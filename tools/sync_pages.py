"""루트 index.html → pages/index.html 복사 (같은 화면을 pages/ 폴더에서도 열 수 있게)
pages/ 는 한 단계 아래라서 css·js 경로 앞에 ../ 를 붙이고, 다른 스크립트보다 먼저 APP_ROOT='../' 를 넣어 ../data/ 의 JSON을 읽게 함.
index.html 을 고친 뒤에는 이 스크립트를 다시 실행:  python3 tools/sync_pages.py"""
import os, re
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..')
src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
out = re.sub(r'(href|src)="(css|js|asset|data)/', r'\1="../\2/', src)
marker = '<script src="../js/config.js"></script>'
assert marker in out, 'config.js 스크립트 태그를 찾지 못했어요'
out = out.replace(marker, "<script>var APP_ROOT = '../'; // pages/ 에서 열 때 데이터 경로</script>\n" + marker, 1)
out = out.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<!-- 자동 생성: tools/sync_pages.py 가 루트 index.html 을 복사한 것. 직접 고치지 말고 루트 index.html 을 고친 뒤 스크립트 실행 -->', 1)
os.makedirs(os.path.join(ROOT, 'pages'), exist_ok=True)
open(os.path.join(ROOT, 'pages', 'index.html'), 'w', encoding='utf-8').write(out)
print('pages/index.html 생성 완료')
