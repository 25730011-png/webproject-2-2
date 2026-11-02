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
  if (id === 'list') renderList(); // 목록은 열 때마다 현재 보유 재료 기준으로 다시 그림
  if (id === 'search') { renderSearch(); setTimeout(() => $('#rq').focus(), 0); } // 와이어프레임: 진입 시 검색창 자동 포커스
  if (id === 'list' || id === 'search') backTo = id; // 상세에서 뒤로 가면 들어온 화면(목록·검색)으로, 검색어·탭 유지
}

document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) {
    if (g.disabled) return;
    if (g.dataset.go === 'detail') {
      // 카드에 id가 있으면 그 레시피, HTML 예시 카드는 data-name으로 찾음 → 없으면 "레시피를 찾을 수 없어요"
      if (g.dataset.id) openDetail(Number(g.dataset.id));
      else if (g.dataset.name) openDetail(recipes.find(r => r.name === g.dataset.name)?.id ?? -1);
    }
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
// 8주차 고도화: 출처 플래그 J/A 표시 · 식약처 API 연동 · 레시피 검색 · null 예외 공통 처리
// =====================================================================

// ① JSON 경로 — data/ 바로 아래 또는 data/json/ 아래 어느 쪽에 있어도 읽음 (GitHub Pages 배포 주소에서 확인, file:// 에서는 fetch가 막힘)
const DATA_URLS = ['./data/recipes.json', './data/json/recipes.json'];
let dataUrl = DATA_URLS[0];

// 식약처 레시피 API (식품안전나라 COOKRCP01) — https://www.foodsafetykorea.go.kr/api/openApiInfo.do?svc_no=COOKRCP01
// 주의: 레포가 Public이라 이 키는 누구나 볼 수 있음. 문제가 생기면 식품안전나라에서 재발급 후 여기만 바꾸면 됨
const API_KEY = '952021f2646447be9c0b';
const API_BASE = `${location.protocol === 'http:' ? 'http' : 'https'}://openapi.foodsafetykorea.go.kr/api/${API_KEY}/COOKRCP01/json`;
const API_PAGE = 1000; // 한 번에 받을 수 있는 최대 건수
let apiState = '연결 중'; // 연결 중 · 연결됨 · 실패

// ③ 원본 배열: JSON에서 읽은 데이터를 그대로 보관. 필터·정렬은 여기서 새 배열을 만들어 화면에 전달 (강의 1.3.1)
let recipes = [];
let excluded = [];      // 점검에서 필수 필드가 비어 화면에서 뺀 항목
let backTo = 'list';    // 상세 → 뒤로 갈 화면

// 데이터 명세서 기준 점검 상수 (data/COOKRCP01_100.xlsx 6_meta 플래그 정의 시트와 같음)
const REQUIRED = ['id', 'name', 'method', 'category', 'ingredientsText', 'meta'];
const ALLOWED = {
  method:   ['끓이기', '기타', '볶기', '굽기', '찌기'],
  category: ['국&찌개', '반찬', '밥', '일품'],
  level:    ['쉬움', '보통', '어려움'],
  flag:     ['J', 'A'],
};
const TYPES = { id: 'number', name: 'string', method: 'string', category: 'string',
                time: 'number', level: 'string', calories: 'number', sodium: 'number',
                image: 'string', ingredientsText: 'string', tip: 'string', flag: 'string' };
const isNone = v => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);

