/* Forecast on a copy of stock; actual deduction only happens on cooking confirmation. */
(function (root) {
  'use strict';
  const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const plusDay = (key, n) => { const d = new Date(key + 'T12:00:00'); d.setDate(d.getDate() + n); return dateKey(d); };
  function build({ recipes, stock, people, count, start, today, matches, excluded = [], overrides = [], dictionary = [], catalog = [] }) {
    if (!Number.isInteger(people) || people < 1 || people > 10 || !Number.isInteger(count) || count < 1 || count > 7 || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(new Date(start + 'T12:00:00').getTime()) || plusDay(start, 0) !== start || start < today) throw new Error('인원수(1~10), 끼니 수(1~7), 오늘 이후의 시작일을 확인해 주세요.');
    let virtualStock = stock.map(s => ({...s}));
    const candidates = recipes.filter(p => ['J', 'A', 'U'].includes(p.flag) && p.meta && !['dummy'].includes(p.meta.source) && !(p.meta.dummy || []).some(k => ['name', 'ingredientsText', 'steps'].includes(k)) && p.ingredientsText && p.steps?.length && !excluded.includes(p.id));
    const usedIds = new Set(), covered = new Set();
    const meals = [];
    for (let i = 0; i < count; i++) {
      const date = plusDay(start, i);
      const safe = virtualStock.filter(i => !i.demo && (!i.exp || i.exp >= date));
      const rows = candidates.filter(p => !usedIds.has(p.id)).map(p => {
        const hits = safe.filter(s => matches(p, s.name));
        // A recipe requiring a known expired fridge ingredient is not proposed for that day.
        if (stock.some(s => !s.demo && s.exp && s.exp < date && matches(p, s.name) && !safe.some(t => root.InventoryEngine.canonical(t.name, dictionary) === root.InventoryEngine.canonical(s.name, dictionary)))) return null;
        const assessment = root.InventoryEngine.evaluate(p, virtualStock, {people, date, overrides, dictionary, catalog});
        if (assessment.servings != null && assessment.status === 'shortage') return null;
        const urgent = hits.filter(s => s.exp && s.exp <= plusDay(date, 2));
        const fresh = hits.filter(s => !covered.has(s.name));
        const linked = hits.filter(s => covered.has(s.name));
        return { p, hits, urgent, linked, assessment, score: urgent.length * 100 + fresh.length * 10 + linked.length * 3 };
      }).filter(r => r && r.hits.length).sort((a, b) => Number(b.assessment.status === 'ready') - Number(a.assessment.status === 'ready') || b.score - a.score || String(a.p.id).localeCompare(String(b.p.id)));
      const row = rows[0];
      if (!row) { meals.push({ date, recipeId: null, reason: '기한과 재료 조건에 맞는 중복 없는 레시피가 없어요.' }); continue; }
      usedIds.add(row.p.id);
      const verified = row.assessment.status === 'ready';
      const predictedUse = verified ? row.assessment.rows.map(r => ({name:r.name, amount:r.need, unit:r.unit})) : [];
      if (verified) virtualStock = root.InventoryEngine.consume(virtualStock, predictedUse, {date, dictionary});
      meals.push({ date, recipeId: row.p.id, recipeName: row.p.name, recipeFlag: row.p.flag,
        ingredientsText: row.p.ingredientsText, matched: row.hits.map(s => s.name),
        urgent: row.urgent.map(s => ({ name: s.name, exp: s.exp })), linked: row.linked.map(s => s.name),
        quantityStatus: verified ? 'verified' : 'unverified', remainingQuantity: verified ? virtualStock.map(s => ({name:s.name, qty:s.qty})) : null,
        predictedUse, requirements: row.assessment.rows, missingNames: row.assessment.missingNames, status: 'planned',
        meta: { source: 'calc', real: ['recipeId', 'recipeName', 'recipeFlag', 'ingredientsText'], calc: ['date', 'matched', 'urgent', 'linked', 'quantityStatus'], empty: ['remainingQuantity'] } });
      row.hits.forEach(s => covered.add(s.name));
    }
    return { schemaVersion: 1, flag: 'C', people, count, start, stockSnapshot: stock, excludedRecipeIds: excluded,
      meals, meta: { source: 'calc', calc: ['schemaVersion', 'flag', 'meals'], user: ['people', 'count', 'start', 'stockSnapshot', 'excludedRecipeIds'],
        note: 'C=계산 결과. 확인된 기준 인분·단위가 있는 레시피만 가상 재고를 차감하여 예상 잔여량 계산. 미확인은 조건부 추천. 실제 재고는 조리 완료 확인 때만 차감.' } };
  }
  root.MealPlanEngine = { build, dateKey, plusDay };
  if (typeof document === 'undefined') return;
  let plan = null;
  const ownerKey = () => 'meal_plan_' + encodeURIComponent(store.get('user', null)?.id || 'guest');
  let activeOwner = '';
  const status = text => { $('#plan-status').textContent = text; };
  const snapshot = () => JSON.stringify(fridge());
  function render() {
    $('#plan-export').hidden = !plan;
    $('#plan-rebuild').hidden = !plan || plan.people !== 1;
    if (!plan) { $('#plan-results').innerHTML = ''; return; }
    $('#plan-results').innerHTML = `<p>${esc(plan.start)}부터 ${plan.people === 1 ? '혼자 먹는 한 끼' : '이전 '+plan.people+'인분 계획'} · ${plan.count}끼 <span class="chip">C 계산</span></p>` + plan.meals.map((m, i) => !m.recipeId
      ? `<article class="box"><h3>${i + 1}번째 끼니 · ${esc(m.date)}</h3><p>${esc(m.reason)}</p></article>`
      : `<article class="box"><h3>${i + 1}번째 끼니 · ${esc(m.date)}</h3><h3>${esc(m.recipeName)} <span class="chip">${esc(m.recipeFlag)}</span></h3>
      <p>활용할 보유 재료: ${m.matched.map(esc).join(' · ')}</p>
      ${m.urgent.length ? `<p class="t-urgent">기한 우선: ${m.urgent.map(s => `${esc(s.name)} (${esc(s.exp)})`).join(' · ')}</p>` : ''}
      ${m.linked.length ? `<p>앞 끼니와 이어 쓰는 재료: ${m.linked.map(esc).join(' · ')} — 실제 남은 양 확인 필요</p>` : ''}
      <details><summary>전체 필요 재료 확인</summary><p>${esc(m.ingredientsText)}</p><p class="mu">미보유 재료와 양념, 실제 보유량을 확인해 주세요.</p></details>
      <p class="mu">${m.status === 'completed' ? '조리 완료 · 실제 사용량 반영됨' : m.quantityStatus === 'verified' ? '1인분 수량 기준으로 계산한 계획' : '기준 인분·수량 확인 필요 · 조건부 추천'}</p>
      ${m.predictedUse?.length ? `<details><summary>예상 사용량·남은 양 보기</summary><p>사용 예정: ${m.predictedUse.map(q=>`${esc(q.name)} ${q.amount}${esc(q.unit)}`).join(' · ')}</p><p>예상 잔여량: ${m.remainingQuantity.length ? m.remainingQuantity.map(q=>`${esc(q.name)} ${esc(q.qty)}`).join(' · ') : '보유 재료 모두 사용 예정'}</p></details>` : ''}
      ${m.missingNames?.length ? `<p class="mu">추가 확인할 재료: ${m.missingNames.map(esc).join(' · ')}</p>` : ''}
      <button class="btn" data-go="detail" data-id="${Number(m.recipeId)}">레시피 보기</button>
      ${m.status !== 'completed' && plan.people === 1 ? `<button class="btn dk" type="button" data-plan-cook="${i}">조리 완료 · 사용량 확인</button><button class="btn" type="button" data-plan-replace="${i}">이 요리 제외하고 다시 추천</button>` : ''}</article>`).join('');
    $('#plan-rebuild').hidden = !plan || plan.people !== 1;
  }
  function refresh() {
    const key = ownerKey();
    {
      activeOwner = key;
      const saved = store.get(key, null);
      plan = saved?.schemaVersion === 1 && Array.isArray(saved.meals) ? saved : null;
      if (plan) { $('#plan-count').value = plan.count; $('#plan-start').value = plan.start; }
    }
    $('#plan-start').min = dateKey(new Date());
    if (!$('#plan-start').value) $('#plan-start').value = dateKey(new Date());
    $('#plan-generate').disabled = !recipes.length;
    status(loadFailed ? '레시피를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.' : !recipes.length ? '레시피를 불러오는 중이에요. 잠시 후 다시 열어 주세요.' : plan && (JSON.stringify(plan.stockSnapshot) !== snapshot() || plan.start < dateKey(new Date())) ? '냉장고 또는 날짜가 바뀌었어요. 현재 냉장고로 계획을 다시 만들어 주세요.' : '실제 레시피와 직접 등록한 재료를 사용해요. 가상 레시피·예시 냉장고는 제외해요.');
    if (plan && plan.people !== 1) status('이전 여러 인분 계획은 보관했어요. 혼자 먹는 한 끼 기준으로 새 계획을 만들어 주세요.');
    render();
  }
  function generate(excluded = [], retainCompleted = false) {
    try {
      if (!recipes.length) throw new Error('레시피를 먼저 불러와 주세요.');
      if (retainCompleted && plan?.people !== 1) throw Error('1인분 기준으로 새 계획을 만들어 주세요.');
      const completed = retainCompleted && plan ? plan.meals.filter(m => m.status === 'completed') : [];
      const requested = Number($('#plan-count').value), people = 1, start = $('#plan-start').value;
      if (!Number.isInteger(requested) || requested < 1 || requested > 7 || !Number.isInteger(people) || people < 1 || people > 10 || (!retainCompleted && start < dateKey(new Date()))) throw Error('끼니 수·시작일을 확인해 주세요.');
      if (completed.length > requested) throw Error('끼니 수를 완료한 끼니 수 이상으로 설정해 주세요.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(new Date(start+'T12:00:00').getTime()) || plusDay(start,0)!==start) throw Error('올바른 시작일을 입력해 주세요.');
      if (requested > completed.length && !fridge().some(s => !s.demo && (!s.exp || s.exp >= dateKey(new Date())))) throw new Error('남은 계획에 사용할 재료가 없어요. 냉장고에 재료를 등록해 주세요.');
      const nextStart = completed.length ? [dateKey(new Date()), plusDay(start, completed.length), plusDay(completed[completed.length-1].date, 1)].sort().pop() : start;
      const exclusions = [...new Set([...excluded, ...completed.map(m => m.recipeId)])];
      const next = requested === completed.length ? {schemaVersion:1,flag:'C',people,count:requested,start,stockSnapshot:fridge(),excludedRecipeIds:exclusions,meals:[],meta:{source:'calc'}} : build({ recipes, stock: fridge(), people, count: requested - completed.length, start: nextStart, today: dateKey(new Date()), matches: usesIng, excluded: exclusions, overrides: store.get('recipe_quantities', []), dictionary: ingredientsDict, catalog:sourceFiles.get('recipe_quantities_calculated.json')||[] });
      plan = {...next, count:requested, start, meals:[...completed,...next.meals]};
      plan.meta.calc ||= [];
      plan.createdAt = new Date().toISOString(); plan.meta.calc.push('createdAt');
      plan = normalizeStored(ownerKey(), plan);
      store.set(ownerKey(), plan);
      const persisted = store.get(ownerKey(), null)?.createdAt === plan.createdAt;
      render();
      status(`${plan.meals.filter(m => m.recipeId).length}/${plan.count}끼를 제안했어요. ${persisted ? '이 브라우저에 저장했어요.' : '저장 공간 문제로 보관하지 못했어요. JSON을 내려받아 주세요.'} 냉장고 수량은 변경하지 않았어요.`);
    } catch (e) { status(e.message); }
  }
  $('#plan-form').addEventListener('submit', e => { e.preventDefault(); generate(); });
  $('#plan-results').addEventListener('click', e => {
    const cook = e.target.closest('[data-plan-cook]');
    if (cook && plan) {
      if (plan.people !== 1) { status('1인분 기준으로 새 계획을 만들어 주세요.'); return; }
      const index = Number(cook.dataset.planCook);
      const first = plan.meals.findIndex(m => m.recipeId && m.status !== 'completed');
      if (index !== first) { status('앞 끼니의 조리 완료를 먼저 기록해 주세요.'); return; }
      root.inventoryUI.openCook(plan.meals[index].recipeId, {key:ownerKey(), index, createdAt:plan.createdAt, people:plan.people});
      return;
    }
    const b = e.target.closest('[data-plan-replace]'); if (!b || !plan) return;
    const m = plan.meals[Number(b.dataset.planReplace)];
    generate([...new Set([...plan.excludedRecipeIds, m.recipeId])], true);
  });
  $('#plan-rebuild').addEventListener('click', () => generate(plan?.excludedRecipeIds || [], true));
  $('#plan-export').addEventListener('click', () => {
    if (!plan) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `meal-plan-${plan.start}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  root.mealPlanner = { refresh };
  refresh();
  // Refresh when asynchronous source loading completes, including failure/empty states.
  document.addEventListener('meal-data-ready', refresh);
})(globalThis);
