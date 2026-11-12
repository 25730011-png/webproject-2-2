// 화면 전환 · 탭 · TOP 버튼 (와이어프레임용 최소 동작)
const TAB_OF = {home:'home',list:'list',detail:'list',feed:'feed',post:'feed',write:'feed',rank:'rank',my:'my',new:'my',spec:'my',login:''};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function go(id) {
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.go === TAB_OF[id]));
  $('.tabbar').style.display = id === 'login' ? 'none' : 'flex';
  document.documentElement.classList.toggle('snap', id === 'feed'); // 피드에서만 게시물 단위로 스크롤
  window.scrollTo(0, 0);
  if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
  if (id === 'list') renderList(); // 레시피 화면은 열 때마다 검색어·조건·보유 재료 기준으로 다시 그림
  if (id === 'rank') renderRank();
  if (id === 'my') renderMy();
  if (id === 'new') $('#n-author').textContent = `작성자: ${nickname()}`;
  if (id === 'home') renderHome();
  if (id === 'feed') { renderFeed(); searchPosts(); }
  if (id === 'write') openWrite();
  if (id === 'spec') renderSpec();
}

document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) {
    if (g.disabled) return;
    if (g.dataset.mode === 'all') { flt.mineOnly = false; listShown = PAGE; }
    if (g.dataset.id) openDetail(Number(g.dataset.id)); // 카드에 id가 있으면 그 레시피 상세
    if (g.dataset.post) openPost(Number(g.dataset.post)); // 게시물 카드
    return go(g.dataset.go);
  }
  const t = e.target.closest('[data-tab]'); // 탭(마이 · 목록 배지)
  if (t) {
    const wrap = t.closest('.screen');
    $$('.tabs button', wrap).forEach(b => b.classList.toggle('on', b === t));
    $$('.pane', wrap).forEach(p => p.classList.toggle('on', p.dataset.pane === t.dataset.tab));
  }
  // 피드: 좋아요 · 저장 토글
  const like = e.target.closest('.like');
  if (like) { like.classList.toggle('on'); like.textContent = like.classList.contains('on') ? '♥' : '♡'; }
  const save = e.target.closest('.save');
  if (save) save.textContent = save.textContent === '☆' ? '★' : '☆';
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
  $('#home-go').textContent = mine.length ? (n ? `이 재료로 만들 수 있는 레시피 ${n}건 보기 →` : '이 재료가 들어간 레시피가 없어요 — 재료를 바꿔 보세요') : `레시피 전체 ${n}건 보기 →`;
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
$('#mine').addEventListener('click', e => {
  if (e.target.classList.contains('chip')) { e.target.remove(); syncFind(); renderHomeReco(); renderSuggest(); }
});
$('#suggest').addEventListener('click', e => {
  const c = e.target.closest('.chip');
  if (!c) return;
  const chip = document.createElement('span');
  chip.className = 'chip ing';
  chip.textContent = c.textContent.replace('+', '').trim() + ' ✕';
  $('#mine').append(chip);
  syncFind();
  renderHomeReco();
  renderSuggest();
});
// 홈: 재료를 직접 입력하고 Enter → 칩 추가 (중복·빈값은 무시). 없는 재료를 넣으면 목록에서 '결과 없음' 화면이 나옴
function addIngredient(name) {
  name = name.trim();
  if (!name || myIngredients().includes(name)) return;
  const chip = document.createElement('span');
  chip.className = 'chip ing';
  chip.textContent = name + ' ✕';
  $('#mine').append(chip);
  syncFind();
  renderHomeReco();
  renderSuggest();
}
$('#ing-q').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  addIngredient(e.target.value);
  e.target.value = '';
});

// 로그인: 아이디(영문·숫자 4~16자) + 닉네임(2~12자)이 모두 맞아야 시작하기 활성
function syncLogin() {
  const email = $('#uemail').value.trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const nick = $('#nick').value.trim();
  const nickOk = nick.length >= 2 && nick.length <= 12;
  $('#login-go').disabled = !(emailOk && nickOk);
}
['#uemail', '#nick'].forEach(s => $(s).addEventListener('input', syncLogin));
$('#login-go').addEventListener('click', () => {
  const email = $('#uemail').value.trim().toLowerCase(), nick = $('#nick').value.trim();
  store.set('user', { id: email, email, nick, at: new Date().toISOString() });
  sheetLog('login', { email, nick });
});
$('#my-logout').addEventListener('click', () => { try { localStorage.removeItem('ft_user'); } catch {} renderMy(); });
// 선택: Google Sheets 웹앱(Apps Script)에 기록 — js/config.js의 SHEET_WEBAPP_URL이 있을 때만. 실패해도 화면은 localStorage로 동작
function sheetLog(kind, payload) {
  if (typeof SHEET_WEBAPP_URL === 'undefined' || !SHEET_WEBAPP_URL) return;
  try {
    fetch(SHEET_WEBAPP_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ kind, at: new Date().toISOString(), ...payload }) })
      .then(() => console.log('[시트 기록]', kind)).catch(e => console.warn('[시트 기록 실패]', kind, e.message));
  } catch (e) { console.warn('[시트 기록 실패]', kind, e.message); }
}
const nickname = () => store.get('user', null)?.nick || '익명';

// =====================================================================
// 사용자 데이터 (U): 좋아요 · 즐겨찾기 · 등록 레시피 — 서버가 없으므로 이 브라우저의 localStorage에 JSON으로 저장
// 저장 JSON(J)·API(A)·가상(D)과 구분해 U로 표시. 팀 저장소의 user_recipes.json·posts.json은 개발자가 Console에서 JSON.stringify(store.get('recipes'))로 꺼내 갱신
// =====================================================================
const store = {
  get(k, d) { try { const v = localStorage.getItem('ft_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ft_' + k, JSON.stringify(v)); } catch (e) { console.warn('[저장 실패]', k, e.message); } },
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
// 7주차: JSON 데이터 불러오기 (강의 1.1 ① JSON → ② fetch → ③ 데이터 점검 → ④ 렌더링 → ⑤ 화면)
// =====================================================================

// ① JSON 경로 — 6주차에 만든 data/ 폴더. GitHub Pages 배포 주소에서 확인 (file:// 에서는 fetch가 막힘)
const DATA_URL = './data/recipes.json';
const USER_URL = './data/user_recipes.json'; // 사용자 등록 레시피를 팀 저장소에 반영한 파일 (없어도 동작)
const POSTS_URL = './data/posts.json';       // 사용자 게시물을 팀 저장소에 반영한 파일 (없어도 동작)
const DUMMY_URL = './data/recipes_dummy.json'; // AI(Claude)로 만든 가상 레시피 210건 (flag D) — 300건 이상 검색 시연용
const ING_URL = './data/ingredients.json';   // 재료 사전 (추천 칩 · 표기 통일)
let ingredientsDict = [];                    // ingredients.json 원본
let posts = [];                              // 게시물 원본 배열 (posts.json + localStorage)

// ③ 원본 배열: JSON에서 읽은 데이터를 그대로 보관. 필터·정렬은 여기서 새 배열을 만들어 화면에 전달 (강의 1.3.1)
let recipes = [];
let loadFailed = false; // 불러오기 실패(경로·문법 오류)와 결과 없음(0건)을 화면에서 구분하기 위해 (강의 1.2)

// 데이터 명세서 기준 점검 상수 (data/COOKRCP01_100.xlsx 6_meta 플래그 정의 시트와 같음)
const REQUIRED = ['id', 'name', 'method', 'category', 'ingredientsText', 'meta'];
const ALLOWED = {
  method:   ['끓이기', '기타', '볶기', '굽기', '찌기'],
  category: ['국&찌개', '반찬', '밥', '일품'],
  level:    ['쉬움', '보통', '어려움'],
  flag:     ['J', 'A', 'D', 'U'],      // 팀 규칙: J 저장 JSON / A 저장 JSON + Open API / D AI 생성 가상(더미) / U 사용자 등록
};
const FLAG_OF_SOURCE = { json: 'J', api: 'A', dummy: 'D', user: 'U' };
const TYPES = { id: 'number', flag: 'string', name: 'string', method: 'string', category: 'string', author: 'string',
                time: 'number', level: 'string', calories: 'number', sodium: 'number',
                image: 'string', ingredientsText: 'string', tip: 'string' };

// 배열 여부·건수·필드·id·빈 값·자료형·허용값·필수 필드·출처 플래그를 Console에 출력하고, 필수 필드가 빠진 항목은 제외해 돌려줌 (강의 1.3.2)
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
    // 출처 플래그(meta) 점검 — 강의 1.4.4: source 누락·허용값 밖, 작성 주체 집계
    const s = p.meta?.source;
    if (!s) warn.push(`출처 플래그 누락: id ${p.id} meta.source`);
    else if (!['json', 'api', 'dummy', 'user'].includes(s)) warn.push(`출처 플래그 허용값 밖: id ${p.id} meta.source = "${s}"`);
    src[s || '누락'] = (src[s || '누락'] || 0) + 1;
    // 화면 표식 flag(J/A/U)와 meta.source가 어긋나면 경고 — 둘은 같은 사실을 가리켜야 함
    if (!p.flag) warn.push(`flag 누락: id ${p.id}`);
    else if (FLAG_OF_SOURCE[s] && p.flag !== FLAG_OF_SOURCE[s]) warn.push(`flag 불일치: id ${p.id} flag "${p.flag}" ≠ meta.source "${s}"`);
    // API 플래그 점검 — source "api"면 api 필드가 있어야 하고, 그 필드는 JSON에 값을 두지 않음 (강의 1.4.4 meta.api)
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
    if (miss.length) warn.push(`필수 필드 누락: id ${p.id} ${miss.join('·')} → 화면에서 제외`);
    return !miss.length;
  });
  console.log('빈 값(null) 수:', nulls);
  console.log('항목 출처:', src, '| 작성 주체:', who);
  if (warn.length) warn.forEach(w => console.warn(w)); else console.log('경고: 없음');
  console.log('화면에 표시할 건수:', valid.length);
  console.groupEnd();
  return valid;
}