// 배열 여부·건수·필드·id·빈 값·자료형·허용값·필수 필드·출처 플래그를 Console에 출력하고, 필수 필드가 빠진 항목은 제외해 돌려줌 (강의 1.3.2)
function checkData(data, source) {
  console.group('[데이터 점검]', source);
  console.log('배열인가?', Array.isArray(data));
  if (!Array.isArray(data)) { console.groupEnd(); return []; }
  console.log('데이터 건수:', data.length);
  console.log('첫 번째 객체의 필드:', Object.keys(data[0] || {}));
  console.log('첫 번째 id와 자료형:', data[0]?.id, typeof data[0]?.id);
  const warn = [], ids = new Set(), nulls = {}, src = {}, who = {}, flags = {}, tests = [];
  data.forEach(p => {
    if (ids.has(p.id)) warn.push(`id 중복: ${p.id}`);
    ids.add(p.id);
    Object.entries(TYPES).forEach(([k, type]) => {
      const v = p[k];
      if (isNone(v)) { nulls[k] = (nulls[k] || 0) + 1; return; }
      if (typeof v !== type) warn.push(`자료형: id ${p.id} ${k} = ${JSON.stringify(v)} (${type} 이어야 함)`);
      else if (ALLOWED[k] && !ALLOWED[k].includes(v)) warn.push(`허용값 밖: id ${p.id} ${k} = "${v}"`);
    });
    if (!p.steps?.length) nulls.steps = (nulls.steps || 0) + 1;
    // 출처 플래그(meta) 점검 — 강의 1.4.4: source 누락·허용값 밖, flag(J/A)와 source가 맞는지, 작성 주체 집계
    const s = p.meta?.source;
    if (!s) warn.push(`출처 플래그 누락: id ${p.id} meta.source`);
    else if (!['json', 'api'].includes(s)) warn.push(`출처 플래그 허용값 밖: id ${p.id} meta.source = "${s}"`);
    else if (p.flag && p.flag !== FLAG_OF[s]) warn.push(`flag 불일치: id ${p.id} flag "${p.flag}" ↔ meta.source "${s}"`);
    src[s || '누락'] = (src[s || '누락'] || 0) + 1;
    flags[p.flag || '누락'] = (flags[p.flag || '누락'] || 0) + 1;
    const w = p.hashtag === '팀작성' ? '팀작성' : '식약처';
    who[w] = (who[w] || 0) + 1;
    if (p.meta?.nullTest?.length) tests.push(`${p.id} ${p.name ?? '(이름 없음)'}: ${p.meta.nullTest.join('·')}`);
  });
  excluded = [];
  const valid = data.filter(p => {
    const miss = REQUIRED.filter(k => isNone(p[k]));
    if (miss.length) { warn.push(`필수 필드 누락: id ${p.id} ${miss.join('·')} → 화면에서 제외`); excluded.push({ p, miss }); }
    return !miss.length;
  });
  console.log('빈 값(null) 수:', nulls);
  console.log('항목 출처:', src, '| 플래그:', flags, '| 작성 주체:', who);
  if (tests.length) console.log(`예외 테스트용으로 일부러 비운 항목 ${tests.length}건 (${(tests.length / data.length * 100).toFixed(0)}%):`, tests);
  if (warn.length) warn.forEach(w => console.warn(w)); else console.log('경고: 없음');
  console.log('화면에 표시할 건수:', valid.length);
  console.groupEnd();
  return valid;
}

// ② fetch: 파일을 요청하고 응답을 JavaScript 배열로 변환. 실패하면 catch에서 오류 화면 (강의 1.2 "불러오기 실패")
// 저장 JSON으로 먼저 화면을 그리고 → 식약처 API로 최신 값을 받아 덮어씀. API가 실패해도 저장 JSON 화면은 그대로 유지
function fetchJson(urls) {
  const [url, ...rest] = urls;
  return fetch(url)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status} (${url})`);
      dataUrl = url;
      return response.json();
    })
    .catch(error => rest.length ? fetchJson(rest) : Promise.reject(error));
}

function loadData() {
  $('#count').textContent = '불러오는 중…';
  $('#list-state').innerHTML = '';
  fetchJson(DATA_URLS)
    .then(data => {
      recipes = checkData(data, dataUrl);
      renderAll();
      return loadApi();
    })
    .catch(error => {
      console.error('[불러오기 실패]', error);
      showLoadError(error);
    });
}

function renderAll() {
  renderSrcNote();
  renderHomeReco();
  syncSampleLinks();
  if ($('#list').classList.contains('on')) renderList();
  if ($('#search').classList.contains('on')) renderSearch();
}

// 식약처 API 요청: 응답 한 페이지 → { total, rows }
function fetchApiPage(start) {
  return fetch(`${API_BASE}/${start}/${start + API_PAGE - 1}`)
    .then(response => {
      if (!response.ok) throw new Error(`API HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      const body = data.COOKRCP01 || data;
      const res = body.RESULT || {};
      if (res.CODE !== 'INFO-000') throw new Error(`API ${res.CODE} ${res.MSG}`); // 인증키 오류 등
      return { total: Number(body.total_count), rows: body.row || [] };
    });
}

