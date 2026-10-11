# -*- coding: utf-8 -*-
"""数据补全脚本 v4：knowledge_graph_nodes 全部用 naive datetime"""
import sys, os, asyncio, json
from datetime import datetime, timezone
sys.path.insert(0, r"D:\RMFOODFP\backend"); os.chdir(r"D:\RMFOODFP\backend")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from sqlalchemy import text
from app.core.database.session import async_session_factory

async def backfill():
    async with async_session_factory() as db:
        now = datetime.now(timezone.utc)
        naive_now = datetime.utcnow()

        herbs = (await db.execute(text("SELECT id, name_cn, compounds FROM tcm_herbs WHERE compounds IS NOT NULL"))).fetchall()
        inserted_stab = 0; skipped_stab = 0
        for hid, name, compounds in herbs:
            comps = compounds if isinstance(compounds, list) else (json.loads(compounds) if isinstance(compounds, str) else [])
            logs = []
            for c in comps:
                try:
                    v = float(c.get("alogp"))
                    if v == v: logs.append(v)
                except Exception:
                    pass
            if len(logs) < 1:
                skipped_stab += 1; continue
            logp_avg = sum(logs)/len(logs); logp_max = max(logs)
            deg = 0.0508 + 0.0023*logp_avg; shelf = 1.2/deg
            exists = (await db.execute(text("SELECT id FROM stability_data WHERE herb_name_cn=:n"), {"n": name})).fetchone()
            if exists:
                await db.execute(text("UPDATE stability_data SET degradation_rate=:d, shelf_life_months=:s, logp_max=:mx, logp_avg=:av, compounds_analyzed=:ca, updated_at=:now WHERE herb_name_cn=:n"),
                                 {"d": round(deg,5), "s": round(shelf,1), "mx": round(logp_max,3), "av": round(logp_avg,3), "ca": len(logs), "now": now, "n": name})
            else:
                await db.execute(text("INSERT INTO stability_data (herb_id, herb_name_cn, degradation_rate, shelf_life_months, logp_max, logp_avg, compounds_analyzed, derived_from, source, confidence, created_at, updated_at) VALUES (:hid,:n,:d,:s,:mx,:av,:ca,:der,:src,:conf,:now,:now)"),
                                 {"hid": hid, "n": name, "d": round(deg,5), "s": round(shelf,1), "mx": round(logp_max,3), "av": round(logp_avg,3), "ca": len(logs), "der": "model_derived(TCMSP_alogP+Arrhenius)", "src": "model_derived", "conf": 0.55, "now": now})
            inserted_stab += 1
        await db.commit()
        print("stability_data inserted/updated:", inserted_stab, "skipped:", skipped_stab)

        await db.execute(text("DELETE FROM knowledge_graph_nodes"))
        node_ids = {}
        async def _insert_node(node_type, name, props, source_id=None, conf=0.9):
            key = (node_type, name)
            if key in node_ids:
                return node_ids[key]
            r = (await db.execute(text(
                "INSERT INTO knowledge_graph_nodes (node_type, name, properties, source_database, source_id, confidence_score, last_validated, created_at, updated_at) "
                "VALUES (:t,:n,:p,:sd,:si,:c,:lv,:ca,:ua) RETURNING id"
            ), {"t": node_type, "n": name, "p": json.dumps(props, ensure_ascii=False), "sd": "tcm_knowledge_base", "si": str(source_id) if source_id is not None else None, "c": conf, "lv": naive_now, "ca": naive_now, "ua": naive_now})).fetchone()
            node_ids[key] = r[0]
            return r[0]

        herb_count = compound_count = target_count = disease_count = 0
        rows = (await db.execute(text("SELECT id, name_cn, name_latin, category, effects, ob_percent, dl_value, is_food_homology, compounds, targets, diseases FROM tcm_herbs"))).fetchall()
        for hid, name, name_latin, category, effects, ob, dl, is_fh, compounds, targets, diseases in rows:
            props = {"name_latin": name_latin, "category": category, "effects": effects, "ob_percent": ob, "dl_value": dl, "is_food_homology": bool(is_fh)}
            await _insert_node("herb", name, props, source_id=hid, conf=0.95); herb_count += 1
            comps = compounds if isinstance(compounds, list) else (json.loads(compounds) if isinstance(compounds, str) else [])
            for c in comps:
                cname = c.get("name")
                if cname:
                    await _insert_node("compound", cname, {"ob": c.get("ob"), "dl": c.get("dl"), "mw": c.get("mw"), "alogp": c.get("alogp"), "source_herb": name}, source_id=c.get("mol_id"), conf=0.9)
            compound_count += len(comps)
            tgts = targets if isinstance(targets, list) else (json.loads(targets) if isinstance(targets, str) else [])
            for t in tgts:
                tname = t.get("name") if isinstance(t, dict) else str(t)
                if tname:
                    await _insert_node("target", tname, {"source_herbs": [name]}, conf=0.8)
            target_count += len(tgts)
            diss = diseases if isinstance(diseases, list) else (json.loads(diseases) if isinstance(diseases, str) else [])
            for d in diss:
                dname = d.get("name") if isinstance(d, dict) else str(d)
                if dname:
                    await _insert_node("disease", dname, {"related_herbs": [name]}, conf=0.8)
            disease_count += len(diss)
        await db.commit()
        print("knowledge_graph_nodes: herbs=%d compounds=%d targets=%d diseases=%d total=%d" % (herb_count, compound_count, target_count, disease_count, len(node_ids)))

        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
                id BIGSERIAL PRIMARY KEY,
                source_node_id BIGINT NOT NULL REFERENCES knowledge_graph_nodes(id),
                target_node_id BIGINT NOT NULL REFERENCES knowledge_graph_nodes(id),
                relation_type VARCHAR(50) NOT NULL,
                properties JSON,
                source_database VARCHAR(50),
                confidence_score FLOAT DEFAULT 0.8,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            )
        """))
        await db.execute(text("CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON knowledge_graph_edges(source_node_id)"))
        await db.execute(text("CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON knowledge_graph_edges(target_node_id)"))
        await db.execute(text("DELETE FROM knowledge_graph_edges"))
        herb_rows = (await db.execute(text("SELECT n.id as nid, n.name, h.compounds, h.targets, h.diseases FROM knowledge_graph_nodes n JOIN tcm_herbs h ON h.name_cn = n.name WHERE n.node_type='herb'"))).fetchall()
        edge_count = 0
        for nid, name, compounds, targets, diseases in herb_rows:
            comps = compounds if isinstance(compounds, list) else (json.loads(compounds) if isinstance(compounds, str) else [])
            for c in comps:
                cname = c.get("name")
                if cname and ("compound", cname) in node_ids:
                    await db.execute(text("INSERT INTO knowledge_graph_edges (source_node_id, target_node_id, relation_type, properties, source_database, confidence_score, created_at, updated_at) VALUES (:s,:t,'contains_compound',:p,'tcm_knowledge_base',0.9,:now,:now)"),
                                     {"s": nid, "t": node_ids[("compound", cname)], "p": json.dumps({"source_herb": name}, ensure_ascii=False), "now": now}); edge_count += 1
            tgts = targets if isinstance(targets, list) else (json.loads(targets) if isinstance(targets, str) else [])
            for t in tgts:
                tname = t.get("name") if isinstance(t, dict) else str(t)
                if tname and ("target", tname) in node_ids:
                    await db.execute(text("INSERT INTO knowledge_graph_edges (source_node_id, target_node_id, relation_type, properties, source_database, confidence_score, created_at, updated_at) VALUES (:s,:t,'targets',:p,'tcm_knowledge_base',0.8,:now,:now)"),
                                     {"s": nid, "t": node_ids[("target", tname)], "p": json.dumps({"source_herb": name}, ensure_ascii=False), "now": now}); edge_count += 1
            diss = diseases if isinstance(diseases, list) else (json.loads(diseases) if isinstance(diseases, str) else [])
            for d in diss:
                dname = d.get("name") if isinstance(d, dict) else str(d)
                if dname and ("disease", dname) in node_ids:
                    await db.execute(text("INSERT INTO knowledge_graph_edges (source_node_id, target_node_id, relation_type, properties, source_database, confidence_score, created_at, updated_at) VALUES (:s,:t,'related_to',:p,'tcm_knowledge_base',0.8,:now,:now)"),
                                     {"s": nid, "t": node_ids[("disease", dname)], "p": json.dumps({"source_herb": name}, ensure_ascii=False), "now": now}); edge_count += 1
            if edge_count % 5000 == 0:
                await db.commit()
        await db.commit()
        print("knowledge_graph_edges inserted:", edge_count)

        for t in ["knowledge_graph_nodes", "knowledge_graph_edges", "stability_data"]:
            r = (await db.execute(text(f"SELECT COUNT(*) FROM {t}"))).scalar()
            print(t, "count:", r)

asyncio.run(backfill())
