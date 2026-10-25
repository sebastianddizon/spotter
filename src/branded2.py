import zipfile, ijson, json, sys, time, collections
src=sys.argv[1]; out=sys.argv[2]
z=zipfile.ZipFile(src); f=z.open(z.infolist()[0])
N={1008:'k',1003:'p',1004:'f',1005:'c',1079:'fi'}
rows={}; n=0; src_ct=collections.Counter(); bad=0
def d2(s):
    try: m,dd,y=s.split('/'); return int(y)*10000+int(m)*100+int(dd)
    except: return 0
for it in ijson.items(f,'BrandedFoods.item', use_float=True):
    n+=1
    per={}; derivnull=True
    for fn in it.get('foodNutrients',[]):
        nid=fn.get('nutrient',{}).get('id')
        if nid in N and fn.get('amount') is not None:
            per[N[nid]]=float(fn['amount'])
            if fn.get('foodNutrientDerivation'): derivnull=False
    if 'k' not in per: continue
    ds=it.get('dataSource',''); src_ct[ds]+=1
    ss=it.get('servingSize'); su=(it.get('servingSizeUnit') or '').lower()
    try: ss=float(ss)
    except: ss=None
    if ds=='Euromonitor' or derivnull:
        srv={k:per.get(k,0) for k in N.values()}
    else:
        if not ss or su not in ('g','grm','ml','mlt','gm'): 
            # no usable serving; keep per 100 as "100 g"
            ss=100.0; su='g'
        srv={k:per.get(k,0)*ss/100 for k in N.values()}
    k,p,c,fa=srv['k'],srv['p'],srv['c'],srv['f']
    if k<0 or k>2500 or p<0 or c<0 or fa<0: bad+=1; continue
    at=4*p+4*c+9*fa
    if k>40 and at>0 and not (0.6<k/at<1.6): bad+=1; continue
    gt=(it.get('gtinUpc') or '').lstrip('0') or None
    unit='ml' if su in ('ml','mlt') else 'g'
    rec=[it.get('description','').strip(), (it.get('brandName') or it.get('brandOwner') or '').strip(), gt,
         round(ss,1) if ss else None, unit, (it.get('householdServingFullText') or '').strip(),
         round(k), round(p,1), round(c,1), round(fa,1), round(srv['fi'],1), it.get('brandedFoodCategory','')]
    dt=d2(it.get('publicationDate') or it.get('modifiedDate') or '')
    key=gt or (rec[0].lower()+'|'+rec[1].lower())
    if key not in rows or dt>=rows[key][0]: rows[key]=(dt,rec)
with open(out,'w') as o:
    for dt,r in rows.values(): o.write(json.dumps(r,separators=(',',':'))+'\n')
print('done', n, len(rows), 'bad', bad, src_ct.most_common(), flush=True)