// ② fetch: 파일을 요청하고 응답을 JavaScript 배열로 변환. 실패하면 catch에서 오류 화면 (강의 1.2 "불러오기 실패")
function loadData() {
  fetch(DATA_URL)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(async data => {
      // 사용자 등록 레시피: 저장소 파일(user_recipes.json) + 이 브라우저 저장소를 합침 (같은 id면 브라우저 쪽이 최신)
      let fileUsers = [];
      try { const r = await fetch(USER_URL); if (r.ok) fileUsers = await r.json(); } catch (e) { console.warn('[user_recipes.json 없음]', e.message); }
      const localUsers = store.get('recipes', []);
      const users = [...fileUsers.filter(u => !localUsers.some(l => l.id === u.id)), ...localUsers];
      let dummy = [];
      try { const r = await fetch(DUMMY_URL); if (r.ok) dummy = await r.json(); } catch (e) { console.warn('[recipes_dummy.json 없음]', e.message); }
      recipes = checkData([...data, ...dummy, ...users], `${DATA_URL}(${data.length}) + ${DUMMY_URL}(${dummy.length}) + ${USER_URL}(${fileUsers.length}) + localStorage(${localUsers.length})`);
      $('#hero-count').textContent = recipes.length;
      homeCount();
      // 재료 사전 · 게시물 (없어도 화면은 동작)
      try { const r = await fetch(ING_URL); if (r.ok) ingredientsDict = await r.json(); } catch (e) { console.warn('[ingredients.json 없음]', e.message); }
      let filePosts = [];
      try { const r = await fetch(POSTS_URL); if (r.ok) filePosts = await r.json(); } catch (e) { console.warn('[posts.json 없음]', e.message); }
      const localPosts = store.get('posts', []);
      posts = [...filePosts.filter(f => !localPosts.some(l => l.id === f.id)), ...localPosts];
      console.log('[게시물]', posts.length, '건 (파일', filePosts.length, '· 브라우저', localPosts.length, ')');
      renderHome();
      if ($('#feed').classList.contains('on')) { renderFeed(); searchPosts(); }
      if ($('#list').classList.contains('on')) renderList();
      if ($('#my').classList.contains('on')) renderMy();
    })
    .catch(error => {
      loadFailed = true;
      console.error('[불러오기 실패]', error);
      showLoadError(error);
    });
}

// 불러오기 실패 화면: 데이터 자체가 없는 상태 (결과 없음과 다름 — 조건이 아니라 경로·문법을 확인해야 함)
const loadErrorHtml = msg => `<div class="err"><b>데이터를 불러오지 못했어요</b><br>
    ${location.protocol === 'file:' ? 'HTML을 직접 열면(file://) 브라우저가 JSON 읽기를 막습니다. 로컬 서버(Live Server) 또는 GitHub Pages 배포 주소에서 확인하세요.' : '파일 경로(data/recipes.json)와 JSON 문법을 확인하세요.'}
    ${msg ? `<br><span class="mu">${esc(msg)}</span>` : ''}</div>`;
function showLoadError(error) {
  const box = title => `<div class="box empty" style="margin-top:0">${pic('fridge', 'empty-img', false)}<b>${title}</b><p class="mu">레시피 데이터(data/recipes.json)를 불러오지 못했어요. ${location.protocol === 'file:' ? 'HTML을 직접 열면(file://) 브라우저가 JSON 읽기를 막아요 — VS Code Live Server나 GitHub Pages 주소로 열어 주세요.' : '경로와 JSON 문법을 확인해 주세요.'}</p></div>`;
  $('#home-reco').innerHTML = box('레시피를 보여줄 수 없어요');
  $('#home-week').innerHTML = box('이번 주 요리를 셀 수 없어요');
  $('#pop-track').innerHTML = box('인기 요리를 보여줄 수 없어요');
  $('#hero-count').textContent = '?';
  $('#count').textContent = '불러오기 실패';
  $('#cards').innerHTML = '';
  $('#list-state').innerHTML = loadErrorHtml(error.message);
  $('#home-go').textContent = '데이터를 불러오지 못했어요'; $('#home-go').disabled = true;
}

// ---------- 출처 표식 (강의 1.4.5): 데이터의 meta만 보고 결정 ----------
// 필드 유형 판단: meta 목록에서 찾아 api → real → dummy 순으로 확인
function fieldType(p, key) {
  const m = p.meta || {};
  if ((m.api || []).includes(key)) return 'api';
  if ((m.real || []).includes(key)) return 'real';
  if ((m.dummy || []).includes(key)) return 'dummy';
  if ((m.user || []).includes(key)) return 'user';
  return '';
}
const FIELD_TYPE_LABEL = { real: '실제', dummy: '더미', api: 'API', fallback: '대체', user: '사용자' };
const typeTag = type => type ? `<span class="type-tag type-${type}">${FIELD_TYPE_LABEL[type]}</span>` : '';
const tagOf = (p, key) => typeTag(fieldType(p, key));
// 항목 출처 칩: 식약처 원본 / 팀 작성 (강의 1.4.2 "행마다 출처가 다르면 ID별 출처도 기록")
const isTeam = p => p.hashtag === '팀작성';
const isUser = p => p.flag === 'U';
// 데이터 플래그 칩: 글자(J/A/U) + title로 뜻을 함께 표시
const FLAG_LABEL = { J: '저장 JSON (식약처 공개 데이터)', A: '저장 JSON + Open API (팀 작성, 영양정보는 API)', D: 'AI로 만든 가상 데이터 (실제 조리법 아님)', U: '사용자 등록 (이 브라우저에 저장)' };
const flagChip = p => `<span class="flag flag-${p.flag || 'J'}" title="${FLAG_LABEL[p.flag] || ''}" aria-label="${FLAG_LABEL[p.flag] || ''}">${p.flag || 'J'}</span>`;
const originChip = p => isUser(p) ? `<span class="src-chip team">${esc(p.author || '사용자')}</span>${flagChip(p)}`
  : p.flag === 'D' ? `<span class="src-chip team">AI 가상</span>${flagChip(p)}`
  : isTeam(p) ? `<span class="src-chip team">팀 작성</span>${flagChip(p)}`
  : `<span class="src-chip">식약처</span>${flagChip(p)}`;
// 작성자 표시: 식약처(제공 기관) / 팀 / 사용자 닉네임 — null이면 '작성자 정보 없음'
const authorLine = p => p.author ? `<span class="author">by <b>${esc(p.author)}</b></span>` : '<span class="author na">작성자 정보 없음</span>';
const sourceChip = p => p.meta?.source === 'api' ? '<span class="type-tag type-api">API</span>'
  : p.meta?.source === 'dummy' ? '<span class="type-tag type-dummy">AI 가상</span>'
  : p.meta?.source === 'user' ? '<span class="type-tag type-dummy">사용자</span>'
  : '<span class="type-tag type-real">JSON</span>';
