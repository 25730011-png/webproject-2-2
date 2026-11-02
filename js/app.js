// 화면 전환 · 탭 · TOP 버튼 (와이어프레임용 최소 동작)
const TAB_OF = {home:'home',list:'home',detail:'home',search:'home',feed:'feed',post:'feed',write:'feed',my:'my',login:''};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function go(id) {
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.go === TAB_OF[id]));
  $('.tabbar').style.display = id === 'login' ? 'none' : 'flex';
  document.documentElement.classList.toggle('snap', id === 'feed'); // 피드에서만 게시물 단위로 스크롤
  window.scrollTo(0, 0);
  if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
  if (id === 'list') { listShowAll = false; renderList(); } // 목록은 열 때마다 현재 보유 재료 기준으로 다시 그림
  if (id === 'search') searchRecipes();
}

document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) {
    if (g.disabled) return;
    if (g.dataset.id) openDetail(Number(g.dataset.id)); // 카드에 id가 있으면 그 레시피 상세
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
function syncFind() { $('#find').disabled = $$('#mine .chip').length < 2; }
$('#mine').addEventListener('click', e => {
  if (e.target.classList.contains('chip')) { e.target.remove(); syncFind(); renderHomeReco(); }
});
$('#suggest').addEventListener('click', e => {
  const c = e.target.closest('.chip');
  if (!c) return;
  const chip = document.createElement('span');
  chip.className = 'chip ing';
  chip.textContent = c.textContent.replace('+', '').trim() + ' ✕';
  $('#mine').append(chip);
  c.remove();
  syncFind();
  renderHomeReco();
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
}
$('#ing-q').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  addIngredient(e.target.value);
  e.target.value = '';
});

// 로그인: 아이디(영문·숫자 4~16자) + 닉네임(2~12자)이 모두 맞아야 시작하기 활성
function syncLogin() {
  const idOk = /^[A-Za-z0-9]{4,16}$/.test($('#uid').value.trim());
  const nick = $('#nick').value.trim();
  const nickOk = nick.length >= 2 && nick.length <= 12;
  $('#login-go').disabled = !(idOk && nickOk);
}
['#uid', '#nick'].forEach(s => $(s).addEventListener('input', syncLogin));

// 피드 > 게시물 검색: 요리 이름 · 닉네임 · 재료로 바로 걸러 보기
const norm = s => s.toLowerCase().replace(/[@\s]/g, '');
function filterPosts() {
  const q = norm($('#post-q').value);
  const tiles = $$('#post-tiles .tile');
  let n = 0;
  tiles.forEach(t => {
    const hit = !q || norm(t.dataset.q).includes(q);
    t.hidden = !hit;
    if (hit) n++;
  });
  $('#post-count').textContent = q ? `"${$('#post-q').value.trim()}" 게시물 ${n}개` : `게시물 ${tiles.length}개`;
  $('#post-empty').hidden = n > 0;
  $('#post-empty-msg').textContent = `"${$('#post-q').value.trim()}"에 맞는 게시물이 없어요`;
}
$('#post-q').addEventListener('input', filterPosts);
$('#post-recent').addEventListener('click', e => {
  const c = e.target.closest('.chip');
  if (!c) return;
  $('#post-q').value = c.textContent;
  filterPosts();
});

// TOP 버튼
const topBtn = $('.totop');
addEventListener('scroll', () => topBtn.classList.toggle('show', scrollY > 200));
topBtn.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

// =====================================================================
// 7주차: JSON 데이터 불러오기 (강의 1.1 ① JSON → ② fetch → ③ 데이터 점검 → ④ 렌더링 → ⑤ 화면)
// =====================================================================

// ① JSON 경로 — 6주차에 만든 data/ 폴더. GitHub Pages 배포 주소에서 확인 (file:// 에서는 fetch가 막힘)
const DATA_URL = './data/recipes.json';

