import sys, json
sys.path.insert(0, r"D:\RMFOODFP\backend")
sys.stdout.reconfigure(encoding="utf-8")

from app.services.knowledge_base import HERB_KNOWLEDGE_BASE
from app.services.ai.algorithms.genetic_formula_optimizer import _EFFICACY_TO_HERBS

# Print all effects
all_effects = set()
for name, info in HERB_KNOWLEDGE_BASE.items():
    for eff in info.get("effects", []):
        all_effects.add(eff)
print("=== All knowledge_base effects ===")
for e in sorted(all_effects):
    print(f"  '{e}'")

# Print backend keys
print(f"\n=== Backend efficacy keys ({len(_EFFICACY_TO_HERBS)}) ===")
for k in sorted(_EFFICACY_TO_HERBS.keys()):
    print(f"  '{k}'")

# Show which knowledge_base effects map to which backend keys
print("\n=== Effect-to-backend mapping needed ===")
# Build reverse map from backend keys to descriptions
key_map = {
    "补气": ["补气升阳", "补中益气", "大补元气", "益气健脾", "益气养阴", "补脾益气", "补气"],
    "免疫调节": ["免疫调节", "补气升阳", "大补元气", "滋补肝肾"],
    "抗氧化": ["抗氧化", "清热解毒", "滋补肝肾"],
    "降血糖": ["降血糖", "降糖"],
    "降血压": ["降血压", "降压", "清热平肝"],
    "降脂": ["降脂", "降脂减肥", "降脂降压", "降脂降血压"],
    "安神": ["安神", "宁心安神", "养心安神", "清心除烦"],
    "明目": ["明目", "益精明目", "清热明目"],
    "利尿": ["利尿", "利水消肿", "清热利尿", "燥湿利水"],
    "消化系统": ["消食化积", "健脾和胃", "健脾止泻", "健脾益气"],
    "补血": ["补血", "补血活血", "补血滋阴", "滋阴补血"],
    "活血": ["活血", "行气散瘀", "活血化瘀", "通经止痛"],
    "清热解毒": ["清热解毒", "清热解毒", "疏散风热", "清热排脓"],
    "止咳化痰": ["止咳化痰", "祛痰止咳", "燥湿化痰"],
    "补肾": ["补肾", "补肾益精", "补肾温肺", "补肾壮阳", "益肾固精", "补肾"],
    "健脾": ["健脾", "健脾益气", "健脾和胃", "健脾止泻", "益气健脾"],
    "心血管保护": ["心血管保护", "活血", "降脂", "降压"],
    "抗衰老": ["抗衰老", "滋补肝肾", "延年益寿"],
    "美容养颜": ["美容养颜", "美容", "补血"],
    "抗炎": ["抗炎", "清热解毒"],
}

# Check coverage
missing_backend = set(_EFFICACY_TO_HERBS.keys())
for effects_list in key_map.values():
    for e in effects_list:
        missing_backend.discard(e)

print(f"\nBackend keys NOT covered by knowledge_base effects: {sorted(missing_backend)}")
