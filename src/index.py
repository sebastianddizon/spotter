import json, re, os, sys, collections, zlib
src=sys.argv[1]; outdir=sys.argv[2]; prefix=sys.argv[3]   # prefix: 'b' branded
SH=int(sys.argv[4]) if len(sys.argv)>4 else 4000
import os as _o
TB=int(_o.environ.get("TB","128"))
STOP=set('and with the of in for a an or to on by from no not oz fl lb g ml pack ct count size per each'.split())
def toks(s):
    out=set()
    for w in re.findall(r"[a-z0-9]+", s.lower().replace("'","")):
        if len(w)<2 or w in STOP or w.isdigit() and len(w)>3: continue
        if len(w)>3 and w.endswith('s') and not w.endswith('ss'): w=w[:-1]
        out.add(w)
    return out
def bucket(t): return zlib.crc32(t.encode())%TB
rows=[json.loads(l) for l in open(src)]
rows.sort(key=lambda r:((r[1] or '~').lower(), r[0].lower()))
os.makedirs(f'{outdir}/{prefix}i',exist_ok=True); os.makedirs(f'{outdir}/{prefix}t',exist_ok=True); os.makedirs(f'{outdir}/{prefix}u',exist_ok=True)
post=[collections.defaultdict(list) for _ in range(TB)]
upc=[{} for _ in range(100)]
for i,r in enumerate(rows):
    for t in toks(r[0]+' '+(r[1] or '')): post[bucket(t)][t].append(i)
    if r[2]: upc[int(r[2][-2:]) if r[2][-2:].isdigit() else 0][r[2]]=i
for s in range(0,len(rows),SH):
    json.dump(rows[s:s+SH], open(f'{outdir}/{prefix}i/{s//SH}.json','w'), separators=(',',':'))
for b in range(TB):
    # delta-encode ids
    d={t:[ids[0]]+[ids[k]-ids[k-1] for k in range(1,len(ids))] for t,ids in post[b].items()}
    json.dump(d, open(f'{outdir}/{prefix}t/{b}.json','w'), separators=(',',':'))
if prefix=='b':
    for b in range(100): json.dump(upc[b], open(f'{outdir}/{prefix}u/{b}.json','w'), separators=(',',':'))
json.dump({'n':len(rows),'shard':SH,'tb':TB}, open(f'{outdir}/{prefix}meta.json','w'))
print(len(rows), (len(rows)+SH-1)//SH, 'shards')