const metaSummary = p => {
  const m = p.meta || {};
  return m.source === 'user' ? `사용자 입력 ${(m.user || []).length}개 필드` : `실제 ${(m.real || []).length}개 · 더미 ${(m.dummy || []).length}개 · API ${(m.api || []).length}개 필드`;
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

// 홈의 보유 재료 칩 텍스트 → ['계란','양파','김치']
const myIngredients = () => $$('#mine .chip').map(c => c.textContent.replace('✕', '').trim()).filter(Boolean);
// 레시피 재료 텍스트에 보유 재료 이름이 몇 개 들어 있는지 (재료 매칭 로직 고도화는 이후 주차)
// 같은 재료의 다른 표기를 맞춤 (ingredients.json의 aliases와 같은 쌍 — 사전 연동은 이후 주차)
const ALIAS_FALLBACK = [['달걀', '계란'], ['참치캔', '참치'], ['묵은지', '김치']];
function alias(t) {
  let out = String(t ?? '');
  const pairs = ingredientsDict.length
    ? ingredientsDict.flatMap(i => (i.aliases || []).map(a => [a, i.name])).concat([['참치캔', '참치']]) // 레시피 텍스트는 '참치'로 적혀 있음
    : ALIAS_FALLBACK;
  pairs.forEach(([from, to]) => { out = out.split(from).join(to); });
  return out;
}
function matchCount(p, mine) {
  const t = alias(p.ingredientsText);
  return mine.map(alias).filter(m => t.includes(m)).length;
}

// ---------- 검색 조건 (UX 기준: 사용자가 실제로 고르는 축만) ----------
// 분류(뭘 먹을지) · 조리시간(얼마나 바쁜지) · 난이도 · 조리방법 · 출처 플래그(가상 데이터 제외 가능) · 정렬. 목록은 '보유 재료 모두 포함'도 토글
const FILTER_DEF = [
  { key: 'category', label: '분류', opts: [['밥', '밥'], ['일품', '일품'], ['국&찌개', '국·찌개'], ['반찬', '반찬']] },
  { key: 'time', label: '시간', opts: [['15', '15분 이내'], ['30', '30분 이내'], ['60', '1시간 이내']] },
  { key: 'level', label: '난이도', opts: [['쉬움', '쉬움'], ['보통', '보통'], ['어려움', '어려움']] },
  { key: 'method', label: '방법', opts: [['볶기', '볶기'], ['끓이기', '끓이기'], ['굽기', '굽기'], ['찌기', '찌기'], ['기타', '기타']] },
  { key: 'flag', label: '출처', opts: [['J', 'J 식약처'], ['A', 'A 팀+API'], ['D', 'D AI가상'], ['U', 'U 사용자'], ['real', '가상 제외']] },
];
const SORTS = [['rel', '추천순'], ['time', '빨리 만드는 순'], ['made', '많이 만든 순'], ['easy', '쉬운 순'], ['name', '가나다순'], ['new', '최신 등록순']];
const LEVEL_ORDER = { '쉬움': 0, '보통': 1, '어려움': 2 };
// 이 레시피로 만든 요리 게시물 수 (레시피 카드의 '좋아요' 대신 보여주는 값 — 좋아요는 요리 게시물에만 있음)
const madeCount = id => posts.filter(p => p.recipeId === id).length;
const flt = { category: null, time: null, level: null, method: null, flag: null, sort: 'rel', allMine: false, mineOnly: false };
const PAGE = 30; let listShown = PAGE;

const FILTER_LABEL = v => { for (const f of FILTER_DEF) { const o = f.opts.find(([k]) => k === v); if (o) return o[1]; } return v; };
let filtersOpen = true;
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
      <div class="fsec-h"><b>조건</b><span class="mu">${act.length ? `${act.length}개 적용 중` : '선택 안 함'}</span><button class="fsec-toggle" type="button" data-f="toggle">${filtersOpen ? '접기 ▴' : '펼치기 ▾'}</button></div>
      ${filtersOpen ? rows : ''}
    </div>
    <div class="fsec">
      <div class="fsec-h"><b>정렬</b><span class="mu">${sortLabel}</span></div>
      ${filtersOpen ? `<div class="frow"><div class="fchips">${SORTS.map(([v, l]) => `<button class="chip${flt.sort === v ? ' on' : ''}" type="button" data-f="sort" data-v="${v}">${l}</button>`).join('')}</div></div>` : ''}
    </div>
    <div class="fsum">${activeLabels().length ? `적용 중: ${activeLabels().map(esc).join(' · ')} <button class="chip reset" type="button" data-f="reset">초기화</button>` : '조건 없이 전체에서 찾는 중'}</div>`;
}
function applyFilters(scored) {
  return scored.filter(({ p, hit }) =>
    (!flt.category || p.category === flt.category) &&
    (!flt.time || (p.time !== null && p.time <= Number(flt.time))) &&
    (!flt.level || p.level === flt.level) &&
    (!flt.method || p.method === flt.method) &&
    (!flt.flag || (flt.flag === 'real' ? p.flag !== 'D' : p.flag === flt.flag)) &&
    (!flt.allMine || (hit > 0 && hit === myIngredients().length)));
}
function sortResults(arr, q) {
  const byName = (a, b) => a.p.name.localeCompare(b.p.name, 'ko');
  const rel = (a, b) => (b.nameHit || 0) - (a.nameHit || 0) || b.hit - a.hit || (b.p.flag !== 'D') - (a.p.flag !== 'D') || byName(a, b);
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

// 검색 + 조건 + 보유 재료를 한 번에 적용한 결과 (홈 건수 표시와 레시피 화면이 같이 씀). 원본 배열은 바꾸지 않음 (강의 1.3.1)
// 검색어는 띄어쓰기로 나눈 단어가 모두(이름 또는 재료에) 들어가야 함 → "두부 찌개", "김치 볶음" 조합 검색
function queryResults(raw) {
  const mine = myIngredients();
  const tokens = alias(raw || '').split(/\s+/).map(norm).filter(Boolean);
  const scored = recipes.map(p => {
    const n = norm(p.name), ing = norm(alias(p.ingredientsText));
    if (!tokens.every(t => n.includes(t) || ing.includes(t))) return null;
    return { p, hit: matchCount(p, mine), nameHit: tokens.filter(t => n.includes(t)).length };
  }).filter(Boolean);
  return sortResults(applyFilters(flt.mineOnly ? scored.filter(r => r.hit > 0) : scored));
}

// ④ 렌더링: 원본 배열 → 결과 배열 → 카드 HTML → ⑤ #cards. 0건이면 '결과 없음' 표준 화면 (강의 1.2)
function renderList() {
  const mine = myIngredients(), raw = $('#rec-q').value.trim();
  const mode = mineMode();
  $('#list-mine').innerHTML = `<span class="flabel" style="font-size:11px;color:var(--mu)">보유 재료</span>`
    + MINE_OPTS.map(([v, l]) => `<button class="chip${mode === v ? ' on' : ''}" type="button" data-mine="${v}" ${!mine.length && v !== 'none' ? 'disabled' : ''}>${l}</button>`).join('')
    + (mine.length ? mine.map(m => `<span class="chip${mode !== 'none' ? ' ing' : ' gr'}">${esc(m)}</span>`).join('') : '<span class="mu" style="font-size:11px">홈에서 재료를 고르면 여기서 걸러요</span>');
  $('#list-filters').innerHTML = filterBar();
  if (!recipes.length) { if (!loadFailed) $('#count').textContent = '불러오는 중…'; return; }
  const results = queryResults(raw);
  navIds = results.map(r => r.p.id);
  const d = results.filter(r => r.p.flag === 'D').length;
  $('#count').innerHTML = raw ? `"${esc(raw)}" ${results.length}건` : `${results.length}건`;
  $('#count-src').textContent = `(전체 ${recipes.length}건${flt.mineOnly ? ' 중 보유 재료가 들어간 레시피' : ''}${d ? ` · 가상 D ${d}건 포함` : ''})`;
  const page = withThumbs(results.slice(0, listShown));
  $('#cards').innerHTML = page.map(({ p, hit, t }) => card(p, hit, mine.length, t)).join('');
  $('#list-state').innerHTML = results.length ? '' : emptyList(mine, raw);
  $('#list-more').innerHTML = results.length ? moreBtn(listShown, results.length) : '';
}
function card(p, hit, total, t) {
  const badge = hit && hit === total ? '<span class="bg a">보유 재료 모두 포함</span>'
              : hit ? `<span class="bg">보유 재료 ${hit}개 포함</span>` : '';
  return `<div class="card" data-go="detail" data-id="${p.id}">
    ${imgBox(p, '', '요리 사진', t)}
    <div>
      <b>${esc(p.name)}</b>${lvlTag(p)} ${originChip(p)}
      <p class="mu">${num(p.time, '분')}${tagOf(p, 'time')} · ${info(p.category)}${tagOf(p, 'category')}</p>
      <p class="mu">${authorLine(p)} · 만든 사람 ${madeCount(p.id)}명</p>
      ${badge}
    </div>
    <span>${isFav(p.id) ? '★' : '☆'}</span>
  </div>`;
}

// 표준 예외 화면 (결과 없음): 빈 냉장고 그림 + 무엇이 없는지 한 줄 + 왜/어떻게 한 줄 + 다음 행동 버튼. 모든 '0건' 화면이 이 함수를 씀
// 불러오기 실패(.err, 빨간 테두리)와는 다른 화면 — 그쪽은 데이터 자체가 없는 상태 (강의 1.2)
function emptyState({ title, hint, actions = [] }) {
  return `<div class="box empty">${pic('fridge', 'empty-img', false)}
    <b>${title}</b>${hint ? `<p class="mu">${hint}</p>` : ''}
    ${actions.map(a => `<button class="btn${a.dark ? ' dk' : ''}" ${a.go ? `data-go="${a.go}"` : ''} ${a.id ? `id="${a.id}"` : ''}>${a.label}</button>`).join('')}</div>`;
}
function emptyList(mine, raw) {
  const anyF = FILTER_DEF.some(f => flt[f.key]) || flt.allMine;
  const title = raw ? `"${esc(raw)}"에 맞는 레시피가 없어요` : flt.mineOnly && mine.length ? `${mine.map(esc).join(' · ')}(으)로 만들 수 있는 레시피가 없어요` : '조건에 맞는 레시피가 없어요';
  const hint = raw ? '요리 이름의 일부(예: 볶음밥)나 재료 이름(예: 두부)으로 다시 찾아보세요. 띄어쓰기는 무시돼요.'
    : flt.mineOnly ? '재료 이름을 레시피에 적힌 대로(예: 달걀 → 계란) 바꾸거나 다른 재료를 추가해 보세요.' : '조건을 하나 풀어 보세요.';
  const actions = [];
  if (anyF) actions.push({ label: '검색 조건 초기화', id: 'flt-reset', dark: true });
  if (flt.mineOnly) actions.push({ label: `보유 재료 상관없이 전체 보기`, id: 'show-all', dark: !anyF });
  if (raw) actions.push({ label: '검색어 지우기', id: 'q-clear', dark: !anyF && !flt.mineOnly });
  actions.push({ label: '홈에서 재료 바꾸기', go: 'home' }, { label: '+ 내 레시피로 등록', go: 'new' });
  return emptyState({ title, hint, actions });
}
document.addEventListener('click', e => {
  if (e.target.closest('#show-all')) { flt.mineOnly = false; listShown = PAGE; renderList(); }
  if (e.target.closest('#q-clear')) { $('#rec-q').value = ''; listShown = PAGE; renderList(); }
  if (e.target.closest('#flt-reset')) { Object.assign(flt, { category: null, time: null, level: null, method: null, flag: null, allMine: false }); listShown = PAGE; renderList(); homeCount(); }
});

$('#rec-q').addEventListener('input', () => { listShown = PAGE; renderList(); });

// 홈 "지금 재료로 바로 만들 수 있는 레시피": 보유 재료 매칭 상위 2건 (실제 데이터 우선)
function renderHomeReco() {
  const box = $('#home-reco');
  if (!box || !recipes.length) return;
  const mine = myIngredients();
  const top = recipes.map(p => ({ p, hit: matchCount(p, mine) })).sort((a, b) => b.hit - a.hit || (b.p.flag !== 'D') - (a.p.flag !== 'D')).slice(0, 2);
  box.innerHTML = withThumbs(top).map(({ p, hit, t }) => `<article class="big-card" data-go="detail" data-id="${p.id}">
    ${imgBox(p, 'big-img', '레시피 사진', t)}
    <div class="big-body"><span class="bg${hit === mine.length && hit ? ' a' : ''}">${hit ? `보유 재료 ${hit}개 포함` : '재료 확인 필요'}</span>
      <b>${esc(p.name)}</b> ${originChip(p)}<p class="mu">${num(p.time, '분')}${tagOf(p, 'time')} · ${info(p.level)}${tagOf(p, 'level')} · ${authorLine(p)}</p></div>
  </article>`).join('');
}

// ---------- 마이: 즐겨찾기 · 내 레시피 (사용자 데이터 U) ----------
function miniCard(p, right, t) {
  return `<div class="card" data-go="detail" data-id="${p.id}">${imgBox(p, '', 'IMG', t)}
    <div><b>${esc(p.name)}</b> ${originChip(p)}<p class="mu">${num(p.time, '분')}${tagOf(p, 'time')} · ${info(p.level)}${tagOf(p, 'level')} · ${authorLine(p)}</p></div>
    ${right || ''}</div>`;
}
function renderMy() {
  const u = store.get('user', null);
  $('#my-name').textContent = u ? `${u.nick} 님` : '로그인 전';
  $('#my-sub').textContent = u ? `${u.email || u.id} · 즐겨찾기·내 레시피·내가 만든 요리는 이 브라우저에 저장돼요` : '로그인하면 닉네임으로 레시피와 요리를 올릴 수 있어요';
  $('#my-logout').hidden = !u;
  $('#top-login').textContent = u ? u.nick : '로그인';
  const favs = recipes.filter(p => isFav(p.id));
  navIds = favs.map(p => p.id);
  $('#fav-list').innerHTML = favs.length ? withThumbs(favs.map(p => ({ p }))).map(({ p, t }) => miniCard(p, '<span>★</span>', t)).join('')
    : emptyState({ title: '즐겨찾기한 레시피가 없어요', hint: '레시피 상세에서 ☆ 즐겨찾기를 누르면 여기에 모여요.',
        actions: [{ label: '레시피 보러 가기', go: 'list', dark: true }] });
  const myPosts = posts.filter(isMyPost).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  $('#posts-count').innerHTML = myPosts.length ? `내가 만든 요리 ${myPosts.length}건 <span class="flag flag-U">U</span>` : '';
  $('#posts-list').innerHTML = myPosts.length ? myPosts.map(p => `<div class="card" data-go="post" data-post="${p.id}">${postImg(p, '', 'IMG')}<div><b>${esc(p.recipeName)}</b><p class="mu">${p.text ? esc(p.text) : '<span class="na">후기 없음</span>'} · ♥ ${postLikes(p.id)}</p></div><button class="chip" type="button" data-pdel="${p.id}">삭제</button></div>`).join('')
    : emptyState({ title: u ? '올린 요리가 없어요' : '로그인하면 내가 만든 요리가 여기 모여요', hint: '레시피 상세에서 "이 레시피로 요리했어요 · 공유"로 올릴 수 있어요.', actions: [{ label: u ? '레시피 보러 가기' : '로그인', go: u ? 'list' : 'login', dark: true }] });
  const fr = myIngredients();
  $('#fr-list').innerHTML = fr.length ? fr.map(m => `<span class="chip ing">${esc(m)}</span>`).join('') : '<span class="mu">홈에서 재료를 골라 주세요</span>';
  const mine = recipes.filter(isUser);
  $('#mine-count').innerHTML = mine.length ? `내가 등록한 레시피 ${mine.length}건 <span class="flag flag-U">U</span>` : '';
  $('#mine-list').innerHTML = mine.length ? withThumbs(mine.map(p => ({ p }))).map(({ p, t }) => miniCard(p, `<button class="chip" type="button" data-del="${p.id}">삭제</button>`, t)).join('')
    : emptyState({ title: '등록한 레시피가 없어요', hint: '내가 아는 레시피를 등록하면 J·A 레시피와 함께 목록·검색에 나와요.',
        actions: [{ label: '+ 레시피 등록', go: 'new', dark: true }] });
}
document.addEventListener('click', e => {
  const d = e.target.closest('[data-del]');
  if (d) { e.stopPropagation(); deleteUserRecipe(Number(d.dataset.del)); renderMy(); }
  const pd = e.target.closest('#posts-list [data-pdel]');
  if (pd) { e.stopPropagation(); deletePost(Number(pd.dataset.pdel)); renderMy(); }
}, true);
function deleteUserRecipe(id) {
  store.set('recipes', store.get('recipes', []).filter(r => r.id !== id));
  recipes = recipes.filter(r => r.id !== id);
  const f = favIds(); f.delete(id); store.set('fav', [...f]);
}
// ---------- 레시피 등록 (U): recipes.json과 같은 구조로 만들어 localStorage에 저장 ----------
const USER_ID_BASE = 100001; // 식약처(31~3577)·팀(90001~)과 겹치지 않는 범위
$('#new-form').addEventListener('submit', e => {
  e.preventDefault();
  const v = id => $(id).value.trim();
  const steps = v('#n-steps').split('\n').map(t => t.trim()).filter(Boolean);
  const miss = [];
  if (!v('#n-name')) miss.push('요리 이름');
  if (!v('#n-category')) miss.push('분류');
  if (!v('#n-method')) miss.push('조리방법');
  if (!v('#n-ing')) miss.push('재료');
  if (!steps.length) miss.push('조리 순서');
  const img = v('#n-image');
  if (img && !/^https:\/\//.test(img)) miss.push('사진 주소(https로 시작)');
  const msg = $('#n-msg');
  if (miss.length) { msg.hidden = false; msg.textContent = `입력을 확인해 주세요: ${miss.join(', ')}`; return; }
  if (recipes.some(p => p.name === v('#n-name'))) { msg.hidden = false; msg.textContent = `"${v('#n-name')}"은 이미 있는 레시피예요. 이름을 바꾸거나 기존 레시피를 확인해 주세요.`; return; }
  msg.hidden = true;
  const ids = recipes.filter(isUser).map(p => p.id);
  const time = v('#n-time') ? Number(v('#n-time')) : null, level = v('#n-level') || null, tip = v('#n-tip') || null;
  const optional = { time, level, tip, image: img || null };
  const userFields = ['name', 'method', 'category', 'author', 'ingredientsText', 'steps', ...Object.keys(optional).filter(k => optional[k] !== null)];
  const p = {
    id: ids.length ? Math.max(...ids) + 1 : USER_ID_BASE, flag: 'U',
    name: v('#n-name'), method: v('#n-method'), category: v('#n-category'), author: nickname(),
    time, level, weight: null, calories: null, carb: null, protein: null, fat: null, sodium: null,
    hashtag: '사용자등록', image: img || null, imageStep: null,
    ingredientsText: v('#n-ing'), steps: steps.map((text, i) => ({ text: `${i + 1}. ${text.replace(/^\d+\.\s*/, '')}`, image: null })),
    tip, createdAt: new Date().toISOString(),
    // 출처 플래그(강의 1.4.4를 팀에서 확장): 사용자가 직접 입력한 값 = user. 영양정보는 받지 않으므로 null 유지 → 화면엔 '정보 없음'
    meta: { source: 'user', real: [], dummy: [], api: [], user: userFields,
            note: `사용자 ${nickname()}가 ${new Date().toLocaleDateString('ko-KR')} 등록 — 검증되지 않은 사용자 데이터` },
  };
  store.set('recipes', [...store.get('recipes', []), p]);
  recipes = [...recipes, p];
  sheetLog('recipe', { id: p.id, name: p.name, author: p.author, category: p.category });
  e.target.reset();
  openDetail(p.id); go('detail');
});

// =====================================================================
// 심화: 식약처 Open API 연동 (강의 1.4.1 "외부 API 연동" · 1.4.4 meta.api · 1.4.5 '대체' 표식)
// 대상: meta.source === "api" 항목(팀 작성 24건)만. 요리명으로 레시피 DB를 검색해 meta.api에 적힌 필드만 채움.
// 식약처 76건은 저장 JSON과 같은 데이터셋이므로 호출하지 않음. API 값은 실행 중에만 쓰고 JSON·CSV에는 저장하지 않음.
// =====================================================================
const API_BASE = 'https://openapi.foodsafetykorea.go.kr/api';          // http는 GitHub Pages(https)에서 혼합 콘텐츠로 차단
const API_SERVICE = 'COOKRCP01';                                        // 조리식품의 레시피 DB
const API_TIMEOUT = 5000;
// 응답 필드 → recipes.json 필드 (meta.api에 적힌 7개)
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
      const row = rows.find(r => (r.RCP_NM || '').trim() === p.name) || null; // 부분 일치 결과 중 이름이 정확히 같은 건만
      if (!row) {
        result = { ok: false, reason: rows.length ? `"${p.name}"과 이름이 정확히 같은 레시피 없음 (유사 ${rows.length}건)` : `결과 없음 (${code || 'row 없음'})` };
      } else {
        const vals = {};
        Object.entries(API_FIELD_MAP).forEach(([k, src]) => {
          const v = String(row[src] ?? '').trim();
          if (v === '') { vals[k] = null; return; }
          vals[k] = (k === 'image' || k === 'tip') ? v : (Number.isNaN(Number(v)) ? null : Number(v));
        });
        result = { ok: true, vals, seq: row.RCP_SEQ, count: rows.length };
      }
    } catch (e) {
      result = { ok: false, reason: e.name === 'AbortError' ? `${API_TIMEOUT / 1000}초 타임아웃`
               : e instanceof TypeError ? '네트워크 오류 또는 CORS 차단 (브라우저 직접 호출 불가)' : e.message };
    } finally { clearTimeout(timer); }
  }
  result.at = new Date();
  apiCache.set(p.id, result);
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

// 상세: id로 원본 배열에서 찾음 (강의 1.3.1 — id 중복이면 다른 레시피가 열리므로 checkData가 중복을 잡음)
function openDetail(id) {
  const p = recipes.find(r => r.id === id);
  if (!p) return;
  detailId = id;
  syncDetailNav();
  $('#d-title').innerHTML = `<span>${esc(p.name)}${lvlTag(p)} ${originChip(p)}</span><button class="fav-star${isFav(p.id) ? ' on' : ''}" id="d-fav" type="button" aria-label="즐겨찾기">${isFav(p.id) ? '★' : '☆'}</button>`;
  $('#d-sub').innerHTML = `${num(p.time, '분')}${tagOf(p, 'time')} · ${info(p.method)}${tagOf(p, 'method')} · ${info(p.category)}${tagOf(p, 'category')}${p.level ? ` · 난이도 ${esc(p.level)}${tagOf(p, 'level')}` : ''}`;
  $('#d-author').innerHTML = `${authorLine(p)}${tagOf(p, 'author')}${p.createdAt ? ` · ${new Date(p.createdAt).toLocaleDateString('ko-KR')} 등록` : ''}`;
  $('#d-src').innerHTML = `출처 ${sourceChip(p)} ${isUser(p) ? '사용자가 등록한 레시피 (검증 없음, 이 브라우저에 저장)' : p.flag === 'D' ? 'AI(Claude)로 생성한 가상 레시피 — 실제 조리법·영양 정보가 아님' : isTeam(p) ? '팀이 직접 작성한 시연용 레시피' : '식품의약품안전처 조리식품 레시피 DB'} · ${metaSummary(p)}`;
  syncDetailActions(p);
  $('#d-del').hidden = !isUser(p);
  $('#d-ing').innerHTML = `${info(p.ingredientsText)}${tagOf(p, 'ingredientsText')}`;
  $('#d-steps').innerHTML = p.steps.length
    ? p.steps.map(s => `<li>${esc(s.text)}${s.image ? `<div class="img has-img"><img src="${esc(imgUrl(s.image))}" alt="" loading="lazy"></div>` : ''}</li>`).join('') + `<li class="mu">조리 순서${tagOf(p, 'steps')}</li>`
    : '<li class="mu">조리 순서 정보 없음</li>';
  // 저장 JSON 값으로 먼저 다 그린 뒤, API 항목이면 응답이 오면 해당 필드만 갈아끼움 (화면이 비는 구간 없음)
  renderDetailApiFields(p, null);
  if (p.meta?.source === 'api') {
    $('#d-api').innerHTML = `식약처 레시피 DB에 "${esc(p.name)}" 검색 중…`;
    fetchApi(p).then(r => { if (detailId === id) renderDetailApiFields(p, r); });
  } else {
    $('#d-api').textContent = isUser(p) ? 'API 미연동 (사용자 등록 레시피 — 영양정보는 입력받지 않음)' : 'API 미연동 (저장 JSON 항목)';
  }
}

function syncDetailActions(p) {
  const fav = $('#d-fav');
  fav.textContent = isFav(p.id) ? '★' : '☆';
  fav.classList.toggle('on', isFav(p.id));
  const n = madeCount(p.id);
  $('#d-made').innerHTML = n ? `이 레시피로 만든 요리 <b>${n}</b>건 <span class="flag flag-U">U</span> · 공감은 요리 피드에서` : '아직 이 레시피로 만든 요리가 없어요 — 첫 번째가 되어 보세요';
}
document.addEventListener('click', e => { if (e.target.closest('#d-fav')) { const p = recipes.find(r => r.id === detailId); if (p) { toggleFav(p.id); syncDetailActions(p); } } });
$('#d-del').addEventListener('click', () => { if (detailId) { deleteUserRecipe(detailId); go('my'); } });
$('#d-share').addEventListener('click', () => { writeRecipeId = detailId; go('write'); });

// 영양정보·사진·팁 영역 렌더링. r = null(아직 응답 전 또는 JSON 항목) / fetchApi 결과
// 태그 규칙(강의 1.4.5): JSON 항목은 meta대로 실제/더미, API 항목은 응답값 'API', 실패·값 없음 '대체'
function renderDetailApiFields(p, r) {
  const isApi = p.meta?.source === 'api';
  const got = r && r.ok;
  const val = f => got ? r.vals[f] : p[f];
  const tag = f => !isApi ? tagOf(p, f) : (!r ? typeTag('api') : (got && r.vals[f] !== null ? typeTag('api') : typeTag('fallback')));
  const show = (f, unit) => isApi && !r ? '요청 중…' : num(val(f), unit);
  // 영양정보: API 항목은 응답 전·실패여도 박스를 숨기지 않고 '정보 없음 [대체]'로 표시
  // 사용자 등록(U) 레시피는 영양정보를 입력받지 않으므로 숨기지 않고 '정보 없음'으로 보여줌 (태그 없음)
  const hasNut = isApi || isUser(p) || ['calories', 'carb', 'protein', 'fat', 'sodium'].some(f => p[f] !== null);
  $('#d-nut-box').hidden = !hasNut;
  if (hasNut) $('#d-nut').innerHTML = [['열량', 'calories', ' kcal'], ['탄수화물', 'carb', ' g'], ['단백질', 'protein', ' g'],
    ['지방', 'fat', ' g'], ['나트륨', 'sodium', ' mg']]
    .map(([k, f, u]) => `<span>${k}</span><span>${show(f, u)}${tag(f)}</span>`).join('')
    + `<span>중량</span><span>${num(p.weight, ' g')}${tagOf(p, 'weight')}</span>`;
  // 사진
  const image = val('image');
  $('#d-img').outerHTML = imgBox({ image, name: p.name, id: p.id }, 'sq-img', isApi && !r ? '사진 요청 중…' : '요리 사진 (1:1)')
    .replace('class="img', 'id="d-img" class="img');
  // 팁
  const tip = val('tip');
  $('#d-tip-box').hidden = !isApi && !tip;
  $('#d-tip').innerHTML = tip ? `${esc(tip)}${tag('tip')}` : `${isApi && !r ? '요청 중…' : '정보 없음'}${tag('tip')}`;
  // API 상태 영역: 요청 시각 + 결과 (강의 1.4.5 "응답 기준 시각 표시")
  if (isApi && r) {
    const at = r.at.toLocaleTimeString('ko-KR');
    $('#d-api').innerHTML = got
      ? `식약처 레시피 DB · 요청 ${at} · "${esc(p.name)}" 검색 ${r.count}건 중 이름이 같은 1건 사용 (RCP_SEQ ${esc(r.seq)}) ${typeTag('api')}`
      : `식약처 레시피 DB · 요청 ${at} · ${esc(r.reason)} → 저장 JSON 값으로 대체 ${typeTag('fallback')}`;
  }
}

// =====================================================================
// 게시물 (사용자 데이터 U): posts.json + localStorage. 레시피와 같은 규칙 — flag U, meta.source "user"
// =====================================================================
const recipeOf = post => recipes.find(r => r.id === post.recipeId);
const postLikes = id => (store.get('plikes', {})[id] || 0);
const postLikedByMe = id => store.get('pliked', []).includes(id);
function togglePostLike(id) {
  const likes = store.get('plikes', {}), liked = new Set(store.get('pliked', []));
  if (liked.has(id)) { liked.delete(id); likes[id] = Math.max(0, (likes[id] || 0) - 1); } else { liked.add(id); likes[id] = (likes[id] || 0) + 1; }
  store.set('plikes', likes); store.set('pliked', [...liked]);
}
// 👍 추천 = 랭킹 투표 (♥ 좋아요는 공감, 랭킹과 무관)
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
  return !r ? '<span class="chip gr">레시피 삭제됨</span>' : hit && hit === total ? '<span class="bg a">내 냉장고로 바로 가능</span>' : hit ? `<span class="bg">보유 재료 ${hit}개 포함</span>` : '<span class="chip gr">보유 재료 없음</span>'; };

// ---------- 홈: 추천 재료 칩 · 인기 게시물 · 이번 주 많이 만든 요리 ----------
function renderSuggest() {
  const mine = myIngredients();
  const names = ingredientsDict.map(i => i.name).filter(n => !mine.includes(n));
  $('#suggest').innerHTML = names.length ? names.map(n => `<span class="chip add">+ ${esc(n)}</span>`).join('')
    : `<span class="mu" style="font-size:11px">${ingredientsDict.length ? '재료 사전의 재료를 모두 골랐어요 — 직접 입력해 보세요' : '재료 사전(ingredients.json)을 읽지 못했어요'}</span>`;
}
function renderHome() {
  renderSuggest(); renderHomeReco(); homeCount();
  const u0 = store.get('user', null); $('#top-login').textContent = u0 ? u0.nick : '로그인';
  const top = [...posts].sort((a, b) => postLikes(b.id) - postLikes(a.id) || b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  $('#pop-track').innerHTML = top.length ? top.map((p, i) => { const r = recipeOf(p); return `<article class="pop" data-go="post" data-post="${p.id}">
      <div class="img pop-img ${p.image ? 'has-img' : 'no-img'}"><span class="rank">${i + 1}</span>${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.recipeName)} 사진">` : pic('noimage')}</div>
      <div class="pop-body"><b>${esc(p.recipeName)}</b> <span class="flag flag-U">U</span><p class="mu">@${esc(p.author)} 님이 만든 요리${r ? ` · ${esc(r.category || '')}` : ''}</p><p class="likes">♥ ${postLikes(p.id)}</p></div></article>`; }).join('')
    : `<div class="box empty" style="margin-top:0">${pic('fridge', 'empty-img', false)}<b>아직 올라온 요리가 없어요</b><p class="mu">레시피로 만든 요리를 첫 번째로 공유해 보세요.</p><button class="btn dk" data-go="list">레시피 보러 가기</button></div>`;
  popCarousel.set(top.length);
  // 이번 주: 최근 7일 게시물을 레시피별로 셈
  const week = Date.now() - 7 * 86400000, cnt = {};
  posts.filter(p => new Date(p.createdAt) >= week).forEach(p => { cnt[p.recipeId] = (cnt[p.recipeId] || 0) + 1; });
  const rows = Object.entries(cnt).map(([id, n]) => ({ r: recipes.find(x => x.id === Number(id)), n })).filter(x => x.r)
    .sort((a, b) => b.n - a.n).slice(0, 4);
  $('#home-week').innerHTML = rows.length ? `<div class="grid2 week">${rows.map(({ r, n }) => `<div data-go="detail" data-id="${r.id}">${imgBox(r, '', '사진')}<b>${esc(r.name)}</b>${lvlTag(r)} ${flagChip(r)}<p class="mu">이번 주 ${n}명이 만들었어요 <span class="flag flag-U">U</span></p></div>`).join('')}</div>`
    : `<div class="box empty" style="margin-top:0">${pic('fridge', 'empty-img', false)}<b>이번 주에 올라온 요리가 아직 없어요</b><p class="mu">레시피로 요리하고 공유하면 레시피별로 "몇 명이 만들었는지" 여기 모여요. 첫 요리가 이번 주 1위!</p><button class="btn dk" data-go="list">레시피 보러 가기</button></div>`;
}

// ---------- 피드 ----------
let feedMineOnly = false, feedSortPop = false;
function renderFeed() {
  const u = store.get('user', null);
  let list = [...posts];
  if (feedMineOnly) list = list.filter(p => postMakeable(p) > 0);
  list.sort((a, b) => feedSortPop ? (postLikes(b.id) - postLikes(a.id) || b.createdAt.localeCompare(a.createdAt)) : b.createdAt.localeCompare(a.createdAt));
  $('#feed-mine').textContent = `${feedMineOnly ? '☑' : '☐'} 내 냉장고로 만들 수 있는 것만`;
  $('#feed-mine').classList.toggle('on', feedMineOnly);
  $('#feed-sort').textContent = feedSortPop ? '인기순 ▾' : '최신순 ▾';
  $('#feed-list').innerHTML = list.length ? list.map(p => `<article class="post">
      <header class="post-head"><span class="avatar" aria-hidden="true"></span><div><b>@${esc(p.author)}</b> <span class="flag flag-U">U</span><p class="mu">${ago(p.createdAt)}</p></div>${isMyPost(p) ? `<button class="more" type="button" data-pdel="${p.id}" aria-label="삭제">🗑</button>` : ''}</header>
      <div data-go="post" data-post="${p.id}">${postImg(p, 'post-img', '요리 사진 (1:1)')}</div>
      <div class="post-act"><button class="like${postLikedByMe(p.id) ? ' on' : ''}" type="button" data-plike="${p.id}" aria-label="좋아요(공감)">${postLikedByMe(p.id) ? '♥' : '♡'}</button><button class="vote${postVotedByMe(p.id) ? ' on' : ''}" type="button" data-pvote="${p.id}" aria-label="추천(랭킹 투표)">👍</button>${recipeOf(p) ? `<button type="button" data-go="detail" data-id="${p.recipeId}" aria-label="레시피 보기" style="margin-left:auto">↗</button>` : ''}</div>
      <div class="post-body"><b>좋아요 ${postLikes(p.id)}개</b> <span class="mu">· 👍 추천 ${postVotes(p.id)}표</span> <span class="mu" style="font-size:11px">(추천이 이번 주 랭킹 투표)</span>
        <p><b>${esc(p.recipeName)}</b> ${recipeOf(p) ? flagChip(recipeOf(p)) : ''}</p>
        <p><b>@${esc(p.author)}</b> ${p.text ? esc(p.text) : '<span class="na">후기 없음</span>'}</p>
        <div class="row">${postBadge(p)}${recipeOf(p) ? `<span class="chip gr">${esc((recipeOf(p).ingredientsText || '').split(',').slice(0, 3).map(t => t.trim().split(' ')[0]).join(' · '))}</span>` : ''}</div>
        ${recipeOf(p) ? `<button class="btn dk" data-go="detail" data-id="${p.recipeId}">이 요리의 레시피 보기</button>` : ''}
      </div></article>`).join('')
    : `<div style="padding:14px">${emptyState({
        title: feedMineOnly ? '내 냉장고 재료로 만들 수 있는 요리가 없어요' : '아직 올라온 요리가 없어요',
        hint: feedMineOnly ? '필터를 끄거나 홈에서 보유 재료를 바꿔 보세요.' : `레시피를 보고 만든 요리를 첫 번째로 공유해 보세요${u ? '' : ' — 로그인하면 바로 올릴 수 있어요'}.`,
        actions: feedMineOnly ? [{ label: '필터 끄기', id: 'feed-off' }] : [{ label: '레시피 보러 가기', go: 'list', dark: true }, ...(u ? [] : [{ label: '로그인', go: 'login' }])],
      })}</div>`;
}
$('#feed-mine').addEventListener('click', () => { feedMineOnly = !feedMineOnly; renderFeed(); });
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
  store.set('posts', store.get('posts', []).filter(p => p.id !== id));
  posts = posts.filter(p => p.id !== id);
}

// ---------- 게시물 검색 (피드 탭 · 검색 화면 게시물 탭 공용) ----------
let postSortPop = false;
function postHits(raw) {
  const q = norm(alias(raw));
  return posts.filter(p => !q || norm(p.recipeName).includes(q) || norm(p.author).includes(q) || norm(alias(recipeOf(p)?.ingredientsText)).includes(q) || norm(p.text).includes(q));
}
function searchPosts() {
  const raw = $('#post-q').value.trim();
  let hits = postHits(raw);
  hits.sort((a, b) => postSortPop ? postLikes(b.id) - postLikes(a.id) : b.createdAt.localeCompare(a.createdAt));
  $('#post-sort').textContent = postSortPop ? '인기순 ▾' : '최신순 ▾';
  $('#post-count').textContent = raw ? `"${raw}" 요리 ${hits.length}개` : `요리 ${hits.length}개`;
  $('#post-tiles').innerHTML = hits.map(p => `<a class="tile" data-go="post" data-post="${p.id}">${postImg(p, '', 'IMG')}<span>${esc(p.recipeName)} · @${esc(p.author)}</span></a>`).join('');
  const empty = $('#post-empty'); empty.hidden = hits.length > 0;
  if (!hits.length) empty.innerHTML = emptyState({
    title: raw ? `"${esc(raw)}"에 맞는 요리가 없어요` : (posts.length ? '조건에 맞는 요리가 없어요' : '아직 올라온 요리가 없어요'),
    hint: raw ? '다른 단어로 찾거나, 레시피 이름으로 찾아보세요.' : '레시피 상세의 "이 레시피로 요리했어요 · 공유"로 올릴 수 있어요.',
    actions: [{ label: '레시피 보러 가기', go: 'list', dark: true }],
  });
}
$('#post-q').addEventListener('input', searchPosts);
$('#post-recent').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; $('#post-q').value = c.textContent; searchPosts(); });
$('#post-sort').addEventListener('click', () => { postSortPop = !postSortPop; searchPosts(); });
// ---------- 게시물 상세 ----------
let postId = null;
function openPost(id) {
  const p = posts.find(x => x.id === id); if (!p) return;
  postId = id;
  const r = recipeOf(p);
  $('#p-img').outerHTML = postImg(p, 'sq-img', '요리 사진 (1:1)').replace('class="img', 'id="p-img" class="img');
  $('#p-title').innerHTML = `${esc(p.recipeName)} <span class="mu">@${esc(p.author)}</span> <span class="flag flag-U">U</span>`;
  $('#p-sub').innerHTML = `${r ? `${esc(r.category || '')} · ` : ''}${p.text ? `"${esc(p.text)}"` : '<span class="na">후기 없음</span>'} · ${new Date(p.createdAt).toLocaleString('ko-KR')}`;
  $('#p-ing').innerHTML = r ? `${info(r.ingredientsText)} ${postBadge(p)}` : '<span class="na">연결된 레시피가 삭제됨</span>';
  $('#p-like').textContent = `${postLikedByMe(id) ? '♥' : '♡'} 좋아요 ${postLikes(id)}`; $('#p-like').classList.toggle('on-like', postLikedByMe(id));
  $('#p-vote').textContent = `👍 추천 ${postVotes(id)}`; $('#p-vote').classList.toggle('on-vote', postVotedByMe(id));
  $('#p-del').hidden = !isMyPost(p);
  $('#p-recipe').hidden = !r;
}
$('#p-like').addEventListener('click', () => { togglePostLike(postId); openPost(postId); $('#p-like').classList.add('heart-pop'); renderHome(); });
$('#p-vote').addEventListener('click', () => { togglePostVote(postId); openPost(postId); $('#p-vote').classList.add('heart-pop'); });
$('#p-del').addEventListener('click', () => { deletePost(postId); go('feed'); });
$('#p-recipe').addEventListener('click', () => { const p = posts.find(x => x.id === postId); if (p && recipeOf(p)) { openDetail(p.recipeId); go('detail'); } });

// ---------- 게시물 작성 ----------
let writeRecipeId = null, writePhoto = null;
function openWrite() {
  const u = store.get('user', null);
  if (!u) { go('login'); $('#login-msg').textContent = '게시물을 올리려면 먼저 로그인해 주세요 (아이디 + 닉네임).'; return; }
  const sel = $('#w-recipe');
  sel.innerHTML = '<option value="">레시피 선택</option>' + [...recipes].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map(r => `<option value="${r.id}">${esc(r.name)} (${r.flag})</option>`).join('');
  if (writeRecipeId) sel.value = String(writeRecipeId);
  $('#w-author').textContent = `작성자: ${u.nick}`;
  syncWrite();
}
function syncWrite() {
  $('#w-len').textContent = $('#w-text').value.length;
  $('#w-go').disabled = !($('#w-recipe').value && writePhoto);
  $('#w-go').textContent = $('#w-go').disabled ? `올리기 (${!$('#w-recipe').value ? '레시피' : '사진'} 필요)` : '요리 올리기';
}
$('#w-text').addEventListener('input', syncWrite);
$('#w-recipe').addEventListener('change', syncWrite);
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
  const ids = posts.map(p => p.id);
  const post = { id: ids.length ? Math.max(...ids) + 1 : 1, flag: 'U', recipeId: r.id, recipeName: r.name,
    author: u.nick, authorId: u.id, text: $('#w-text').value.trim(), image: writePhoto, createdAt: new Date().toISOString(),
    meta: { source: 'user', real: [], dummy: [], api: [], user: ['recipeId', 'text', 'image', 'author'], note: `사용자 ${u.nick} 요리 게시물 — 이 브라우저에 저장` } };
  try { store.set('posts', [...store.get('posts', []), post]); } catch {}
  if (!store.get('posts', []).some(p => p.id === post.id)) { $('#w-msg').hidden = false; $('#w-msg').textContent = '브라우저 저장 공간이 가득 찼어요. 오래된 게시물을 지우거나 작은 사진을 써 주세요.'; return; }
  posts = [...posts, post];
  sheetLog('post', { id: post.id, recipeId: post.recipeId, recipeName: post.recipeName, author: post.author, text: post.text });
  writePhoto = null; writeRecipeId = null; e.target.reset(); $('#w-preview').innerHTML = '미리보기'; $('#w-preview').classList.remove('has-img'); $('#w-msg').hidden = true;
  openPost(post.id); go('post');
});


// =====================================================================
// 랭킹 (경진대회): 이번 주(월 00:00 ~ 일 24:00) 게시물로 점수 계산. 저장하지 않고 화면에서 셈
// 점수 = 요리 게시물 1건 10점 + 받은 👍 추천(투표) 1개 3점 (♥ 좋아요는 공감 표시, 랭킹에 안 들어감)
// =====================================================================
const PT_POST = 10, PT_LIKE = 3;
function weekRange(offset = 0) { // offset 0 = 이번 주, -1 = 지난 주
  const now = new Date(); const day = (now.getDay() + 6) % 7; // 월=0
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + offset * 7);
  const end = new Date(start); end.setDate(start.getDate() + 7);
  return { start, end };
}
const fmtMD = d => `${d.getMonth() + 1}/${d.getDate()}`;
function scorePosts(list) {
  const byRecipe = {}, byChef = {};
  list.forEach(p => {
    const pts = PT_POST + PT_LIKE * postVotes(p.id); // 👍 추천 = 투표
    const r = byRecipe[p.recipeId] ||= { id: p.recipeId, name: p.recipeName, posts: 0, likes: 0, pts: 0 };
    r.posts++; r.likes += postVotes(p.id); r.pts += pts;
    const c = byChef[p.authorId] ||= { id: p.authorId, nick: p.author, posts: 0, likes: 0, pts: 0, best: null };
    c.posts++; c.likes += postVotes(p.id); c.pts += pts; if (!c.best || postVotes(p.id) > postVotes(c.best.id)) c.best = p;
  });
  const sortF = (a, b) => b.pts - a.pts || b.likes - a.likes || b.posts - a.posts;
  return { recipes: Object.values(byRecipe).sort(sortF), chefs: Object.values(byChef).sort(sortF) };
}
function rankRow(i, html, pts, sub, attrs = '', cls = '') {
  return `<div class="rank-row r${i + 1} ${cls}" ${attrs}><span class="medal">${i < 3 ? ['1','2','3'][i] : i + 1}</span>${html}<div class="score"><b>${pts}</b><span>${sub}</span></div></div>`;
}
function renderRank() {
  const { start, end } = weekRange(0), last = weekRange(-1);
  const inWeek = (p, w) => { const d = new Date(p.createdAt); return d >= w.start && d < w.end; };
  const cur = scorePosts(posts.filter(p => inWeek(p, { start, end })));
  const prev = scorePosts(posts.filter(p => inWeek(p, last)));
  const u = store.get('user', null);
  const leftMs = end - Date.now(), leftD = Math.floor(leftMs / 86400000), leftH = Math.floor((leftMs % 86400000) / 3600000);
  $('#rank-period').textContent = `${fmtMD(start)} ~ ${fmtMD(new Date(end - 1))} 주간 랭킹`;
  $('#rank-left').textContent = `마감까지 ${leftD}일 ${leftH}시간 · 올라온 요리 ${posts.filter(p => inWeek(p, { start, end })).length}건 · 요리사 ${cur.chefs.length}명`;
  const emptyR = emptyState({ title: '이번 주 올라온 요리가 아직 없어요', hint: `레시피로 요리하고 "이 레시피로 요리했어요 · 공유"로 사진을 올리면 바로 랭킹에 올라가요. 다른 사람의 👍 추천이 표가 돼요. 첫 요리면 1위!${u ? '' : ' 요리를 올리려면 상단의 로그인이 필요해요.'}`, actions: [{ label: '레시피 보러 가기', go: 'list', dark: true }] });
  $('#rank-recipes').innerHTML = cur.recipes.length ? withThumbs(cur.recipes.map(r => ({ p: recipes.find(x => x.id === r.id) || { id: r.id, name: r.name } }))).map(({ p, t }, i) => {
      const r = cur.recipes[i];
      return rankRow(i, `${imgBox(p, '', 'IMG', t)}<div class="body"><b>${esc(r.name)}</b>${lvlTag(p)} ${p.flag ? flagChip(p) : ''}<span class="mu">만든 요리 ${r.posts}건 · 👍 ${r.likes}표</span></div>`, r.pts, '점', `data-go="detail" data-id="${r.id}"`);
    }).join('') : emptyR;
  $('#rank-chefs').innerHTML = cur.chefs.length ? cur.chefs.map((c, i) =>
      rankRow(i, `<span class="avatar" aria-hidden="true"></span><div class="body"><b>@${esc(c.nick)} <span class="flag flag-U">U</span></b><span class="mu">만든 요리 ${c.posts}건 · 👍 ${c.likes}표 · 대표 요리 ${esc(c.best?.recipeName || '')}</span></div>`, c.pts, '점', c.best ? `data-go="post" data-post="${c.best.id}"` : '', u && c.id === u.id ? 'me' : '')).join('')
    : emptyR;
  $('#rank-last').innerHTML = prev.chefs.length
    ? `<p class="mu" style="margin-top:10px">${fmtMD(last.start)} ~ ${fmtMD(new Date(last.end - 1))} 결과</p>` + prev.chefs.slice(0, 3).map((c, i) => rankRow(i, `<span class="avatar" aria-hidden="true"></span><div class="body"><b>@${esc(c.nick)}</b><span class="mu">만든 요리 ${c.posts}건 · 👍 ${c.likes}표</span></div>`, c.pts, '점')).join('')
      + (prev.recipes[0] ? `<p class="mu" style="margin-top:10px">지난 주 가장 많이 만든 요리: <b>${esc(prev.recipes[0].name)}</b> (${prev.recipes[0].posts}건)</p>` : '')
    : emptyState({ title: '지난 주 결과가 없어요', hint: '지난 주(월~일)에 올라온 요리가 없었어요. 이번 주가 첫 대회예요.', actions: [{ label: '이번 주 참여하기', go: 'list', dark: true }] });
  const me = u ? cur.chefs.findIndex(c => c.id === u.id) : -1;
  $('#rank-me').innerHTML = !u ? `<b>내 순위</b><p class="mu" style="margin-top:4px">상단의 로그인 버튼으로 로그인하면 내 순위와 점수가 여기 나와요.</p>`
    : me < 0 ? `<b>내 순위</b><p class="mu" style="margin-top:4px">${esc(u.nick)} 님은 이번 주 아직 참여 전이에요. 요리 1건 올리면 ${PT_POST}점부터 시작!</p><button class="btn dk" data-go="list">레시피 고르러 가기</button>`
    : `<b>내 순위 ${me + 1}위 · ${cur.chefs[me].pts}점</b><p class="mu" style="margin-top:4px">만든 요리 ${cur.chefs[me].posts}건 · 받은 👍 ${cur.chefs[me].likes}표${me > 0 ? ` · ${me}위까지 ${cur.chefs[me - 1].pts - cur.chefs[me].pts + 1}점` : ' · 현재 1위!'}</p><button class="btn dk" data-go="list">요리 하나 더 올리기</button>`;
}

const fromHash = () => { const h = location.hash.slice(1); return h in TAB_OF ? h : 'home'; };
addEventListener('hashchange', () => go(fromHash())); // 주소 직접 입력 · 뒤로 가기 대응
go(fromHash());
syncFind();
syncLogin();
loadData();
