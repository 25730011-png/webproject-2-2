"""그림 모음 한 파일 생성 → asset/sprite.svg (<symbol> 38개)
- t01~t36: 사진 없는 레시피용 일러스트 (분류별 그릇 모양 4종 × 색 9종). 실제 사진이 아니므로 화면에 '그림' 표식
- fridge: 결과 없음 화면의 빈 냉장고 / noimage: 사진 링크 깨짐용 접시 / hero: 홈 히어로 그림
화면에서는 <svg><use href="asset/sprite.svg#t01"></use></svg> 로 꺼내 씀 (파일 1개, 요청 1번)
사용: python tools/make_thumbs.py"""
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'asset', 'sprite.svg')
PAL = [('#f4e9d8','#c0392b','#f2b6a0'),('#e8f0e3','#2f6b4f','#a8d5b5'),('#fbeede','#d9822b','#f6c36a'),('#e9ecf4','#3b4f7a','#b9c6e6'),
       ('#f7e6ef','#9b3d6e','#e6a9c9'),('#f3f0dd','#8a7d1c','#dcd27a'),('#e6f1f3','#2a7f8f','#a4d4db'),('#f5e7e0','#7a4a2e','#d8b29c'),('#ececec','#444','#bdbdbd')]
def bowl(bg, a, b):   # 국&찌개: 둥근 그릇 + 김
    return f'''<rect width="160" height="160" fill="{bg}"/><path d="M30 78 h100 q0 46 -50 46 q-50 0 -50 -46z" fill="{a}"/><ellipse cx="80" cy="78" rx="50" ry="12" fill="{b}"/><ellipse cx="80" cy="78" rx="38" ry="8" fill="{a}" opacity=".35"/><path d="M62 60 q6 -10 0 -20 M80 56 q6 -10 0 -20 M98 60 q6 -10 0 -20" stroke="{a}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>'''
def plate(bg, a, b):  # 밥: 납작 접시 + 밥 봉우리
    return f'''<rect width="160" height="160" fill="{bg}"/><ellipse cx="80" cy="100" rx="60" ry="22" fill="{b}"/><ellipse cx="80" cy="96" rx="46" ry="15" fill="{bg}" opacity=".6"/><path d="M48 96 q32 -40 64 0z" fill="{a}"/><circle cx="70" cy="80" r="3" fill="{bg}" opacity=".8"/><circle cx="86" cy="76" r="3" fill="{bg}" opacity=".8"/><circle cx="92" cy="88" r="3" fill="{bg}" opacity=".8"/>'''
def pan(bg, a, b):    # 일품: 팬 + 손잡이
    return f'''<rect width="160" height="160" fill="{bg}"/><rect x="104" y="72" width="44" height="12" rx="6" fill="{a}"/><circle cx="68" cy="82" r="44" fill="{a}"/><circle cx="68" cy="82" r="34" fill="{b}"/><circle cx="56" cy="74" r="8" fill="{bg}" opacity=".9"/><circle cx="80" cy="90" r="6" fill="{bg}" opacity=".9"/><circle cx="76" cy="70" r="4" fill="{a}" opacity=".8"/>'''
def side(bg, a, b):   # 반찬: 네모 종지 2개
    return f'''<rect width="160" height="160" fill="{bg}"/><rect x="22" y="58" width="54" height="54" rx="10" fill="{b}"/><rect x="84" y="48" width="54" height="54" rx="10" fill="{a}"/><circle cx="49" cy="85" r="14" fill="{a}" opacity=".8"/><rect x="98" y="62" width="26" height="26" rx="6" fill="{b}" opacity=".9"/>'''
