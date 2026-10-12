// 화면 전환 · 탭 · TOP 버튼 (와이어프레임용 최소 동작)
const TAB_OF = {home:'home',list:'home',detail:'home',search:'search',feed:'feed',post:'feed',write:'feed',my:'my',login:''};
const NAV_OF = {feed:'feed',post:'feed',write:'feed',search:'search',my:'my',login:'login'};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function go(id) {
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.go === TAB_OF[id]));
  $$('.top-bar .nv').forEach(b => b.classList.toggle('on', b.dataset.nav === NAV_OF[id]));
  window.scrollTo(0, 0);
  history.replaceState(null, '', '#' + id);
}

document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g) return go(g.dataset.go);
  const t = e.target.closest('[data-tab]'); // 탭(마이 · 목록 배지)
  if (t) {
    const wrap = t.closest('.screen');
    $$('.tabs button', wrap).forEach(b => b.classList.toggle('on', b === t));
    $$('.pane', wrap).forEach(p => p.classList.toggle('on', p.dataset.pane === t.dataset.tab));
  }
});

// 재료 칩 탭하면 삭제, 2개 미만이면 검색 버튼 비활성
function syncFind() { $('#find').disabled = $$('#mine .chip').length < 2; }
$('#mine').addEventListener('click', e => {
  if (e.target.classList.contains('chip')) { e.target.remove(); syncFind(); }
});

// TOP 버튼
const topBtn = $('.totop');
addEventListener('scroll', () => topBtn.classList.toggle('show', scrollY > 200));
topBtn.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

const h = location.hash.slice(1);
go(h in TAB_OF ? h : 'home');
syncFind();