// API 전체를 받아 식약처 레시피(팀 작성 제외)에 최신 값을 덮어씀
function loadApi() {
  console.group('[API 연결]', API_BASE.replace(API_KEY, '인증키'));
  return fetchApiPage(1)
    .then(first => {
      const rest = [];
      for (let s = 1 + API_PAGE; s <= first.total; s += API_PAGE) rest.push(fetchApiPage(s));
      return Promise.all(rest).then(pages => [first, ...pages].flatMap(p => p.rows));
    })
    .then(rows => {
      const byId = new Map(rows.map(r => [Number(r.RCP_SEQ), r]));
      let n = 0;
      recipes.forEach(p => {
        if (isTeam(p)) return;
        const a = byId.get(p.id);
        if (a) { applyApi(p, a); n++; }
      });
      apiState = '연결됨';
      console.log(`API 전체 ${rows.length}건 수신 → 우리 레시피 ${n}건 갱신 (flag J → A)`);
    })
    .catch(error => {
      apiState = '실패';
      console.warn('API 연결 실패 → 저장 JSON(J)으로 표시', error.message);
    })
    .finally(() => { console.groupEnd(); renderAll(); refreshDetail(); });
}

// API 한 건(a) → 화면용 필드. 조리시간·난이도는 API에 없어서 저장 JSON의 더미 값 유지
// meta.nullTest에 적힌 필드는 예외 화면 확인용으로 일부러 비운 값이라 API 값으로 채우지 않음
const API_FIELD = { RCP_NM: 'name', RCP_WAY2: 'method', RCP_PAT2: 'category', INFO_WGT: 'weight',
  INFO_ENG: 'calories', INFO_CAR: 'carb', INFO_PRO: 'protein', INFO_FAT: 'fat', INFO_NA: 'sodium',
  HASH_TAG: 'hashtag', ATT_FILE_NO_MAIN: 'image', ATT_FILE_NO_MK: 'imageStep', RCP_PARTS_DTLS: 'ingredientsText', RCP_NA_TIP: 'tip' };
const API_NUM = ['weight', 'calories', 'carb', 'protein', 'fat', 'sodium'];
function applyApi(p, a) {
  const keep = p.meta?.nullTest || [];
  const v = k => String(a[k] ?? '').trim();
  Object.entries(API_FIELD).forEach(([col, key]) => {
    if (keep.includes(key)) return;
    p[key] = API_NUM.includes(key) ? (v(col) ? Number(v(col)) : null) : (v(col) || null);
  });
  if (!keep.includes('steps')) {
    const steps = [];
    for (let i = 1; i <= 20; i++) {
      const n = String(i).padStart(2, '0');
      if (v(`MANUAL${n}`)) steps.push({ text: v(`MANUAL${n}`).replace(/\n/g, ' '), image: v(`MANUAL_IMG${n}`) || null });
    }
    p.steps = steps;
  }
  p.flag = 'A';
  p.meta = { ...p.meta, source: 'api', real: [], dummy: ['time', 'level'],
             api: [...Object.values(API_FIELD), 'steps'].filter(k => !keep.includes(k)),
             note: `식약처 API 실시간 (${new Date().toLocaleDateString('ko-KR')})` };
}

