import zipfile, json, sys
A='/mnt/user-data/attachments/01221aa9-e4b0-5547-8c14-2b1e737c67e8/'
files=[('3eb6fb4f-FoodData_Central_foundation_food_json_2026-04-30.zip','FoundationFoods','F'),
       ('ed70ed35-FoodData_Central_survey_food_json_2024-10-31.zip','SurveyFoods','S'),
       ('4a125e84-FoodData_Central_sr_legacy_food_json_2018-04.zip','SRLegacyFoods','R')]
NK={1008:'k',2047:'k2',2048:'k3',1003:'p',1004:'f',1005:'c',1079:'fi',1050:'c2'}
rows={}; stats={}
for fn,key,tag in files:
    z=zipfile.ZipFile(A+fn); d=json.load(z.open(z.infolist()[0]))[key]; c=0
    for it in d:
        if not it: continue
        per={}
        for n in it.get('foodNutrients',[]):
            nid=n.get('nutrient',{}).get('id'); 
            if nid in NK and n.get('amount') is not None: per[NK[nid]]=float(n['amount'])
        k=per.get('k', per.get('k3', per.get('k2')))
        p=per.get('p',0); f=per.get('f',0); cb=per.get('c', per.get('c2',0)); fi=per.get('fi',0)
        if k is None:
            if not (p or f or cb): continue
            k=4*p+4*cb+9*f
        ports=[]
        for po in sorted(it.get('foodPortions',[]), key=lambda x:x.get('sequenceNumber',99)):
            g=po.get('gramWeight') or 0
            if g<=0: continue
            if tag=='S': lab=po.get('portionDescription','')
            else:
                u=po.get('measureUnit',{}).get('name','')
                if u in ('undetermined','RACC'): u=''
                amt=po.get('amount') or po.get('value') or 1
                amt=('%g'%amt)
                lab=' '.join(x for x in [amt,u,po.get('modifier','') or ''] if x).strip()
            if not lab or lab.lower().startswith('quantity not specified'): continue
            ports.append([lab[:60], round(g,1)])
        ports=ports[:8]
        sq,hh=(ports[0][1],ports[0][0]) if ports else (100.0,'100 g')
        m=sq/100
        name=it['description'].strip()
        cat=(it.get('foodCategory') or {}).get('description') if isinstance(it.get('foodCategory'),dict) else (it.get('wweiaFoodCategory') or {}).get('wweiaFoodCategoryDescription','')
        rec=[name,'',None,sq,'g',hh,round(k*m),round(p*m,1),round(cb*m,1),round(f*m,1),round(fi*m,1),cat or '',ports,[round(k,1),round(p,2),round(cb,2),round(f,2),round(fi,2)],tag]
        kk=name.lower()
        if kk not in rows: rows[kk]=rec; c+=1
    stats[tag]=c
with open(sys.argv[1],'w') as o:
    for r in rows.values(): o.write(json.dumps(r,separators=(',',':'))+'\n')
print(stats, len(rows))
