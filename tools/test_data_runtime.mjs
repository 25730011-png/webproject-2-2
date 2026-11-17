// Isolated DOM/fetch simulation. Does not contact API, Firebase, or real localStorage.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { Blob } from 'node:buffer';
import { setTimeout, clearTimeout } from 'node:timers';
class AbortController { constructor() { this.signal = {}; } abort() {} }
class Event { constructor(type) { this.type = type; } }
const base = new URL('../', import.meta.url);
const html = await fs.readFile(new URL('index.html', base), 'utf8');
const nodes = new Map();
class Node {
  constructor(id = '') { this.id = id; this.value = ''; this.textContent = ''; this.innerHTML = ''; this.dataset = {}; this.style = {}; this.listeners = {}; this.classes = new Set(); this.classList = { contains: c => this.classes.has(c), add: c => this.classes.add(c), remove: c => this.classes.delete(c), toggle: (c, value) => { if (value ?? !this.classes.has(c)) this.classes.add(c); else this.classes.delete(c); } }; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  querySelector(s) { return select(s); }
  querySelectorAll() { return []; }
  reset() {}
  setAttribute() {}
  closest() { return null; }
}
for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) nodes.set('#' + id, new Node(id));
for (const css of ['.tabbar', '.totop']) nodes.set(css, new Node());
function select(css) { assert.ok(nodes.has(css), 'Missing HTML selector ' + css); return nodes.get(css); }
const screens = [...html.matchAll(/<section class="screen" id="([^"]+)"/g)].map(m => nodes.get('#' + m[1]));
const listeners = {};
const dynamicLists = new Map();
const document = { querySelector: select, querySelectorAll: css => dynamicLists.get(css) || (css === '.screen' ? screens : []), documentElement: new Node(),
  addEventListener(type, fn) { (listeners[type] ||= []).push(fn); }, dispatchEvent(e) { for (const fn of listeners[e.type] || []) fn(e); } };