// 와이어프레임 예외: 레시피 데이터 로드 실패 → 오류 상태와 다시 시도, 입력 중인 재료는 유지
function showLoadError(error) {
  $('#count').textContent = '불러오기 실패';
  $('#count-src').textContent = '';
  $('#cards').innerHTML = '';
  $('#list-state').innerHTML = `<div class="err"><b>데이터를 불러오지 못했어요</b><br>
    ${location.protocol === 'file:' ? 'HTML을 직접 열면(file://) 브라우저가 JSON 읽기를 막습니다. GitHub Pages 배포 주소에서 확인하세요.' : '파일 경로(data/recipes.json)와 JSON 문법을 확인하세요.'}
    <br><span class="mu">${esc(error.message)}</span>
    <button class="btn dk" type="button" id="retry">다시 시도</button></div>`;
  $('#retry').addEventListener('click', loadData);
}

// ---------- 출처 표식 (강의 1.4.5): 데이터의 flag·meta만 보고 결정 ----------
// 항목 플래그: 저장 JSON = J, 식약처 API = A  (JSON의 flag 필드, 없으면 meta.source로 판단)
const FLAG_OF = { json: 'J', api: 'A' };
const FLAG_LABEL = { J: '저장 JSON', A: '식약처 API' };
const flagOf = p => p.flag || FLAG_OF[p.meta?.source] || 'J';
const flagBadge = p => { const f = flagOf(p); return `<span class="flag flag-${f.toLowerCase()}" title="${FLAG_LABEL[f]}">${f}</span>`; };

// 필드 유형: J(저장 JSON의 실제 값) · A(API 값) · D(더미) · 값이 없으면 null
function fieldType(p, key) {
  const m = p.meta || {};
  if (isNone(p[key])) return 'none';
  if ((m.api || []).includes(key)) return 'api';
  if ((m.real || []).includes(key)) return 'real';
  if ((m.dummy || []).includes(key)) return 'dummy';
  return '';
}
const FIELD_TYPE_LABEL = { real: 'J', api: 'A', dummy: 'D', none: 'null' };
const FIELD_TYPE_TITLE = { real: '저장 JSON 실제 값', api: '식약처 API 값', dummy: '더미 값', none: '빈 값(null)' };
const typeTag = type => type ? `<span class="type-tag type-${type}" title="${FIELD_TYPE_TITLE[type]}">${FIELD_TYPE_LABEL[type]}</span>` : '';
const tagOf = (p, key) => typeTag(fieldType(p, key));
const LEGEND = `<p class="legend"><span class="flag flag-j">J</span> 저장 JSON <span class="flag flag-a">A</span> 식약처 API
  <span class="type-tag type-dummy">D</span> 더미 <span class="type-tag type-none">null</span> 빈 값</p>`;

// 항목 출처 칩: 식약처 원본 / 팀 작성 (강의 1.4.2 "행마다 출처가 다르면 ID별 출처도 기록")
const isTeam = p => p.hashtag === '팀작성';
const originChip = p => isTeam(p)
  ? '<span class="src-chip team">팀 작성</span>'
  : '<span class="src-chip">식약처</span>';
const metaSummary = p => {
  const m = p.meta || {};
  return `J ${(m.real || []).length}개 · A ${(m.api || []).length}개 · D ${(m.dummy || []).length}개 필드`;
};

// J/A 항목 수 (flag 기준)
function sourceSummary() {
  const a = recipes.filter(p => flagOf(p) === 'A').length;
  const state = apiState === '연결 중' ? ' · API 연결 중…' : apiState === '실패' ? ' · API 연결 실패' : '';
  return `A ${a} · J ${recipes.length - a}${state}`;
}
// 홈 하단 데이터 출처 안내를 실제 데이터 기준으로 갱신
function renderSrcNote() {
  const el = $('#home-src');
  if (!el || !recipes.length) return;
  const team = recipes.filter(isTeam).length;
  el.textContent = `레시피 데이터: 식품의약품안전처 「조리식품의 레시피 DB」 ${recipes.length - team}건 + 팀 작성 ${team}건 (${sourceSummary()}).`
    + (excluded.length ? ` 필수 값이 비어 ${excluded.length}건은 화면에서 뺐어요.` : '')
    + ' 조리시간·난이도는 실습용 더미(D)이며, 게시물·좋아요·별점은 와이어프레임용 예시입니다. 자세한 구분은 README 참고.';
}

