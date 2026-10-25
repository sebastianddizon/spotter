import json, glob, sys
out=open(sys.argv[1],'w'); rep=[]
for f in sorted(glob.glob('/tmp/claude-0/-home-claude/01221aa9-e4b0-5547-8c14-2b1e737c67e8/scratchpad/rest/*.json')):
    d=json.load(open(f)); chain=d['chain']; n=0; bad=0; seen=set()
    for it in d.get('items',[]):
        try:
            k=float(it['kcal']); p=float(it.get('protein') or 0); c=float(it.get('carbs') or 0); fa=float(it.get('fat') or 0); fi=float(it.get('fiber') or 0)
        except Exception: bad+=1; continue
        at=4*p+4*c+9*fa
        if k<0 or k>4000 or (k>60 and at>0 and not 0.6<k/at<1.6): bad+=1; continue
        nm=str(it['name']).strip()
        key=(nm.lower(), str(it.get('serving','')).lower())
        if key in seen: continue
        seen.add(key)
        g=it.get('grams'); g=float(g) if isinstance(g,(int,float)) and g>0 else None
        out.write(json.dumps([nm, chain, None, g, 'g', str(it.get('serving') or '1 item'), round(k), round(p,1), round(c,1), round(fa,1), round(fi,1), it.get('category','')],separators=(',',':'))+'\n'); n+=1
    rep.append((chain,n,bad,d.get('source','')))
for r in rep: print(r)
