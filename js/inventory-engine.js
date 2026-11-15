/* Pure quantity engine: no inferred servings, densities or package weights. */
(function (root) {
  'use strict';
  const UNITS = ['g','kg','mL','L','개','모','장','대','쪽','포기','공기','팩','봉','캔','컵','큰술','작은술','줌','마리','송이','인분'];
  const unitPattern = '(kg|g|ml|mL|ML|l|L|개|모|장|대|쪽|포기|공기|팩|봉|캔|컵|큰술|작은술|줌|마리|송이|인분)';
  const numberPattern = '(\\d+(?:\\.\\d+)?(?:\\s+\\d+\\/\\d+)?|\\d+\\/\\d+)';
  const amountRE = new RegExp('^' + numberPattern + '\\s*' + unitPattern + '$');
  const lineRE = new RegExp('^(.+?)\\s+' + numberPattern + '\\s*' + unitPattern + '$');
  const round = n => Number(Number(n).toFixed(6));
  const day = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const later = (date,n) => { const d=new Date(date+'T12:00:00'); d.setDate(d.getDate()+n); return day(d); };
  function number(text) {
    const parts=String(text).trim().split(/\s+/);
    const values=parts.map(s => { if (!s.includes('/')) return Number(s); const [a,b]=s.split('/').map(Number); return b>0 ? a/b : NaN; });
    return values.every(Number.isFinite) ? values.reduce((a,b)=>a+b,0) : NaN;
  }
  function normalize(amount,unit) {
    if(amount===null||amount===undefined||String(amount).trim()==='')return null;
    amount=Number(amount);
    if (!Number.isFinite(amount) || amount<0 || !UNITS.includes(unit)) return null;
    const converted=round(amount*((unit==='kg'||unit==='L')?1000:1));
    if(!Number.isFinite(converted))return null;
    return {amount:converted,unit:unit==='kg'?'g':unit==='L'?'mL':unit};
  }
  const unitName = u => /^ml$/i.test(u) ? 'mL' : /^l$/i.test(u) ? 'L' : u;
  function parseAmount(text) {
    const match=String(text || '').trim().match(amountRE);
    return match ? normalize(number(match[1]),unitName(match[2])) : null;
  }
  function stockAmount(item) {
    // qty is the user's authoritative value; structure is re-derived after edits.
    return parseAmount(item.qty);
  }
  function canonical(name, dictionary=[]) {
    const clean=String(name || '').trim().replace(/\s+/g,' ');
    const key=clean.replace(/\s/g,'');
    const item=dictionary.find(i => [i.name,...(i.aliases || [])].some(n=>String(n).replace(/\s/g,'')===key));
    return item ? item.name : clean;
  }
  function parseLine(raw,dictionary=[]) {
    const text=String(raw).trim();
    const m=text.match(lineRE);
    if (m) {
      const q=normalize(number(m[2]),unitName(m[3]));
      if (q && q.amount>0) return {name:canonical(m[1],dictionary),...q,raw:text,parsed:true};
    }
    // Keep ambiguous original text visible; do not manufacture a quantity.
    const name=text.replace(/\s+\d.*$/,'').replace(/\s+(?:약간|적당량|조금|소량|취향껏)$/,'').trim() || text;
    return {name:canonical(name,dictionary),amount:null,unit:null,raw:text,parsed:false};
  }
  function requirements(recipe,overrides=[],dictionary=[],catalog=[]) {
    const custom=overrides.find(o=>o.recipeId===recipe.id);
    const derived=catalog.find(r=>r.recipeId===recipe.id&&r.sourceText===recipe.ingredientsText);
    const rows=custom?.ingredients || derived?.ingredients || String(recipe.ingredientsText || '').split(/[,\n]/).map(raw=>raw.trim()).filter(Boolean).map(raw=>parseLine(raw,dictionary));
    const servings=Number(custom?.servings ?? recipe.servings);
    const aggregated=new Map();
    for (const row of rows) {
      const name=canonical(row.name,dictionary), q=normalize(row.amount,row.unit);
      const key=name+'|'+(q?.unit || '?');
      const old=aggregated.get(key);
      if (old && q) old.amount=round(old.amount+q.amount);
      else aggregated.set(key,{...row,name,amount:q?.amount ?? null,unit:q?.unit ?? null});
    }
    return {servings:Number.isFinite(servings)&&servings>0 ? servings : null,rows:[...aggregated.values()],source:custom?'user':'calc'};
  }
  function evaluate(recipe,stock,{people=1,date=day(new Date()),overrides=[],dictionary=[],catalog=[]}={}) {
    const base=requirements(recipe,overrides,dictionary,catalog);
    const safe=stock.filter(s=>!s.demo&&(!s.exp||s.exp>=date));
    const rows=base.rows.map(r=>{
      const owned=safe.filter(s=>canonical(s.name,dictionary)===r.name);
      const amounts=owned.map(stockAmount).filter(Boolean);
      const same=amounts.filter(a=>a.unit===r.unit);
      const available=round(same.reduce((sum,q)=>sum+q.amount,0));
      const need=base.servings && r.amount!=null ? round(r.amount*people/base.servings) : null;
      const known=need!=null && (same.length>0 || !owned.length);
      return {...r,need,available:known?available:null,missing:!owned.length,unknown:!known,
        shortage:known?round(Math.max(0,need-available)):null,
        reason:!base.servings?'기준 인분 확인 필요':r.amount==null?'원문 수량 확인 필요':owned.length&&!same.length?'보유량 또는 단위 확인 필요':null};
    });
    const shortage=rows.some(r=>r.shortage>1e-6 || r.missing);
    const unknown=!rows.length || rows.some(r=>r.unknown);
    return {status:shortage?'shortage':unknown?'unknown':'ready',servings:base.servings,rows,missingNames:[...new Set(rows.filter(r=>r.missing||r.shortage>1e-6).map(r=>r.name))]};
  }
  function consume(stock,uses,{date=day(new Date()),dictionary=[]}={}) {
    const next=stock.map(s=>({...s})), combined=new Map();
    for (const u of uses) {
      const q=normalize(u.amount,u.unit);
      if (!q || q.amount<=0) throw Error('사용량은 0보다 큰 수량과 지원 단위로 입력해 주세요.');
      const name=canonical(u.name,dictionary), key=name+'|'+q.unit;
      const old=combined.get(key);
      combined.set(key,{name,unit:q.unit,amount:round(q.amount+(old?.amount||0))});
    }
    for (const u of combined.values()) {
      const candidates=next.filter(s=>canonical(s.name,dictionary)===u.name&&(!s.exp||s.exp>=date)&&stockAmount(s)?.unit===u.unit).sort((a,b)=>(a.exp||'9999').localeCompare(b.exp||'9999'));
      const available=candidates.reduce((sum,s)=>sum+stockAmount(s).amount,0);
      if (available+1e-6<u.amount) throw Error(`${u.name}: 사용량이 보유량보다 많거나 단위가 달라요.`);
      let left=u.amount;
      for (const item of candidates) {
        const before=stockAmount(item), take=Math.min(before.amount,left);
        item.qty=`${round(before.amount-take)}${before.unit}`;
        item.amount=round(before.amount-take);item.unit=before.unit;
        item.quantityOrigin='calc';
        left=round(left-take);
        if (left<=1e-6) break;
      }
    }
    return next.filter(s=>stockAmount(s)?.amount!==0);
  }
  function buyOne(recipes,stock,options={}) {
    const groups=new Map();
    for (const recipe of recipes) {
      if (recipe.flag==='D'||recipe.meta?.source==='dummy') continue;
      const assessment=evaluate(recipe,stock,options);
      if (assessment.missingNames.length!==1) continue;
      const missing=assessment.missingNames[0];
      const owned=assessment.rows.filter(r=>!r.missing && r.name!==missing);
      if (!owned.length) continue;
      const needed=assessment.rows.filter(r=>r.name===missing);
      const verified=assessment.servings!=null && assessment.rows.every(r=>r.name===missing ? r.need!=null&&!r.unknown : !r.unknown&&!(r.shortage>1e-6));
      const group=groups.get(missing)||{name:missing,recipes:[],existingNames:[],urgentNames:[]};
      group.recipes.push({recipeId:recipe.id,recipeName:recipe.name,quantityVerified:verified,needed:needed.map(r=>({amount:r.shortage??r.need,unit:r.unit})),assessment});
      group.existingNames=[...new Set([...group.existingNames,...owned.map(r=>r.name)])];
      group.urgentNames=[...new Set([...group.urgentNames,...stock.filter(s=>!s.demo&&s.exp&&s.exp>=(options.date||day(new Date()))&&s.exp<=later(options.date||day(new Date()),2)&&owned.some(r=>r.name===canonical(s.name,options.dictionary))).map(s=>canonical(s.name,options.dictionary))])];
      groups.set(missing,group);
    }
    return [...groups.values()].sort((a,b)=>b.urgentNames.length-a.urgentNames.length||b.recipes.filter(r=>r.quantityVerified).length-a.recipes.filter(r=>r.quantityVerified).length||b.existingNames.length-a.existingNames.length||b.recipes.length-a.recipes.length||a.name.localeCompare(b.name,'ko'));
  }
  root.InventoryEngine={UNITS,day,later,round,normalize,parseAmount,stockAmount,canonical,parseLine,requirements,evaluate,consume,buyOne};
})(globalThis);