// ---------- null 공통 표시 규칙 ----------
// 글자·숫자: "정보 없음"(회색) + null 태그 / 사진: 회색 자리표시 + "사진 없음" / 목록: 빈 배열이면 안내 문장
const NONE = '<span class="none">정보 없음</span>';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const info = v => isNone(v) ? NONE : esc(v);
const num = (v, unit) => isNone(v) ? NONE : `${v}${unit}`;
const timeText = p => isNone(p.time) ? '<span class="none">시간 정보 없음</span>' : `${p.time}분`;
const levelText = p => isNone(p.level) ? '<span class="none">난이도 정보 없음</span>' : esc(p.level);
const metaLine = (p, keys) => keys.map(k => ({
  time: `${timeText(p)}${tagOf(p, 'time')}`, level: `${levelText(p)}${tagOf(p, 'level')}`,
  method: `${info(p.method)}${tagOf(p, 'method')}`, category: `${info(p.category)}${tagOf(p, 'category')}`,
}[k])).join(' · ');

// 식약처 이미지는 http:// 링크 → https 배포 주소에서 혼합 콘텐츠로 막히므로 표시할 때만 https로 바꿈 (JSON 원본값은 그대로 유지)
const imgUrl = u => u ? u.replace(/^http:\/\//, 'https://') : '';
// 사진: 로딩 중에는 회색 자리표시가 먼저 보이고(와이어프레임 '느린 네트워크' 예외), 값이 없거나 깨지면 같은 자리표시에 "사진 없음"
const noImg = label => `<span class="no-img"><i aria-hidden="true">🍽</i>${label}</span>`;
function imgBox(p, cls) {
  if (isNone(p.image)) return `<div class="img ${cls} is-empty">${noImg('사진 없음')}</div>`;
  return `<div class="img ${cls} has-img"><img src="${esc(imgUrl(p.image))}" alt="${esc(p.name)} 사진" loading="lazy" onerror="imgFail(this)"></div>`;
}
// 주소는 있는데 사진이 깨진 경우도 같은 자리표시로
function imgFail(img) {
  const box = img.parentNode;
  box.classList.remove('has-img');
  box.classList.add('is-empty');
  box.innerHTML = noImg(box.offsetWidth < 120 ? '사진 없음' : '사진을 불러오지 못했어요'); // 작은 썸네일은 짧게
}

// 홈의 보유 재료 칩 텍스트 → ['계란','양파','김치']
const myIngredients = () => $$('#mine .chip').map(c => c.textContent.replace('✕', '').trim()).filter(Boolean);
// 재료·검색어 비교용: 공백 제거, 별칭 통일 (data/ingredients.json의 aliases와 같은 규칙: 달걀 → 계란)
const normText = s => String(s ?? '').replace(/\s/g, '').replace(/달걀/g, '계란').toLowerCase();
// 레시피 재료 텍스트에 보유 재료 이름이 몇 개 들어 있는지 (재료 매칭 로직 고도화는 이후 주차)
function matchCount(p, mine) {
  const t = normText(p.ingredientsText);
  return mine.filter(m => t.includes(normText(m))).length;
}
const matchBadge = (hit, total) => hit && hit === total ? '<span class="bg a">보유 재료 모두 포함</span>'
  : hit ? `<span class="bg">보유 재료 ${hit}개 포함</span>` : '<span class="chip gr">보유 재료 없음</span>';

// ④ 렌더링: 원본 배열 → 카드 HTML → ⑤ #cards. 원본을 바꾸지 않고 결과 배열을 새로 만듦
// 목록 = 보유 재료가 1개 이상 들어간 레시피만 (만들 수 있는 요리 찾기 결과)
function renderList() {
  const mine = myIngredients();
  $('#list-mine').innerHTML = mine.map(m => `<span class="chip on">${esc(m)}</span>`).join('');
  if (!recipes.length) return;
  const results = recipes
    .map(p => ({ p, hit: matchCount(p, mine) }))
    .filter(r => r.hit > 0)
    .sort((a, b) => b.hit - a.hit || a.p.name.localeCompare(b.p.name, 'ko'));
  $('#count').textContent = `${results.length}건`;
  $('#count-src').textContent = `(전체 ${recipes.length} · ${sourceSummary()}${excluded.length ? ` · 점검 제외 ${excluded.length}` : ''})`;
  $('#list-legend').innerHTML = LEGEND;
  $('#cards').innerHTML = results.map(({ p, hit }) => card(p, hit, mine.length)).join('');
  $('#list-state').innerHTML = results.length ? '' : listEmpty();
}

function card(p, hit, total, dim) {
  return `<div class="card${dim ? ' dim' : ''}" data-go="detail" data-id="${p.id}">
    ${imgBox(p, '')}
    <div>
      <b>${esc(p.name)}</b> ${flagBadge(p)} ${originChip(p)}
      <p class="mu">${metaLine(p, ['time', 'level', 'category'])}</p>
      ${matchBadge(hit, total)}
    </div>
    <span>☆</span>
  </div>`;
}

// 와이어프레임 예외: 결과 0건 → 입력 재료 요약 유지, "이 재료를 추가하면…"과 추천 재료
function listEmpty() {
  const sug = $$('#suggest .chip').map(c => c.textContent.replace('+', '').trim());
  return `<div class="box empty"><b>보유 재료로 만들 수 있는 요리가 없어요</b>
    <p class="mu">이 재료를 추가하면 만들 수 있는 요리가 늘어나요</p>
    <div class="row" style="justify-content:center">${sug.map(s => `<span class="chip add">+ ${esc(s)}</span>`).join('') || '<span class="mu">추천 재료 없음</span>'}</div>
    <button class="btn" data-go="home">재료 다시 고르기</button></div>`;
}

// 홈 "지금 재료로 바로 만들 수 있어요": 보유 재료 매칭 상위 2건
function renderHomeReco() {
  const box = $('#home-reco');
  if (!box || !recipes.length) return;
  const mine = myIngredients();
  const top = recipes.map(p => ({ p, hit: matchCount(p, mine) })).filter(r => r.hit > 0)
    .sort((a, b) => b.hit - a.hit || a.p.name.localeCompare(b.p.name, 'ko')).slice(0, 2);
  box.innerHTML = top.length ? top.map(({ p, hit }) => `<article class="big-card" data-go="detail" data-id="${p.id}">
    ${imgBox(p, 'big-img')}
    <div class="big-body">${matchBadge(hit, mine.length)}
      <b>${esc(p.name)} ${flagBadge(p)}</b> ${originChip(p)}<p class="mu">${metaLine(p, ['time', 'level'])}</p></div>
  </article>`).join('')
    : `<div class="box empty"><b>지금 재료로 만들 수 있는 요리가 없어요</b>
        <p class="mu">${mine.length < 2 ? '재료를 2개 이상 넣어 주세요' : '아래 추천 재료를 추가해 보세요'}</p></div>`;
}

// ---------- 레시피 검색 (와이어프레임: 검색 탭) ----------
// 검색어 입력 전: 최근 검색어만 표시(X 삭제) / 입력 후: 레시피 N·게시물 N 탭, 내 냉장고 기준 배지, 보유 재료 없으면 회색
// 결과 0건: "이름 대신 재료로 찾아볼까요?"와 홈 이동
const RECENT_KEY = 'fridge.recentSearch';
let recentMemory = null; // 로컬 저장소를 못 쓸 때 이번 실행에만 보관
function getRecent() {
  if (recentMemory) return recentMemory;
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || ['김치볶음밥', '계란말이']; }
  catch { recentMemory = ['김치볶음밥', '계란말이']; return recentMemory; }
}
function setRecent(list) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); recentMemory = null; }
  catch { recentMemory = list; }
}
function addRecent(q) {
  q = q.trim();
  if (q) setRecent([q, ...getRecent().filter(x => x !== q)].slice(0, 8));
}

