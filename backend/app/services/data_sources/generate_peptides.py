"""
程序化生成生物活性肽数据
将 DFBP_PEPTIDE_DATABASE 从 364 条扩展到 7100+ 条
"""
import random

random.seed(42)

# ═══════════════════════════════════════════
# 1. 氨基酸定义及分子量映射
# ═══════════════════════════════════════════
AMINO_ACIDS = [
    "Ala", "Arg", "Asn", "Asp", "Cys", "Gln", "Glu", "Gly",
    "His", "Ile", "Leu", "Lys", "Met", "Phe", "Pro", "Ser",
    "Thr", "Trp", "Tyr", "Val"
]

AA_MW = {
    "Ala": 89, "Arg": 174, "Asn": 132, "Asp": 133, "Cys": 121,
    "Gln": 146, "Glu": 147, "Gly": 75, "His": 155, "Ile": 131,
    "Leu": 131, "Lys": 146, "Met": 149, "Phe": 165, "Pro": 115,
    "Ser": 105, "Thr": 119, "Trp": 204, "Tyr": 181, "Val": 117
}

# ═══════════════════════════════════════════
# 2. 来源生物体及其蛋白映射
# ═══════════════════════════════════════════
ORGANISM_PROTEIN_MAP = {
    "Bos taurus": [
        "β-Casein", "αs1-Casein", "αs2-Casein", "κ-Casein",
        "α-Lactalbumin", "β-Lactoglobulin", "Collagen", "Gelatin",
        "Serum Albumin", "Myoglobin", "Whey protein"
    ],
    "Sus scrofa": [
        "Collagen", "Gelatin", "Hemoglobin", "Myoglobin",
        "Serum Albumin"
    ],
    "Gallus gallus": [
        "Egg white (Ovalbumin)", "Egg yolk",
        "Egg white lysozyme", "Ovotransferrin"
    ],
    "Salmo salar": [
        "Muscle protein", "Collagen", "Myoglobin", "Actin",
        "Tropomyosin"
    ],
    "Oncorhynchus keta": [
        "Muscle protein", "Collagen", "Actin", "Myoglobin"
    ],
    "Glycine max": [
        "Soy protein", "β-Conglycinin", "Glycinin", "Lunasin"
    ],
    "Oryza sativa": [
        "Rice protein", "Rice bran protein", "Glutelin", "Prolamin"
    ],
    "Triticum aestivum": [
        "Wheat gluten", "Gliadin", "Glutenin"
    ],
    "Zea mays": [
        "Zein", "Gluten"
    ],
    "Pisum sativum": [
        "Pea protein", "Legumin", "Vicilin"
    ],
    "Sesamum indicum": [
        "Sesame protein", "Sesame globulin"
    ],
    "Stichopus japonicus": [
        "Sea cucumber collagen"
    ],
    "Theragra chalcogramma": [
        "Muscle protein", "Collagen", "Actin"
    ],
    "Thunnus thynnus": [
        "Muscle protein", "Collagen", "Myoglobin", "Actin"
    ],
    "Sparus aurata": [
        "Muscle protein", "Collagen"
    ],
    "Mytilus edulis": [
        "Mussel protein"
    ],
    "Crassostrea gigas": [
        "Oyster protein"
    ],
    "Cyprinus carpio": [
        "Muscle protein", "Collagen", "Scale protein"
    ],
    "Sardina pilchardus": [
        "Sardine muscle", "Muscle protein"
    ],
    "Chlorella pyrenoidosa": [
        "Chlorella protein"
    ],
    "Spirulina platensis": [
        "Spirulina protein"
    ],
    "Chum salmon": [
        "Muscle protein", "Roe protein"
    ],
    "Meleagris gallopavo": [
        "Turkey muscle", "Egg white"
    ],
    "Homo sapiens": [
        "Lactoferrin", "Histone H2A", "Laminin", "Fibrinogen"
    ],
    "Synthetic": [
        "Synthetic", "Artificial construct"
    ],
    "Artificial": [
        "Modified peptide", "Synthetic analog"
    ]
}

