import asyncio, json, math, os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://postgres:password@localhost:5432/rmfood")
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

HERBS = ["黄芪","当归","茯苓","甘草","大枣"]

def _clamp(v, lo, hi): return max(lo, min(hi, v))

def derive_pk(logp, tpsa, ob):
    F = _clamp(ob/100.0,0,1) if ob<=100 else ob/200.0
    lp = max(-5.0,min(logp,15.0))
    ka = _clamp(0.30*math.exp(-0.18*lp)+0.80, 0.1, 4.0)
    tv = tpsa or 0.0
    Vd = _clamp(0.4+0.15*lp+0.01*(tv/10.0), 0.1, 3.0)
    CL = _clamp((math.log(2)/4.0)*Vd, 0.01, 2.0)
    df = json.dumps({"logp":logp,"tpsa":tpsa,"ob":ob,"formulas":{"ka":"0.30*exp(-0.18*logP)+0.80","Vd":"0.4+0.15*logP+0.01*(TPSA/10)","CL":"Vd*ln2/4h"},"ref":"PK estimation convention (one-compartment extrapolation of logP/TPSA)"}, ensure_ascii=False)
    return {"F":round(F,4),"ka":round(ka,4),"Vd":round(Vd,4),"CL":round(CL,4),"t_lag":0.3,"df":df,"src":"model_derived(logP/TPSA/OB%)","conf":0.45}

def derive_pd(ob, scores, logp):
    E_max = round(max(scores.values()) if scores else 0.5,4)
    F = _clamp(ob/100.0,0,1) if ob<=100 else ob/200.0
    lp=max(-5.0,min(logp,15.0))
    ka=0.30*math.exp(-0.18*lp)+0.80
    Vd=0.4+0.15*lp
    ke=math.log(2)/4.0
    cmax = F*100*ka/(Vd*(ka-ke)) if abs(ka-ke)>1e-9 else F*100*ka/Vd
    EC50=_clamp(cmax/math.sqrt(2),0.01,500.0)
    df=json.dumps({"efficacy_scores":scores,"cmax_est":round(cmax,4),"formula":"EC50=Cmax/sqrt(2), one-compartment Cmax","ref":"Emax model convention"}, ensure_ascii=False)
    return {"E_max":E_max,"EC50":round(EC50,4),"Hill":1.5,"scores":scores,"df":df,"src":"E_max:DB_real;EC50:model_derived;Hill:model_default","conf":_clamp(0.6 if scores else 0.3,0,1)}

def derive_stab(logps, tpsas):
    la=sum(logps)/len(logps) if logps else 0.0
    lm=max(logps) if logps else 0.0
    ta=(sum(tpsas)/len(tpsas)) if tpsas else None
    k=_clamp(0.02*(1.0+0.05*max(0,la))*2.5,0.001,0.5)
    shelf=_clamp(12.0/(k*10.0),3.0,36.0)
    df=json.dumps({"logp_avg":round(la,3),"formula":"k=0.02*(1+0.05*logP)*2.5; shelf=12/(k*10)","ref":"Arrhenius accelerated stability + lipophilicity oxidation risk"}, ensure_ascii=False)
    return {"dr":round(k,5),"shelf":round(shelf,1),"lmax":round(lm,3),"lav":round(la,3),"tp":round(ta,2) if ta is not None else None,"cn":len(logps),"df":df,"src":"model_derived(Arrhenius+logP)","conf":0.40}

