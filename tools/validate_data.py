"""Validate static JSON paths, provenance, links and manifest counts."""
from pathlib import Path
import json

BASE = Path(__file__).resolve().parent.parent
DATA = BASE / 'data'
GROUPS = ['real', 'user', 'api', 'calc', 'empty']
FLAGS = {'json': 'J', 'api': 'A', 'user': 'U', 'calc': 'C'}

def paths(value, prefix=''):
    if prefix:
        yield prefix, value
    if isinstance(value, dict):
        for key, child in value.items():
            if key != 'meta':
                yield from paths(child, prefix + '.' + key if prefix else key)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from paths(child, f'{prefix}[{index}]')

def check(row, label):
    meta = row['meta']
    assert FLAGS[meta['source']] == row['flag'], label + ': flag/source'
    assert not meta.get('dummy'), label + ': dummy'
    valid = dict(paths(row))
    for path, value in valid.items():
        groups = [group for group in GROUPS if path in meta.get(group, [])]
        assert len(groups) == 1, f'{label}: missing/duplicate {path} {groups}'
        assert (groups[0] == 'empty') == (value is None), f'{label}: null {path}'
    for group in GROUPS:
        for path in meta.get(group, []):
            assert path in valid, f'{label}: unknown path {path}'

def main():
    files = {f.name: json.loads(f.read_text(encoding='utf-8')) for f in DATA.glob('*.json')}
    manifest = files['data_manifest.json']
    assert {e['file'] for e in manifest['files']} == set(files) - {'data_manifest.json'}
    total = 0
    for name, value in files.items():
        for index, row in enumerate(value if isinstance(value, list) else [value]):
            check(row, f'{name}[{index}]')
            total += 1
    for entry in manifest['files']:
        assert len(files[entry['file']]) == entry['count'], entry['file']
    recipes = files['recipes_existing.json']
    ids = {r['id'] for r in recipes}
    assert len(ids) == len(recipes) == 76
    assert all(r['time'] is None and r['level'] is None for r in recipes)
    assert all(r['recipe_id'] in ids for r in files['recipe_ingredients_links.json'])
    assert {r['recipeId'] for r in files['recipes_api_requests.json']} == ids
    assert all(r['status'] == 'not_requested' and not r['meta']['api'] for r in files['recipes_api_requests.json'])
    assert files['api_responses.json'] == []
    app = (BASE / 'js/app.js').read_text(encoding='utf-8')
    for required in ['recipes_existing.json','recipes_user.json','posts_user.json','ingredients_dictionary.json']:
        assert required in app
    for obsolete in ['recipes_dummy.json','fridge_demo.json','user_recipes.json']:
        assert obsolete not in app
    print(f'PASS: {len(files)} JSON files, {total} records; provenance, IDs, references and counts valid.')

if __name__ == '__main__':
    main()
