/* Static JSON, user input, live API responses and calculated results stay separate. */
let sourceFiles = new Map();
let sourceLoadErrors = [];
let sourceLoadPromise;
const SOURCE_GROUPS = ['real', 'user', 'api', 'calc', 'empty'];
function provenance(record, source, flag, defaults = 'user', overrides = {}) {
  const original = record.meta || {};
  const out = { ...record, flag };
  const meta = { source, real: [], user: [], api: [], calc: [], empty: [], note: original.note || '' };
  function visit(path, value, group) {
    meta[value == null ? 'empty' : group].push(path);
    if (Array.isArray(value)) value.forEach((v, i) => visit(`${path}[${i}]`, v, group));
    else if (value && typeof value === 'object') Object.entries(value).filter(([k]) => k !== 'meta').forEach(([k, v]) => {
      const nested = value.meta && SOURCE_GROUPS.find(g => g !== 'empty' && (value.meta[g] || []).includes(k));
      visit(`${path}.${k}`, v, nested || group);
    });
  }
  Object.entries(out).filter(([k]) => k !== 'meta').forEach(([k, v]) => {
    const old = SOURCE_GROUPS.find(g => g !== 'empty' && (original[g] || []).includes(k));
    visit(k, v, overrides[k] || (k === 'flag' ? 'calc' : old || defaults));
  });
  out.meta = meta;
  return out;
}
function normalizeStored(key, value) {
  if (!Array.isArray(value)) {
    if (key.startsWith('meal_plan_') && value && typeof value === 'object') return provenance(value, 'calc', 'C', 'calc', { people: value.people === 1 ? 'calc' : 'user', count: 'user', start: 'user', stockSnapshot: 'user', excludedRecipeIds: 'user' });
    return value;
  }
  if (!['recipes', 'posts', 'fridge', 'flog', 'api_responses', 'recipe_quantities', 'cooking_logs', 'shopping_recommendations'].includes(key)) return value;
  return value.filter(r => r && typeof r === 'object' && !r.demo && r.flag !== 'D' && !(r.meta?.dummy || []).some(k => ['name', 'ingredientsText', 'steps'].includes(k))).map(r => {
    const api = key === 'api_responses';
    if (key === 'shopping_recommendations') return provenance(r, 'calc', 'C', 'calc', { people: r.people === 1 ? 'calc' : 'user', stockSnapshot: 'user' });
    if (key === 'fridge') { const q = InventoryEngine.stockAmount(r); r = { ...r, amount: q?.amount ?? null, unit: q?.unit ?? null }; }
    return provenance(r, api ? 'api' : 'user', api ? 'A' : 'U', api ? 'calc' : 'user', {
      id: 'calc', flag: 'calc', createdAt: 'calc', at: 'calc', t: 'calc', used: 'calc', hashtag: 'calc', recipeName: 'calc', authorId: 'calc', urgent: 'calc', expired: 'calc', dday: 'calc',
      ...(key === 'fridge' ? { amount: 'calc', unit: 'calc', quantityOrigin: 'calc', qty: r.quantityOrigin === 'calc' ? 'calc' : 'user' } : {}),
      ...(key === 'cooking_logs' ? { people: r.people === 1 ? 'calc' : 'user', stockBefore: 'calc', stockAfter: 'calc', plan: 'calc', actorId: 'calc' } : {}),
      ...(api ? { raw: 'api', vals: 'api', recipeId: 'real', recipeName: 'real', seq: 'api', count: 'api' } : {})
    });
  });
}
async function loadSourceFiles() {
  if (sourceLoadPromise) return sourceLoadPromise;
  sourceLoadPromise = (async () => {
    const response = await fetch((typeof APP_ROOT === 'string' ? APP_ROOT : './') + 'data/data_manifest.json');
    if (!response.ok) throw new Error('data_manifest.json HTTP ' + response.status);
    const manifest = await response.json();
    sourceFiles.set('data_manifest.json', manifest);
    await Promise.all(manifest.files.map(async entry => {
      try {
        const r = await fetch((typeof APP_ROOT === 'string' ? APP_ROOT : './') + 'data/' + entry.file);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const rows = await r.json();
        if (!Array.isArray(rows)) throw new Error('배열 형식이 아님');
        sourceFiles.set(entry.file, rows);
      } catch (e) { sourceLoadErrors.push(`${entry.file}: ${e.message}`); }
    }));
  })().catch(e => { sourceLoadErrors.push(e.message); });
  return sourceLoadPromise;
}
function apiTarget(recipe) {
  return (sourceFiles.get('recipes_api_requests.json') || []).some(r => r.recipeId === recipe.id);
}
function hydrateUserFiles() {
  const names = { recipes_user: 'recipes', posts_user: 'posts', fridge_user: 'fridge', fridge_history_user: 'flog', api_responses: 'api_responses', recipe_quantities_user: 'recipe_quantities', cooking_logs_user: 'cooking_logs', shopping_recommendations_calculated: 'shopping_recommendations' };
  for (const [file, key] of Object.entries(names)) {
    const rows = sourceFiles.get(file + '.json') || [];
    if (localStorage.getItem('ft_' + key) === null && rows.length) store.set(key, rows);
  }
  for (const item of sourceFiles.get('interactions_user.json') || []) {
    if (['fav', 'plikes', 'pliked', 'pvotes', 'pvoted', 'deleted_recipe_ids', 'deleted_post_ids'].includes(item.key) && localStorage.getItem('ft_' + item.key) === null) store.set(item.key, item.value);
  }
  for (const plan of sourceFiles.get('meal_plans_calculated.json') || []) {
    const key = plan.ownerKey;
    if (typeof key === 'string' && key.startsWith('meal_plan_') && localStorage.getItem('ft_' + key) === null) store.set(key, plan);
  }
}
function recordApiResponse(recipe, result) {
  const record = provenance({ recipeId: recipe.id, recipeName: recipe.name, service: 'COOKRCP01',
    status: result.ok ? 'success' : 'error', requestedAt: result.at.toISOString(),
    reason: result.reason || null, seq: result.seq || null, count: result.count ?? null,
    vals: result.vals || null, raw: result.raw || null,
    meta: { note: 'API의 실제 성공/실패 기록. API 키와 인증정보는 저장하지 않음. 원본 ID·이름 동시 일치 시만 응답 적용.' }
  }, 'api', 'A', 'calc', { recipeId: 'real', recipeName: 'real', vals: 'api', raw: 'api', seq: 'api', count: 'api' });
  const previous = store.get('api_responses', []).filter(r => r.recipeId !== recipe.id);
  store.set('api_responses', [...previous, record]);
}
function auditProvenance(record) {
  const problems = [], m = record.meta || {};
  if ({ json: 'J', api: 'A', user: 'U', calc: 'C' }[m.source] !== record.flag) problems.push('flag/source 불일치');
  if ((m.dummy || []).length) problems.push('더미 필드 존재');
  function visit(path, value) {
    const groups = SOURCE_GROUPS.filter(g => (m[g] || []).includes(path));
    if (groups.length !== 1) problems.push(path + ': 분류 누락 또는 중복');
    if (value === null && !groups.includes('empty')) problems.push(path + ': null 분류 오류');
    if (Array.isArray(value)) value.forEach((v, i) => visit(`${path}[${i}]`, v));
    else if (value && typeof value === 'object') Object.entries(value).filter(([k]) => k !== 'meta').forEach(([k, v]) => visit(`${path}.${k}`, v));
  }
  Object.entries(record).filter(([k]) => k !== 'meta').forEach(([k, v]) => visit(k, v));
  return problems;
}
function currentDataFiles() {
  const files = Object.fromEntries(sourceFiles);
  files['recipes_user.json'] = normalizeStored('recipes', recipes.filter(r => r.flag === 'U'));
  files['posts_user.json'] = normalizeStored('posts', posts);
  files['fridge_user.json'] = store.get('fridge', []);
  files['recipe_quantities_user.json'] = store.get('recipe_quantities', []);
  files['cooking_logs_user.json'] = store.get('cooking_logs', []);
  files['shopping_recommendations_calculated.json'] = store.get('shopping_recommendations', []);
  files['fridge_history_user.json'] = store.get('flog', []);
  files['api_responses.json'] = store.get('api_responses', []);
  files['interactions_user.json'] = ['fav', 'plikes', 'pliked', 'pvotes', 'pvoted', 'deleted_recipe_ids', 'deleted_post_ids'].map(key => provenance({ key, value: store.get(key, ['plikes', 'pvotes'].includes(key) ? {} : []) }, 'user', 'U'));
  const plans = [];
  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (!storageKey.startsWith('ft_meal_plan_')) continue;
    const plan = store.get(storageKey.slice(3), null);
    if (plan) plans.push(provenance({ ...plan, ownerKey: storageKey.slice(3) }, 'calc', 'C', 'calc', { people: plan.people === 1 ? 'calc' : 'user', count: 'user', start: 'user', stockSnapshot: 'user', excludedRecipeIds: 'user', ownerKey: 'calc' }));
  }
  files['meal_plans_calculated.json'] = plans;
  files['statistics_calculated.json'] = posts.filter(post => !post.demo).map(post => provenance({ postId: post.id, ...postPoints(post), createdAt: post.createdAt }, 'calc', 'C', 'calc'));
  if (files['data_manifest.json']) files['data_manifest.json'] = provenance({ ...files['data_manifest.json'], files: files['data_manifest.json'].files.map(e => ({ ...e, count: (files[e.file] || []).length, storage: ['recipes_existing.json', 'recipes_api_requests.json', 'ingredients_dictionary.json', 'recipe_ingredients_links.json', 'ingredient_substitutions.json', 'recipe_quantities_calculated.json'].includes(e.file) ? 'static_json' : 'browser_json' })) }, 'calc', 'C', 'calc');
  return files;
}
function downloadJSON(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function renderDataSpecification() {
  $('#spec-body').textContent = 'JSON 파일을 확인하고 있어요…';
  await loadSourceFiles();
  const files = currentDataFiles();
  const manifest = files['data_manifest.json'];
  if (!manifest) { $('#spec-body').textContent = '데이터 명세를 불러오지 못했어요: ' + sourceLoadErrors.join(' / '); return; }
  const states = store.get('api_responses', []);
  const issues = Object.entries(files).flatMap(([name, rows]) => (Array.isArray(rows) ? rows : [rows]).flatMap((r, i) => auditProvenance(r).map(error => `${name}[${i}]: ${error}`)));
  $('#spec-body').innerHTML = `<div class="box"><h3>출처별 데이터</h3><p>J 저장 JSON · A 외부 API · U 사용자·팀 입력 · C 계산 결과</p>
    <p>레시피 ${recipes.length}건 (저장 JSON ${recipes.filter(r => r.flag === 'J').length} · 사용자 ${recipes.filter(r => r.flag === 'U').length})</p>
    <p>API 조회 대상 ${(files['recipes_api_requests.json'] || []).length}건 · 실제 성공 ${states.filter(s => s.status === 'success').length}건 · 실패 ${states.filter(s => s.status === 'error').length}건</p>
    <p>출처·필드 분류 검사: ${issues.length ? esc(issues.slice(0, 5).join(' / ')) : '누락·중복·플래그 불일치 없음'}</p>
    <p>API 조회 명세는 추가 레시피나 실제 응답이 아닙니다. 원본 JSON은 JavaScript로 읽어 화면에 표시하고, API 응답은 상세에서 요청하여 값마다 별도 표시합니다.</p>
    <p>빈 배열은 등록·수집 데이터가 없다는 뜻입니다. 브라우저에 저장한 내용이 정적 파일에 자동 반영되지는 않습니다. 아래에서 현재 JSON을 확인·저장할 수 있습니다.</p></div>
    ${sourceLoadErrors.length ? `<p role="alert">일부 JSON 로드 실패: ${esc(sourceLoadErrors.join(' / '))}</p>` : ''}` + manifest.files.map(entry => {
      const rows = files[entry.file];
      return `<article class="box"><h3>${esc(entry.title)} <span class="chip">${esc(entry.flag)}</span></h3><p><code>${esc(entry.file)}</code> · ${rows ? rows.length : '로드 실패'}건</p>
        <details><summary>JavaScript로 읽은 JSON 보기</summary><pre class="data-json">${esc(JSON.stringify(rows ?? null, null, 2))}</pre></details>
        ${rows ? `<button class="btn" type="button" data-download-json="${esc(entry.file)}">이 JSON 내려받기</button>` : ''}</article>`;
    }).join('');
}
document.addEventListener('click', e => {
  const file = e.target.closest('[data-download-json]')?.dataset.downloadJson;
  if (file) downloadJSON(file, currentDataFiles()[file]);
  if (e.target.closest('#data-export')) {
    const files = currentDataFiles();
    downloadJSON('fridge-data-snapshot.json', provenance({ schemaVersion: 1, exportedAt: new Date().toISOString(), files }, 'calc', 'C', 'calc'));
    $('#data-export-status').textContent = '현재 데이터 묶음을 내려받았습니다. 개별 파일은 각 항목의 내려받기를 이용해 주세요. 비밀번호·로그인 세션·API 키는 포함하지 않습니다.';
  }
});