// ③ 원본 배열: JSON에서 읽은 데이터를 그대로 보관. 필터·정렬은 여기서 새 배열을 만들어 화면에 전달 (강의 1.3.1)
let recipes = [];
let loadFailed = false; // 불러오기 실패(경로·문법 오류)와 결과 없음(0건)을 화면에서 구분하기 위해 (강의 1.2)
let listShowAll = false; // 목록 '결과 없음'에서 '전체 레시피 보기'를 눌렀을 때

// 데이터 명세서 기준 점검 상수 (data/COOKRCP01_100.xlsx 6_meta 플래그 정의 시트와 같음)
const REQUIRED = ['id', 'name', 'method', 'category', 'ingredientsText', 'meta'];
const ALLOWED = {
  method:   ['끓이기', '기타', '볶기', '굽기', '찌기'],
  category: ['국&찌개', '반찬', '밥', '일품'],
  level:    ['쉬움', '보통', '어려움'],
};
const TYPES = { id: 'number', name: 'string', method: 'string', category: 'string',
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
    else if (!['json', 'api'].includes(s)) warn.push(`출처 플래그 허용값 밖: id ${p.id} meta.source = "${s}"`);
    src[s || '누락'] = (src[s || '누락'] || 0) + 1;
    // API 플래그 점검 — source "api"면 api 필드가 있어야 하고, 그 필드는 JSON에 값을 두지 않음 (강의 1.4.4 meta.api)
    const apiFields = p.meta?.api || [];
    if (s === 'api' && !apiFields.length) warn.push(`API 플래그: id ${p.id} source "api"인데 meta.api가 비어 있음`);
    if (s !== 'api' && apiFields.length) warn.push(`API 플래그: id ${p.id} source "${s}"인데 meta.api에 필드가 있음`);
    apiFields.filter(k => p[k] !== null && p[k] !== undefined && p[k] !== '')
      .forEach(k => warn.push(`API 플래그: id ${p.id} ${k}은 API 필드인데 JSON에 값이 있음 (API 필드는 JSON에 값을 두지 않음)`));
    const w = p.hashtag === '팀작성' ? '팀작성' : '식약처';
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
    .then(data => {
      recipes = checkData(data, DATA_URL);
      renderHomeReco();
      if ($('#list').classList.contains('on')) renderList();
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
  $('#count').textContent = '불러오기 실패';
  $('#cards').innerHTML = '';
  $('#list-state').innerHTML = loadErrorHtml(error.message);
  $('#rec-count').textContent = '불러오기 실패';
  $('#rec-cards').innerHTML = '';
  $('#rec-state').innerHTML = loadErrorHtml(error.message);
}

// ---------- 출처 표식 (강의 1.4.5): 데이터의 meta만 보고 결정 ----------
// 필드 유형 판단: meta 목록에서 찾아 api → real → dummy 순으로 확인
function fieldType(p, key) {
  const m = p.meta || {};
  if ((m.api || []).includes(key)) return 'api';
  if ((m.real || []).includes(key)) return 'real';
  if ((m.dummy || []).includes(key)) return 'dummy';
  return '';
}
const FIELD_TYPE_LABEL = { real: '실제', dummy: '더미', api: 'API', fallback: '대체' };
const typeTag = type => type ? `<span class="type-tag type-${type}">${FIELD_TYPE_LABEL[type]}</span>` : '';
const tagOf = (p, key) => typeTag(fieldType(p, key));
// 항목 출처 칩: 식약처 원본 / 팀 작성 (강의 1.4.2 "행마다 출처가 다르면 ID별 출처도 기록")
const isTeam = p => p.hashtag === '팀작성';
const originChip = p => isTeam(p)
  ? '<span class="src-chip team">팀 작성</span>'
  : '<span class="src-chip">식약처</span>';
const sourceChip = p => (p.meta?.source === 'api')
  ? '<span class="type-tag type-api">API</span>'
  : '<span class="type-tag type-real">JSON</span>';
const metaSummary = p => {
  const m = p.meta || {};
  return `실제 ${(m.real || []).length}개 · 더미 ${(m.dummy || []).length}개 · API ${(m.api || []).length}개 필드`;
};

// ---------- 유틸 ----------
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// 식약처 이미지는 http:// 링크 → https 배포 주소에서 혼합 콘텐츠로 막히므로 표시할 때만 https로 바꿈 (JSON 원본값은 그대로 유지)
const imgUrl = u => u ? u.replace(/^http:\/\//, 'https://') : '';
function imgBox(p, cls, label) {
  if (!p.image) return `<div class="img ${cls}">${label}</div>`;
  return `<div class="img ${cls} has-img"><img src="${esc(imgUrl(p.image))}" alt="${esc(p.name)} 사진" loading="lazy"
    onerror="this.parentNode.classList.remove('has-img');this.replaceWith('${label} (이미지 없음)')"></div>`;
}
const info = v => (v === null || v === undefined || v === '') ? '정보 없음' : esc(v);
const num = (v, unit) => (v === null || v === undefined) ? '정보 없음' : `${v}${unit}`;

// 홈의 보유 재료 칩 텍스트 → ['계란','양파','김치']
const myIngredients = () => $$('#mine .chip').map(c => c.textContent.replace('✕', '').trim()).filter(Boolean);
// 레시피 재료 텍스트에 보유 재료 이름이 몇 개 들어 있는지 (재료 매칭 로직 고도화는 이후 주차)
// 같은 재료의 다른 표기를 맞춤 (ingredients.json의 aliases와 같은 쌍 — 사전 연동은 이후 주차)
const alias = t => String(t ?? '').replace(/달걀/g, '계란').replace(/참치캔/g, '참치').replace(/묵은지/g, '김치');
function matchCount(p, mine) {
  const t = alias(p.ingredientsText);
  return mine.map(alias).filter(m => t.includes(m)).length;
}

// ④ 렌더링: 원본 배열 → 카드 HTML → ⑤ #cards. 원본을 바꾸지 않고 결과 배열을 새로 만듦
// 보유 재료가 1개 이상 들어간 레시피만 보여주고, 0건이면 '결과 없음' 화면 (강의 1.2: 조건을 넓히는 안내)
function renderList() {
  const mine = myIngredients();
  $('#list-mine').innerHTML = mine.map(m => `<span class="chip on">${esc(m)}</span>`).join('');
  if (!recipes.length) { if (!loadFailed) $('#count').textContent = '불러오는 중…'; return; }
  const scored = recipes.map(p => ({ p, hit: matchCount(p, mine) }));
  const results = (listShowAll ? scored : scored.filter(r => r.hit > 0))
    .sort((a, b) => b.hit - a.hit || a.p.name.localeCompare(b.p.name, 'ko'));
  const team = recipes.filter(isTeam).length;
  $('#count').textContent = `${results.length}건`;
  $('#count-src').textContent = listShowAll
    ? `(전체 · 식약처 ${recipes.length - team} · 팀 작성 ${team})`
    : `(전체 ${recipes.length}건 중 보유 재료가 들어간 레시피)`;
  $('#cards').innerHTML = results.map(({ p, hit }) => card(p, hit, mine.length)).join('');
  $('#list-state').innerHTML = results.length ? '' : emptyList(mine);
}

function card(p, hit, total) {
  const badge = hit && hit === total ? '<span class="bg a">보유 재료 모두 포함</span>'
              : hit ? `<span class="bg">보유 재료 ${hit}개 포함</span>` : '';
  return `<div class="card" data-go="detail" data-id="${p.id}">
    ${imgBox(p, '', '요리 사진')}
    <div>
      <b>${esc(p.name)}</b> ${originChip(p)}
      <p class="mu">${p.time}분${tagOf(p, 'time')} · ${esc(p.level)}${tagOf(p, 'level')} · ${esc(p.category)}${tagOf(p, 'category')}</p>
      ${badge}
    </div>
    <span>☆</span>
  </div>`;
}

// 결과 없음 화면 (목록): 데이터는 있는데 조건에 맞는 항목이 0건 → 조건을 넓히는 안내 + 바로 할 수 있는 행동
function emptyList(mine) {
  return `<div class="box empty" style="text-align:center"><b>${mine.length ? `${mine.map(esc).join(' · ')}(으)로 만들 수 있는 레시피가 없어요` : '보유 재료를 먼저 골라 주세요'}</b>
    <p class="mu" style="margin-top:6px">재료 이름을 레시피에 적힌 대로(예: 달걀 → 계란, 참치캔 → 참치) 바꾸거나 다른 재료를 추가해 보세요.</p>
    <button class="btn" data-go="home">홈에서 재료 바꾸기</button>
    <button class="btn dk" id="show-all">전체 레시피 ${recipes.length}건 보기</button></div>`;
}
document.addEventListener('click', e => {
  if (e.target.closest('#show-all')) { listShowAll = true; renderList(); }
});

// 검색 화면 (레시피 탭): 이름·재료 텍스트로 검색. 결과 없음과 불러오기 실패를 다른 화면으로 (강의 1.2)
function searchRecipes() {
  const raw = $('#rec-q').value.trim();
  const q = norm(alias(raw));
  if (loadFailed) return; // showLoadError()가 이미 그림
  if (!recipes.length) { $('#rec-count').textContent = '불러오는 중…'; return; }
  if (!q) {
    $('#rec-count').textContent = `검색어를 입력하면 레시피 ${recipes.length}건에서 찾아요`;
    $('#rec-cards').innerHTML = ''; $('#rec-state').innerHTML = '';
    return;
  }
  const mine = myIngredients();
  const hits = recipes.filter(p => norm(p.name).includes(q) || norm(alias(p.ingredientsText)).includes(q))
    .map(p => ({ p, hit: matchCount(p, mine) }))
    .sort((a, b) => (norm(b.p.name).includes(q) - norm(a.p.name).includes(q)) || b.hit - a.hit || a.p.name.localeCompare(b.p.name, 'ko'));
  $('#rec-count').innerHTML = `<b>"${esc(raw)}"</b> 레시피 ${hits.length}건`;
  $('#rec-cards').innerHTML = hits.map(({ p, hit }) => `<div class="card" data-go="detail" data-id="${p.id}">
    ${imgBox(p, '', 'IMG')}
    <div><b>${esc(p.name)}</b> ${originChip(p)}<p class="mu">${p.time}분${tagOf(p, 'time')} · ${esc(p.level)}${tagOf(p, 'level')}</p>
      ${hit ? `<span class="bg${hit === mine.length ? ' a' : ''}">보유 재료 ${hit}개 포함</span>` : ''}</div></div>`).join('');
  $('#rec-state').innerHTML = hits.length ? '' : `<div class="box empty" style="text-align:center"><b>"${esc(raw)}"에 맞는 레시피가 없어요</b>
    <p class="mu" style="margin-top:6px">요리 이름의 일부(예: 볶음밥)나 재료 이름(예: 두부)으로 다시 찾아보세요. 띄어쓰기는 무시돼요.</p>
    <button class="btn" data-go="home">재료로 찾기</button></div>`;
}
$('#rec-q').addEventListener('input', searchRecipes);
$('#rec-recent').addEventListener('click', e => {
  const c = e.target.closest('.chip');
  if (!c) return;
  $('#rec-q').value = c.textContent;
  searchRecipes();
});

// 홈 "지금 재료로 바로 만들 수 있어요": 보유 재료 매칭 상위 2건
function renderHomeReco() {
  const box = $('#home-reco');
  if (!box || !recipes.length) return;
  const mine = myIngredients();
  const top = recipes.map(p => ({ p, hit: matchCount(p, mine) })).sort((a, b) => b.hit - a.hit).slice(0, 2);
  box.innerHTML = top.map(({ p, hit }) => `<article class="big-card" data-go="detail" data-id="${p.id}">
    ${imgBox(p, 'big-img', '레시피 사진')}
    <div class="big-body"><span class="bg${hit === mine.length && hit ? ' a' : ''}">${hit ? `보유 재료 ${hit}개 포함` : '재료 확인 필요'}</span>
      <b>${esc(p.name)}</b> ${originChip(p)}<p class="mu">${p.time}분${tagOf(p, 'time')} · ${esc(p.level)}${tagOf(p, 'level')}</p></div>
  </article>`).join('');
}

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

// ---------- 상세 화면 ----------
let detailId = null; // 응답이 늦게 와도 다른 레시피 화면에 덮어쓰지 않도록

// 상세: id로 원본 배열에서 찾음 (강의 1.3.1 — id 중복이면 다른 레시피가 열리므로 checkData가 중복을 잡음)
function openDetail(id) {
  const p = recipes.find(r => r.id === id);
  if (!p) return;
  detailId = id;
  $('#d-title').innerHTML = `${esc(p.name)} ${originChip(p)}`;
  $('#d-sub').innerHTML = `${p.time}분${tagOf(p, 'time')} · ${esc(p.level)}${tagOf(p, 'level')} · ${esc(p.method)}${tagOf(p, 'method')} · ${esc(p.category)}${tagOf(p, 'category')}`;
  $('#d-src').innerHTML = `출처 ${sourceChip(p)} ${isTeam(p) ? '팀이 직접 작성한 시연용 레시피' : '식품의약품안전처 조리식품 레시피 DB'} · ${metaSummary(p)}`;
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
    $('#d-api').textContent = 'API 미연동 (저장 JSON 항목)';
  }
}

// 영양정보·사진·팁 영역 렌더링. r = null(아직 응답 전 또는 JSON 항목) / fetchApi 결과
// 태그 규칙(강의 1.4.5): JSON 항목은 meta대로 실제/더미, API 항목은 응답값 'API', 실패·값 없음 '대체'
function renderDetailApiFields(p, r) {
  const isApi = p.meta?.source === 'api';
  const got = r && r.ok;
  const val = f => got ? r.vals[f] : p[f];
  const tag = f => !isApi ? tagOf(p, f) : (!r ? typeTag('api') : (got && r.vals[f] !== null ? typeTag('api') : typeTag('fallback')));
  const show = (f, unit) => isApi && !r ? '요청 중…' : num(val(f), unit);
  // 영양정보: API 항목은 응답 전·실패여도 박스를 숨기지 않고 '정보 없음 [대체]'로 표시
  const hasNut = isApi || ['calories', 'carb', 'protein', 'fat', 'sodium'].some(f => p[f] !== null);
  $('#d-nut-box').hidden = !hasNut;
  if (hasNut) $('#d-nut').innerHTML = [['열량', 'calories', ' kcal'], ['탄수화물', 'carb', ' g'], ['단백질', 'protein', ' g'],
    ['지방', 'fat', ' g'], ['나트륨', 'sodium', ' mg']]
    .map(([k, f, u]) => `<span>${k}</span><span>${show(f, u)}${tag(f)}</span>`).join('')
    + `<span>중량</span><span>${num(p.weight, ' g')}${tagOf(p, 'weight')}</span>`;
  // 사진
  const image = val('image');
  $('#d-img').outerHTML = imgBox({ image, name: p.name }, 'sq-img', isApi && !r ? '사진 요청 중…' : '요리 사진 (1:1)')
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

const fromHash = () => { const h = location.hash.slice(1); return h in TAB_OF ? h : 'home'; };
addEventListener('hashchange', () => go(fromHash())); // 주소 직접 입력 · 뒤로 가기 대응
go(fromHash());
syncFind();
syncLogin();
loadData();
