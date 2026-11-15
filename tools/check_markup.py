"""Check static markup nesting, IDs, local assets and input labels."""
from html.parser import HTMLParser
from pathlib import Path
from collections import Counter

ROOT=Path(__file__).resolve().parent.parent
VOID={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
class Check(HTMLParser):
    def __init__(self):
        super().__init__();self.stack=[];self.ids=[];self.refs=[];self.labels=set();self.inputs=[];self.errors=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='label' and a.get('for'):self.labels.add(a['for'])
        if tag in {'input','select','textarea'}:self.inputs.append((a,any(t=='label' for t,_ in self.stack)))
        if tag in {'script','link','use'}:
            value=a.get('src') or a.get('href')
            if value:self.refs.append(value)
        if tag not in VOID:self.stack.append((tag,a))
    def handle_endtag(self,tag):
        if tag in VOID:return
        if not self.stack or self.stack[-1][0]!=tag:self.errors.append('Unexpected closing '+tag)
        else:self.stack.pop()
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if tag not in VOID:self.handle_endtag(tag)

if __name__=='__main__':
    c=Check();c.feed((ROOT/'index.html').read_text(encoding='utf-8'))
    assert not c.errors,c.errors
    assert not c.stack,c.stack
    assert not [name for name,count in Counter(c.ids).items() if count>1],'Duplicate ID'
    for ref in c.refs:
        if ref.startswith('#'):assert ref[1:] in c.ids,ref
        elif not ref.startswith(('http:','https:','//')):assert (ROOT/ref).is_file(),ref
    unlabelled=[a.get('id') for a,wrapped in c.inputs if a.get('type') not in {'hidden','button','submit'} and not wrapped and not a.get('aria-label') and a.get('id') not in c.labels]
    assert not unlabelled,unlabelled
    print(f'PASS: markup nesting, {len(c.ids)} unique IDs, asset references and input labels.')
