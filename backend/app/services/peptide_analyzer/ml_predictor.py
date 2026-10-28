"""
纯 Python 实现的肽活性预测模型
不依赖 sklearn，使用统计方法进行预测
"""

class PeptideMLPredictor:
    """基于统计规则的肽活性预测器"""

    # 氨基酸特性权重
    AA_WEIGHTS = {
        # ACE抑制相关
        'F': 0.8, 'W': 0.9, 'Y': 0.7,  # 芳香族
        'P': 0.6, 'L': 0.5, 'I': 0.5,   # 疏水性
        'K': 0.3, 'R': 0.3,              # 碱性
        'H': 0.2,                         # 组氨酸
        # 抗氧化相关
        'H': 0.7, 'Y': 0.6, 'W': 0.5,   # 抗氧化氨基酸
        'C': 0.4, 'M': 0.3,              # 含硫氨基酸
    }

    # ACE抑制特征权重
    ACE_FEATURES = {
        'c_terminal_hydrophobic': 0.25,
        'pro_content': 0.20,
        'length_optimal': 0.15,
        'motif_pp': 0.10,
        'motif_lp': 0.08,
        'motif_yp': 0.08,
        'motif_kp': 0.06,
        'motif_rp': 0.06,
        'aromatic_c_term': 0.12,
    }

    # 抗菌肽特征权重
    AMP_FEATURES = {
        'positive_charge': 0.30,
        'hydrophobic_ratio': 0.20,
        'length_optimal': 0.25,
        'amphipathic': 0.15,
        'disulfide': 0.10,
    }

    @staticmethod
    def predict_ace_inhibition(sequence: str) -> dict:
        """预测ACE抑制活性"""
        seq = sequence.upper()
        seq_len = len(seq)
        score = 0.0

        # C端疏水性
        c_term = seq[-1] if seq else ''
        if c_term in ['F', 'W', 'Y', 'L', 'I', 'M', 'P']:
            score += 0.25
            if c_term in ['F', 'W', 'Y']:
                score += 0.05  # 芳香族额外加分

        # Pro含量
        pro_count = seq.count('P')
        pro_ratio = pro_count / seq_len if seq_len > 0 else 0
        score += pro_ratio * 0.5  # Pro权重放大

        # 长度因子
        if 3 <= seq_len <= 8:
            score += 0.2
        elif 9 <= seq_len <= 15:
            score += 0.1
        else:
            score += 0.05

        # Motif匹配
        motifs = {
            'PP': 0.10, 'LP': 0.08, 'YP': 0.08,
            'KP': 0.06, 'RP': 0.06, 'PF': 0.05,
            'YF': 0.05, 'WF': 0.05,
        }
        for motif, weight in motifs.items():
            if motif in seq:
                score += weight

        return {
            'score': min(score, 1.0),
            'confidence': 0.75,
            'method': 'statistical',
        }

    @staticmethod
    def predict_antimicrobial(sequence: str) -> dict:
        """预测抗菌活性"""
        seq = sequence.upper()
        seq_len = len(seq)
        score = 0.0

        # 正电荷含量
        positive = sum(1 for aa in seq if aa in ['K', 'R', 'H'])
        positive_ratio = positive / seq_len if seq_len > 0 else 0
        score += positive_ratio * 0.6

        # 疏水含量
        hydrophobic = sum(1 for aa in seq if aa in ['F', 'W', 'Y', 'L', 'I', 'V', 'M'])
        hydro_ratio = hydrophobic / seq_len if seq_len > 0 else 0
        score += hydro_ratio * 0.3

        # 长度因子
        if 10 <= seq_len <= 50:
            score += 0.2
        elif seq_len < 10:
            score += 0.1
        else:
            score += 0.05

        # 两亲性检测（简化）
        if seq_len >= 6:
            n_term_hydro = sum(1 for aa in seq[:seq_len//2] if aa in ['F', 'W', 'Y', 'L', 'I', 'V', 'M'])
            c_term_hydro = sum(1 for aa in seq[seq_len//2:] if aa in ['F', 'W', 'Y', 'L', 'I', 'V', 'M'])
            if abs(n_term_hydro - c_term_hydro) < seq_len * 0.15:
                score += 0.15

        # 二硫键
        cys_count = seq.count('C')
        if cys_count >= 2:
            score += 0.1

        return {
            'score': min(score, 1.0),
            'confidence': 0.70,
            'method': 'statistical',
        }

    @staticmethod
    def predict_antioxidant(sequence: str) -> dict:
        """预测抗氧化活性"""
        seq = sequence.upper()
        seq_len = len(seq)
        score = 0.0

        # 抗氧化氨基酸
        antiox_aa = sum(1 for aa in seq if aa in ['H', 'Y', 'W', 'C', 'M'])
        antiox_ratio = antiox_aa / seq_len if seq_len > 0 else 0
        score += antiox_ratio * 0.7

        # 长度因子
        if seq_len <= 10:
            score += 0.25
        elif seq_len <= 20:
            score += 0.15
        else:
            score += 0.05

        # 抗氧化motif
        motifs = ['HY', 'WH', 'CY', 'YW', 'HH']
        for motif in motifs:
            if motif in seq:
                score += 0.05

        return {
            'score': min(score, 1.0),
            'confidence': 0.72,
            'method': 'statistical',
        }

    @staticmethod
    def predict_safety(sequence: str) -> dict:
        """预测安全性"""
        seq = sequence.upper()
        seq_len = len(seq)

        # 过敏原预测
        allergen_score = 0.0
        allergen_patterns = ['QQ', 'EE', 'KK', 'GPP', 'PPP', 'CXC']
        for pattern in allergen_patterns:
            if pattern in seq:
                allergen_score += 0.25
        allergen_score += (seq.count('P') / seq_len) * 0.3 if seq_len > 0 else 0
        allergen_score = min(allergen_score, 1.0)

        # 毒性预测
        toxicity_score = 0.0
        toxic_patterns = ['GPPP', 'AAAG', 'PPPP']
        for pattern in toxic_patterns:
            if pattern in seq:
                toxicity_score += 0.4
        hydro_count = sum(1 for aa in seq if aa in ['F', 'W', 'Y', 'L', 'I', 'V'])
        if seq_len > 0 and hydro_count / seq_len > 0.7 and seq_len > 20:
            toxicity_score += 0.5
        toxicity_score = min(toxicity_score, 1.0)

        # 消化性
        pro_ratio = seq.count('P') / seq_len if seq_len > 0 else 0
        hydro_ratio = hydro_count / seq_len if seq_len > 0 else 0
        digest_score = pro_ratio * 0.5 + hydro_ratio * 0.3
        if digest_score > 0.5:
            digestibility = 'low'
        elif digest_score > 0.3:
            digestibility = 'medium'
        else:
            digestibility = 'high'

        return {
            'allergen_score': allergen_score,
            'is_allergen': allergen_score > 0.5,
            'toxicity_score': toxicity_score,
            'is_toxic': toxicity_score > 0.7,
            'digestibility': digestibility,
            'confidence': 0.68,
            'method': 'statistical',
        }


if __name__ == '__main__':
    predictor = PeptideMLPredictor()

    # 测试
    test_sequences = ['IPP', 'VLGYT', 'KRNRWRKWRR', 'WTSL']
    for seq in test_sequences:
        ace = predictor.predict_ace_inhibition(seq)
        amp = predictor.predict_antimicrobial(seq)
        antiox = predictor.predict_antioxidant(seq)
        safety = predictor.predict_safety(seq)
        print(f'{seq}: ACE={ace["score"]:.3f}, AMP={amp["score"]:.3f}, Antiox={antiox["score"]:.3f}')
        print(f'  Safety: allergen={safety["is_allergen"]}, toxic={safety["is_toxic"]}, digest={safety["digestibility"]}')