function searchRecipes(q) {
  const nq = normText(q);
  const mine = myIngredients();
  return recipes
    .map(p => ({ p, inName: normText(p.name).includes(nq), inIng: normText(p.ingredientsText).includes(nq), hit: matchCount(p, mine) }))
    .filter(r => r.inName || r.inIng)
    .sort((a, b) => b.inName - a.inName || b.hit - a.hit || a.p.name.localeCompare(b.p.name, 'ko'));
}

function renderSearch() {
  const q = $('#rq').value.trim();
  const recent = getRecent();
  $('#recent').innerHTML = recent.length
    ? recent.map(r => `<span class="chip recent"><button type="button" data-q="${esc(r)}">${esc(r)}</button><button type="button" class="x" data-del="${esc(r)}" aria-label="${esc(r)} 삭제">✕</button></span>`).join('')
    : '<span class="mu">최근 검색어가 없어요</span>';
  $('#recent-note').hidden = !recentMemory;
  $('#search-body').hidden = !q;   // 입력 전에는 최근 검색어만
  $('#recent-wrap').hidden = !!q;
  if (!q) return;
  if (!recipes.length) { $('#r-results').innerHTML = '<p class="mu">레시피를 불러오는 중이에요…</p>'; return; }

  const mine = myIngredients();
  const found = searchRecipes(q);
  $('#rq-n').textContent = found.length;
  $('#r-results').innerHTML = found.length
    ? `<p class="mu" style="margin-top:8px">"${esc(q)}" 레시피 ${found.length}건 · ${sourceSummary()}</p>${LEGEND}`
      + found.map(({ p, hit }) => card(p, hit, mine.length, hit === 0)).join('')
    : `<div class="box empty"><b>"${esc(q)}"에 맞는 레시피가 없어요</b>
        <p class="mu">이름 대신 재료로 찾아볼까요?</p>
        <button class="btn dk" data-go="home">재료로 찾기 (홈)</button></div>`;

  // 게시물 탭: HTML 예시 게시물을 같은 검색어로 거름
  const nq = normText(q);
  let pn = 0;
  $$('#p-results .card').forEach(c => { const hit = normText(c.dataset.q).includes(nq); c.hidden = !hit; if (hit) pn++; });
  $('#pq-n').textContent = pn;
  $('#p-empty').hidden = pn > 0;
  $('#p-empty b').textContent = `"${q}"에 맞는 게시물이 없어요`;
}

