// 화면 전환 · 탭 · TOP 버튼 (와이어프레임용 최소 동작)
const TAB_OF = {home:'home',plan:'home',shopping:'home',cook:'list',list:'list',detail:'list',feed:'feed',post:'feed',write:'feed',rank:'rank',my:'my',new:'my',spec:'my',login:''};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let curScreen = null, lastScreen = 'home';
function go(id) {
  if (curScreen && curScreen !== id) lastScreen = curScreen;
  curScreen = id;
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  $$('.tabbar button').forEach(b => { const selected=b.dataset.go===TAB_OF[id]; b.classList.toggle('on',selected); b.setAttribute('aria-current',selected?'page':'false'); });
  $('.tabbar').style.display = id === 'login' ? 'none' : 'flex';
  document.documentElement.classList.toggle('snap', id === 'feed'); // 피드에서만 게시물 단위로 스크롤
  window.scrollTo(0, 0);
  if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
  if (id === 'list') renderList(); // 레시피 화면은 열 때마다 검색어·조건·보유 재료 기준으로 다시 그림
  if (id === 'rank') renderRank();
  if (id === 'my') renderMy();
  if (id === 'new') $('#n-author').textContent = `작성자: ${nickname()}`;
  if (id === 'home') renderHome();
  if (id === 'plan') window.mealPlanner?.refresh();
  if (id === 'feed') { renderFeed(); searchPosts(); }
  if (id === 'write') openWrite();
  if (id === 'spec') renderSpec();
  window.inventoryUI?.refresh();
}

document.addEventListener('click', e => {
  if (e.target.closest('[data-back]')) { go(lastScreen && lastScreen !== curScreen ? lastScreen : 'home'); return; }
  const g = e.target.closest('[data-go]');
  if (g) {
    if (g.disabled) return;
    if (g.dataset.mode === 'all') { flt.mineOnly = false; listShown = PAGE; }
    if (g.dataset.id && openDetail(Number(g.dataset.id)) === false) return;
    if (g.dataset.post) openPost(Number(g.dataset.post)); // 게시물 카드
    return go(g.dataset.go);
  }
  const t = e.target.closest('[data-tab]'); // 탭(마이 · 목록 배지)
  if (t) {
    const wrap = t.closest('.screen');
    $$('.tabs button', wrap).forEach(b => { b.classList.toggle('on', b === t); b.setAttribute('aria-pressed',String(b === t)); });
    $$('.pane', wrap).forEach(p => p.classList.toggle('on', p.dataset.pane === t.dataset.tab));
  }
});

// 홈: 재료 칩 탭하면 삭제, 추천 칩 탭하면 추가, 2개 미만이면 검색 버튼 비활성
// 보유 재료 토글(홈·레시피 화면 공용 flt.mineOnly): 재료가 없으면 자동으로 꺼짐
function syncFind() { flt.mineOnly = myIngredients().length > 0; if (!flt.mineOnly) flt.allMine = false; homeCount(); }
// 홈 검색·조건 → 레시피 화면으로. 조건은 flt 하나를 홈·레시피 화면이 같이 씀
// 홈 「레시피 찾기」는 재료 기반만: 보유 재료가 들어간 레시피 수를 버튼에 보여주고, 누르면 레시피 화면을 '보유 재료만' 켠 채 연다 (검색어·조건은 레시피 화면에서)
function homeCount() {
  if (!recipes.length) return;
  const mine = myIngredients();
  const n = mine.length ? recipes.filter(p => matchCount(p, mine) > 0).length : recipes.length;
  $('#home-go').textContent = mine.length ? (n ? `보유 재료를 활용하는 레시피 ${n}건 보기` : '이 재료가 들어간 레시피가 없어요 — 재료를 바꿔 보세요') : `전체 레시피 ${n}건 보기`;
  $('#home-go').disabled = !n;
}
$('#home-go').addEventListener('click', () => {
  $('#rec-q').value = ''; Object.assign(flt, { category: null, time: null, level: null, method: null, flag: null, allMine: false });
  flt.mineOnly = myIngredients().length > 0; listShown = PAGE; go('list');
});
// 캐러셀(인기 요리 3장): 좌우 스와이프 + 점
function makeCarousel(root, track, dots) {
  const st = { i: 0, n: 0 };
  const goTo = i => { if (!st.n) return; st.i = (i + st.n) % st.n; $(track).style.transform = `translateX(-${st.i * 100}%)`; $(dots).innerHTML = Array.from({ length: st.n }, (_, k) => `<i class="${k === st.i ? 'on' : ''}"></i>`).join(''); };
  attachSwipe($(root), { left: () => goTo(st.i + 1), right: () => goTo(st.i - 1) });
  return { set(n) { st.n = n; goTo(0); } };
}
// =====================================================================
// 기반: 내 냉장고 (재료 · 남은 양 · 보관 기한) — 이 브라우저 localStorage 'ft_fridge' (사용자 데이터 U)
// 냉장고 기록 'ft_flog': 넣음(add) · 털어냄(used, 임박 여부) · 그냥 먹음(eaten) · 버림(discard) → 털이 리포트의 원천
// =====================================================================
const URGENT_D = 2; // 보관 기한 D-2 이내 = 임박
const fridge = () => store.get('fridge', []);
const setFridge = f => store.set('fridge', f);
const flog = (name, kind, extra = {}) => store.set('flog', [...store.get('flog', []), { t: new Date().toISOString(), name, kind, ...extra }]);
function dday(exp) { // 오늘 기준 남은 날 (0 = 오늘까지, 음수 = 지남), 보관 기한 없으면 null
  if (!exp) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(exp + 'T00:00:00') - t) / 86400000);
}
const isUrgent = it => { const d = dday(it.exp); return d !== null && d >= 0 && d <= URGENT_D; };
const isExpired = it => { const d = dday(it.exp); return d !== null && d < 0; };
const dTag = it => { const d = dday(it.exp); if (d === null) return ''; return `<span class="dd${d < 0 ? ' over' : d <= URGENT_D ? ' urgent' : ''}">${d < 0 ? `${-d}일 지남` : d === 0 ? '오늘까지' : `${d}일 남음`}</span>`; };
function renderMine() {
  const f = [...fridge()].sort((a, b) => (dday(a.exp) ?? 999) - (dday(b.exp) ?? 999));
  $('#mine').innerHTML = f.map(it => `<button type="button" class="chip ing${isUrgent(it) ? ' urgent' : isExpired(it) ? ' over' : ''}" data-ing="${esc(it.name)}" aria-label="${esc(it.name)} 삭제">${esc(it.name)}${dTag(it)} ${uiIcon('close')}</button>`).join('');
}
function fridgeChanged() { window.inventoryUI?.refresh(); renderMine(); syncFind(); renderHomeReco(); renderSuggest(); if ($('#my').classList.contains('on')) renderMy(); }
// 재료 등록 (중복·빈값 무시). 보관 기한·양은 마이페이지 · 냉장고에서 넣거나 고침
$('#mine').addEventListener('click', e => {
  const c = e.target.closest('[data-ing]'); if (!c) return;
  setFridge(fridge().filter(it => it.name !== c.dataset.ing)); fridgeChanged(); // 홈의 ✕ = 잘못 넣은 것 지우기 (기록 안 남김)
});
function addIngredient(name, exp = null, qty = '') {
  name = String(name).trim();
  if (!name || myIngredients().includes(name)) return;
  setFridge([...fridge(), { name, qty, exp, at: new Date().toISOString() }]); flog(name, 'add');
  fridgeChanged();
}

// 로그인 / 회원가입: 아이디 + 닉네임 + 비밀번호 (이메일 없음)
// - 심화: js/config.js의 FIREBASE_CONFIG가 있으면 Firebase Authentication + Firestore (js/firebase.js)
//         아이디는 내부적으로 '아이디@fridge-raid.app'으로 바꿔 쓰고, 화면에서는 이메일을 받지 않음
// - 필수: 설정이 없거나 Firebase를 못 불러오면 LocalStorage(ft_accounts)에 계정 저장 (비밀번호는 SHA-256 해시)
// 어느 쪽이든 화면용 로그인 정보는 store 'user' = { id, loginId, nick, via } 로 같아서 나머지 화면 코드는 그대로 씀
const ID_RE = /^[a-z0-9_]{3,20}$/, NICK_RE = /^[가-힣A-Za-z0-9_]{2,12}$/;
let authMode = 'in';
function setAuthMode(m) {
  authMode = m; const up = m === 'up';
  $$('[data-auth]').forEach(b => b.closest('.tabs') && b.classList.toggle('on', b.dataset.auth === m));
  $('#up-only').hidden = $('#up-only2').hidden = !up;
  $('#auth-title').textContent = up ? '회원가입' : '로그인';
  $('#auth-sub').textContent = up ? '이메일 없이 아이디로 가입해요.' : '로그인하면 닉네임으로 레시피와 요리를 등록할 수 있어요.';
  $('#a-id').placeholder = up ? '영문 소문자·숫자·_ 3~20자' : '가입할 때 만든 아이디';
  $('#a-pw').placeholder = up ? '6자 이상' : '비밀번호';
  $('#a-pw').autocomplete = up ? 'new-password' : 'current-password';
  $('#auth-go').textContent = up ? '가입하고 시작하기' : '로그인';
  $('#auth-switch').innerHTML = up ? '이미 계정이 있어요? <a href="#" data-auth="in" style="font-weight:700;text-decoration:underline;color:var(--dk)">로그인</a>'
    : '처음이에요? <a href="#" data-auth="up" style="font-weight:700;text-decoration:underline;color:var(--dk)">회원가입</a>';
  authMsg('');
}
function authMsg(t, err = true) { $('#auth-msg').textContent = t; $('#auth-msg').style.color = err ? '#B8432A' : ''; }
document.addEventListener('click', e => { const b = e.target.closest('[data-auth]'); if (b) { e.preventDefault(); setAuthMode(b.dataset.auth); } });
// 입력값 확인 → 틀린 곳 메시지 (문제 없으면 null)
function checkAuth() {
  const id = $('#a-id').value.trim().toLowerCase(), pw = $('#a-pw').value, nick = $('#a-nick').value.trim();
  if (!id) return '아이디를 입력해 주세요';
  if (authMode === 'up') {
    if (!ID_RE.test(id)) return '아이디는 영문 소문자·숫자·_ 3~20자예요';
    if (!NICK_RE.test(nick)) return '닉네임은 한글·영문·숫자 2~12자예요 (띄어쓰기·특수문자 불가)';
    if (pw.length < 6) return '비밀번호는 6자 이상이에요';
    if (pw !== $('#a-pw2').value) return '비밀번호가 서로 달라요';
  } else if (!pw) return '비밀번호를 입력해 주세요';
  return null;
}
function finishLogin(id, loginId, nick, via) {
  store.set('user', { id, loginId, nick, via, at: new Date().toISOString() });
  sheetLog(authMode === 'up' ? 'signup' : 'login', { nick, via });
  $('#auth-form').reset(); setAuthMode('in');
  go('my');
}
// LocalStorage 계정 (필수 트랙 대체용). 비밀번호는 원문 대신 해시로 저장
async function pwHash(pw) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ft:' + pw));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch { return 'p_' + [...('ft:' + pw)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16); }
}
const localAuth = {
  async signUp(id, nick, pw) {
    const acc = store.get('accounts', {});
    if (acc[id]) throw { code: 'id-taken' };
    if (Object.values(acc).some(a => a.nick.toLowerCase() === nick.toLowerCase())) throw { code: 'nick-taken' };
    const uid = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    store.set('accounts', { ...acc, [id]: { uid, nick, pw: await pwHash(pw), at: new Date().toISOString() } });
    return { uid, nickname: nick };
  },
  async signIn(id, pw) {
    const a = store.get('accounts', {})[id];
    if (!a || a.pw !== await pwHash(pw)) throw { code: 'bad-login' };
    return { uid: a.uid, nickname: a.nick };
  },
};
const AUTH_ERR = {
  'id-taken': '이미 있는 아이디예요', 'auth/email-already-in-use': '이미 있는 아이디예요',
  'nick-taken': '이미 사용 중인 닉네임이에요',
  'bad-login': '아이디 또는 비밀번호가 맞지 않아요', 'auth/invalid-credential': '아이디 또는 비밀번호가 맞지 않아요',
  'auth/wrong-password': '아이디 또는 비밀번호가 맞지 않아요', 'auth/user-not-found': '아이디 또는 비밀번호가 맞지 않아요',
  'auth/invalid-email': '아이디는 영문 소문자·숫자·_만 쓸 수 있어요', 'auth/weak-password': '비밀번호는 6자 이상이에요',
  'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 해 주세요',
  'auth/operation-not-allowed': 'Firebase 콘솔에서 이메일/비밀번호 로그인이 꺼져 있어요',
  'auth/unauthorized-domain': '이 주소가 Firebase 승인된 도메인에 없어요', 'permission-denied': 'Firestore 규칙을 확인해 주세요',
};
$('#auth-form').addEventListener('submit', async e => {
  e.preventDefault();
  const bad = checkAuth(); if (bad) return authMsg(bad);
  const id = $('#a-id').value.trim().toLowerCase(), pw = $('#a-pw').value, nick = $('#a-nick').value.trim();
  const fb = window.fb, api = fb || localAuth, btn = $('#auth-go'), label = btn.textContent;
  btn.disabled = true; btn.textContent = authMode === 'up' ? '가입하는 중…' : '로그인 중…'; authMsg('');
  try {
    const r = authMode === 'up' ? await api.signUp(id, nick, pw) : await api.signIn(id, pw);
    finishLogin(r.uid, id, r.nickname, fb ? 'firebase' : 'local');
  } catch (err) {
    console.warn('[로그인 실패]', err);
    authMsg(AUTH_ERR[err.code] || '연결이 불안정해요. 잠시 후 다시 시도해 주세요');
  } finally { btn.disabled = false; if (btn.textContent.endsWith('…')) btn.textContent = label; }
});
// Firebase가 준비되면: 로그인 상태 복원 (새로고침해도 유지) / 다른 곳에서 로그아웃됐으면 화면도 로그아웃
window.addEventListener('fb-ready', async () => {
  try {
    const r = await window.fb.current(), u = store.get('user', null);
    if (r && (!u || u.id !== r.uid)) { store.set('user', { id: r.uid, loginId: r.loginId, nick: r.nickname, via: 'firebase', at: new Date().toISOString() }); renderMy(); }
    else if (!r && u?.via === 'firebase') { try { localStorage.removeItem('ft_user'); } catch {} renderMy(); }
  } catch (err) { console.warn('[Firebase 상태 확인 실패]', err.message); }
});
$('#my-logout').addEventListener('click', async () => {
  try { if (window.fb) await window.fb.signOut(); } catch (err) { console.warn('[로그아웃]', err.message); }
  try { localStorage.removeItem('ft_user'); } catch {} renderMy();
});
// 선택: Google Sheets 웹앱(Apps Script)에 기록 — js/config.js의 SHEET_WEBAPP_URL이 있을 때만. 실패해도 화면은 localStorage로 동작
function sheetLog(kind, payload) {
  if (typeof SHEET_WEBAPP_URL === 'undefined' || !SHEET_WEBAPP_URL) return;
  try {
    fetch(SHEET_WEBAPP_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ kind, at: new Date().toISOString(), ...payload }) })
      .then(() => console.log('[시트 기록]', kind)).catch(e => console.warn('[시트 기록 실패]', kind, e.message));
  } catch (e) { console.warn('[시트 기록 실패]', kind, e.message); }
}
$('#ing-q').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  addIngredient(e.target.value);
  e.target.value = '';
});
function syncTopLogin(u) { const b = $('#top-login'); b.setAttribute('aria-label', u ? `${u.nick} 님 (마이페이지)` : '로그인'); b.dataset.go = u ? 'my' : 'login'; b.classList.toggle('on', !!u); }
const nickname = () => store.get('user', null)?.nick || '익명';

