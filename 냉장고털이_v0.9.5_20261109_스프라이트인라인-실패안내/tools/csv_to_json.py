"""data/COOKRCP01_100.csv(플래그 열 포함) → data/recipes.json 변환
사용: python tools/csv_to_json.py
CSV에서 레시피나 flag·meta_* 열을 고친 뒤 이 스크립트를 돌리면 JSON이 다시 만들어짐.
TIME·LEVEL 열이 비어 있으면 규칙(조리방법→시간, 재료 수→난이도)으로 채움 (더미).
flag 열이 비어 있으면 meta_source로 정함 (api → A, 그 외 → J). 사용자 등록 레시피(U)는 이 CSV가 아니라 data/user_recipes.json."""
import csv, json, re, os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'data', 'COOKRCP01_100.csv')
DST = os.path.join(HERE, '..', 'data', 'recipes.json')
TIME_BY_METHOD = {'볶기': 15, '굽기': 20, '끓이기': 25, '찌기': 30, '기타': 15}

def s(v): v = (v or '').strip(); return v or None
def n(v): v = (v or '').strip(); return float(v) if v else None
def split(v): return [x.strip() for x in (v or '').split(',') if x.strip()]
def level(text):
    k = len([x for x in re.split(r'[,，\n]', text or '') if x.strip()])
    return '쉬움' if k <= 6 else ('보통' if k <= 11 else '어려움')

out = []
with open(SRC, encoding='utf-8-sig', newline='') as f:
    for r in csv.DictReader(f):
        steps = [{'text': s(r[f'MANUAL{i:02d}']).replace('\n', ' '), 'image': s(r[f'MANUAL_IMG{i:02d}'])}
                 for i in range(1, 21) if s(r.get(f'MANUAL{i:02d}'))]
        source = s(r['meta_source']) or 'json'
        meta = {'source': source, 'real': split(r['meta_real']), 'dummy': split(r['meta_dummy']), 'api': split(r['meta_api'])}
        if s(r.get('meta_note')): meta['note'] = s(r['meta_note'])
        team = s(r['HASH_TAG']) == '팀작성'
        out.append({
            'id': int(r['RCP_SEQ']),
            'flag': s(r.get('flag')) or ('A' if source == 'api' else 'J'),
            'name': s(r['RCP_NM']), 'method': s(r['RCP_WAY2']), 'category': s(r['RCP_PAT2']),
            'author': s(r.get('AUTHOR')) or ('냉장고 털이 팀' if team else '식품의약품안전처'),
            'time': int(float(r['TIME'])) if s(r.get('TIME')) else TIME_BY_METHOD.get(s(r['RCP_WAY2']), 15),
            'level': s(r.get('LEVEL')) or level(r['RCP_PARTS_DTLS']),
            'weight': n(r['INFO_WGT']), 'calories': n(r['INFO_ENG']), 'carb': n(r['INFO_CAR']),
            'protein': n(r['INFO_PRO']), 'fat': n(r['INFO_FAT']), 'sodium': n(r['INFO_NA']),
            'hashtag': s(r['HASH_TAG']), 'image': s(r['ATT_FILE_NO_MAIN']), 'imageStep': s(r['ATT_FILE_NO_MK']),
            'ingredientsText': s(r['RCP_PARTS_DTLS']), 'steps': steps, 'tip': s(r['RCP_NA_TIP']), 'meta': meta,
        })
with open(DST, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
team = sum(1 for p in out if p['hashtag'] == '팀작성')
flags = {}
for p in out: flags[p['flag']] = flags.get(p['flag'], 0) + 1
print(f'{DST}: {len(out)}건 (식약처 {len(out)-team} · 팀작성 {team}) flag {flags}')