$('#rq').addEventListener('input', renderSearch);
$('#rq').addEventListener('keydown', e => { if (e.key === 'Enter') { addRecent($('#rq').value); e.target.blur(); } });
$('#rq').addEventListener('change', () => addRecent($('#rq').value));
$('#recent').addEventListener('click', e => {
  const del = e.target.closest('[data-del]');
  if (del) { setRecent(getRecent().filter(x => x !== del.dataset.del)); return renderSearch(); }
  const pick = e.target.closest('[data-q]');
  if (pick) { $('#rq').value = pick.dataset.q; addRecent(pick.dataset.q); renderSearch(); }
});
// 상세로 들어가기 전에 검색어를 최근 검색어에 남김
$('#search').addEventListener('click', e => { if (e.target.closest('[data-go="detail"]')) addRecent($('#rq').value); }, true);

// ---------- 상세 ----------
// id로 원본 배열에서 찾음 (강의 1.3.1 — id 중복이면 다른 레시피가 열리므로 checkData가 중복을 잡음)
// 와이어프레임 예외: 존재하지 않는 레시피 id → "레시피를 찾을 수 없어요"와 목록·홈 이동
let detailId = null;
function openDetail(id) {
  detailId = id;
  const p = recipes.find(r => r.id === id);
  $('#d-back').textContent = backTo === 'search' ? '← 검색으로' : '← 목록으로';
  $('#d-back').dataset.go = backTo;
  $('#d-found').hidden = !p;
  $('#d-missing').hidden = !!p;
  if (!p) {
    $('#d-missing-msg').textContent = recipes.length ? '목록에서 다른 레시피를 골라 주세요.' : '레시피를 아직 불러오지 못했어요.';
    return;
  }
  $('#d-img').outerHTML = imgBox(p, 'sq-img').replace('class="img', 'id="d-img" class="img');
  $('#d-title').innerHTML = `${esc(p.name)} ${flagBadge(p)} ${originChip(p)}`;
  $('#d-sub').innerHTML = metaLine(p, ['time', 'level', 'method', 'category']);
  $('#d-src').innerHTML = `출처 ${flagBadge(p)} ${FLAG_LABEL[flagOf(p)]} · ${isTeam(p) ? '팀이 직접 작성한 시연용 레시피' : '식품의약품안전처 조리식품 레시피 DB'} · ${metaSummary(p)}`
    + (p.meta?.nullTest?.length ? `<br><span class="none">예외 테스트용으로 비운 값: ${p.meta.nullTest.join(', ')}</span>` : '');
  $('#d-legend').innerHTML = LEGEND;
  $('#d-ing').innerHTML = `${info(p.ingredientsText)}${tagOf(p, 'ingredientsText')}`;
  $('#d-steps').innerHTML = p.steps?.length
    ? p.steps.map(s => `<li>${esc(s.text)}${s.image ? `<div class="img has-img"><img src="${esc(imgUrl(s.image))}" alt="" loading="lazy" onerror="this.parentNode.remove()"></div>` : ''}</li>`).join('') + `<li class="mu">조리 순서${tagOf(p, 'steps')}</li>`
    : `<li>${NONE.replace('정보 없음', '조리 순서 정보가 없어요')}${typeTag('none')}</li>`;
  const nutKeys = ['calories', 'carb', 'protein', 'fat', 'sodium'];
  $('#d-nut').innerHTML = nutKeys.every(k => isNone(p[k]))
    ? `<span>영양 정보</span><span>${NONE}${typeTag('none')}</span>`
    : [['열량', num(p.calories, ' kcal'), 'calories'], ['탄수화물', num(p.carb, ' g'), 'carb'],
       ['단백질', num(p.protein, ' g'), 'protein'], ['지방', num(p.fat, ' g'), 'fat'], ['나트륨', num(p.sodium, ' mg'), 'sodium'], ['중량', num(p.weight, ' g'), 'weight']]
      .map(([k, v, f]) => `<span>${k}</span><span>${v}${tagOf(p, f)}</span>`).join('');
  $('#d-tip').innerHTML = `${info(p.tip)}${tagOf(p, 'tip')}`;
  $('#d-api').textContent = flagOf(p) === 'A' ? `식약처 API에서 받은 값 · ${p.meta.note}`
    : isTeam(p) ? '팀 작성 레시피 (API 대상 아님, J)'
    : apiState === '실패' ? 'API 연결 실패 → 저장 JSON(J) 값 표시' : 'API 연결 중… (저장 JSON(J) 값 표시)';
}
// API 응답이 늦게 와도 지금 보고 있는 상세를 새 값으로 다시 그림
function refreshDetail() { if ($('#detail').classList.contains('on') && detailId !== null) openDetail(detailId); }

// HTML 예시 카드(인기 게시물·이번 주 요리·피드) → 원본 레시피가 없으면 "따라 만들기" 비활성 (와이어프레임 예외)
function syncSampleLinks() {
  $$('button[data-go="detail"][data-name]').forEach(b => {
    const ok = recipes.some(r => r.name === b.dataset.name);
    b.disabled = !ok;
    if (!ok && b.classList.contains('btn')) b.textContent = '원본 레시피 없음';
  });
}

const fromHash = () => { const h = location.hash.slice(1); return h in TAB_OF ? h : 'home'; };
addEventListener('hashchange', () => go(fromHash())); // 주소 직접 입력 · 뒤로 가기 대응
go(fromHash());
syncFind();
syncLogin();
loadData();
