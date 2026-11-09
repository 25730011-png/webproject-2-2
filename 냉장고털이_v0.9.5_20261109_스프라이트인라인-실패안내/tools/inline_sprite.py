"""asset/sprite.svg(그림 모음)를 index.html 안에 넣음 → <use href="#t01">로 어디서나(파일로 바로 열어도) 그림이 보임
사용: python tools/inline_sprite.py   (make_thumbs.py가 끝에 자동 실행)
index.html의 <!-- sprite:start --> … <!-- sprite:end --> 사이만 바꿈. asset/sprite.svg는 그림의 원본으로 계속 둠"""
import os, re
HERE = os.path.dirname(os.path.abspath(__file__))
html_p = os.path.join(HERE, '..', 'index.html'); svg_p = os.path.join(HERE, '..', 'asset', 'sprite.svg')
svg = open(svg_p, encoding='utf-8').read().strip()
svg = re.sub(r'<!--.*?-->\s*', '', svg, count=1, flags=re.S)  # 파일 맨 위 설명 주석 제거
html = open(html_p, encoding='utf-8').read()
block = '<!-- sprite:start — asset/sprite.svg 를 tools/inline_sprite.py 로 넣은 것. 직접 고치지 말고 sprite.svg 를 고친 뒤 스크립트 실행 -->\n' + svg + '\n<!-- sprite:end -->'
if '<!-- sprite:start' in html:
    html = re.sub(r'<!-- sprite:start.*?<!-- sprite:end -->', lambda m: block, html, flags=re.S)
else:
    html = html.replace('<body>\n', '<body>\n' + block + '\n', 1)
open(html_p, 'w', encoding='utf-8').write(html)
print('index.html에 sprite 삽입:', svg.count('<symbol'), 'symbol')