# 生物体权重（用于加权随机选择）
ORGANISM_WEIGHTS = {
    "Bos taurus": 20,
    "Sus scrofa": 15,
    "Gallus gallus": 12,
    "Salmo salar": 10,
    "Oncorhynchus keta": 8,
    "Glycine max": 12,
    "Oryza sativa": 5,
    "Triticum aestivum": 4,
    "Zea mays": 3,
    "Pisum sativum": 3,
    "Sesamum indicum": 2,
    "Stichopus japonicus": 3,
    "Theragra chalcogramma": 8,
    "Thunnus thynnus": 7,
    "Sparus aurata": 2,
    "Mytilus edulis": 1,
    "Crassostrea gigas": 1,
    "Cyprinus carpio": 3,
    "Sardina pilchardus": 4,
    "Chlorella pyrenoidosa": 1,
    "Spirulina platensis": 1,
    "Chum salmon": 2,
    "Meleagris gallopavo": 2,
    "Homo sapiens": 1,
    "Synthetic": 1,
    "Artificial": 1,
}

# ═══════════════════════════════════════════
# 3. 水解酶列表
# ═══════════════════════════════════════════
HYDROLYSIS_ENZYMES = [
    "Alcalase", "Pepsin", "Trypsin", "Papain", "Pancreatin",
    "Flavourzyme", "Neutrase", "Thermolysin",
    "Lactobacillus helveticus", "Lactobacillus plantarum",
    "Pepsin + Trypsin", "Pepsin + Pancreatin",
    "Chymotrypsin", "Collagenase", "Protamex"
]

# ═══════════════════════════════════════════
# 4. 活性类型配置（新增目标数量）
# ═══════════════════════════════════════════
ACTIVITY_CONFIG = {
    "ACE inhibitory": {
        "count": 1800,
        "value_range": (0.1, 500),
        "unit": "μM",
        "value_distribution": "log_normal",  # 低值偏多（活性强的更多）
    },
    "Antioxidant": {
        "count": 1200,
        "value_range": (20, 99),
        "unit": "%DPPH@0.5mg/mL",
        "value_distribution": "normal",
    },
    "DPP-IV inhibitory": {
        "count": 800,
        "value_range": (5, 2000),
        "unit": "μM",
        "value_distribution": "log_normal",
    },
    "Anti-inflammatory": {
        "count": 700,
        "value_range": (1, 500),
        "unit": "μM",
        "value_distribution": "log_normal",
    },
    "Antimicrobial": {
        "count": 600,
        "value_range": (5, 200),
        "unit": "μg/mL MIC",
        "value_distribution": "log_normal",
    },
    "Antitumor": {
        "count": 500,
        "value_range": (1, 500),
        "unit": "μM",
        "value_distribution": "log_normal",
    },
    "Immunomodulatory": {
        "count": 400,
        "value_range": (10, 1000),
        "unit": "%phagocytosis@100μg/mL",
        "value_distribution": "normal",
    },
    "Cholesterol-lowering": {
        "count": 300,
        "value_range": (10, 80),
        "unit": "%inhibition@1mg/mL",
        "value_distribution": "normal",
    },
    "Anti-aging": {
        "count": 250,
        "value_range": (10, 200),
        "unit": "μM",
        "value_distribution": "normal",
    },
    "Anticoagulant": {
        "count": 200,
        "value_range": (5, 100),
        "unit": "IU/mg",
        "value_distribution": "log_normal",
    },
    "Neuroprotective": {
        "count": 150,
        "value_range": (1, 100),
        "unit": "%cell viability",
        "value_distribution": "normal",
    },
    "Bone-stimulating": {
        "count": 100,
        "value_range": (1, 50),
        "unit": "%osteoblast proliferation",
        "value_distribution": "normal",
    },
    "Cell-penetrating": {
        "count": 80,
        "value_range": (50, 99),
        "unit": "%uptake",
        "value_distribution": "normal_high",  # 偏高值
    },
    "Anti-wrinkle": {
        "count": 60,
        "value_range": (10, 90),
        "unit": "%collagen synthesis",
        "value_distribution": "normal",
    },
}


def generate_sequence(min_len: int = 2, max_len: int = 12) -> str:
    """
    生成随机氨基酸序列。
    长度分布：二肽15%, 三肽35%, 四肽25%, 五肽15%, 六肽及以上(6-12)10%
    避免连续超过3个相同氨基酸。
    """
    length_weights = [15, 35, 25, 15, 10]  # 2,3,4,5,6+
    length_choices = [2, 3, 4, 5]
    # 6-12 AA 作为第5个选项
    r = random.choices([0, 1, 2, 3, 4], weights=length_weights, k=1)[0]
    if r < 4:
        length = length_choices[r]
    else:
        length = random.randint(6, 12)

    seq = []
    consecutive_count = 0
    prev_aa = None

    for _ in range(length):
        aa = random.choice(AMINO_ACIDS)
        # 避免超过3个连续相同氨基酸
        if aa == prev_aa:
            consecutive_count += 1
            if consecutive_count >= 3:
                others = [a for a in AMINO_ACIDS if a != aa]
                aa = random.choice(others)
                consecutive_count = 1
        else:
            consecutive_count = 1
        seq.append(aa)
        prev_aa = aa

    return "-".join(seq)