SHAPES = [('bowl', bowl), ('plate', plate), ('pan', pan), ('side', side)]
FRIDGE = """<rect x="22" y="8" width="116" height="180" rx="10" fill="#f6f6f3" stroke="#222" stroke-width="3"/><rect x="34" y="20" width="92" height="156" rx="4" fill="#e9eef1" stroke="#222" stroke-width="2"/><line x1="34" y1="66" x2="126" y2="66" stroke="#222" stroke-width="2"/><line x1="40" y1="104" x2="120" y2="104" stroke="#9aa5ad" stroke-width="2" stroke-dasharray="4 3"/><line x1="40" y1="140" x2="120" y2="140" stroke="#9aa5ad" stroke-width="2" stroke-dasharray="4 3"/><rect x="40" y="26" width="80" height="12" rx="2" fill="#dfe5e9" stroke="#9aa5ad" stroke-width="1.5"/><rect x="128" y="34" width="6" height="22" rx="3" fill="#222"/><rect x="128" y="80" width="6" height="40" rx="3" fill="#222"/><path d="M58 86 q6 -8 12 0 q6 8 12 0 q6 -8 12 0" fill="none" stroke="#9aa5ad" stroke-width="2" stroke-linecap="round"/><line x1="30" y1="194" x2="130" y2="194" stroke="#222" stroke-width="3" stroke-linecap="round"/>"""
HERO = """<rect width="220" height="160" fill="none"/><rect x="18" y="14" width="78" height="130" rx="8" fill="#f6f6f3" stroke="#fff" stroke-width="3"/><rect x="26" y="22" width="62" height="114" rx="4" fill="#e9eef1"/><line x1="26" y1="58" x2="88" y2="58" stroke="#9aa5ad" stroke-width="2"/><line x1="26" y1="98" x2="88" y2="98" stroke="#9aa5ad" stroke-width="2"/><ellipse cx="44" cy="52" rx="9" ry="7" fill="#f2b6a0"/><rect x="58" y="42" width="12" height="14" rx="2" fill="#a8d5b5"/><circle cx="78" cy="50" r="6" fill="#f6c36a"/><rect x="34" y="78" width="18" height="18" rx="3" fill="#dcd27a"/><ellipse cx="68" cy="88" rx="12" ry="8" fill="#c0392b"/><rect x="34" y="112" width="40" height="10" rx="2" fill="#b9c6e6"/><rect x="90" y="34" width="5" height="18" rx="2.5" fill="#fff"/><rect x="90" y="70" width="5" height="30" rx="2.5" fill="#fff"/><ellipse cx="160" cy="118" rx="48" ry="20" fill="#f1f1ec" stroke="#fff" stroke-width="3"/><ellipse cx="160" cy="114" rx="36" ry="14" fill="#fbeede"/><path d="M132 112 q28 -36 56 0z" fill="#d9822b"/><circle cx="150" cy="100" r="3" fill="#fff" opacity=".9"/><circle cx="166" cy="96" r="3" fill="#fff" opacity=".9"/><path d="M146 80 q6 -10 0 -20 M160 76 q6 -10 0 -20 M174 80 q6 -10 0 -20" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/><circle cx="196" cy="48" r="22" fill="#2f6b4f" stroke="#fff" stroke-width="3"/><circle cx="196" cy="48" r="14" fill="#a8d5b5"/><rect x="214" y="44" width="4" height="8" fill="#fff"/>"""
NOIMAGE = """<rect width="160" height="160" fill="#d9d9d2"/><ellipse cx="80" cy="92" rx="52" ry="30" fill="#f1f1ec" stroke="#777" stroke-width="2.5"/><ellipse cx="80" cy="90" rx="36" ry="19" fill="none" stroke="#9aa5ad" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M28 44 v26 M22 44 v14 M34 44 v14 M22 58 q6 6 12 0" fill="none" stroke="#777" stroke-width="2.5" stroke-linecap="round"/><path d="M132 44 v26" stroke="#777" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="132" cy="38" rx="6" ry="9" fill="none" stroke="#777" stroke-width="2.5"/><text x="80" y="140" text-anchor="middle" font-family="-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif" font-size="12" fill="#777">사진 없음</text>"""
syms, n = [], 0
for sname, fn in SHAPES:
    for bg, a, b in PAL:
        n += 1
        syms.append(f'  <symbol id="t{n:02d}" viewBox="0 0 160 160">{fn(bg, a, b)}</symbol>')
syms.append(f'  <symbol id="fridge" viewBox="0 0 160 200">{FRIDGE}</symbol>')
syms.append(f'  <symbol id="noimage" viewBox="0 0 160 160">{NOIMAGE}</symbol>')
syms.append(f'  <symbol id="hero" viewBox="0 0 220 160">{HERO}</symbol>')
open(OUT, 'w', encoding='utf-8').write('<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n<!-- 냉장고 털이 그림 모음 (한 파일): t01~t36 음식 일러스트, fridge 빈 냉장고, noimage 접시. 생성: tools/make_thumbs.py -->\n' + '\n'.join(syms) + '\n</svg>\n')
print(len(syms), '개 symbol →', OUT)

import runpy; runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'inline_sprite.py'))