const storage = new Map();
const localStorage = { getItem: k => storage.has(k) ? storage.get(k) : null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k), key: i => [...storage.keys()][i], get length() { return storage.size; } };
const errors = [];
let apiMode = 'success';
const original = JSON.parse(await fs.readFile(new URL('data/recipes_existing.json', base), 'utf8'))[0];
const raw = { RCP_SEQ: String(original.id), RCP_NM: original.name, INFO_ENG: String(original.calories), INFO_CAR: String(original.carb), INFO_PRO: String(original.protein), INFO_FAT: String(original.fat), INFO_NA: String(original.sodium), ATT_FILE_NO_MAIN: original.image, RCP_NA_TIP: original.tip || '' };
async function fetchMock(url) {
  if (url.startsWith('https://openapi.')) {
    if (apiMode === 'error') throw new TypeError('TEST ONLY network failure');
    return { ok: true, json: async () => ({ COOKRCP01: { row: [apiMode === 'mismatch' ? { ...raw, RCP_SEQ: 'different' } : raw], RESULT: { CODE: 'INFO-000' } } }) };
  }
  const data = JSON.parse(await fs.readFile(new URL(url.replace(/^\.\//, ''), base), 'utf8'));
  return { ok: true, json: async () => data };
}
const ctx = vm.createContext({ document, localStorage, fetch: fetchMock, URL, Blob, AbortController, Event, setTimeout, clearTimeout, API_KEY: 'TEST_ONLY_NOT_A_CREDENTIAL',
  location: { hash: '#home', protocol: 'http:' }, history: { replaceState() {} }, scrollY: 0,
  console: { log() {}, warn() {}, group() {}, groupEnd() {}, error(...args) { errors.push(args); } },
  addEventListener() {}, scrollTo() {} });
ctx.window = ctx;
for (const script of ['ui-icons.js','inventory-engine.js','data-sources.js','app.js','inventory-ui.js','meal-planner.js','presentation.js']) vm.runInContext(await fs.readFile(new URL('js/' + script, base), 'utf8'), ctx, { filename: script });
await new Promise(resolve => setTimeout(resolve, 150));
assert.equal(errors.length, 0, JSON.stringify(errors));
assert.equal(vm.runInContext('recipes.length', ctx), 76);
assert.equal(vm.runInContext('sourceLoadErrors.length', ctx), 0);
await vm.runInContext('renderDataSpecification()', ctx);
assert.match(nodes.get('#spec-body').innerHTML, /누락·중복·플래그 불일치 없음/);
assert.match(nodes.get('#spec-body').innerHTML, /recipes_existing.json/);
assert.match(nodes.get('#spec-body').innerHTML, /실제 성공 0건/);
vm.runInContext('renderList()', ctx);
// v0.9.30: 조회 전에는 A를 붙이지 않음 (API 응답이 실제로 반영된 레시피에만 A)
assert.doesNotMatch(nodes.get('#cards').innerHTML, /API 조회 가능|flag-A/);
await vm.runInContext('fetchApi(recipes[0]).then(r => renderDetailApiFields(recipes[0], r))', ctx);
assert.match(nodes.get('#d-api').innerHTML, /원본 ID·이름이 같은 1건/);
assert.match(nodes.get('#d-nut').innerHTML, /type-api/);
assert.equal(vm.runInContext("store.get('api_responses',[])[0].status", ctx), 'success');
apiMode = 'error';
await vm.runInContext('apiCache.clear(); fetchApi(recipes[0]).then(r => renderDetailApiFields(recipes[0], r))', ctx);
assert.match(nodes.get('#d-api').innerHTML, /API 응답 실패/);
assert.match(nodes.get('#d-nut').innerHTML, /JSON 원본 유지/);
assert.ok(!nodes.get('#d-nut').innerHTML.includes('type-api'));
apiMode = 'mismatch';
await vm.runInContext('apiCache.clear(); fetchApi(recipes[0])', ctx);
assert.equal(vm.runInContext("store.get('api_responses',[])[0].status", ctx), 'error');
vm.runInContext("store.set('fridge',[{name:'두부',qty:'1모',exp:null}]); store.set('posts',[{id:1,recipeId:recipes[0].id,author:'검사',text:'<script>',image:null,createdAt:'2026-11-15T00:00:00Z',used:[]}]);", ctx);
nodes.get('#plan-count').value = '3';
nodes.get('#plan-start').value = vm.runInContext('MealPlanEngine.dateKey(new Date())', ctx);
for (const fn of nodes.get('#plan-form').listeners.submit || []) fn({ preventDefault() {} });
assert.match(nodes.get('#plan-results').innerHTML, /번째 끼니/);
assert.equal(vm.runInContext("store.get('meal_plan_guest').people",ctx),1);
ctx.exported = vm.runInContext("posts = store.get('posts', []); currentDataFiles()", ctx);
for (const [file, rows] of Object.entries(ctx.exported)) for (const row of Array.isArray(rows) ? rows : [rows]) {
  ctx.record = row;
  assert.equal(vm.runInContext('auditProvenance(record).length', ctx), 0, file);
}
assert.equal(ctx.exported['fridge_user.json'][0].flag, 'U');
assert.equal(ctx.exported['statistics_calculated.json'][0].flag, 'C');
assert.equal(ctx.exported['meal_plans_calculated.json'][0].flag, 'C');
// Exercise populated screens to catch icon/markup regressions beyond initial load.
nodes.set('#d-fav', new Node('d-fav'));
vm.runInContext("store.set('user',{id:'TEST_ONLY',nick:'검사'}); posts[0].authorId='TEST_ONLY'; renderMine(); renderFeed(); renderMy(); renderRank(); renderFridge(); openPost(posts[0].id); openWrite();", ctx);
assert.match(nodes.get('#feed-list').innerHTML, /#ui-heart/);
assert.match(nodes.get('#feed-list').innerHTML, /#ui-vote/);
assert.match(nodes.get('#p-like').innerHTML, /좋아요 0개/);
assert.match(nodes.get('#p-vote').innerHTML, /랭킹 투표 0표/);
assert.ok(!nodes.get('#p-next').innerHTML.includes('<button type="button" class="chip ing'));
assert.ok(!/[👍♥♡🗑🧺🎉]/u.test(nodes.get('#feed-list').innerHTML));
vm.runInContext('openDetail(recipes[0].id); toggleFav(recipes[0].id); syncDetailActions(recipes[0]);', ctx);
assert.match(nodes.get('#d-fav').innerHTML, /is-filled/);
// Cooking fixtures exist only in this isolated storage/DOM simulation.
vm.runInContext("recipes.push(provenance({id:999999,name:'수량 검사 전용',servings:1,ingredientsText:'두부 100g',steps:[{text:'검사'}]},'user','U')); store.set('fridge',[{name:'두부',qty:'150g',exp:null}]); inventoryUI.openCook(999999);", ctx);
const usageInput = new Node(); usageInput.value='100';
const usageRow = new Node(); usageRow.dataset.stockIndex='0'; usageRow.querySelector=css=>css==='.cook-amount'?usageInput:null;
dynamicLists.set('#cook-rows .cook-row',[usageRow]);
const submitCook=()=>{ for(const fn of nodes.get('#cook-form').listeners.submit || [])fn({preventDefault(){}}); };
submitCook();
assert.equal(vm.runInContext("fridge()[0].qty",ctx),'50g');
assert.equal(vm.runInContext("store.get('cooking_logs',[]).length",ctx),1);
assert.equal(vm.runInContext("store.get('cooking_logs',[])[0].people",ctx),1);
submitCook();
assert.equal(vm.runInContext("fridge()[0].qty",ctx),'50g','double submit must not deduct twice');
vm.runInContext('inventoryUI.openCook(999999)',ctx); usageInput.value='10';
const originalSet=localStorage.setItem;
const beforeFailure=new Map(storage);
localStorage.setItem=(key,value)=>{if(key==='ft_cooking_logs')throw Error('TEST ONLY quota');originalSet(key,value);};
submitCook();
assert.equal(storage.get('ft_fridge'),beforeFailure.get('ft_fridge'));
assert.equal(storage.get('ft_cooking_logs'),beforeFailure.get('ft_cooking_logs'));
assert.equal(storage.get('ft_flog'),beforeFailure.get('ft_flog'));
assert.match(nodes.get('#cook-status').textContent,/취소/);
localStorage.setItem=originalSet;submitCook();
assert.equal(vm.runInContext("fridge()[0].qty",ctx),'40g');
assert.equal(vm.runInContext("store.get('cooking_logs',[]).length",ctx),2);
nodes.set('#w-cooking-record',new Node('w-cooking-record'));
nodes.get('#w-cooking-record').value=vm.runInContext("store.get('cooking_logs',[]).slice(-1)[0].id",ctx);
const beforeLink=storage.get('ft_fridge');
vm.runInContext('inventoryUI.postUsage(999999)',ctx);
assert.equal(storage.get('ft_fridge'),beforeLink,'post linking must not deduct stock');
vm.runInContext("posts.push(provenance({id:99,recipeId:999999,cookingLogId:store.get('cooking_logs',[]).slice(-1)[0].id,createdAt:new Date().toISOString(),used:[]},'user','U'));",ctx);
assert.throws(()=>vm.runInContext('inventoryUI.postUsage(999999)',ctx));
vm.runInContext("recipes.find(r=>r.id===999999).servings=10; const todayForTest=InventoryEngine.day(new Date()); const planForTest=MealPlanEngine.build({recipes:[recipes.find(r=>r.id===999999)],stock:fridge(),people:1,count:1,start:todayForTest,today:todayForTest,matches:usesIng}); planForTest.createdAt='test-plan-1'; store.set('meal_plan_TEST_ONLY',planForTest); inventoryUI.openCook(999999,{key:'meal_plan_TEST_ONLY',index:0,createdAt:'test-plan-1',people:1});",ctx);
usageInput.value='10';submitCook();
assert.equal(vm.runInContext("fridge()[0].qty",ctx),'30g');
assert.equal(vm.runInContext("store.get('meal_plan_TEST_ONLY').meals[0].status",ctx),'completed');
vm.runInContext("inventoryUI.openCook(999999,{key:'meal_plan_TEST_ONLY',index:0,createdAt:'test-plan-1',people:1});",ctx);
submitCook();
assert.equal(vm.runInContext("fridge()[0].qty",ctx),'30g','completed meal cannot be recorded again');
assert.match(nodes.get('#cook-status').textContent,/이미 완료/);
for(const fn of nodes.get('#plan-rebuild').listeners.click || [])fn({});
assert.equal(vm.runInContext("store.get('meal_plan_TEST_ONLY').meals[0].status",ctx),'completed');
ctx.exported=vm.runInContext('currentDataFiles()',ctx);
for(const [file,rows] of Object.entries(ctx.exported))for(const row of Array.isArray(rows)?rows:[rows]){ctx.record=row;assert.equal(vm.runInContext('auditProvenance(record).length',ctx),0,file);}
assert.ok(!('ft_accounts' in ctx.exported));
assert.equal(vm.runInContext("weekRange(0).start.getDay()",ctx),1);
assert.equal(vm.runInContext("weekRange(0).start.getHours()",ctx),0);
vm.runInContext("recipes.find(r=>r.id===999999).authorId='OTHER_USER'; const beforeOwnerCheck=recipes.length; deleteUserRecipe(999999); if(recipes.length!==beforeOwnerCheck)throw Error('Wrong author deletion'); recipes.find(r=>r.id===999999).authorId='TEST_ONLY'; store.set('recipes',[recipes.find(r=>r.id===999999)]); deleteUserRecipe(999999);",ctx);
assert.equal(vm.runInContext("recipes.some(r=>r.id===999999)",ctx),false);
assert.equal(vm.runInContext("store.get('deleted_recipe_ids',[]).includes(999999)",ctx),true);
assert.equal(vm.runInContext('openDetail(999999)',ctx),false);
assert.match(nodes.get('#list-state').innerHTML,/연결된 레시피를 찾을 수 없어요/);
nodes.get('#n-name').value='입력값 검사 전용';nodes.get('#n-category').value='밥';nodes.get('#n-method').value='끓이기';nodes.get('#n-ing').value='두부 1g';nodes.get('#n-steps').value='조리';nodes.get('#n-time').value='-1';
const beforeInvalidRecipe=vm.runInContext('recipes.length',ctx);
for(const fn of nodes.get('#new-form').listeners.submit||[])fn({preventDefault(){}});
assert.equal(vm.runInContext('recipes.length',ctx),beforeInvalidRecipe);
assert.match(nodes.get('#n-msg').textContent,/1~600/);
vm.runInContext('inventoryUI.renderShopping()',ctx);
assert.equal(vm.runInContext("store.get('shopping_recommendations',[])[0].people",ctx),1);
assert.equal(errors.length, 0);
console.log('PASS: source loading, JS rendering, API success/failure/ID mismatch, user flags and export. Simulated API only.');