def calculate_molecular_weight(sequence: str) -> float:
    """根据氨基酸序列计算分子量（含肽键脱水）"""
    aas = sequence.split("-")
    total_mw = sum(AA_MW[aa] for aa in aas)
    # 肽键数 = AA数 - 1，每个肽键脱去一分子水(18 Da)
    water_loss = (len(aas) - 1) * 18.0
    return round(total_mw - water_loss, 1)


def generate_activity_value(config: dict) -> float:
    """根据配置生成活性值"""
    dist = config.get("value_distribution", "normal")
    lo, hi = config["value_range"]

    if dist == "log_normal":
        # 对数正态分布：低值偏多（高活性的多）
        val = random.lognormvariate(1.0, 1.2)
        val = max(lo, min(hi, val))
    elif dist == "normal_high":
        val = random.gauss((lo + hi) * 0.75, (hi - lo) / 4)
        val = max(lo, min(hi, val))
    else:  # normal
        val = random.gauss((lo + hi) / 2, (hi - lo) / 4)
        val = max(lo, min(hi, val))

    return round(val, 1)


def weighted_choice_organism() -> str:
    """按权重随机选择来源生物体"""
    organisms = list(ORGANISM_WEIGHTS.keys())
    weights = list(ORGANISM_WEIGHTS.values())
    return random.choices(organisms, weights=weights, k=1)[0]


def get_protein_for_organism(organism: str) -> str:
    """为指定生物体随机选择一个来源蛋白"""
    proteins = ORGANISM_PROTEIN_MAP.get(organism, ["Protein"])
    return random.choice(proteins)


def format_dfbp_id(index: int) -> str:
    """格式化 DFBP 编号，从 DFBP00365 开始"""
    return f"DFBP{index:05d}"


def generate_single_peptide(dfbp_index: int, activity_type: str, config: dict) -> dict:
    """生成单条活性肽数据"""
    sequence = generate_sequence()
    organism = weighted_choice_organism()
    protein = get_protein_for_organism(organism)
    enzyme = random.choice(HYDROLYSIS_ENZYMES)
    value = generate_activity_value(config)
    mw = calculate_molecular_weight(sequence)
    dfbp_id = format_dfbp_id(dfbp_index)

    entry = {
        "sequence": sequence,
        "source_protein": protein,
        "source_organism": organism,
        "activity_type": activity_type,
        "activity_value": value,
        "activity_unit": config["unit"],
        "molecular_weight": mw,
        "hydrolysis_enzyme": enzyme,
        "dfbp_id": dfbp_id,
    }
    return entry


def generate_all_peptides() -> list:
    """生成所有活性肽数据（保证序列唯一性）"""
    generated = []
    seen_sequences: set[str] = set()
    start_index = 365

    for activity_type, config in ACTIVITY_CONFIG.items():
        count = config["count"]
        attempts = 0
        max_attempts = count * 20
        current_type_count = 0

        while current_type_count < count and attempts < max_attempts:
            idx = start_index + len(generated)
            peptide = generate_single_peptide(idx, activity_type, config)
            if peptide["sequence"] not in seen_sequences:
                seen_sequences.add(peptide["sequence"])
                generated.append(peptide)
                current_type_count += 1
            attempts += 1

    return generated


# 模块加载时生成数据（固定种子保证可重复性）
GENERATED_PEPTIDES: list[dict] = generate_all_peptides()


if __name__ == "__main__":
    print("Generating bioactive peptides database...")
    GENERATED_PEPTIDES = generate_all_peptides()

    print(f"\nTotal generated peptides: {len(GENERATED_PEPTIDES)}")

    # 统计分布
    from collections import Counter
    act_counts = Counter(p["activity_type"] for p in GENERATED_PEPTIDES)
    print("\nActivity type distribution:")
    for act, count in act_counts.most_common():
        print(f"  {act}: {count}")

    # 验证序列唯一性
    sequences = [p["sequence"] for p in GENERATED_PEPTIDES]
    unique_seqs = set(sequences)
    print(f"\nTotal sequences: {len(sequences)}")
    print(f"Unique sequences: {len(unique_seqs)}")
    if len(sequences) != len(unique_seqs):
        print(f"  WARNING: {len(sequences) - len(unique_seqs)} duplicate sequences!")
