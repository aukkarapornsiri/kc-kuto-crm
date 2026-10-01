"""Prepare the bundled, simplified province map; no customer addresses leave CRM."""
import json, math, re, hashlib, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'src/thailand-provinces-source.geojson'
if not source.exists():
 source.write_bytes(urllib.request.urlopen('https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/main/releaseData/gbOpen/THA/ADM1/geoBoundaries-THA-ADM1_simplified.geojson',timeout=30).read())
assert hashlib.sha256(source.read_bytes()).hexdigest()=='841f1250cac868fa966b2089863f01e9c9b4dc9b7fb0d9d6dce9a495e32b32a0', 'Review changed upstream boundary data before regenerating'
raw=json.loads(source.read_text())
names=json.loads((ROOT/'src/thailand-province-names.json').read_text())
def norm(s):return re.sub('[^a-z]','',s.lower().replace(' province','').replace(' metropolis',''))
aliases={'Bueng Kan Province':'Bueng Kan','Lopburi Province':'Lop Buri'}
def rdp(points,tolerance=.012):
 if len(points)<=2:return points
 a,b=points[0],points[-1];dx=b[0]-a[0];dy=b[1]-a[1];den=dx*dx+dy*dy
 def distance(p):
  t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)) if den else 0
  return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
 at=max(range(1,len(points)-1),key=lambda i:distance(points[i]))
 if distance(points[at])<=tolerance:return [a,b]
 return rdp(points[:at+1],tolerance)[:-1]+rdp(points[at:],tolerance)
def project(p):return [(p[0]-97.2)*51,(20.8-p[1])*51]
rows=[]
for f in raw['features']:
 n=f['properties']['shapeName'];match=next(p for p in names if norm(p['en'])==norm(aliases.get(n,n)))
 polygons=f['geometry']['coordinates'] if f['geometry']['type']=='MultiPolygon' else [f['geometry']['coordinates']]
 paths=[];largest=[]
 for polygon in polygons:
  for ring in polygon:
   points=[project(p) for p in rdp(ring)]
   if len(points)<4:continue
   if len(ring)>len(largest):largest=ring
   paths.append('M'+'L'.join(f'{x:.1f},{y:.1f}' for x,y in points)+'Z')
 center=project([sum(p[0] for p in largest)/len(largest),sum(p[1] for p in largest)/len(largest)])
 rows.append({'id':f['properties']['shapeISO'],'th':match['th'],'en':match['en'],'path':''.join(paths),'x':round(center[0],1),'y':round(center[1],1)})
assert len(rows)==77 and len({r['id'] for r in rows})==77
header='// geoBoundaries gbOpen THA ADM1; CC BY 4.0. Simplified for province-level display.\n'
(ROOT/'src/thailand-map-data.mjs').write_text(header+'export const THAI_PROVINCES='+json.dumps(rows,ensure_ascii=False,separators=(',',':'))+';\n')
print('77 provinces; source SHA256',hashlib.sha256(source.read_bytes()).hexdigest())
