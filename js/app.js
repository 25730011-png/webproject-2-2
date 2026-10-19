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
}

document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) { if (g.disabled) return; return go(g.dataset.go); }
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
  if (e.target.classList.contains('chip')) { e.target.remove(); syncFind(); }
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

const fromHash = () => { const h = location.hash.slice(1); return h in TAB_OF ? h : 'home'; };
addEventListener('hashchange', () => go(fromHash())); // 주소 직접 입력 · 뒤로 가기 대응
go(fromHash());
syncFind();
syncLogin();