async def run():
    e = create_async_engine(os.environ["DATABASE_URL"])
    async with e.begin() as db:
        ph=",".join(f":n{i}" for i in range(len(HERBS))); P={f"n{i}":n for i,n in enumerate(HERBS)}
        for t in ("tcm_herbs_pk","tcm_herbs_pd","stability_data"):
            await db.execute(text(f"DELETE FROM {t} WHERE herb_name_cn IN ({ph})"), P)
        await db.execute(text(f"DELETE FROM synergy_interactions WHERE ingredient_a IN ({ph})"), P)
        print("已清理旧数据")
        for name in HERBS:
            r2=await db.execute(text("SELECT id,ob_percent,extra_knowledge FROM tcm_herbs WHERE name_cn=:n"),{"n":name})
            row=r2.fetchone()
            if not row: print(f"  [skip]{name}"); continue
            hid,ob,ek=row[0],row[1],row[2]
            if ek and isinstance(ek,str):
                try: ek=json.loads(ek)
                except: ek=None
            scores=(ek or {}).get("efficacy_scores") or {}
            obv=ob if ob is not None else 50.0
            r3=await db.execute(text(
                "SELECT tc.logp,tc.tpsa FROM tcm_herbs ch "
                "JOIN tcm_herb_compounds chc ON chc.herb_id=ch.id "
                "JOIN tcm_compounds tc ON tc.id=chc.compound_id "
                "WHERE ch.name_cn=:n AND tc.logp IS NOT NULL "
                "ORDER BY tc.ob_percent DESC NULLS LAST LIMIT 1"),{"n":name})
            c3=r3.fetchone()
            logp=float(c3[0]) if c3 and c3[0] is not None else 0.0
            tpsa=c3[1] if c3 else None
            r4=await db.execute(text(
                "SELECT tc.logp,tc.tpsa FROM tcm_herbs ch "
                "JOIN tcm_herb_compounds chc ON chc.herb_id=ch.id "
                "JOIN tcm_compounds tc ON tc.id=chc.compound_id "
                "WHERE ch.name_cn=:n AND tc.logp IS NOT NULL"),{"n":name})
            logps=[float(x[0]) for x in r4.fetchall() if x[0] is not None]
            tpsas=[float(x[1]) for x in r4.fetchall() if x[1] is not None]
            pk=derive_pk(logp,tpsa,obv)
            await db.execute(text(
                "INSERT INTO tcm_herbs_pk (herb_id,herb_name_cn,F,F_source,ka,Vd,CL,t_lag,derived_from,source,confidence) "
                "VALUES(:hid,:n,:F,:fs,:ka,:Vd,:CL,:tl,:df,:src,:conf)"),
                {"hid":hid,"n":name,"F":pk["F"],"fs":"tcm_herbs.ob_percent","ka":pk["ka"],"Vd":pk["Vd"],"CL":pk["CL"],"tl":pk["t_lag"],"df":pk["df"],"src":pk["src"],"conf":pk["conf"]})
            pd=derive_pd(obv,scores,logp)
            await db.execute(text(
                "INSERT INTO tcm_herbs_pd (herb_id,herb_name_cn,E_max,E_max_source,EC50,Hill,efficacy_scores,derived_from,source,confidence) "
                "VALUES(:hid,:n,:em,:ems,:ec50,:hill,:es,:df,:src,:conf)"),
                {"hid":hid,"n":name,"em":pd["E_max"],"ems":"efficacy_scores(DB)","ec50":pd["EC50"],"hill":pd["Hill"],"es":json.dumps(pd["scores"],ensure_ascii=False),"df":pd["df"],"src":pd["src"],"conf":pd["conf"]})
            st=derive_stab(logps,tpsas)
            await db.execute(text(
                "INSERT INTO stability_data (herb_id,herb_name_cn,degradation_rate,shelf_life_months,logp_max,logp_avg,tpsa_avg,compounds_analyzed,derived_from,source,confidence) "
                "VALUES(:hid,:n,:dr,:shelf,:lmax,:lav,:tp,:cn,:df,:src,:conf)"),
                {"hid":hid,"n":name,"dr":st["dr"],"shelf":st["shelf"],"lmax":st["lmax"],"lav":st["lav"],"tp":st["tp"],"cn":st["cn"],"df":st["df"],"src":st["src"],"conf":st["conf"]})
            print(f"  {name}: F={pk['F']} ka={pk['ka']} Vd={pk['Vd']} CL={pk['CL']} | Emax={pd['E_max']} EC50={pd['EC50']} | k={st['dr']} shelf={st['shelf']}月")
        print("\n=== 协同 Jaccard ===")
        r5=await db.execute(text(
            "SELECT h.name_cn,ct.target_id FROM herb_food_herbs h "
            "JOIN herb_food_herb_compound hc ON hc.herb_id=h.id "
            "JOIN herb_food_compound_target ct ON ct.compound_id=hc.compound_id "
            "WHERE h.name_cn=ANY(:n)"),{"n":HERBS})
        ht={h:set() for h in HERBS}
        for row in r5.fetchall():
            if row[0] in ht: ht[row[0]].add(row[1])
        ins=0
        for i,a in enumerate(HERBS):
            for b in HERBS[i+1:]:
                if not ht.get(a) or not ht.get(b): continue
                un=len(ht[a]|ht[b]); si=round(len(ht[a]&ht[b])/un,4) if un else 0.0
                await db.execute(text(
                    "INSERT INTO synergy_interactions (ingredient_a,ingredient_b,mechanism_type,synergy_coefficient,confidence_score,source_reference) "
                    "VALUES(:a,:b,:mech,:si,:conf,:ref)"),
                    {"a":a,"b":b,"mech":"network_pharmacology_target_overlap","si":si,"conf":0.7,
                     "ref":f"herb_food_compound_target 靶点重叠 {len(ht[a])}x{len(ht[b])}"})
                print(f"  {a}-{b}: Jaccard={si}"); ins+=1
        print(f"\n协同写入 {ins} 对")
    await e.dispose()
    print("=== 完成 ===")

asyncio.run(run())
