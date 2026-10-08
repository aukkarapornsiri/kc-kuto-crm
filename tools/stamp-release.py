"""Version every local JS module and stylesheet together for a production release."""
import json,re,sys,posixpath
from pathlib import Path
root=Path(__file__).resolve().parents[1]
release=sys.argv[1]
if not re.fullmatch(r'[A-Za-z0-9._-]+',release):raise SystemExit('Invalid release ID')
imports={}
for file in [*root.glob('*.js'),*root.glob('src/*.mjs')]:
    for spec in re.findall(r'''(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["'](\.[^"']+)["']''',file.read_text()):
        rel=posixpath.normpath(posixpath.join(str(file.relative_to(root).parent),spec))
        target=rel.split('?')[0].split('#')[0]
        if (root/target).is_file():imports['./'+rel]='./'+target+'?v='+release
p=root/'index.html';html=p.read_text()
html=re.sub(r'<script type="importmap">.*?</script>','<script type="importmap">'+json.dumps({'imports':dict(sorted(imports.items()))},separators=(',',':'))+'</script>',html,flags=re.S)
html=re.sub(r'((?:src|href)="\./[^"?]+\.(?:js|mjs|css))(?:\?[^" ]*)?"',lambda m:m[1]+'?v='+release+'"',html)
html=re.sub(r'\s*<meta name="kc-release"[^>]*>','',html)
html=html.replace('<title>','<meta name="kc-release" content="'+release+'" />\n    <title>',1)
html=html.replace('<!-- Cache-bust only changed login modules without rewriting the app bundle. -->','<!-- One release ID for all users, module dependencies and stylesheets. -->')
p.write_text(html)
print(json.dumps({'release':release,'moduleMappings':len(imports)}))
