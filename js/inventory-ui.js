/* Quantity confirmation, cooking transactions and one-ingredient shopping. */
(function(root){
  'use strict';
  const E=root.InventoryEngine;
  let cooking=null, sequence=0;
  const owner=()=>store.get('user',null)?.id || 'guest';
  const overrides=()=>store.get('recipe_quantities',[]);
  const options=(people=1,date=E.day(new Date()))=>({people,date,overrides:overrides(),dictionary:ingredientsDict,catalog:sourceFiles.get('recipe_quantities_calculated.json')||[]});
  const amount=q=>q?.amount!=null?`${q.amount}${q.unit || ''}`:'수량 확인 필요';
  const message=(id,text)=>{$(id).textContent=text;};
  function openFridge(){go('my'); document.querySelector('#my [data-tab="fr"]')?.click();}
  function refresh(){
    const urgent=fridge().filter(isUrgent).length;
    $('#fridge-badge').textContent=urgent?String(urgent):'';
    $('#fridge-badge').hidden=!urgent;
    $('#top-fridge').setAttribute('aria-label',`냉장고${urgent?`, 보관 기한 임박 재료 ${urgent}종`:''}`);
    $('#home-expiry').hidden=!urgent;
    $('#home-expiry-text').textContent=`보관 기한이 임박한 재료 ${urgent}종이 있어요.`;
    if ($('#cook').classList.contains('on') && !cooking) { $('#cook-submit').disabled=true; message('#cook-status','레시피 상세에서 조리 완료를 시작해 주세요.'); }
    if ($('#shopping').classList.contains('on')) renderShopping();
  }
  function detail(recipe,resetEditor=true){
    const base=E.requirements(recipe,overrides(),ingredientsDict,sourceFiles.get('recipe_quantities_calculated.json')||[]);
    $('#quantity-save').dataset.recipeId=String(recipe.id);
    $('#detail-cook').dataset.cookRecipe=String(recipe.id);
    if(resetEditor){$('#quantity-servings').value=base.servings||'';$('#quantity-editor').value=base.rows.map(r=>r.amount==null?r.raw:`${r.name} ${r.amount}${r.unit}`).join('\n');}
    const people=1;
    const assessment=E.evaluate(recipe,fridge(),options(people));
    const labels={ready:'보유량으로 조리 가능',shortage:'부족한 재료가 있어요',unknown:'수량 기준 확인 필요'};
    $('#quantity-status').textContent=labels[assessment.status];
    $('#quantity-rows').innerHTML=assessment.rows.map(r=>`<li><b>${esc(r.name)}</b> · 필요 ${r.need==null?'수량 확인 필요':esc(amount({amount:r.need,unit:r.unit}))} · 보유 ${r.available==null?'수량·단위 확인 필요':esc(amount({amount:r.available,unit:r.unit}))}${r.missing?' · 미보유':r.shortage>0?` · ${esc(amount({amount:r.shortage,unit:r.unit}))} 부족`:''}</li>`).join('');
    message('#quantity-message','');
  }
  function saveQuantities(){
    const recipeId=Number($('#quantity-save').dataset.recipeId), servings=Number($('#quantity-servings').value);
    if(!Number.isFinite(servings)||servings<0.1||servings>100){message('#quantity-message','원문 수량의 기준 인분을 0.1~100 범위로 입력해 주세요.');return;}
    const lines=$('#quantity-editor').value.split('\n').map(s=>s.trim()).filter(Boolean);
    const rows=lines.map(s=>provenance(E.parseLine(s,ingredientsDict),'user','U','user',{parsed:'calc'}));
    if(!rows.length||rows.some(r=>r.amount==null||!r.name)){message('#quantity-message','각 줄을 ‘재료 이름 수량단위’로 입력해 주세요. 예: 두부 150g');return;}
    const record=provenance({recipeId,servings,ingredients:rows,updatedAt:new Date().toISOString(),confirmedBy:owner(),meta:{note:'사용자가 직접 확인한 기준 인분과 재료 수량. 공공 API의 검증값이 아님.'}},'user','U','user',{updatedAt:'calc',confirmedBy:'calc'});
    const next=[...overrides().filter(r=>r.recipeId!==recipeId),record];
    try{localStorage.setItem('ft_recipe_quantities',JSON.stringify(next));detail(recipes.find(r=>r.id===recipeId));message('#quantity-message','원본 수량 기준을 저장했어요. 1인분으로 환산해 비교해요.');}
    catch{message('#quantity-message','저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');}
  }
  function renderShopping(){
    const people=1;
    const rows=E.buyOne(recipes,fridge(),options(people));
    const ready=recipes.filter(r=>E.evaluate(r,fridge(),options(people)).status==='ready').length;
    message('#shopping-status',fridge().length?`현재 수량으로 조리 가능한 레시피 ${ready}건 · 추가할 재료 ${rows.length}종`:'냉장고에 보유 재료를 먼저 등록해 주세요.');
    $('#shopping-results').innerHTML=rows.length?rows.slice(0,10).map(row=>`<article class="box"><h3>${esc(row.name)}만 더 준비하면</h3>
      <p>보유 재료 ${row.existingNames.length}종을 활용하는 레시피 ${row.recipes.length}건과 연결돼요.</p>
      ${row.urgentNames.length?`<p class="t-urgent">임박 재료 활용: ${row.urgentNames.map(esc).join(' · ')}</p>`:''}
      <details><summary>연결 레시피·필요량 보기</summary>${row.recipes.map(r=>`<div class="shopping-recipe"><button class="more-link" data-go="detail" data-id="${r.recipeId}">${esc(r.recipeName)}</button><p class="mu">${r.quantityVerified?`추가량 ${r.needed.map(q=>esc(amount(q))).join(' · ')} · 다른 재료 수량 확인됨`:'재료명 기준 추천 · 기준 인분·수량·단위 확인 필요'}</p></div>`).join('')}</details></article>`).join(''):emptyState({title:'한 가지 재료로 연결할 추천이 없어요',hint:'양념과 물도 실제 보유한 재료만 계산해요. 냉장고의 재료와 양을 확인해 주세요.',actions:[]});
    const result=provenance({createdAt:new Date().toISOString(),people,actorId:owner(),stockSnapshot:fridge(),readyBefore:ready,recommendations:rows},'calc','C','calc',{people:'calc',stockSnapshot:'user'});
    store.set('shopping_recommendations',[result]);
  }
  function openCook(recipeId,context=null){
    const recipe=recipes.find(r=>r.id===recipeId);if(!recipe)return;
    cooking={recipeId,context,token:`cook-${Date.now()}-${++sequence}`,actorId:owner(),stockSnapshot:JSON.stringify(fridge()),complete:false};

    $('#cook-title').textContent=recipe.name;
    $('#cook-submit').disabled=false;
    $('#cook-post').hidden=true;
    message('#cook-status','실제로 사용한 양을 입력하면 냉장고에 반영해요.');
    renderCookingRows();go('cook');
  }
  function renderCookingRows(){
    if(!cooking)return;
    const recipe=recipes.find(r=>r.id===cooking.recipeId), assessment=E.evaluate(recipe,fridge(),options(1));
    const stock=fridge();
    const matched=stock.map((s,i)=>({s,i,q:E.stockAmount(s)})).filter(({s})=>!s.demo&&(!s.exp||s.exp>=E.day(new Date()))&&assessment.rows.some(r=>r.name===E.canonical(s.name,ingredientsDict)));
    $('#cook-rows').innerHTML=matched.length?matched.map(({s,i,q})=>{
      const need=assessment.rows.find(r=>r.name===E.canonical(s.name,ingredientsDict)&&r.unit===q?.unit)?.need;
      return `<div class="cook-row" data-stock-index="${i}"><label>${esc(s.name)} <span class="mu">보유 ${esc(s.qty||'수량 없음')}</span>${q&&q.amount>0?`<input class="in cook-amount" type="number" min="0" max="${q.amount}" step="any" placeholder="실제 사용량" value="${need!=null&&need<=q.amount?need:''}" aria-label="${esc(s.name)} 실제 사용량">${esc(q.unit)}`:'<p class="mu">냉장고에서 수량을 숫자·단위로 먼저 수정해 주세요.</p>'}</label></div>`;
    }).join(''):'<p>수량을 기록할 보유 재료가 없어요. 냉장고에 실제 재료를 등록해 주세요.</p>';
  }
  function saveCooking(){
    if(!cooking||cooking.complete)return;
    try{
      if(cooking.actorId!==owner())throw Error('로그인 사용자가 바뀌었어요. 조리 완료 화면을 다시 열어 주세요.');
      if(cooking.stockSnapshot!==JSON.stringify(fridge()))throw Error('냉장고가 바뀌었어요. 화면을 다시 열고 사용량을 확인해 주세요.');
      const people=1;
      const before=fridge(), uses=[];
      for(const row of $$('#cook-rows .cook-row')){
        const input=row.querySelector('.cook-amount');if(!input||!input.value.trim())continue;
        const n=Number(input.value);if(!Number.isFinite(n)||n<0)throw Error('사용량은 0 이상의 숫자로 입력해 주세요.');
        if(n===0)continue;
        const item=before[Number(row.dataset.stockIndex)],q=E.stockAmount(item);
        uses.push(provenance({name:item.name,amount:n,unit:q.unit,urgent:isUrgent(item),dday:dday(item.exp)},'user','U','user',{urgent:'calc',dday:'calc'}));
      }
      if(!uses.length)throw Error('실제로 사용한 재료의 양을 한 가지 이상 입력해 주세요.');
      const after=E.consume(before,uses,{dictionary:ingredientsDict});
      const oldLogs=store.get('cooking_logs',[]);
      if(oldLogs.some(r=>r.id===cooking.token))return;
      const record=provenance({id:cooking.token,recipeId:cooking.recipeId,people,actorId:owner(),createdAt:new Date().toISOString(),uses,stockBefore:before,stockAfter:after,plan:cooking.context},'user','U','user',{id:'calc',people:'calc',actorId:'calc',createdAt:'calc',stockBefore:'calc',stockAfter:'calc',plan:'calc'});
      const changes={fridge:after,cooking_logs:[...oldLogs,record],flog:[...store.get('flog',[]),...uses.map(u=>({name:u.name,t:record.createdAt,kind:'used',urgent:u.urgent,amount:u.amount,unit:u.unit,cookingLogId:record.id}))]};
      if(cooking.context){
        const plan=store.get(cooking.context.key,null),index=cooking.context.index;
        if(!plan||plan.createdAt!==cooking.context.createdAt||plan.meals[index]?.recipeId!==cooking.recipeId||plan.meals[index]?.status==='completed')throw Error('식사 계획이 변경되었거나 이미 완료된 끼니예요.');
        plan.meals[index]={...plan.meals[index],status:'completed',cookingLogId:record.id};
        changes[cooking.context.key]=plan;
      }
      // Commit related JSON keys together; restore originals if any write fails.
      const originals=new Map(Object.keys(changes).map(k=>[k,localStorage.getItem('ft_'+k)]));
      try{for(const [key,value] of Object.entries(changes))localStorage.setItem('ft_'+key,JSON.stringify(normalizeStored(key,value)));}
      catch(e){for(const [key,value] of originals){try{if(value===null)localStorage.removeItem('ft_'+key);else localStorage.setItem('ft_'+key,value);}catch{}}throw Error('저장하지 못해 재고 반영을 취소했어요. 저장 공간을 확인해 주세요.');}
      cooking.complete=true;$('#cook-submit').disabled=true;
      $('#cook-post').hidden=owner()==='guest';
      message('#cook-status','조리 완료를 기록하고 재고를 반영했어요. 같은 기록은 다시 차감하지 않아요.');
      fridgeChanged();refresh();root.mealPlanner?.refresh();
    }catch(e){message('#cook-status',e.message);}
  }
  function renderPostCooking(){
    const id=Number($('#w-recipe').value);
    const rows=store.get('cooking_logs',[]).filter(r=>r.recipeId===id&&r.actorId===owner()&&!posts.some(p=>p.cookingLogId===r.id));
    $('#w-used').innerHTML=`<label for="w-cooking-record">연결할 조리 완료 기록 (선택)</label><select class="in" id="w-cooking-record"><option value="">기록 연결 안 함</option>${rows.map(r=>`<option value="${esc(r.id)}">${esc(new Date(r.createdAt).toLocaleString('ko-KR'))} · 재료 ${r.uses.length}종</option>`).join('')}</select><p class="mu">재고 차감은 조리 완료에서 한 번만 진행해요. 기록을 연결하면 활용한 재료가 게시물에 표시돼요.</p>`;
  }
  function postUsage(recipeId){
    const id=$('#w-cooking-record')?.value;
    if(!id)return {id:null,uses:[]};
    const record=store.get('cooking_logs',[]).find(r=>r.id===id&&r.recipeId===recipeId&&r.actorId===owner());
    if(!record||posts.some(p=>p.cookingLogId===id))throw Error('연결할 수 없는 조리 기록이에요. 레시피를 다시 선택해 주세요.');
    return {id,uses:record.uses.map(u=>({name:u.name,urgent:u.urgent,dday:u.dday,amount:u.amount,unit:u.unit}))};
  }
  document.addEventListener('click',e=>{
    const fridgeButton=e.target.closest('[data-open-fridge]');if(fridgeButton){openFridge();return;}
    const cookButton=e.target.closest('[data-cook-recipe]');if(cookButton){openCook(Number(cookButton.dataset.cookRecipe));return;}
    if(e.target.closest('#quantity-save'))saveQuantities();
    if(e.target.closest('#cook-post')&&cooking?.complete){writeRecipeId=cooking.recipeId;go('write');const select=$('#w-cooking-record');if(select)select.value=cooking.token;}
  });
  $('#cook-form').addEventListener('submit',e=>{e.preventDefault();saveCooking();});
  $('#shopping-form').addEventListener('submit',e=>{e.preventDefault();renderShopping();});
  document.addEventListener('meal-data-ready',refresh);
  root.inventoryUI={refresh,detail,openCook,renderShopping,renderPostCooking,postUsage,overrides,options};
  refresh();
})(globalThis);