// =====================================================================
// 사용자 데이터 (U): 좋아요 · 즐겨찾기 · 등록 레시피 — 서버가 없으므로 이 브라우저의 localStorage에 JSON으로 저장
// =====================================================================
const store = {
  get(k, d) { try { const v = localStorage.getItem('ft_' + k); return v === null ? d : normalizeStored(k, JSON.parse(v)); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ft_' + k, JSON.stringify(normalizeStored(k, v))); } catch (e) { console.warn('[저장 실패]', k, e.message); } },
};
const favIds = () => new Set(store.get('fav', []));
const isFav = id => favIds().has(id);
function toggleFav(id) { const f = favIds(); f.has(id) ? f.delete(id) : f.add(id); store.set('fav', [...f]); return f.has(id); }

const norm = s => String(s ?? '').toLowerCase().replace(/[@\s]/g, '');

// TOP 버튼
const topBtn = $('.totop');
addEventListener('scroll', () => topBtn.classList.toggle('show', scrollY > 200));
topBtn.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

// =====================================================================
// =====================================================================

// ① JSON 경로 — 6주차에 만든 data/ 폴더. GitHub Pages 배포 주소에서 확인 (file:// 에서는 fetch가 막힘)
const APP_BASE = typeof APP_ROOT === 'string' ? APP_ROOT : './'; // pages/ 안에서 열면 '../'
const DATA_URL = APP_BASE + 'data/recipes_existing.json';
const USER_URL = APP_BASE + 'data/recipes_user.json'; // 사용자 등록 레시피를 팀 저장소에 반영한 파일 (없어도 동작)
const POSTS_URL = APP_BASE + 'data/posts_user.json';       // 사용자 게시물을 팀 저장소에 반영한 파일 (없어도 동작)
const ING_URL = APP_BASE + 'data/ingredients_dictionary.json';   // 재료 사전 (추천 칩 · 표기 통일)
let ingredientsDict = [];                    // ingredients_dictionary.json 원본
let posts = [];                              // 게시물 원본 배열 (posts_user.json + localStorage)

let recipes = [];
let loadFailed = false; // 불러오기 실패(경로·문법 오류)와 결과 없음(0건)을 화면에서 구분하기 위해 (강의 1.2)

// 현재 JSON 데이터 규격에 따른 점검 상수
const REQUIRED = ['id', 'name', 'method', 'category', 'ingredientsText', 'meta'];
const ALLOWED = {
  method:   ['끓이기', '기타', '볶기', '굽기', '찌기'],
  category: ['국&찌개', '반찬', '밥', '일품'],
  level:    ['쉬움', '보통', '어려움'],
  flag:     ['J', 'A', 'U', 'C'],      // 저장 원본 / API / 입력 / 계산 결과
};
const FLAG_OF_SOURCE = { json: 'J', api: 'A', user: 'U', calc: 'C' };
const TYPES = { id: 'number', flag: 'string', name: 'string', method: 'string', category: 'string', author: 'string',
                time: 'number', level: 'string', calories: 'number', sodium: 'number',
                image: 'string', ingredientsText: 'string', tip: 'string' };

function checkData(data, source) {
  console.group('[데이터 점검]', source);
  console.log('배열인가?', Array.isArray(data));
  if (!Array.isArray(data)) { console.groupEnd(); return []; }
  console.log('데이터 건수:', data.length);
  console.log('첫 번째 객체의 필드:', Object.keys(data[0] || {}));
  console.log('첫 번째 id와 자료형:', data[0]?.id, typeof data[0]?.id);
  const warn = [], ids = new Set(), nulls = {}, src = {}, who = {};
  data.forEach(p => {
    if (ids.has(p.id)) warn.push(`id 중복: ${p.id}`);
    ids.add(p.id);
    Object.entries(TYPES).forEach(([k, type]) => {
      const v = p[k];
      if (v === null || v === undefined || v === '') { nulls[k] = (nulls[k] || 0) + 1; return; }
      if (typeof v !== type) warn.push(`자료형: id ${p.id} ${k} = ${JSON.stringify(v)} (${type} 이어야 함)`);
      else if (ALLOWED[k] && !ALLOWED[k].includes(v)) warn.push(`허용값 밖: id ${p.id} ${k} = "${v}"`);
    });
    const s = p.meta?.source;
    if (!s) warn.push(`출처 플래그 누락: id ${p.id} meta.source`);
    else if (!['json', 'api', 'user', 'calc'].includes(s)) warn.push(`출처 플래그 허용값 밖: id ${p.id} meta.source = "${s}"`);
    src[s || '누락'] = (src[s || '누락'] || 0) + 1;
    // 화면 표식 flag(J/A/U)와 meta.source가 어긋나면 경고 — 둘은 같은 사실을 가리켜야 함
    if (!p.flag) warn.push(`flag 누락: id ${p.id}`);
    else if (FLAG_OF_SOURCE[s] && p.flag !== FLAG_OF_SOURCE[s]) warn.push(`flag 불일치: id ${p.id} flag "${p.flag}" ≠ meta.source "${s}"`);
    const apiFields = p.meta?.api || [];
    if (s === 'api' && !apiFields.length) warn.push(`API 플래그: id ${p.id} source "api"인데 meta.api가 비어 있음`);
    if (s !== 'api' && apiFields.length) warn.push(`API 플래그: id ${p.id} source "${s}"인데 meta.api에 필드가 있음`);
    apiFields.filter(k => p[k] !== null && p[k] !== undefined && p[k] !== '')
      .forEach(k => warn.push(`API 플래그: id ${p.id} ${k}은 API 필드인데 JSON에 값이 있음 (API 필드는 JSON에 값을 두지 않음)`));
    const w = p.flag === 'U' ? '사용자' : p.flag === 'D' ? 'AI생성' : p.hashtag === '팀작성' ? '팀작성' : '식약처';
    who[w] = (who[w] || 0) + 1;
  });
  const valid = data.filter(p => {
    const miss = REQUIRED.filter(k => p[k] === null || p[k] === undefined || p[k] === '');
    if (miss.length) warn.push(`필수 필드 누락: id ${p.id} ${miss.join(' · ')} → 화면에서 제외`);
    return !miss.length;
  });
  console.log('빈 값(null) 수:', nulls);
  console.log('항목 출처:', src, '| 작성 주체:', who);
  if (warn.length) warn.forEach(w => console.warn(w)); else console.log('경고: 없음');
  console.log('화면에 표시할 건수:', valid.length);
  console.groupEnd();
  return valid;
}

function loadData() {
  fetch(DATA_URL)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(async data => {
      await loadSourceFiles();
      hydrateUserFiles();
      // 사용자 등록 레시피: 저장소 파일(recipes_user.json) + 이 브라우저 저장소를 합침 (같은 id면 브라우저 쪽이 최신)
      let fileUsers = [];
      try { const r = await fetch(USER_URL); if (r.ok) fileUsers = await r.json(); } catch (e) { console.warn('[recipes_user.json 없음]', e.message); }
      const localUsers = store.get('recipes', []);
      const users = [...fileUsers.filter(u => !localUsers.some(l => l.id === u.id)), ...localUsers];
      const deletedRecipes = new Set(store.get('deleted_recipe_ids', []));
      recipes = checkData([...data, ...users].filter(r => !deletedRecipes.has(r.id)), '기존 JSON + 사용자 JSON');
      $('#hero-count').textContent = recipes.length;
      homeCount();
      // 재료 사전 · 게시물 (없어도 화면은 동작)
      try { const r = await fetch(ING_URL); if (r.ok) { ingredientsDict = await r.json(); aliasKeys = null; } } catch (e) { console.warn('[ingredients_dictionary.json 없음]', e.message); }
      let filePosts = [];
      try { const r = await fetch(POSTS_URL); if (r.ok) filePosts = await r.json(); } catch (e) { console.warn('[posts_user.json 없음]', e.message); }
      const localPosts = store.get('posts', []);
      const deletedPosts = new Set(store.get('deleted_post_ids', []));
      posts = [...filePosts.filter(f => !localPosts.some(l => l.id === f.id)), ...localPosts].filter(p => !deletedPosts.has(p.id));
      console.log('[게시물]', posts.length, '건 (파일', filePosts.length, '· 브라우저', localPosts.length, ')');
      renderHome();
      document.dispatchEvent(new Event('meal-data-ready'));
      if ($('#feed').classList.contains('on')) { renderFeed(); searchPosts(); }
      if ($('#list').classList.contains('on')) renderList();
      if ($('#my').classList.contains('on')) renderMy();
    })
    .catch(error => {
      loadFailed = true;
      document.dispatchEvent(new Event('meal-data-ready'));
      console.error('[불러오기 실패]', error);
      showLoadError(error);
    });
}

// 불러오기 실패 화면: 데이터 자체가 없는 상태 (결과 없음과 다름 — 조건이 아니라 경로·문법을 확인해야 함)
const loadErrorHtml = msg => `<div class="err"><b>데이터를 불러오지 못했어요</b><br>
    ${location.protocol === 'file:' ? 'HTML을 직접 열면(file://) 브라우저가 JSON 읽기를 막습니다. 로컬 서버(Live Server) 또는 GitHub Pages 배포 주소에서 확인하세요.' : '파일 경로(data/recipes_existing.json)와 JSON 문법을 확인하세요.'}
    ${msg ? `<br><span class="mu">${esc(msg)}</span>` : ''}</div>`;
function showLoadError(error) {
  const box = title => `<div class="box empty" style="margin-top:0">${pic('fridge', 'empty-img', false)}<b>${title}</b><p class="mu">레시피 데이터(data/recipes_existing.json)를 불러오지 못했어요. ${location.protocol === 'file:' ? 'HTML을 직접 열면(file://) 브라우저가 JSON 읽기를 막아요 — VS Code Live Server나 GitHub Pages 주소로 열어 주세요.' : '경로와 JSON 문법을 확인해 주세요.'}</p></div>`;
  $('#home-reco').innerHTML = box('레시피를 보여줄 수 없어요');
  $('#home-week').innerHTML = box('이번 주 요리를 셀 수 없어요');
  $('#pop-track').innerHTML = box('인기 요리를 보여줄 수 없어요');
  $('#count').textContent = '불러오기 실패';
  $('#cards').innerHTML = '';
  $('#list-state').innerHTML = loadErrorHtml(error.message);
  $('#home-go').disabled = true;
}

// 필드 유형 판단: meta 목록에서 찾아 api → real → dummy 순으로 확인
function fieldType(p, key) {
  const m = p.meta || {};
  if ((m.api || []).includes(key)) return 'api';
  if ((m.real || []).includes(key)) return 'real';
  if ((m.dummy || []).includes(key)) return 'dummy';
  if ((m.user || []).includes(key)) return 'user';
  if ((m.calc || []).includes(key)) return 'calc';
  if ((m.empty || []).includes(key)) return 'empty';
  return '';
}
const FIELD_TYPE_LABEL = { real: '원본', dummy: '더미', api: 'API', fallback: '대체', user: '사용자', calc: '계산', meas: '사용자 기록 평균', empty: '정보 없음' };
const typeTag = type => type ? `<span class="type-tag type-${type}">${FIELD_TYPE_LABEL[type]}</span>` : '';
const tagOf = (p, key) => fieldType(p, key) === 'empty' ? '' : typeTag(fieldType(p, key));
const isTeam = p => p.hashtag === '팀작성';
const isUser = p => p.flag === 'U';
const isMyRecipe = p => isUser(p) && !!store.get('user', null) && p.authorId === store.get('user', null).id;
// 데이터 플래그 칩: 글자(J/A/U) + title로 뜻을 함께 표시
const FLAG_LABEL = { J: '기존 JSON 원본', A: '외부 API (조회·응답 상태 별도)', U: '사용자·팀 입력', C: '계산 결과' };
const flagChip = p => `<span class="flag flag-${p.flag || 'C'}" title="${FLAG_LABEL[p.flag] || '출처 미확인'}">${p.flag || '?'}</span>${apiTarget(p) ? '<span class="type-tag type-api">API 조회 가능</span>' : ''}`;
const originChip = p => isUser(p) ? `<span class="src-chip team">${esc(p.author || '사용자')}</span>${flagChip(p)}`
  : p.flag === 'D' ? `<span class="src-chip team">AI 가상</span>${flagChip(p)}`
  : isTeam(p) ? `<span class="src-chip team">팀 작성</span>${flagChip(p)}`
  : `<span class="src-chip">식약처</span>${flagChip(p)}`;
// 작성자 표시: 식약처(제공 기관) / 팀 / 사용자 닉네임 — null이면 '작성자 정보 없음'
const authorLine = p => p.author ? `<span class="author">${isUser(p) ? '작성자' : '제공 기관'} <b>${esc(p.author)}</b></span>` : '<span class="author na">제공·작성 정보 없음</span>';
const sourceChip = p => p.meta?.source === 'api' ? '<span class="type-tag type-api">API</span>'
  : p.meta?.source === 'dummy' ? '<span class="type-tag type-dummy">AI 가상</span>'
  : p.meta?.source === 'user' ? '<span class="type-tag type-dummy">사용자</span>'
  : '<span class="type-tag type-real">JSON</span>';
const metaSummary = p => {
  const m = p.meta || {};
  const n = group => (m[group] || []).filter(k => !/[.\[]/.test(k)).length;
  return `원본 ${n('real')} · 사용자 ${n('user')} · API ${n('api')} · 계산 ${n('calc')} · 정보 없음 ${n('empty')}개 필드`;
};

// ---------- 유틸 ----------
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// 식약처 이미지는 http:// 링크 → https 배포 주소에서 혼합 콘텐츠로 막히므로 표시할 때만 https로 바꿈 (JSON 원본값은 그대로 유지)
const imgUrl = u => u ? u.replace(/^http:\/\//, 'https://') : '';
// 썸네일 규칙: 사진 있음 → 사진 / 사진 없음 → 일러스트 36장 중 하나(.illu, '그림' 표식) / 사진 링크 깨짐 → 접시 placeholder(.no-img)
// 일러스트는 id로 정해지되(같은 레시피는 늘 같은 그림), 목록에서는 이웃 카드와 겹치지 않게 한 칸씩 민다 (withThumbs)
// 그림은 전부 asset/sprite.svg 한 파일(<symbol>)에 있고, tools/inline_sprite.py가 index.html 안에 넣어 둠 → <use href="#id">. 파일로 바로 열어도(file://) 보임
// cover=true면 카드 비율(16:10 등)에 맞춰 가운데를 잘라 꽉 채움 (음식 일러스트), false면 전체가 보이게 (빈 냉장고)
const pic = (id, cls = '', cover = true) => `<svg class="${cls}" aria-hidden="true"${cover ? ' viewBox="0 0 160 160" preserveAspectRatio="xMidYMid slice"' : ''}><use href="#${id}"></use></svg>`;
const THUMB_N = 36, THUMB_PAL = 9; // 36장 = 그릇 모양 4종(분류별) × 색 9종
const THUMB_SHAPE = { '국&찌개': 0, '밥': 1, '일품': 2, '반찬': 3 };
const thumbShape = p => THUMB_SHAPE[p.category] ?? ((Number(p.id) || 0) % 4);
const thumbOf = p => thumbShape(p) * THUMB_PAL + ((Math.abs(Number(p.id) || 0) * 7 + (p.name || '').length) % THUMB_PAL);
function withThumbs(list) { // [{p, hit, ...}] → 각 항목에 t(일러스트 번호) 부여. 모양은 분류대로 두고 색만 바꿔 이웃 카드와 겹치지 않게
  let prev = -1; const recent = [];
  return list.map(x => {
    const p = x.p || x, sh = thumbShape(p); let pal = thumbOf(p) % THUMB_PAL, t = sh * THUMB_PAL + pal;
    for (let k = 0; k < THUMB_PAL && (t === prev || recent.includes(t)); k++) { pal = (pal + 1) % THUMB_PAL; t = sh * THUMB_PAL + pal; }
    recent.push(t); if (recent.length > 4) recent.shift(); prev = t;
    return { ...x, t };
  });
}
function imgBox(p, cls, label, t) {
  if (!p.image) {
    const ti = t === undefined ? thumbOf(p) : t;
    return `<div class="img ${cls} illu" role="img" aria-label="${esc(p.name || '')} 일러스트 (사진 아님)">${pic('t' + String(ti + 1).padStart(2, '0'))}</div>`;
  }
  return `<div class="img ${cls} has-img"><img src="${esc(imgUrl(p.image))}" alt="${esc(p.name)} 사진" loading="lazy"
    onerror="this.parentNode.classList.remove('has-img');this.parentNode.classList.add('no-img');this.parentNode.innerHTML=pic('noimage')"></div>`;
}
// 값 없음(null) 규칙: '— 정보 없음'(회색)으로 표시하고 추정값을 넣지 않음. 숫자 필드는 단위도 붙이지 않음
const NA = '<span class="na">정보 없음</span>';
const info = v => (v === null || v === undefined || v === '') ? NA : esc(v);
const num = (v, unit) => (v === null || v === undefined) ? NA : `${v}${unit}`;
function recipeFacts(p) {
  const facts=[];
  if(p.time!=null)facts.push(num(p.time,'분')+tagOf(p,'time'));
  if(p.level)facts.push(info(p.level)+tagOf(p,'level'));
  return facts.length ? facts.join(' · ') : '<span class="na">조리 시간·난이도 정보 없음</span>';
}

// 홈의 보유 재료 칩 텍스트 → ['계란','양파','김치']
const myIngredients = () => fridge().map(it => it.name);
// 레시피 재료 텍스트에 보유 재료 이름이 몇 개 들어 있는지 (재료 매칭 로직 고도화는 이후 주차)
// 같은 재료의 다른 표기를 맞춤 (ingredients_dictionary.json의 aliases와 같은 쌍 — 사전 연동은 이후 주차)
const ALIAS_FALLBACK = [['달걀', '계란'], ['참치캔', '참치캔'], ['참치', '참치캔'], ['묵은지', '김치']]; // 재료 사전을 못 읽었을 때만
// 긴 표기부터 자리표시로 바꾼 뒤 대표 이름으로 되돌림 → '참치'가 '참치캔' 안에서, '호박'이 '애호박' 안에서 두 번 바뀌는 문제 방지
let aliasKeys = null;
function alias(t) {
  let out = String(t ?? '');
  if (!aliasKeys) {
    const pairs = ingredientsDict.length ? ingredientsDict.flatMap(i => [[i.name, i.name], ...(i.aliases || []).map(a => [a, i.name])]) : ALIAS_FALLBACK;
    aliasKeys = pairs.filter(([a]) => a).sort((x, y) => y[0].length - x[0].length);
    if (!ingredientsDict.length) { const k = aliasKeys; aliasKeys = null; return apply(out, k); }
  }
  return apply(out, aliasKeys);
  function apply(s, keys) {
    const names = [];
    keys.forEach(([from, to]) => { if (s.includes(from)) { names.push(to); s = s.split(from).join(`\u0001${names.length - 1}\u0001`); } });
    return s.replace(/\u0001(\d+)\u0001/g, (_, i) => names[i]);
  }
}
const usesIng = (p, name) => alias(p.ingredientsText).includes(alias(name));
// 매칭 엔진: 이 레시피에 쓰이는 냉장고 재료 (털이 인증·이어 쓰기·임박 우선 정렬이 같이 씀)
const fridgeHits = p => fridge().filter(it => usesIng(p, it.name));
function matchCount(p, mine) {
  const t = alias(p.ingredientsText);
  return mine.map(alias).filter(m => t.includes(m)).length;
}

// ---------- 검색 조건 (UX 기준: 사용자가 실제로 고르는 축만) ----------
const FILTER_DEF = [
  { key: 'category', label: '분류', opts: [['밥', '밥'], ['일품', '일품요리'], ['국&찌개', '국·찌개'], ['반찬', '반찬']] },
  { key: 'time', label: '조리 시간', opts: [['15', '15분 이내'], ['30', '30분 이내'], ['60', '1시간 이내']] },
  { key: 'level', label: '난이도', opts: [['쉬움', '쉬움'], ['보통', '보통'], ['어려움', '어려움']] },
  { key: 'method', label: '조리 방법', opts: [['볶기', '볶기'], ['끓이기', '끓이기'], ['굽기', '굽기'], ['찌기', '찌기'], ['기타', '기타']] },
  { key: 'flag', label: '출처', opts: [['J', 'J 저장 JSON'], ['A', 'A API 조회 가능'], ['U', 'U 사용자']] },
];
const SORTS = [['rel', '추천순'], ['time', '빨리 만드는 순'], ['made', '많이 만든 순'], ['easy', '쉬운 순'], ['name', '가나다순'], ['new', '최신 등록순']];
const LEVEL_ORDER = { '쉬움': 0, '보통': 1, '어려움': 2 };
// 이 레시피로 만든 요리 게시물 수 (레시피 카드의 '좋아요' 대신 보여주는 값 — 좋아요는 요리 게시물에만 있음)
const madeCount = id => posts.filter(p => p.recipeId === id).length;
const flt = { category: null, time: null, level: null, method: null, flag: null, sort: 'rel', allMine: false, mineOnly: false };
const PAGE = 30; let listShown = PAGE;

const FILTER_LABEL = v => { for (const f of FILTER_DEF) { const o = f.opts.find(([k]) => k === v); if (o) return o[1]; } return v; };
let filtersOpen = false; // 기본은 접어 둠 (검색창과 결과 먼저)
const MINE_OPTS = [['none', '상관없음'], ['any', '하나라도 포함'], ['all', '모두 포함']];
const mineMode = () => flt.allMine ? 'all' : flt.mineOnly ? 'any' : 'none';
const activeLabels = () => FILTER_DEF.filter(f => flt[f.key]).map(f => FILTER_LABEL(flt[f.key])).concat(flt.allMine ? ['재료 모두 포함'] : flt.mineOnly ? ['재료 포함'] : []);
// 검색 패널의 ② 조건 ③ 정렬 섹션 + 적용 중 요약 한 줄. 조건은 접을 수 있고 접혀도 요약은 보임
function filterBar() {
  const act = FILTER_DEF.filter(f => flt[f.key]).map(f => FILTER_LABEL(flt[f.key]));
  const sortLabel = SORTS.find(([v]) => v === flt.sort)?.[1] || '추천순';
  const rows = FILTER_DEF.map(f => `<div class="frow"><span class="flabel">${f.label}</span><div class="fchips">${f.opts.map(([v, l]) =>
      `<button class="chip${flt[f.key] === v ? ' on' : ''}" type="button" data-f="${f.key}" data-v="${v}">${l}</button>`).join('')}</div></div>`).join('');
  return `<div class="fsec">
      <div class="fsec-h"><b>조건·정렬</b><span class="mu">${act.length ? `${act.length}개 적용 · ` : ''}${sortLabel}</span><button class="fsec-toggle" type="button" data-f="toggle">${filtersOpen ? '접기' : '펼치기'}${uiIcon(filtersOpen ? 'chevron-up' : 'chevron-down')}</button></div>
      ${filtersOpen ? rows : ''}
      ${filtersOpen ? `<div class="frow"><span class="flabel">정렬</span><div class="fchips">${SORTS.map(([v, l]) => `<button class="chip${flt.sort === v ? ' on' : ''}" type="button" data-f="sort" data-v="${v}">${l}</button>`).join('')}</div></div>` : ''}
    </div>
    ${activeLabels().length ? `<div class="fsum">${activeLabels().map(esc).join(' · ')} <button class="chip reset" type="button" data-f="reset">초기화</button></div>` : ''}`;
}
function applyFilters(scored) {
  return scored.filter(({ p, hit }) =>
    (!flt.category || p.category === flt.category) &&
    (!flt.time || (p.time !== null && p.time <= Number(flt.time))) &&
    (!flt.level || p.level === flt.level) &&
    (!flt.method || p.method === flt.method) &&
    (!flt.flag || (flt.flag === 'real' ? p.flag !== 'D' : (flt.flag === 'A' ? apiTarget(p) : p.flag === flt.flag))) &&
    (!flt.allMine || (hit > 0 && hit === myIngredients().length)));
}
function sortResults(arr, q) {
  const byName = (a, b) => a.p.name.localeCompare(b.p.name, 'ko');
  const rel = (a, b) => (b.nameHit || 0) - (a.nameHit || 0) || (b.urgent || 0) - (a.urgent || 0) || b.hit - a.hit || (b.p.flag !== 'D') - (a.p.flag !== 'D') || byName(a, b);
  const f = { rel, time: (a, b) => ((a.p.time ?? 999) - (b.p.time ?? 999)) || rel(a, b), made: (a, b) => madeCount(b.p.id) - madeCount(a.p.id) || rel(a, b),
              easy: (a, b) => ((LEVEL_ORDER[a.p.level] ?? 9) - (LEVEL_ORDER[b.p.level] ?? 9)) || rel(a, b),
              name: byName, new: (a, b) => (b.p.createdAt || '').localeCompare(a.p.createdAt || '') || rel(a, b) }[flt.sort] || rel;
  return [...arr].sort(f);
}
document.addEventListener('click', e => {
  const b = e.target.closest('.filters [data-f]'); if (!b) return;
  const k = b.dataset.f, v = b.dataset.v;
  if (k === 'toggle') { filtersOpen = !filtersOpen; renderList(); return; }
  if (k === 'reset') { Object.assign(flt, { category: null, time: null, level: null, method: null, flag: null, sort: 'rel', allMine: false, mineOnly: false }); }
  else if (k === 'sort') flt.sort = v;
  else flt[k] = flt[k] === v ? null : v;
  listShown = PAGE;
  if ($('#list').classList.contains('on')) renderList();
  homeCount();
});
document.addEventListener('click', e => {
  if (e.target.closest('#list-more button')) { listShown += PAGE; renderList(); }
  const mm = e.target.closest('[data-mine]');
  if (mm) { const v = mm.dataset.mine; flt.mineOnly = v !== 'none'; flt.allMine = v === 'all'; listShown = PAGE; renderList(); }
});
const moreBtn = (shown, total) => shown < total ? `<button class="more-btn" type="button">더 보기 (${Math.min(PAGE, total - shown)}건 더 · 남은 ${total - shown}건)</button>` : (total > PAGE ? `<p class="mu" style="text-align:center;margin-top:10px">${total}건 모두 표시했어요</p>` : '');
let navIds = []; // 상세 좌우 스와이프에서 넘길 순서 (마지막으로 그린 목록/검색 결과)

// 검색어는 띄어쓰기로 나눈 단어가 모두(이름 또는 재료에) 들어가야 함 → "두부 찌개", "김치 볶음" 조합 검색
function queryResults(raw) {
  const mine = myIngredients();
  const tokens = alias(raw || '').split(/\s+/).map(norm).filter(Boolean);
  const scored = recipes.map(p => {
    const n = norm(p.name), ing = norm(alias(p.ingredientsText));
    if (!tokens.every(t => n.includes(t) || ing.includes(t))) return null;
    return { p, hit: matchCount(p, mine), nameHit: tokens.filter(t => n.includes(t)).length, urgent: fridgeHits(p).filter(isUrgent).length };
  }).filter(Boolean);
  return sortResults(applyFilters(flt.mineOnly ? scored.filter(r => r.hit > 0) : scored));
}

function renderList() {
  const mine = myIngredients(), raw = $('#rec-q').value.trim();
  const mode = mineMode();
  // 냉장고 재료가 있을 때만 '내 재료' 조건을 보여 줌 (설명 문구 없음)
  $('#list-mine').hidden = !mine.length;
  $('#list-mine').innerHTML = mine.length ? `<span class="flabel">내 재료</span>`
    + MINE_OPTS.map(([v, l]) => `<button class="chip${mode === v ? ' on' : ''}" type="button" data-mine="${v}">${l}</button>`).join('') : '';
  $('#list-filters').innerHTML = filterBar();
  if (!recipes.length) { if (!loadFailed) $('#count').textContent = '불러오는 중…'; return; }
  $('#count').textContent = '';
  const results = queryResults(raw);
  navIds = results.map(r => r.p.id);
  const d = results.filter(r => r.p.flag === 'D').length;
  $('#count').textContent = raw && results.length ? `"${raw}" 검색 결과` : ''; // 전체 건수는 표시하지 않음
  const page = withThumbs(results.slice(0, listShown));
  $('#cards').innerHTML = page.map(({ p, hit, t }) => card(p, hit, mine.length, t)).join('');
  $('#list-state').innerHTML = results.length ? '' : emptyList(mine, raw);
  $('#list-more').innerHTML = results.length ? moreBtn(listShown, results.length) : '';
}
function card(p, hit, total, t) {
  const urg = fridgeHits(p).filter(isUrgent);
  const badge = (hit && hit === total ? '<span class="bg a">보유 재료 모두 포함</span>'
              : hit ? `<span class="bg">보유 재료 ${hit}종 포함</span>` : '')
              + (urg.length ? ` <span class="bg rescue">임박 재료 ${urg.map(it => esc(it.name)).join(' · ')} 활용</span>` : '');
  return `<div class="card" data-go="detail" data-id="${p.id}">
    ${imgBox(p, '', '요리 사진', t)}
    <div>
      <b>${esc(p.name)}</b>${lvlTag(p)} ${originChip(p)}
      <p class="mu">${num(p.time, '분')}${tagOf(p, 'time')} · ${info(uiCategory(p.category))}${tagOf(p, 'category')}</p>
      <p class="mu">${authorLine(p)}${madeCount(p.id) ? ` · 자랑 ${madeCount(p.id)}건` : ''}</p>
      ${badge}
    </div>
    <button class="fav-btn${isFav(p.id) ? ' on' : ''}" type="button" data-fav="${p.id}" aria-pressed="${isFav(p.id)}" aria-label="${isFav(p.id) ? '즐겨찾기 해제' : '즐겨찾기'}">${uiIcon('star', isFav(p.id))}</button>
  </div>`;
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-fav]'); if (!b) return;
  e.stopPropagation(); e.preventDefault();
  const id = Number(b.dataset.fav); toggleFav(id); const on = isFav(id);
  $$(`[data-fav="${id}"]`).forEach(x => { x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); x.setAttribute('aria-label', on ? '즐겨찾기 해제' : '즐겨찾기'); x.innerHTML = uiIcon('star', on); });
  if ($('#my').classList.contains('on')) renderMy();
}, true);
// 홈용 작은 빈 화면 (그림 없이 한 줄)
const miniEmpty = (text, action = '') => `<div class="mini-empty"><p>${text}</p>${action}</div>`;
// 표준 예외 화면 (결과 없음): 빈 냉장고 그림 + 무엇이 없는지 한 줄 + 왜/어떻게 한 줄 + 다음 행동 버튼. 모든 '0건' 화면이 이 함수를 씀
function emptyState({ title, hint, actions = [] }) {
  return `<div class="box empty">${pic('fridge', 'empty-img', false)}
    <b>${title}</b>${hint ? `<p class="mu">${hint}</p>` : ''}
    ${actions.map(a => `<button class="btn${a.dark ? ' dk' : ''}" ${a.go ? `data-go="${a.go}"` : ''} ${a.id ? `id="${a.id}"` : ''}>${a.label}</button>`).join('')}</div>`;
}
function emptyList(mine, raw) {
  const anyF = FILTER_DEF.some(f => flt[f.key]) || flt.allMine;
  const title = raw ? `"${esc(raw)}"에 맞는 레시피가 없어요` : flt.mineOnly && mine.length ? `보유 재료(${mine.map(esc).join(' · ')})를 포함한 레시피가 없어요` : '조건에 맞는 레시피가 없어요';
  const hint = raw ? '다른 재료나 요리 이름으로 찾아보세요.' : flt.mineOnly ? '다른 재료를 등록해 보세요.' : '조건을 하나 풀어 보세요.';
  const actions = [];
  if (anyF) actions.push({ label: '검색 조건 초기화', id: 'flt-reset', dark: true });
  if (flt.mineOnly) actions.push({ label: `보유 재료 상관없이 전체 보기`, id: 'show-all', dark: !anyF });
  if (raw) actions.push({ label: '검색어 지우기', id: 'q-clear', dark: !anyF && !flt.mineOnly });

  return emptyState({ title, hint, actions });
}
document.addEventListener('click', e => {
  if (e.target.closest('#show-all')) { flt.mineOnly = false; listShown = PAGE; renderList(); }
  if (e.target.closest('#q-clear')) { $('#rec-q').value = ''; listShown = PAGE; renderList(); }
  if (e.target.closest('#flt-reset')) { Object.assign(flt, { category: null, time: null, level: null, method: null, flag: null, allMine: false }); listShown = PAGE; renderList(); homeCount(); }
});

$('#rec-q').addEventListener('input', () => { listShown = PAGE; renderList(); });

// 홈 "보유 재료를 활용하는 레시피": 보유 재료 매칭 상위 2건 (실제 데이터 우선)
function renderHomeReco() {
  const box = $('#home-reco');
  if (!box || !recipes.length) return;
  const mine = myIngredients();
  const top = recipes.map(p => ({ p, hit: matchCount(p, mine), urgent: fridgeHits(p).filter(isUrgent).length })).filter(r => r.hit > 0).sort((a, b) => b.urgent - a.urgent || b.hit - a.hit).slice(0, 2);
  if (!top.length) { box.innerHTML = miniEmpty(mine.length ? '내 재료로 만들 수 있는 레시피가 없어요' : '냉장고에 재료를 등록하면 추천해 드려요', mine.length ? '' : '<button class="link-btn" type="button" data-open-fridge>재료 등록하기</button>'); return; }
  box.innerHTML = withThumbs(top).map(({ p, hit, t }) => `<article class="big-card" data-go="detail" data-id="${p.id}">
    ${imgBox(p, 'big-img', '레시피 사진', t)}
    <div class="big-body"><b>${esc(p.name)}</b> ${originChip(p)}<p class="mu">${recipeFacts(p)} · 내 재료 ${hit}종 사용</p></div>
  </article>`).join('');
}

// ---------- 마이: 즐겨찾기 · 내 레시피 (사용자 데이터 U) ----------
function miniCard(p, right, t) {
  return `<div class="card" data-go="detail" data-id="${p.id}">${imgBox(p, '', '요리 사진', t)}
    <div><b>${esc(p.name)}</b> ${originChip(p)}<p class="mu">${recipeFacts(p)} · ${authorLine(p)}</p></div>
    ${right || ''}</div>`;
}
function renderMy() {
  const u = store.get('user', null);
  $('#my-name').textContent = u ? `${u.nick} 님` : '로그인이 필요해요';
  $('#my-sub').textContent = u ? (u.loginId ? '@' + u.loginId : u.email || '') : '레시피 등록·요리 자랑에 필요해요';
  $('#my-logout').hidden = !u; $('#my-login').hidden = !!u;
  syncTopLogin(u);
  const favs = recipes.filter(p => isFav(p.id));
  navIds = favs.map(p => p.id);
  $('#fav-list').innerHTML = favs.length ? withThumbs(favs.map(p => ({ p }))).map(({ p, t }) => miniCard(p, uiIcon('star', true), t)).join('')
    : emptyState({ title: '즐겨찾기한 레시피가 없어요', hint: '레시피의 별을 누르면 여기에 모여요.', actions: [{ label: '레시피 보기', go: 'list', dark: true }] });
  const myPosts = posts.filter(isMyPost).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  $('#posts-list').innerHTML = myPosts.length ? myPosts.map(p => `<div class="card" data-go="post" data-post="${p.id}">${postImg(p, '', '요리 사진')}<div><b>${esc(p.recipeName)}</b><p class="mu">${p.text ? esc(p.text) : '<span class="na">후기 없음</span>'} · 좋아요 ${postLikes(p.id)}개</p></div><button class="chip" type="button" data-pdel="${p.id}">삭제</button></div>`).join('')
    : emptyState({ title: u ? '아직 자랑한 요리가 없어요' : '로그인하면 내 자랑이 여기 모여요', hint: u ? '레시피 상세의 "요리 자랑하기"로 올릴 수 있어요.' : '', actions: u ? [{ label: '레시피 보기', go: 'list', dark: true }] : [] });
  renderFridge(); renderReport();
  const mine = recipes.filter(isMyRecipe);
  $('#mine-list').innerHTML = mine.length ? withThumbs(mine.map(p => ({ p }))).map(({ p, t }) => miniCard(p, `<button class="chip" type="button" data-del="${p.id}">삭제</button>`, t)).join('')
    : emptyState({ title: '등록한 레시피가 없어요', hint: '', actions: [] }); // 등록 버튼은 위에 하나만
}
document.addEventListener('click', e => {
  const d = e.target.closest('[data-del]');
  if (d) { e.stopPropagation(); deleteUserRecipe(Number(d.dataset.del)); renderMy(); }
  const pd = e.target.closest('#posts-list [data-pdel]');
  if (pd) { e.stopPropagation(); deletePost(Number(pd.dataset.pdel)); renderMy(); }
}, true);
// ---------- 마이페이지 · 데이터 명세: 지금 불러온 데이터에서 바로 셈 ----------
function renderSpec() { renderDataSpecification(); }

// ---------- 마이페이지 · 냉장고: 재료 · 남은 양 · 보관 기한, 나갈 때 '먹음'/'버림' ----------
function renderFridge() {
  const f = [...fridge()].sort((a, b) => (dday(a.exp) ?? 999) - (dday(b.exp) ?? 999));
  const urg = f.filter(isUrgent).length, over = f.filter(isExpired).length;
  $('#fr-count').innerHTML = f.length ? `재료 ${f.length}종${urg ? ` · <b class="t-urgent">임박 ${urg}종</b>` : ''}${over ? ` · <b class="t-over">기한 지남 ${over}종</b>` : ''} <span class="flag flag-U">U</span>` : '';
  $('#fr-list').innerHTML = f.length ? f.map(it => `<div class="fr-row${isUrgent(it) ? ' urgent' : isExpired(it) ? ' over' : ''}" data-fr="${esc(it.name)}">
      <div class="fr-main"><b>${esc(it.name)}</b>${dTag(it)}${it.demo ? ' <span class="flag flag-D">D</span>' : ''}
        <input class="in fr-qty" value="${esc(it.qty || '')}" placeholder="남은 양" aria-label="${esc(it.name)} 남은 양"><span class="mu">${InventoryEngine.stockAmount(it) ? '수량 비교 가능' : '숫자·단위 확인 필요'}</span><input class="in fr-exp" type="date" value="${it.exp || ''}" aria-label="${esc(it.name)} 보관 기한"></div>
      <div class="fr-act"><button class="chip" type="button" data-fx="eaten">사용 완료</button><button class="chip fr-bin" type="button" data-fx="discard">폐기</button></div></div>`).join('')
    : emptyState({ title: '냉장고가 비어 있어요', hint: '재료와 보관 기한을 등록해 보세요.', actions: [] });
  $('#fr-search').hidden = !f.length;
}
$('#fr-add').addEventListener('click', () => { const n = $('#fr-name').value.trim(); if (!n) return; if (myIngredients().includes(n)) { setFridge(fridge().map(it => it.name === n ? { ...it, exp: $('#fr-exp').value || it.exp, qty: $('#fr-qty').value.trim() || it.qty, quantityOrigin: 'user' } : it)); fridgeChanged(); } else addIngredient(n, $('#fr-exp').value || null, $('#fr-qty').value.trim()); $('#fr-name').value = ''; $('#fr-qty').value = ''; $('#fr-exp').value = ''; });
$('#fr-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#fr-add').click(); } });
$('#fr-list').addEventListener('change', e => {
  const row = e.target.closest('[data-fr]'); if (!row) return;
  setFridge(fridge().map(it => it.name === row.dataset.fr ? { ...it, qty: row.querySelector('.fr-qty').value.trim(), quantityOrigin: 'user', exp: row.querySelector('.fr-exp').value || null } : it)); fridgeChanged();
});
$('#fr-list').addEventListener('click', e => {
  const b = e.target.closest('[data-fx]'); if (!b) return;
  const name = b.closest('[data-fr]').dataset.fr, it = fridge().find(x => x.name === name);
  flog(name, b.dataset.fx, { urgent: it ? isUrgent(it) : false, expired: it ? isExpired(it) : false });
  setFridge(fridge().filter(x => x.name !== name)); fridgeChanged();
});
// ---------- 마이페이지 · 5. 털이 리포트: 이번 달 냉장고 기록에서 계산 ----------
function renderReport() {
  const now = new Date(), m0 = new Date(now.getFullYear(), now.getMonth(), 1);
  const log = store.get('flog', []).filter(x => new Date(x.t) >= m0);
  const cnt = k => log.filter(x => x.kind === k).length;
  const used = cnt('used'), rescued = log.filter(x => x.kind === 'used' && x.urgent).length, eaten = cnt('eaten'), discard = cnt('discard'), added = cnt('add');
  const left = fridge().length, out = used + eaten;
  const rate = out + discard + left ? Math.round(out / (out + discard + left) * 100) : null;
  const top = Object.entries(log.filter(x => x.kind === 'used').reduce((a, x) => (a[x.name] = (a[x.name] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const myPostsM = posts.filter(p => isMyPost(p) && new Date(p.createdAt) >= m0);
  const urgNow = fridge().filter(isUrgent);
  $('#report').innerHTML = `<div class="report-hero"><p class="hero-kicker">${now.getMonth() + 1}월 냉장고 리포트</p>
      <div class="rate"><b>${rate === null ? '—' : rate + '%'}</b><span>비움률 ${typeTag('calc')}</span></div>
      <div class="rate-bar"><i style="width:${rate || 0}%"></i></div>
      <div class="rep-nums"><span><b>${used}</b>활용</span><span><b>${rescued}</b>임박 활용</span><span><b>${discard}</b>버림</span></div>
      <details class="rep-how"><summary>계산 방법</summary><p>(활용 + 그냥 먹음) ÷ (활용 + 그냥 먹음 + 버림 + 지금 남은 재료) · 이번 달 냉장고 기록 기준</p></details></div>`;
}
document.addEventListener('click', e => { if (e.target.closest('#rep-go')) { $('#rec-q').value = ''; flt.mineOnly = true; flt.sort = 'rel'; listShown = PAGE; go('list'); } });

function deleteUserRecipe(id) {
  if (!isMyRecipe(recipes.find(r => r.id === id) || {})) return;
  store.set('deleted_recipe_ids', [...new Set([...store.get('deleted_recipe_ids', []), id])]);
  if (!store.get('deleted_recipe_ids', []).includes(id)) return;
  store.set('recipes', store.get('recipes', []).filter(r => r.id !== id));
  recipes = recipes.filter(r => r.id !== id);
  const f = favIds(); f.delete(id); store.set('fav', [...f]);
}
// ---------- 레시피 등록 (U): recipes_existing.json과 같은 구조로 만들어 localStorage에 저장 ----------
const USER_ID_BASE = 100001; // 식약처(31~3577)·팀(90001~)과 겹치지 않는 범위
$('#new-form').addEventListener('submit', e => {
  e.preventDefault();
  const author = store.get('user', null);
  if (!author) { go('login'); authMsg('레시피를 등록하려면 로그인해 주세요.', false); return; }
  const v = id => $(id).value.trim();
  const steps = v('#n-steps').split('\n').map(t => t.trim()).filter(Boolean);
  const miss = [];
  if (!v('#n-name')) miss.push('레시피 이름');
  if (!v('#n-category')) miss.push('분류');
  if (!v('#n-method')) miss.push('조리 방법');
  if (!v('#n-ing')) miss.push('재료');
  if (!steps.length) miss.push('조리 순서');
  const img = v('#n-image');
  if (img && !/^https:\/\//.test(img)) miss.push('사진 주소(https로 시작)');
  const msg = $('#n-msg');
  if (miss.length) { msg.hidden = false; msg.textContent = `입력을 확인해 주세요: ${miss.join(', ')}`; return; }
  if (recipes.some(p => p.name === v('#n-name'))) { msg.hidden = false; msg.textContent = `"${v('#n-name')}"은 이미 있는 레시피예요. 이름을 바꾸거나 기존 레시피를 확인해 주세요.`; return; }
  msg.hidden = true;
  const ids = [...recipes.filter(isUser).map(p => p.id), ...store.get('deleted_recipe_ids', [])];
  const time = v('#n-time') ? Number(v('#n-time')) : null, level = v('#n-level') || null, tip = v('#n-tip') || null;
  if (time !== null && (!Number.isInteger(time) || time < 1 || time > 600)) { msg.hidden=false; msg.textContent='조리 시간은 1~600분의 정수로 입력해 주세요.'; return; }
  if (!ALLOWED.category.includes(v('#n-category')) || !ALLOWED.method.includes(v('#n-method')) || (level && !ALLOWED.level.includes(level))) { msg.hidden=false; msg.textContent='분류·조리 방법·난이도를 확인해 주세요.'; return; }
  const servings = $('#n-servings').value ? Number($('#n-servings').value) : null;
  if (servings !== null && (!Number.isFinite(servings) || servings < 0.1 || servings > 100)) { msg.hidden = false; msg.textContent = '기준 인분은 0.1~100 범위로 입력해 주세요.'; return; }
  const optional = { time, level, tip, image: img || null, servings };
  const userFields = ['name', 'method', 'category', 'author', 'ingredientsText', 'steps', ...Object.keys(optional).filter(k => optional[k] !== null)];
  const p = {
    id: ids.length ? Math.max(...ids) + 1 : USER_ID_BASE, flag: 'U',
    name: v('#n-name'), method: v('#n-method'), category: v('#n-category'), author: nickname(), authorId: author.id,
    time, level, servings, weight: null, calories: null, carb: null, protein: null, fat: null, sodium: null,
    hashtag: '사용자등록', image: img || null, imageStep: null,
    ingredientsText: v('#n-ing'), steps: steps.map((text, i) => ({ text: `${i + 1}. ${text.replace(/^\d+\.\s*/, '')}`, image: null })),
    tip, createdAt: new Date().toISOString(),
    meta: { source: 'user', real: [], dummy: [], api: [], user: userFields,
            note: `사용자 ${nickname()}가 ${new Date().toLocaleDateString('ko-KR')} 등록 — 검증되지 않은 사용자 데이터` },
  };
  Object.assign(p, normalizeStored('recipes', [p])[0]);
  store.set('recipes', [...store.get('recipes', []), p]);
  if (!store.get('recipes', []).some(r => r.id === p.id)) { msg.hidden=false; msg.textContent='레시피를 저장하지 못했어요. 저장 공간을 확인해 주세요.'; return; }
  recipes = [...recipes, p];
  sheetLog('recipe', { id: p.id, name: p.name, author: p.author, category: p.category });
  e.target.reset();
  openDetail(p.id); go('detail');
});

// =====================================================================
// =====================================================================
const API_BASE = 'https://openapi.foodsafetykorea.go.kr/api';          // http는 GitHub Pages(https)에서 혼합 콘텐츠로 차단
const API_SERVICE = 'COOKRCP01';                                        // 조리식품의 레시피 DB
const API_TIMEOUT = 5000;
// 응답 필드 → recipes_existing.json 필드 (meta.api에 적힌 7개)
const API_FIELD_MAP = { calories: 'INFO_ENG', carb: 'INFO_CAR', protein: 'INFO_PRO', fat: 'INFO_FAT', sodium: 'INFO_NA',
                        image: 'ATT_FILE_NO_MAIN', tip: 'RCP_NA_TIP' };
const apiCache = new Map(); // id → 결과. 같은 항목을 다시 열면 재요청하지 않음 (새로고침하면 사라짐)

// 요리명으로 검색해 { ok, vals, seq, count, at } 또는 { ok:false, reason, at } 반환. 실패해도 throw하지 않음
async function fetchApi(p) {
  if (apiCache.has(p.id)) return apiCache.get(p.id);
  let result;
  if (typeof API_KEY === 'undefined' || !API_KEY || API_KEY.startsWith('YOUR_')) {
    result = { ok: false, reason: '인증키 없음 (js/config.js)' };
  } else {
    const url = `${API_BASE}/${API_KEY}/${API_SERVICE}/json/1/5/RCP_NM=${encodeURIComponent(p.name)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json())[API_SERVICE] || {};
      const code = body.RESULT?.CODE || '';
      if (code.startsWith('ERROR')) throw new Error(`${code} ${body.RESULT?.MSG || ''}`.trim());
      const rows = body.row || [];
      const row = rows.find(r => String(r.RCP_SEQ) === String(p.id) && (r.RCP_NM || '').trim() === p.name) || null; // 부분 일치 결과 중 이름이 정확히 같은 건만
      if (!row) {
        result = { ok: false, reason: rows.length ? `"${p.name}"과 이름이 정확히 같은 레시피 없음 (유사 ${rows.length}건)` : `결과 없음 (${code || 'row 없음'})` };
      } else {
        const vals = {};
        Object.entries(API_FIELD_MAP).forEach(([k, src]) => {
          const v = String(row[src] ?? '').trim();
          if (v === '') { vals[k] = null; return; }
          vals[k] = (k === 'image' || k === 'tip') ? v : (!Number.isFinite(Number(v)) ? null : Number(v));
        });
        result = { ok: true, vals, seq: row.RCP_SEQ, count: rows.length, raw: row };
      }
    } catch (e) {
      result = { ok: false, reason: e.name === 'AbortError' ? `${API_TIMEOUT / 1000}초 타임아웃`
               : e instanceof TypeError ? '네트워크 오류 또는 CORS 차단 (브라우저 직접 호출 불가)' : e.message };
    } finally { clearTimeout(timer); }
  }
  result.at = new Date();
  apiCache.set(p.id, result);
  recordApiResponse(p, result);
  if (!result.ok) console.warn('[API 대체]', p.id, p.name, '—', result.reason);
  else console.log('[API]', p.id, p.name, '→ RCP_SEQ', result.seq, result.vals);
  return result;
}

// ---------- 스와이프 (포인터 이벤트: 터치·마우스 공통) ----------
function attachSwipe(el, { left, right, threshold = 50 }) {
  let x0 = null, y0 = null, moved = false;
  el.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; moved = false; });
  el.addEventListener('pointermove', e => { if (x0 !== null && Math.abs(e.clientX - x0) > 8) moved = true; });
  const end = e => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0; x0 = y0 = null;
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.2) return; // 세로 스크롤과 구분
    (dx < 0 ? left : right)?.();
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', () => { x0 = y0 = null; });
  el.addEventListener('click', e => { if (moved) e.stopPropagation(); }, true); // 스와이프 뒤 클릭 오작동 방지
}
const popCarousel = makeCarousel('#home-pop', '#pop-track', '#pop-dots');

// ---------- 상세 화면 ----------
let detailId = null;
// 상세에서 좌우 스와이프 → 마지막으로 본 목록/검색 결과 순서대로 이전·다음 레시피
function detailStep(d) {
  const i = navIds.indexOf(detailId); if (i < 0) return;
  const j = i + d; if (j < 0 || j >= navIds.length) return;
  const sec = $('#detail'); sec.classList.add('swiping'); sec.style.transform = `translateX(${d < 0 ? 12 : -12}px)`;
  setTimeout(() => { sec.style.transform = ''; sec.classList.remove('swiping'); }, 200);
  openDetail(navIds[j]); window.scrollTo(0, 0);
}
function syncDetailNav() {
  const i = navIds.indexOf(detailId), n = navIds.length;
  $('#d-pos').textContent = i >= 0 && n > 1 ? `${i + 1} / ${n} · 좌우로 넘겨 보세요` : (n <= 1 ? '' : '목록 밖 항목');
  $('#d-prev').disabled = !(i > 0); $('#d-next').disabled = !(i >= 0 && i < n - 1);
}
$('#d-prev').addEventListener('click', () => detailStep(-1));
$('#d-next').addEventListener('click', () => detailStep(1));
attachSwipe($('#detail'), { left: () => detailStep(1), right: () => detailStep(-1) }); // 응답이 늦게 와도 다른 레시피 화면에 덮어쓰지 않도록

function openDetail(id) {
  const p = recipes.find(r => r.id === id);
  if (!p) { go('list'); $('#list-state').innerHTML=emptyState({title:'연결된 레시피를 찾을 수 없어요',hint:'레시피가 삭제되었거나 아직 불러오지 못했어요. 목록에서 다른 레시피를 선택해 주세요.',actions:[]}); return false; }
  detailId = id;
  syncDetailNav();
  $('#d-title').innerHTML = `<span>${esc(p.name)}${lvlTag(p)} ${originChip(p)}</span><button class="fav-star${isFav(p.id) ? ' on' : ''}" id="d-fav" type="button" aria-label="즐겨찾기">${uiIcon('star', isFav(p.id))}</button>`;
  $('#d-sub').innerHTML = `${num(p.time, '분')}${tagOf(p, 'time')} · ${info(p.method)}${tagOf(p, 'method')} · ${info(uiCategory(p.category))}${tagOf(p, 'category')}${p.level ? ` · 난이도 ${esc(p.level)}${tagOf(p, 'level')}` : ''}`;
  $('#d-author').innerHTML = `${authorLine(p)}${tagOf(p, 'author')}${p.createdAt ? ` · ${new Date(p.createdAt).toLocaleDateString('ko-KR')} 등록` : ''}`;
  $('#d-src').innerHTML = `출처 ${sourceChip(p)} ${isUser(p) ? '사용자가 등록한 레시피 (검증 없음, 이 브라우저에 저장)' : p.flag === 'D' ? 'AI(Claude)로 생성한 가상 레시피 — 실제 조리법·영양 정보가 아님' : isTeam(p) ? '팀이 직접 작성한 시연용 레시피' : '식품의약품안전처 조리식품 레시피 DB'} · ${metaSummary(p)}`;
  syncDetailActions(p);
  window.inventoryUI?.detail(p);
  renderReal(p);
  $('#d-del').hidden = !isMyRecipe(p);
  $('#d-ing').innerHTML = `${info(p.ingredientsText)}${tagOf(p, 'ingredientsText')}`;
  renderIngredients(p);
  $('#d-steps').innerHTML = p.steps.length
    ? p.steps.map(s => `<li>${esc(s.text)}${s.image ? `<div class="img has-img step-img"><img src="${esc(imgUrl(s.image))}" alt="" loading="lazy" onerror="this.parentNode.remove()"></div>` : ''}</li>`).join('') + `<li class="src-line">${tagOf(p, 'steps')}</li>`
    : '<li class="mu">조리 순서 정보 없음</li>';
  // 저장 JSON 값으로 먼저 다 그린 뒤, API 항목이면 응답이 오면 해당 필드만 갈아끼움 (화면이 비는 구간 없음)
  renderDetailApiFields(p, null);
  if (apiTarget(p)) {
    $('#d-api').innerHTML = `식약처 레시피 DB에 "${esc(p.name)}" API 요청 중… (응답 전에는 JSON 원본 표시)`;
    fetchApi(p).then(r => { if (detailId === id) renderDetailApiFields(p, r); });
  } else {
    $('#d-api').textContent = isUser(p) ? 'API 미연동 (사용자 등록 레시피 — 영양 정보는 입력받지 않음)' : 'API 미연동 (저장 JSON 항목)';
  }
}

const LV = ['쉬움', '보통', '어려움'];
function realStats(id) {
  const ps = posts.filter(x => x.recipeId === id);
  const lv = ps.filter(x => LV.includes(x.actualLevel)).map(x => LV.indexOf(x.actualLevel));
  const tm = ps.filter(x => Number(x.actualTime) > 0).map(x => Number(x.actualTime));
  return { n: ps.length, lvN: lv.length, lv: lv.length ? LV[Math.round(lv.reduce((a, b) => a + b, 0) / lv.length)] : null,
           tmN: tm.length, tm: tm.length ? Math.round(tm.reduce((a, b) => a + b, 0) / tm.length) : null };
}
function renderReal(p) {
  const st = realStats(p.id), box = $('#d-real');
  const parts = [st.tm ? `평균 ${st.tm}분` : '', st.lv ? `난이도 ${st.lv}` : ''].filter(Boolean);
  box.hidden = !parts.length;
  box.innerHTML = parts.length ? `<span class="lbl">전체 사용자</span>만든 사람 ${st.n}명의 실제 기록 · ${parts.join(' · ')}${typeTag('meas')}` : '';
  // 내 요리 기록 = 이 브라우저의 cooking_logs 중 로그인한 내가 '조리 완료'한 기록 (개인 데이터, 자랑 게시물과 별개)
  const me = store.get('user', null)?.id;
  const logs = me ? store.get('cooking_logs', []).filter(r => r.recipeId === p.id && r.actorId === me).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
  const mine = $('#d-mine'); mine.hidden = !logs.length;
  if (logs.length) {
    mine.querySelector('summary').innerHTML = `<span class="lbl">나</span>내 요리 기록 보기 · ${logs.length}회`;
    mine.querySelector('ul').innerHTML = logs.map(r => `<li>${new Date(r.createdAt).toLocaleDateString('ko-KR')} · ${(r.uses || []).map(u => `${esc(u.name)} ${u.amount}${esc(u.unit || '')}`).join(', ') || '사용량 기록 없음'}${posts.some(x => x.cookingLogId === r.id) ? ' · 자랑함' : ''}</li>`).join('');
  }
}
// 필요한 재료: 냉장고와 비교해 '있음/없음' 표시, 없는 재료는 위에 알림 (양념은 비교에서 제외)
const SEASONING = ['소금', '설탕', '간장', '국간장', '저염간장', '진간장', '참기름', '들기름', '식용유', '올리브오일', '식물성기름', '후춧가루', '후추', '물', '고춧가루', '식초', '깨', '통깨', '참깨', '올리고당', '물엿', '맛술', '청주', '미림', '굴소스', '케첩', '마요네즈', '전분', '물전분', '밀가루', '다시마', '육수', '멸치육수', '매실청', '꿀', '버터'];
function parseIngredients(text) {
  return String(text || '').split(/[,\n]/).map(t => t.replace(/^[^:：]*[:：]/, '').trim()).filter(Boolean)
    .map(t => { const name = (t.match(/^[가-힣A-Za-z ]+?(?=\s*[\d(]|$)/) || [t])[0].trim() || t; return { text: t, name }; });
}
function renderIngredients(p) {
  const items = parseIngredients(p.ingredientsText), stock = fridge();
  const have = it => stock.some(s => alias(it.text).includes(alias(s.name)) || alias(s.name).includes(alias(it.name)));
  const isSeason = it => SEASONING.some(k => it.name.replace(/\s/g, '') === k || it.name.endsWith(k) && it.name.length <= k.length + 2);
  const rows = items.map(it => ({ ...it, season: isSeason(it), ok: have(it) }));
  const missing = rows.filter(r => !r.season && !r.ok);
  const tagOfRow = r => !stock.length ? '' : r.season ? '<em>양념</em>' : r.ok ? '<em>있음</em>' : '<em>없음</em>'; // 냉장고가 비어 있으면 표시 안 함
  $('#d-ing-list').innerHTML = rows.length ? rows.map(r => `<li class="${!stock.length ? '' : r.season ? 'season' : r.ok ? 'have' : 'miss'}"><span>${esc(r.text)}</span>${tagOfRow(r)}</li>`).join('')
    + `<li class="src-line">${tagOf(p, 'ingredientsText')}</li>` : `<li>${NA}</li>`;
  const alert = $('#ing-alert');
  alert.hidden = !rows.length || (!missing.length && stock.length > 0);
  alert.innerHTML = !stock.length ? `냉장고에 등록된 재료가 없어요. <button class="link-btn" type="button" data-open-fridge>재료 등록</button>`
    : missing.length ? `<b>없는 재료 ${missing.length}개</b> · ${missing.map(r => esc(r.name)).join(', ')}` : '';
}
function syncDetailActions(p) {
  const fav = $('#d-fav');
  fav.innerHTML = uiIcon('star', isFav(p.id));
  fav.setAttribute('aria-pressed', String(isFav(p.id)));
  fav.setAttribute('aria-label', isFav(p.id) ? '즐겨찾기 해제' : '즐겨찾기 추가');
  fav.classList.toggle('on', isFav(p.id));

}
document.addEventListener('click', e => { if (e.target.closest('#d-fav')) { const p = recipes.find(r => r.id === detailId); if (p) { toggleFav(p.id); syncDetailActions(p); } } });
$('#d-del').addEventListener('click', () => { if (detailId) { deleteUserRecipe(detailId); go('my'); } });
$('#d-share').addEventListener('click', () => { writeRecipeId = detailId; go('write'); });

// 영양 정보·사진·조리 팁 영역 렌더링. r = null(아직 응답 전 또는 JSON 항목) / fetchApi 결과
function renderDetailApiFields(p, r) {
  const isApi = apiTarget(p);
  const got = r && r.ok;
  const val = f => got && r.vals[f] != null ? r.vals[f] : p[f];
  const tag = f => got && r.vals[f] != null ? typeTag('api') : tagOf(p, f) + (isApi && r ? '<span class="type-tag">JSON 원본 유지</span>' : '');
  const show = (f, unit) => num(val(f), unit);
  // 영양 정보: API 항목은 응답 전·실패여도 박스를 숨기지 않고 '정보 없음 [대체]'로 표시
  // 사용자 등록(U) 레시피는 영양 정보를 입력받지 않으므로 숨기지 않고 '정보 없음'으로 보여줌 (태그 없음)
  const hasNut = isApi || isUser(p) || ['calories', 'carb', 'protein', 'fat', 'sodium'].some(f => p[f] !== null);
  $('#d-nut-box').hidden = !hasNut;
  if (hasNut) $('#d-nut').innerHTML = [['열량', 'calories', ' kcal'], ['탄수화물', 'carb', ' g'], ['단백질', 'protein', ' g'],
    ['지방', 'fat', ' g'], ['나트륨', 'sodium', ' mg']]
    .map(([k, f, u]) => `<span>${k}</span><span>${show(f, u)}${tag(f)}</span>`).join('')
    + `<span>중량</span><span>${num(p.weight, ' g')}${tagOf(p, 'weight')}</span>`;
  // 사진
  const image = val('image');
  $('#d-image-source').innerHTML = `사진 출처: ${image ? tag('image') : '사진 정보 없음 · 대체 일러스트'}`;
  $('#d-img').outerHTML = imgBox({ image, name: p.name, id: p.id }, 'sq-img', isApi && !r ? '사진 요청 중…' : '요리 사진 (1:1)')
    .replace('class="img', 'id="d-img" class="img');
  // 조리 팁
  const tip = val('tip');
  $('#d-tip-box').hidden = !isApi && !tip;
  $('#d-tip').innerHTML = tip ? `${esc(tip)}${tag('tip')}` : `정보 없음${tag('tip')}`;
  if (isApi && r) {
    const at = r.at.toLocaleTimeString('ko-KR');
    $('#d-api').innerHTML = got
      ? `식약처 레시피 DB · 요청 ${at} · "${esc(p.name)}" 검색 ${r.count}건 중 원본 ID·이름이 같은 1건 사용 (RCP_SEQ ${esc(r.seq)}) ${typeTag('api')}`
      : `식약처 레시피 DB · 요청 ${at} · ${esc(r.reason)} → API 응답 실패 · 저장 JSON 원본 유지 ${typeTag('real')}`;
  }
}

// =====================================================================
// 게시물 (사용자 데이터 U): posts_user.json + localStorage. 레시피와 같은 규칙 — flag U, meta.source "user"
// =====================================================================
const recipeOf = post => recipes.find(r => r.id === post.recipeId);
// 1. 털이 인증 표시: 사진·후기는 U, 활용한 재료는 냉장고 × 레시피 비교로 만든 '계산' 값
const usedOf = p => p.used || [];
const rescuedOf = p => usedOf(p).filter(x => x.urgent).length;
function usedLine(p) {
  const u = usedOf(p);
  return u.length ? `<p class="used-line">${uiIcon('fridge')} 활용한 재료: <b>${u.map(x => esc(x.name)).join(' · ')}</b>${typeTag('calc')}${rescuedOf(p) ? ` <span class="bg rescue">임박 재료 ${rescuedOf(p)}종 활용</span>` : ''}</p>`
    + (p.actualLevel || p.actualTime ? `<p class="mu">실제 ${p.actualLevel ? esc(p.actualLevel) : ''}${p.actualLevel && p.actualTime ? ' · ' : ''}${p.actualTime ? `${p.actualTime}분` : ''}${typeTag('meas')}</p>` : '')
    : `<p class="used-line mu">${uiIcon('fridge')} 활용한 재료 기록 없음</p>`;
}
const postLikes = id => (store.get('plikes', {})[id] || 0);
const postLikedByMe = id => store.get('pliked', []).includes(id);
function togglePostLike(id) {
  const likes = store.get('plikes', {}), liked = new Set(store.get('pliked', []));
  if (liked.has(id)) { liked.delete(id); likes[id] = Math.max(0, (likes[id] || 0) - 1); } else { liked.add(id); likes[id] = (likes[id] || 0) + 1; }
  store.set('plikes', likes); store.set('pliked', [...liked]);
}
const postVotes = id => (store.get('pvotes', {})[id] || 0);
const postVotedByMe = id => store.get('pvoted', []).includes(id);
function togglePostVote(id) {
  const votes = store.get('pvotes', {}), voted = new Set(store.get('pvoted', []));
  if (voted.has(id)) { voted.delete(id); votes[id] = Math.max(0, (votes[id] || 0) - 1); } else { voted.add(id); votes[id] = (votes[id] || 0) + 1; }
  store.set('pvotes', votes); store.set('pvoted', [...voted]);
}
const isMyPost = post => { const u = store.get('user', null); return !!u && post.authorId === u.id; };
const lvlTag = r => r && r.level ? `<span class="lvl">${esc(r.level)}</span>` : '';
const ago = iso => {
  const d = (Date.now() - new Date(iso)) / 60000;
  return d < 60 ? `${Math.max(1, Math.round(d))}분 전` : d < 1440 ? `${Math.round(d / 60)}시간 전` : `${Math.round(d / 1440)}일 전`;
};
function postImg(post, cls, label) { return imgBox({ image: post.image, name: post.recipeName }, cls, label); }
// 게시물 카드가 '내 냉장고로 만들 수 있는' 글인지: 연결 레시피의 재료에 보유 재료가 들어 있는지
const postMakeable = post => { const r = recipeOf(post); return r ? matchCount(r, myIngredients()) : 0; };
const postBadge = post => { const r = recipeOf(post), hit = postMakeable(post), total = myIngredients().length;
  return !r ? '<span class="chip gr">레시피 삭제됨</span>' : hit && hit === total ? '<span class="bg a">내 냉장고로 바로 가능</span>' : hit ? `<span class="bg">보유 재료 ${hit}종 포함</span>` : '<span class="chip gr">보유 재료 없음</span>'; };

// ---------- 홈: 추천 재료 칩 · 인기 게시물 · 이번 주 많이 활용한 레시피 ----------
function renderSuggest() {} // 홈에 추천 재료 칩을 띄우지 않음
function renderHome() {
  renderSuggest(); renderHomeReco(); homeCount();
  syncTopLogin(store.get('user', null));
  const top = [...posts].sort((a, b) => postLikes(b.id) - postLikes(a.id) || b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  $('#pop-track').innerHTML = top.length ? top.map((p, i) => { const r = recipeOf(p); return `<article class="pop" data-go="post" data-post="${p.id}">
      <div class="img pop-img ${p.image ? 'has-img' : 'no-img'}"><span class="rank">${i + 1}</span>${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.recipeName)} 사진">` : pic('noimage')}</div>
      <div class="pop-body"><b>${esc(p.recipeName)}</b> <span class="flag flag-U">U</span><p class="mu">@${esc(p.author)}${r ? ` · ${esc(uiCategory(r.category || ''))}` : ''}</p><p class="likes">${uiIcon('heart')} 좋아요 ${postLikes(p.id)}개</p></div></article>`; }).join('')
    : miniEmpty('아직 올라온 자랑이 없어요');
  popCarousel.set(top.length);
  // 이번 주: 최근 7일 게시물을 레시피별로 셈
  const range = weekRange(0), cnt = {};
  posts.filter(p => inWeek(p, range)).forEach(p => { cnt[p.recipeId] = (cnt[p.recipeId] || 0) + 1; });
  const rows = Object.entries(cnt).map(([id, n]) => ({ r: recipes.find(x => x.id === Number(id)), n })).filter(x => x.r)
    .sort((a, b) => b.n - a.n).slice(0, 4);
  $('#home-week').innerHTML = rows.length ? `<div class="grid2 week">${rows.map(({ r, n }) => `<div data-go="detail" data-id="${r.id}">${imgBox(r, '', '사진')}<b>${esc(r.name)}</b>${lvlTag(r)} ${flagChip(r)}<p class="mu">이번 주 ${n}명이 만들었어요</p></div>`).join('')}</div>`
    : miniEmpty('이번 주 기록이 아직 없어요');
}

// ---------- 피드 ----------
let feedMineOnly = false, feedSortPop = false;
function renderFeed() {
  const u = store.get('user', null);
  const raw = $('#post-q').value.trim();
  let list = postHits(raw);

  list.sort((a, b) => feedSortPop ? (postLikes(b.id) - postLikes(a.id) || b.createdAt.localeCompare(a.createdAt)) : b.createdAt.localeCompare(a.createdAt));
  $('#feed-sort').textContent = feedSortPop ? '인기순' : '최신순';
  $('#feed-count').textContent = list.length ? (raw ? `검색 결과 ${list.length}개` : `자랑 ${list.length}개`) : '';
  $('#feed-list').innerHTML = list.length ? list.map(p => `<article class="post">
      <header class="post-head"><span class="avatar" aria-hidden="true"></span><div><b>@${esc(p.author)}</b> <span class="flag flag-U">U</span><p class="mu">${ago(p.createdAt)}</p></div>${isMyPost(p) ? `<button class="more" type="button" data-pdel="${p.id}" aria-label="삭제">${uiIcon('trash')}</button>` : ''}</header>
      <div data-go="post" data-post="${p.id}">${postImg(p, 'post-img', '요리 사진 (1:1)')}</div>
      <div class="post-act"><button class="like${postLikedByMe(p.id) ? ' on' : ''}" type="button" data-plike="${p.id}" aria-label="좋아요" aria-pressed="${postLikedByMe(p.id)}">${uiIcon('heart', postLikedByMe(p.id))}</button><button class="vote${postVotedByMe(p.id) ? ' on' : ''}" type="button" data-pvote="${p.id}" aria-label="랭킹 투표" aria-pressed="${postVotedByMe(p.id)}">${uiIcon('vote', postVotedByMe(p.id))}</button>${recipeOf(p) ? `<button type="button" data-go="detail" data-id="${p.recipeId}" aria-label="레시피 보기" style="margin-left:auto">${uiIcon('book')}</button>` : ''}</div>
      <div class="post-body"><b>좋아요 ${postLikes(p.id)}개</b> <span class="mu">· 랭킹 투표 ${postVotes(p.id)}표</span>
        <p><b>${esc(p.recipeName)}</b> ${recipeOf(p) ? flagChip(recipeOf(p)) : ''}</p>
        ${usedLine(p)}
        <p><b>@${esc(p.author)}</b> ${p.text ? esc(p.text) : '<span class="na">후기 없음</span>'}</p>
        <div class="row">${postBadge(p)}${recipeOf(p) ? `<span class="chip gr">${esc((recipeOf(p).ingredientsText || '').split(',').slice(0, 3).map(t => t.trim().split(' ')[0]).join(' · '))}</span>` : ''}</div>
        ${recipeOf(p) ? `<button class="btn dk" data-go="detail" data-id="${p.recipeId}">연결된 레시피 보기</button>` : ''}
      </div></article>`).join('')
    : `<div style="padding:0 16px">${emptyState({
        title: raw ? `"${esc(raw)}"에 맞는 자랑이 없어요` : '아직 올라온 자랑이 없어요',
        hint: raw ? '' : '레시피 상세의 "요리 자랑하기"로 첫 자랑을 올려 보세요.',
        actions: raw ? [] : [{ label: '레시피 보기', go: 'list', dark: true }],
      })}</div>`;
}
$('#feed-sort').addEventListener('click', () => { feedSortPop = !feedSortPop; renderFeed(); });
document.addEventListener('click', e => {
  if (e.target.closest('#feed-off')) { feedMineOnly = false; renderFeed(); }
  const l = e.target.closest('[data-plike]');
  if (l) { togglePostLike(Number(l.dataset.plike)); renderFeed(); renderHome(); const nb = $(`[data-plike="${l.dataset.plike}"]`); if (nb) nb.classList.add('heart-pop'); if ($('#post').classList.contains('on')) openPost(postId); }
  const vb = e.target.closest('[data-pvote]');
  if (vb) { togglePostVote(Number(vb.dataset.pvote)); renderFeed(); const nb = $(`[data-pvote="${vb.dataset.pvote}"]`); if (nb) nb.classList.add('heart-pop'); if ($('#post').classList.contains('on')) openPost(postId); }
  const d = e.target.closest('[data-pdel]');
  if (d) { deletePost(Number(d.dataset.pdel)); renderFeed(); renderHome(); }
});
function deletePost(id) {
  if (!isMyPost(posts.find(p => p.id === id) || {})) return;
  store.set('deleted_post_ids', [...new Set([...store.get('deleted_post_ids', []), id])]);
  if (!store.get('deleted_post_ids', []).includes(id)) return;
  store.set('posts', store.get('posts', []).filter(p => p.id !== id));
  posts = posts.filter(p => p.id !== id);
}

// ---------- 게시물 검색 (피드 탭 · 검색 화면 게시물 탭 공용) ----------
let postSortPop = false;
function postHits(raw) {
  const q = norm(alias(raw));
  return posts.filter(p => !q || norm(p.recipeName).includes(q) || norm(p.author).includes(q) || norm(alias(recipeOf(p)?.ingredientsText)).includes(q) || norm(p.text).includes(q));
}
function searchPosts() { renderFeed(); } // 피드 상단 검색창이 목록을 바로 거름
$('#post-q').addEventListener('input', renderFeed);
// ---------- 게시물 상세 ----------
let postId = null;
function openPost(id) {
  const p = posts.find(x => x.id === id); if (!p) return;
  postId = id;
  const r = recipeOf(p);
  $('#p-img').outerHTML = postImg(p, 'sq-img', '요리 사진 (1:1)').replace('class="img', 'id="p-img" class="img');
  $('#p-title').innerHTML = `${esc(p.recipeName)} <span class="mu">@${esc(p.author)}</span> <span class="flag flag-U">U</span>`;
  $('#p-sub').innerHTML = `${r ? `${esc(uiCategory(r.category || ''))} · ` : ''}${p.text ? `"${esc(p.text)}"` : '<span class="na">후기 없음</span>'} · ${new Date(p.createdAt).toLocaleString('ko-KR')}`;
  $('#p-ing').innerHTML = r ? `${info(r.ingredientsText)}` : '<span class="na">연결된 레시피가 삭제됨</span>';
  const pts = postPoints(p);
  $('#p-used').innerHTML = `<div class="real-h"><b>털이 인증</b><span class="mu">이 요리 게시물의 털이 점수 ${pts.total}점</span></div>${usedLine(p)}
    <p class="mu pts-break">게시 ${PT_POST} + 투표 ${PT_LIKE}×${postVotes(p.id)} + 재료 활용 ${PT_USED}×${usedOf(p).length} + 임박 재료 활용 ${PT_RESCUE}×${rescuedOf(p)}</p>`;
  renderNext(p);
  $('#p-like').innerHTML = `${uiIcon('heart', postLikedByMe(id))}좋아요 ${postLikes(id)}개`;
  $('#p-like').setAttribute('aria-pressed', String(postLikedByMe(id))); $('#p-like').classList.toggle('on-like', postLikedByMe(id));
  $('#p-vote').innerHTML = `${uiIcon('vote', postVotedByMe(id))}랭킹 투표 ${postVotes(id)}표`;
  $('#p-vote').setAttribute('aria-pressed', String(postVotedByMe(id))); $('#p-vote').classList.toggle('on-vote', postVotedByMe(id));
  $('#p-del').hidden = !isMyPost(p);
  $('#p-recipe').hidden = !r;
}
$('#p-like').addEventListener('click', () => { togglePostLike(postId); openPost(postId); $('#p-like').classList.add('heart-pop'); renderHome(); });
$('#p-vote').addEventListener('click', () => { togglePostVote(postId); openPost(postId); $('#p-vote').classList.add('heart-pop'); });
$('#p-del').addEventListener('click', () => { deletePost(postId); go('feed'); });
$('#p-recipe').addEventListener('click', () => { const p = posts.find(x => x.id === postId); if (p && recipeOf(p)) { openDetail(p.recipeId); go('detail'); } });

// 3. 남은 재료 이어 쓰기: 내 요리를 올린 직후, 냉장고에 남은 재료로 바로 만들 수 있는 레시피 (임박 재료 우선)
function renderNext(p) {
  const box = $('#p-next');
  if (!isMyPost(p)) { box.hidden = true; return; }
  const left = [...fridge()].sort((a, b) => (dday(a.exp) ?? 999) - (dday(b.exp) ?? 999));
  box.hidden = false;
  if (!left.length) { box.innerHTML = `<div class="real-h"><b>냉장고가 비었어요</b></div><p class="mu">남은 재료가 없어요. 장 본 재료를 넣으면 다음 요리를 추천해 드려요.</p><button class="btn" data-go="my" id="p-next-fr">냉장고 재료 등록</button>`; return; }
  const mine = left.map(it => it.name);
  const recs = recipes.filter(x => x.id !== p.recipeId).map(x => ({ p: x, hit: matchCount(x, mine), urgent: fridgeHits(x).filter(isUrgent).length }))
    .filter(x => x.hit > 0).sort((a, b) => b.urgent - a.urgent || b.hit - a.hit || (b.p.flag !== 'D') - (a.p.flag !== 'D')).slice(0, 3);
  box.innerHTML = `<div class="real-h"><b>남은 재료 이어 쓰기</b>${typeTag('calc')}</div>
    <p class="left-line">${left.slice(0, 6).map(it => `<span class="chip ing${isUrgent(it) ? ' urgent' : ''}">${esc(it.name)}${it.qty ? ` ${esc(it.qty)}` : ''}${dTag(it)}</span>`).join(' ')} 남았어요</p>
    ${recs.length ? `<p class="mu" style="margin-top:6px">다음 끼니에 활용할 레시피</p>` + withThumbs(recs).map(({ p: x, hit, urgent, t }) => miniCard(x, `<span class="bg${urgent ? ' rescue' : ''}">${urgent ? `임박 ${urgent}` : `재료 ${hit}`}</span>`, t)).join('')
      : '<p class="mu" style="margin-top:6px">남은 재료를 포함한 레시피가 없어요. 재료를 하나 더 넣어 보세요.</p>'}`;
}
$('#p-next').addEventListener('click', e => { if (e.target.closest('#p-next-fr')) setTimeout(() => $('#my [data-tab="fr"]').click(), 0); });

// ---------- 게시물 작성 ----------
let writeRecipeId = null, writePhoto = null, writeLevel = null;
// 활용한 재료 후보 = 레시피 재료 중 내 냉장고에 있는 것 (자동 체크). '모두 사용'이면 냉장고에서 빠지고, 아니면 남은 양을 적음
const syncLevel = () => $$('#w-level .chip').forEach(c => c.classList.toggle('on', c.dataset.wl === writeLevel));
function renderWriteUsed() {
  syncLevel();
  window.inventoryUI?.renderPostCooking();
  const r = recipes.find(x => x.id === Number($('#w-recipe').value));
  $('#w-time-hint').textContent = r?.time ? `레시피 조리 시간 ${r.time}분` : '';
}
$('#w-level').addEventListener('click', e => { const c = e.target.closest('[data-wl]'); if (!c) return; writeLevel = writeLevel === c.dataset.wl ? null : c.dataset.wl; syncLevel(); });
function openWrite() {
  const u = store.get('user', null);
  if (!u) { go('login'); authMsg('요리를 자랑하려면 먼저 로그인해 주세요.', false); return; }
  writePhoto=null; $('#w-photo').value=''; $('#w-text').value=''; $('#w-msg').hidden=true;
  $('#w-preview').innerHTML='사진 미리보기'; $('#w-preview').classList.remove('has-img');
  const sel = $('#w-recipe');
  sel.innerHTML = '<option value="">레시피 선택</option>' + [...recipes].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map(r => `<option value="${r.id}">${esc(r.name)} (${r.flag})</option>`).join('');
  if (writeRecipeId) sel.value = String(writeRecipeId);
  $('#w-author').textContent = `작성자: ${u.nick}`;
  writeLevel = null; $('#w-time').value = '';
  renderWriteUsed(); syncWrite();
}
function syncWrite() {
  $('#w-len').textContent = $('#w-text').value.length;
  $('#w-go').disabled = !($('#w-recipe').value && writePhoto);
  $('#w-go').textContent = $('#w-go').disabled ? `자랑하기 (${!$('#w-recipe').value ? '레시피' : '사진'} 필요)` : '자랑하기';
}
$('#w-text').addEventListener('input', syncWrite);
$('#w-recipe').addEventListener('change', () => { renderWriteUsed(); syncWrite(); });
// 사진: 파일을 480px JPEG data URL로 줄여 저장 (localStorage 용량 보호). 서버 업로드는 없음
$('#w-photo').addEventListener('change', e => {
  const f = e.target.files[0]; writePhoto = null; syncWrite();
  if (!f) return;
  const img = new Image(); img.onload = () => {
    const max = 480, k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    writePhoto = c.toDataURL('image/jpeg', 0.7);
    $('#w-preview').innerHTML = `<img src="${writePhoto}" alt="미리보기">`; $('#w-preview').classList.add('has-img');
    URL.revokeObjectURL(img.src); syncWrite();
  };
  img.onerror = () => { $('#w-msg').hidden = false; $('#w-msg').textContent = '이미지 파일을 읽지 못했어요. JPG·PNG를 골라 주세요.'; };
  img.src = URL.createObjectURL(f);
});
$('#write-form').addEventListener('submit', e => {
  e.preventDefault();
  const u = store.get('user', null); if (!u) return go('login');
  const r = recipes.find(x => x.id === Number($('#w-recipe').value));
  if (!r || !writePhoto) { $('#w-msg').hidden = false; $('#w-msg').textContent = '레시피와 사진은 필수예요.'; return; }
  const ids = [...posts.map(p => p.id), ...store.get('deleted_post_ids', [])];
  // 활용한 재료: 체크된 행만. 냉장고 항목의 임박 여부를 올린 시점 기준으로 기록 (나중에 날짜가 지나도 점수 불변)
  let cookingRecord;
  try { cookingRecord = window.inventoryUI.postUsage(r.id); }
  catch (error) { $('#w-msg').hidden = false; $('#w-msg').textContent = error.message; return; }
  const used = cookingRecord.uses;
  const t = Number($('#w-time').value);
  if ($('#w-time').value && (!Number.isInteger(t) || t < 1 || t > 600)) { $('#w-msg').hidden=false; $('#w-msg').textContent='조리 시간은 1~600분의 정수로 입력해 주세요.'; return; }
  const post = { id: ids.length ? Math.max(...ids) + 1 : 1, flag: 'U', recipeId: r.id, recipeName: r.name,
    author: u.nick, authorId: u.id, text: $('#w-text').value.trim(), image: writePhoto, createdAt: new Date().toISOString(),
    cookingLogId: cookingRecord.id, used, actualLevel: writeLevel, actualTime: t > 0 ? t : null,
    meta: { source: 'user', real: [], dummy: [], api: [], user: ['recipeId', 'text', 'image', 'author', 'actualLevel', 'actualTime'], calc: ['used'],
            note: `사용자 ${u.nick} 요리 게시물 — 이 브라우저에 저장. used(활용한 재료)는 레시피 재료와 냉장고를 비교해 계산` } };
  Object.assign(post, normalizeStored('posts', [post])[0]);
  try { store.set('posts', [...store.get('posts', []), post]); } catch {}
  if (!store.get('posts', []).some(p => p.id === post.id)) { $('#w-msg').hidden = false; $('#w-msg').textContent = '브라우저 저장 공간이 가득 찼어요. 오래된 게시물을 지우거나 작은 사진을 써 주세요.'; return; }
  posts = [...posts, post];
  sheetLog('post', { id: post.id, recipeId: post.recipeId, recipeName: post.recipeName, author: post.author, text: post.text });
  writePhoto = null; writeRecipeId = null; e.target.reset(); $('#w-preview').innerHTML = '미리보기'; $('#w-preview').classList.remove('has-img'); $('#w-msg').hidden = true;
  openPost(post.id); go('post');
});


// =====================================================================
// 랭킹 (경진대회): 이번 주(월 00:00 ~ 일 24:00) 게시물로 점수 계산. 저장하지 않고 화면에서 셈
// =====================================================================
const PT_POST = 10, PT_LIKE = 3, PT_USED = 2, PT_RESCUE = 5;
const postPoints = p => { const v = postVotes(p.id), u = usedOf(p).length, r = rescuedOf(p);
  return { v, u, r, total: PT_POST + PT_LIKE * v + PT_USED * u + PT_RESCUE * r }; };
function weekRange(offset = 0) { // offset 0 = 이번 주, -1 = 지난주
  const now = new Date(); const day = (now.getDay() + 6) % 7; // 월=0
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + offset * 7);
  const end = new Date(start); end.setDate(start.getDate() + 7);
  return { start, end };
}
const inWeek = (p, w) => { const d = new Date(p.createdAt); return d >= w.start && d < w.end; }; // 홈·랭킹 공용
const fmtMD = d => `${d.getMonth() + 1}/${d.getDate()}`;
function scorePosts(list) {
  const byRecipe = Object.create(null), byChef = Object.create(null);
  list.forEach(p => {
    const pp = postPoints(p), pts = pp.total;
    const r = byRecipe[p.recipeId] ||= { id: p.recipeId, name: p.recipeName, posts: 0, likes: 0, used: 0, rescued: 0, pts: 0 };
    r.posts++; r.likes += pp.v; r.used += pp.u; r.rescued += pp.r; r.pts += pts;
    const c = byChef[p.authorId] ||= { id: p.authorId, nick: p.author, posts: 0, likes: 0, used: 0, rescued: 0, pts: 0, best: null };
    c.posts++; c.likes += pp.v; c.used += pp.u; c.rescued += pp.r; c.pts += pts; if (!c.best || postPoints(p).total > postPoints(c.best).total) c.best = p;
  });
  const sortF = (a, b) => b.pts - a.pts || b.likes - a.likes || b.posts - a.posts;
  const chefs = Object.values(byChef);
  return { recipes: Object.values(byRecipe).sort(sortF), chefs: [...chefs].sort(sortF),
           thieves: chefs.filter(c => c.used).sort((a, b) => b.used - a.used || b.rescued - a.rescued || b.pts - a.pts) };
}
function rankRow(i, html, pts, sub, attrs = '', cls = '') {
  return `<div class="rank-row r${i + 1} ${cls}" ${attrs}><span class="medal">${i < 3 ? ['1','2','3'][i] : i + 1}</span>${html}<div class="score"><b>${pts}</b><span>${sub}</span></div></div>`;
}
function renderRank() {
  const { start, end } = weekRange(0), last = weekRange(-1);
  const cur = scorePosts(posts.filter(p => inWeek(p, { start, end })));
  const prev = scorePosts(posts.filter(p => inWeek(p, last)));
  const u = store.get('user', null);
  const leftMs = end - Date.now(), leftD = Math.floor(leftMs / 86400000), leftH = Math.floor((leftMs % 86400000) / 3600000);
  $('#rank-period').textContent = '주간 랭킹';
  $('#rank-left').textContent = `${fmtMD(start)} ~ ${fmtMD(new Date(end - 1))} · 마감까지 ${leftD}일 ${leftH}시간`;
  const emptyR = emptyState({ title: '이번 주 자랑이 아직 없어요', hint: '첫 자랑을 올리면 바로 1위예요.', actions: [] });
  $('#rank-recipes').innerHTML = cur.recipes.length ? withThumbs(cur.recipes.map(r => ({ p: recipes.find(x => x.id === r.id) || { id: r.id, name: r.name } }))).map(({ p, t }, i) => {
      const r = cur.recipes[i];
      return rankRow(i, `${imgBox(p, '', '요리 사진', t)}<div class="body"><b>${esc(r.name)}</b>${lvlTag(p)} ${p.flag ? flagChip(p) : ''}<span class="mu">자랑 ${r.posts}건 · 투표 ${r.likes}표</span></div>`, r.pts, '점', `data-go="detail" data-id="${r.id}"`);
    }).join('') : emptyR;
  $('#rank-chefs').innerHTML = cur.chefs.length ? cur.chefs.map((c, i) =>
      rankRow(i, `<span class="avatar" aria-hidden="true"></span><div class="body"><b>@${esc(c.nick)} <span class="flag flag-U">U</span></b><span class="mu">자랑 ${c.posts}건 · 투표 ${c.likes}표</span></div>`, c.pts, '점', c.best ? `data-go="post" data-post="${c.best.id}"` : '', u && c.id === u.id ? 'me' : '')).join('')
    : emptyR;
  const chefRow = (key, unit, emptyTitle, emptyHint) => (list => list.length ? list.map((c, i) =>
      rankRow(i, `<span class="avatar" aria-hidden="true"></span><div class="body"><b>@${esc(c.nick)} <span class="flag flag-U">U</span></b><span class="mu">재료 활용 ${c.used}회 · 임박 ${c.rescued}회</span></div>`, c[key], unit, c.best ? `data-go="post" data-post="${c.best.id}"` : '', u && c.id === u.id ? 'me' : '')).join('')
    : emptyState({ title: emptyTitle, hint: emptyHint, actions: [] }));
  $('#rank-thief').innerHTML = chefRow('used', '회', '아직 활용한 재료 기록이 없어요', '조리 완료 기록을 연결해 자랑하면 집계돼요.')(cur.thieves);
}
// 랭킹 상단 작은 필터 칩
document.addEventListener('click', e => {
  const c = e.target.closest('[data-rtab]'); if (!c) return;
  $$('#rank [data-rtab]').forEach(b => { b.classList.toggle('on', b === c); b.setAttribute('aria-selected', String(b === c)); });
  $$('#rank .rpane').forEach(p => p.classList.toggle('on', p.dataset.rpane === c.dataset.rtab));
});
const fromHash = () => { const h = location.hash.slice(1); return h in TAB_OF ? h : 'home'; };
addEventListener('hashchange', () => go(fromHash())); // 주소 직접 입력 · 뒤로 가기 대응
renderMine();
go(fromHash());
syncFind();
setAuthMode('in');
loadData();
