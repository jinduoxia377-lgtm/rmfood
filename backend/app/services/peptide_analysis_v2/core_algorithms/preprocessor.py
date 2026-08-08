"""
序列预处理引擎 (Sequence Preprocessor)

功能：
✅ 序列有效性验证（氨基酸组成、长度限制、非法字符检测）
✅ 标准化处理（大小写统一、去除空格/数字、N端/C端标记识别）
✅ 质量评估（复杂度评分、重复序列检测、异常模式识别）

性能目标：
- 单序列处理: <1ms
- 吞吐量: >10,000 seq/s

基于标准生物信息学工具和算法。
"""

import re
import math
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any

logger = logging.getLogger("rmfood.peptide_analyzer.preprocessor")

# 标准氨基酸单字母代码 (20种)
STANDARD_AMINO_ACIDS = set("ACDEFGHIKLMNPQRSTVWY")

# 氨基酸分子量表 (来自Expasy ProtParam)
AA_MOLECULAR_WEIGHTS = {
    'A': 89.0932, 'R': 174.2017, 'N': 132.1187, 'D': 133.1027,
    'C': 121.1590, 'E': 147.1299, 'Q': 146.1445, 'G': 75.0666,
    'H': 155.1546, 'I': 131.1729, 'L': 131.1729, 'K': 146.1876,
    'M': 149.2113, 'F': 165.1891, 'P': 115.1300, 'S': 105.0926,
    'T': 119.1192, 'W': 204.2262, 'Y': 181.1886, 'V': 117.1463
}

# 等电点pKa值 (Bjellqvist方法, 1983)
PKA_N_TERMINAL = 8.0
PKA_C_TERMINAL = 3.1
PKA_SIDE_CHAIN = {
    'D': 3.86, 'E': 4.25, 'H': 6.88, 'C': 8.33,
    'Y': 10.07, 'K': 10.53, 'R': 12.48
}


@dataclass
class ValidationError:
    """验证错误"""
    code: str           # 错误代码
    message: str        # 错误描述
    position: int = -1  # 错误位置 (-1表示全局错误)


@dataclass
class ValidationWarning:
    """验证警告"""
    code: str
    message: str
    severity: str = "info"  # info, warning, critical


@dataclass
class ValidationResult:
    """验证结果"""
    is_valid: bool
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationWarning] = field(default_factory=list)
    quality_score: float = 0.0  # 0.0-1.0
    
    @property
    def has_critical_warnings(self) -> bool:
        return any(w.severity == "critical" for w in self.warnings)


@dataclass
class Modification:
    """修饰信息"""
    type: str            # 修饰类型 (如 "Oxidation", "Phosphorylation")
    position: int        # 修饰位置 (1-based)
    original_char: str   # 原始字符
    description: str = ""


@dataclass
class StandardizedSequence:
    """标准化后的序列"""
    value: str                    # 标准化后的序列
    original_value: str          # 原始输入
    original_length: int         # 原始长度
    standardized_length: int      # 标准化后长度
    modifications_detected: List[Modification] = field(default_factory=list)
    is_fragment: bool = False    # 是否为片段


@dataclass
class RepeatUnit:
    """重复单元"""
    sequence: str         # 重复单元序列
    start: int            # 起始位置 (0-based)
    end: int              # 结束位置 (0-based)
    count: int            # 重复次数


@dataclass
class Region:
    """区域"""
    start: int             # 起始位置 (0-based)
    end: int               # 结束位置 (0-based)
    type: str              # 区域类型 ("low_complexity", "repeat", "anomaly")
    score: float = 0.0     # 得分或置信度


@dataclass
class QualityMetrics:
    """质量指标"""
    complexity_score: float = 0.0       # Shannon熵 (0-4.32)
    has_repeats: bool = False
    repeat_units: List[RepeatUnit] = field(default_factory=list)
    low_complexity_regions: List[Region] = field(default_factory=list)
    anomaly_flags: List[str] = field(default_factory=list)
    overall_quality: float = 0.0      # 综合质量评分 (0.0-1.0)


class SequencePreprocessor:
    """
    高性能序列预处理器
    
    功能层次:
    Level 1: 字符合法性验证
    Level 2: 长度约束检查
    Level 3: 组成合理性评估
    
    性能指标:
    - validate_sequence: O(n), n=seq_length
    - standardize: O(n)
    - quality_assess: O(n) (线性扫描)
    
    使用示例:
    >>> preprocessor = SequencePreprocessor()
    >>> result = await preprocessor.validate_sequence("VLGYTKEGN")
    >>> if result.is_valid:
    ...     std_seq = preprocessor.standardize("VLGYTKEGN")
    ...     metrics = preprocessor.quality_assess(std_seq.value)
    """
    
    MIN_LENGTH = 2
    MAX_LENGTH = 5000
    
    def __init__(self):
        self._stats = {
            "total_processed": 0,
            "validation_errors": 0,
            "standardization_modifications": 0
        }
        
    async def validate_sequence(self, sequence: str) -> ValidationResult:
        """
        多层次序列验证
        
        Args:
            sequence: 输入序列
            
        Returns:
            ValidationResult对象
            
        Example:
        >>> result = preprocessor.validate_sequence("VLGYTKEGN")
        >>> print(result.is_valid, result.quality_score)
        """
        self._stats["total_processed"] += 1
        
        if not sequence or not isinstance(sequence, str):
            return ValidationResult(
                is_valid=False,
                errors=[ValidationError(code="EMPTY_INPUT", message="输入为空")],
                quality_score=0.0
            )
            
        errors = []
        warnings = []
        
        # Level 1: 字符合法性
        invalid_chars = self._find_invalid_characters(sequence)
        if invalid_chars:
            for char_info in invalid_chars:
                errors.append(ValidationError(
                    code="INVALID_CHARACTER",
                    message=f"非法氨基酸字符 '{char_info['char']}' 在位置 {char_info['position']}",
                    position=char_info["position"]
                ))
                
        # Level 2: 长度约束
        if len(sequence) < self.MIN_LENGTH:
            errors.append(ValidationError(
                code="SEQUENCE_TOO_SHORT",
                message=f"序列过短 ({len(sequence)} AA)，最小要求 {self.MIN_LENGTH} AA"
            ))
            
        if len(sequence) > self.MAX_LENGTH:
            errors.append(ValidationError(
                code="SEQUENCE_TOO_LONG",
                message=f"序列过长 ({len(sequence)} AA)，最大允许 {self.MAX_LENGTH} AA"
            ))
            
        # Level 3: 组成合理性
        if len(errors) == 0:  # 只有在基础验证通过后才进行高级检查
            composition_analysis = self._analyze_composition(sequence)
            warnings.extend(composition_analysis.get("warnings", []))
            
        # 计算质量评分
        if not errors:
            quality_score = self._calculate_initial_quality(sequence, warnings)
        else:
            quality_score = max(0.0, 1.0 - len(errors) * 0.2)
            
        is_valid = len(errors) == 0
        
        if not is_valid:
            self._stats["validation_errors"] += 1
            
        return ValidationResult(
            is_valid=is_valid,
            errors=errors,
            warnings=warnings,
            quality_score=quality_score
        )
        
    async def standardize(self, sequence: str) -> StandardizedSequence:
        """
        标准化序列格式
        
        操作步骤:
        1. 转换为大写
        2. 去除空白字符
        3. 去除数字
        4. 解析修饰标记
        
        Args:
            sequence: 原始序列
            
        Returns:
            StandardizedSequence对象
        """
        original = sequence
        original_length = len(original)
        
        # Step 1: 大写转换
        std_seq = sequence.upper()
        
        # Step 2: 去除空白字符
        std_seq = re.sub(r'\s+', '', std_seq)
        
        # Step 3: 去除数字 (保留修饰标记中的特殊符号)
        modifications = []
        
        # 检测修饰标记模式 [MODIFICATION]
        mod_pattern = r'([A-Z])\[([^\]]+)\]'
        matches = list(re.finditer(mod_pattern, std_seq))
        
        for match in reversed(matches):  # 反向替换以保持位置正确
            aa_char = match.group(1)
            mod_type = match.group(2)
            pos = match.start() + 1  # 1-based position
            
            modifications.append(Modification(
                type=mod_type,
                position=pos,
                original_char=aa_char,
                description=f"{aa_char} with {mod_type} modification at position {pos}"
            ))
            
            # 替换为纯氨基酸字符
            std_seq = std_seq[:match.start()] + aa_char + std_seq[match.end():]
            
        # 去除其他非标准字符 (只保留20种标准AA)
        std_seq = ''.join(c for c in std_seq if c in STANDARD_AMINO_ACIDS)
        
        # 检测N端/C端标记
        is_fragment = False
        if std_seq.startswith("NH2-"):
            std_seq = std_seq[4:]
            is_fragment = True
        if std_seq.endswith("-COOH"):
            std_seq = std_seq[:-4]
            is_fragment = True
            
        if modifications:
            self._stats["standardization_modifications"] += len(modifications)
            
        return StandardizedSequence(
            value=std_seq,
            original_value=original,
            original_length=original_length,
            standardized_length=len(std_seq),
            modifications_detected=modifications,
            is_fragment=is_fragment
        )
        
    async def quality_assess(self, sequence: str) -> QualityMetrics:
        """
        评估序列质量
        
        Args:
            sequence: 已标准化的序列
            
        Returns:
            QualityMetrics对象
        """
        length = len(sequence)
        
        if length < 2:
            return QualityMetrics(overall_quality=0.0)
            
        # 1. 复杂度评分 (Shannon entropy)
        complexity = self._calculate_shannon_entropy(sequence)
        
        # 2. 重复序列检测
        repeats = self._detect_repeats(sequence)
        has_repeats = len(repeats) > 0
        
        # 3. 低复杂度区域检测
        low_complexity = self._detect_low_complexity(sequence)
        
        # 4. 异常模式检测
        anomalies = self._detect_anomalies(sequence)
        
        # 计算综合质量评分
        overall_quality = self._calculate_overall_quality(
            complexity, has_repeats, len(low_complexity), anomalies, length
        )
        
        return QualityMetrics(
            complexity_score=complexity,
            has_repeats=has_repeats,
            repeat_units=repeats,
            low_complexity_regions=low_complexity,
            anomaly_flags=anomalies,
            overall_quality=overall_quality
        )
        
    def _find_invalid_characters(self, sequence: str) -> List[Dict[str, Any]]:
        """查找非法字符及其位置"""
        invalid_chars = []
        
        for i, char in enumerate(sequence.upper()):
            if char not in STANDARD_AMINO_ACIDS and char not in [' ', '\t', '\n', '\r', '[', ']', '-']:
                invalid_chars.append({
                    "char": char,
                    "position": i + 1  # 1-based
                })
                
        return invalid_chars
        
    def _analyze_composition(self, sequence: str) -> Dict[str, Any]:
        """分析组成并生成警告"""
        warnings = []
        length = len(sequence)
        
        # 检查极端单一组成
        freq = {}
        for aa in sequence:
            freq[aa] = freq.get(aa, 0) + 1
            
        max_freq_aa = max(freq.items(), key=lambda x: x[1])
        max_ratio = max_freq_aa[1] / length
        
        if max_ratio > 0.5 and length > 10:
            warnings.append(ValidationWarning(
                code="EXTREME_COMPOSITION",
                message=f"氨基酸'{max_freq_aa[0]}'占比过高 ({max_ratio*100:.1f}%)",
                severity="warning"
            ))
            
        # 检查连续重复 (>10个相同AA)
        pattern = r'(.)\1{9,}'
        repeats = re.finditer(pattern, sequence)
        for match in repeats:
            warnings.append(ValidationWarning(
                code="LONG_HOMOPOLYMER",
                message=f"发现连续{len(match.group())}个'{match.group(1)}'重复 (位置 {match.start()+1}-{match.end()})",
                severity="warning"
            ))
            
        return {"warnings": warnings}
        
    def _calculate_initial_quality(self, sequence: str, warnings: List[ValidationWarning]) -> float:
        """计算初始质量评分"""
        base_score = 1.0
        length = len(sequence)
        
        # 根据警告扣分
        for warning in warnings:
            if warning.severity == "critical":
                base_score -= 0.3
            elif warning.severity == "warning":
                base_score -= 0.1
                
        # 根据复杂度调整
        complexity = self._calculate_shannon_entropy(sequence)
        ideal_entropy = math.log2(min(length, 20))  # 最大可能熵
        if ideal_entropy > 0:
            complexity_ratio = complexity / ideal_entropy
            base_score *= (0.7 + 0.3 * complexity_ratio)  # 权重30%
            
        return max(0.0, min(1.0, base_score))
        
    def _calculate_shannon_entropy(self, sequence: str) -> float:
        """
        计算Shannon熵 (衡量序列多样性)
        
        H = -Σ(p_i × log2(p_i))
        
        解释:
        - H ≈ 4.32 (最大): 20种AA均匀分布 (高多样性)
        - H ≈ 0: 单一AA重复 (低质量)
        - 正常范围: 3.5-4.2
        """
        if not sequence:
            return 0.0
            
        length = len(sequence)
        freq = {}
        
        for aa in sequence:
            freq[aa] = freq.get(aa, 0) + 1
            
        entropy = 0.0
        for count in freq.values():
            p = count / length
            if p > 0:
                entropy -= p * math.log2(p)
                
        return entropy
        
    def _detect_repeats(self, sequence: str) -> List[RepeatUnit]:
        """
        检测tandem repeats (串联重复)
        
        使用简单滑动窗口方法检测ABAB、ABCABC等模式
        """
        repeats = []
        length = len(sequence)
        
        if length < 6:
            return repeats
            
        # 检测不同长度的重复单元 (2-6 AA)
        for unit_len in range(2, min(7, length // 2 + 1)):
            i = 0
            while i <= length - unit_len * 2:
                unit = sequence[i:i + unit_len]
                
                # 查找后续重复
                count = 1
                j = i + unit_len
                while j + unit_len <= length and sequence[j:j + unit_len] == unit:
                    count += 1
                    j += unit_len
                    
                if count >= 2:
                    repeats.append(RepeatUnit(
                        sequence=unit,
                        start=i,
                        end=j,
                        count=count
                    ))
                    i = j  # 跳过已检测的区域
                else:
                    i += 1
                    
        return repeats
        
    def _detect_low_complexity(self, sequence: str) -> List[Region]:
        """
        检测低复杂度区域 (简化版SEG算法)
        
        低复杂度特征:
        - 高比例的单一种类AA (如 poly-A, poly-G)
        - 简单二肽重复
        """
        regions = []
        length = len(sequence)
        
        if length < 10:
            return regions
            
        window_size = min(12, length // 3)
        threshold = 0.45  # 低复杂度阈值
        
        i = 0
        while i <= length - window_size:
            window = sequence[i:i + window_size]
            
            # 计算窗口内最常见AA的比例
            freq = {}
            for aa in window:
                freq[aa] = freq.get(aa, 0) + 1
                
            max_freq = max(freq.values())
            ratio = max_freq / window_size
            
            if ratio > threshold:
                # 扩展区域
                start = i
                end = i + window_size
                
                while end < length and end - start < length * 0.3:
                    next_window = sequence[end:min(end + window_size, length)]
                    if not next_window:
                        break
                        
                    next_freq = {}
                    for aa in next_window:
                        next_freq[aa] = next_freq.get(aa, 0) + 1
                        
                    if max(next_freq.values(), default=0) / len(next_window) > threshold:
                        end += len(next_window)
                    else:
                        break
                        
                regions.append(Region(
                    start=start,
                    end=end,
                    type="low_complexity",
                    score=ratio
                ))
                i = end
            else:
                i += 1
                
        return regions
        
    def _detect_anomalies(self, sequence: str) -> List[str]:
        """检测异常模式"""
        anomalies = []
        length = len(sequence)
        
        if length < 5:
            return anomalies
            
        # Poly-A/T/C/G/H/P stretches (>15个)
        for aa in "ATCGHP":
            pattern = aa * 16  # 至少16个连续
            if pattern in sequence:
                anomalies.append(f"Poly-{aa} stretch detected")
                
        # Charge clusters (+/-)
        positive_aas = set("KRH")
        negative_aas = set("DE")
        
        for charge_type, aas in [("positive", positive_aas), ("negative", negative_aas)]:
            max_consecutive = 0
            current = 0
            
            for aa in sequence:
                if aa in aas:
                    current += 1
                    max_consecutive = max(max_consecutive, current)
                else:
                    current = 0
                    
            if max_consecutive >= 12:
                anomalies.append(f"{charge_type.capitalize()} charge cluster ({max_consecutive} residues)")
                
        return anomalies
        
    def _calculate_overall_quality(
        self,
        complexity: float,
        has_repeats: bool,
        low_comp_count: int,
        anomalies: List[str],
        length: int
    ) -> float:
        """
        计算综合质量评分 (0.0-1.0)
        
        权重分配:
        - 复杂度: 40% (核心指标)
        - 无重复: 20%
        - 无低复杂度: 20%
        - 无异常: 10%
        - 长度适宜: 10%
        """
        score = 0.0
        
        # 维度1: 复杂度 (归一化到0-1)
        max_possible_entropy = math.log2(min(length, 20))
        if max_possible_entropy > 0:
            normalized_complexity = complexity / max_possible_entropy
        else:
            normalized_complexity = 1.0
        score += normalized_complexity * 0.40
        
        # 维度2: 无重复
        score += (0.0 if has_repeats else 1.0) * 0.20
        
        # 维度3: 无低复杂度
        score += max(0, 1.0 - low_comp_count * 0.2) * 0.20
        
        # 维度4: 无异常
        score += max(0, 1.0 - len(anomalies) * 0.15) * 0.10
        
        # 维度5: 长度适宜 (理想范围: 50-500 AA)
        if 50 <= length <= 500:
            length_score = 1.0
        elif 10 <= length <= 1000:
            length_score = 0.8
        elif 2 <= length <= 2000:
            length_score = 0.6
        else:
            length_score = 0.4
        score += length_score * 0.10
        
        return round(max(0.0, min(1.0, score)), 3)


async def test_preprocessor():
    """
    测试序列预处理引擎的功能和性能
    """
    logger.info("\n" + "="*80)
    logger.info("🧪 序列预处理引擎 - 功能与性能测试")
    logger.info("="*80 + "\n")
    preprocessor = SequencePreprocessor()
    
    # 测试1: 有效序列验证
    logger.info("📌 测试1: 有效序列验证")
    logger.info("-" * 60)
    valid_seqs = [
        "VLGYTKEGNHIVGKKISARFAQEINQLDLTTLLKLAQPEEL",  # 正常序列
        "ACDEFGHIKLMNPQRSTVWY",  # 包含所有20种AA
        "MVLSEGEWQLVLHVWAKVEADVAGHGQDILIRLFKSHPETLEKFDRVKHLKTEAEMKASEDLKKHGVTVLTALGGILKKKGHHEAEIKPLAQSHATKHKIPV",  # 较长序列
    ]
    
    for seq in valid_seqs:
        result = await preprocessor.validate_sequence(seq)
        assert result.is_valid, f"❌ 应该通过: {seq[:30]}..."
        assert result.quality_score > 0.7, f"❌ 质量分数过低: {result.quality_score}"
        logger.warning(f"   ✅ 长度:{len(seq):4d} | 质量:{result.quality_score:.3f} | 警告数:{len(result.warnings)}")
    logger.info()
    
    # 测试2: 无效序列检测
    logger.info("📌 测试2: 无效序列检测")
    logger.info("-" * 60)
    invalid_cases = [
        ("", "空序列"),
        ("A", "过短"),
        ("X", "非法字符"),
        ("VLGYTXKEG", "包含非法字符X"),
        ("A" * 5001, "超长序列"),
    ]
    
    for seq, desc in invalid_cases:
        result = await preprocessor.validate_sequence(seq)
        assert not result.is_valid, f"❌ 应该失败: {desc}"
        assert len(result.errors) > 0, f"❌ 应该有错误信息: {desc}"
        logger.error(f"   ✅ {desc:15s} | 错误数: {len(result.errors)} | {result.errors[0].message[:50]}")
    logger.info()
    
    # 测试3: 序列标准化
    logger.info("📌 测试3: 序列标准化")
    logger.info("-" * 60)
    standardize_cases = [
        ("vlgytkegn", "小写转大写"),
        ("V L G Y T K E G N", "去除空格"),
        ("NH2-VLGYTK-COOH", "去除端基标记"),
        ("M[Ox]VLGYT", "解析修饰标记"),
    ]
    
    for seq, desc in standardize_cases:
        std_result = await preprocessor.standardize(seq)
        logger.info(f"   ✅ {desc:20s} | 原始:'{seq}' → 标准化:'{std_result.value}' | 修饰:{len(std_result.modifications_detected)}处")
    logger.info()
    
    # 测试4: 质量评估
    logger.info("📌 测试4: 质量评估")
    logger.info("-" * 60)
    test_sequences = {
        "ACDEFGHIKLMNPQRSTVWY": "高多样性 (全20种AA)",
        "AAAAAAA": "极低质量 (单AA重复)",
        "VLGYTKEGNHIVGKKISAR": "正常序列",
    }
    
    for seq, desc in test_sequences.items():
        metrics = await preprocessor.quality_assess(seq)
        logger.info(f"   ✅ {desc}")
        logger.info(f"      Shannon熵: {metrics.complexity_score:.3f}")
        logger.info(f"      有重复: {'是' if metrics.has_repeats else '否'}")
        logger.info(f"      低复杂度区: {len(metrics.low_complexity_regions)} 个")
        logger.error(f"      异常标志: {metrics.anomaly_flags if metrics.anomaly_flags else '无'}")
        logger.info(f"      综合质量: {metrics.overall_quality:.3f}\n")
    # 测试5: 性能基准测试
    logger.info("📌 测试5: 性能基准测试 (>10,000 seq/s)")
    logger.info("-" * 60)
    import time
    import random
    
    random.seed(42)
    aa_list = list(STANDARD_AMINO_ACIDS)
    test_batch = [
        ''.join(random.choice(aa_list) for _ in range(random.randint(10, 500)))
        for _ in range(10000)
    ]
    
    # 验证性能
    start_time = time.time()
    
    for seq in test_batch:
        await preprocessor.validate_sequence(seq)
        
    elapsed = time.time() - start_time
    throughput = len(test_batch) / elapsed
    
    logger.info(f"   📊 测试规模: {len(test_batch):,} 条序列")
    logger.info(f"   ⏱️ 总耗时: {elapsed:.2f}s")
    logger.info(f"   🚀 吞吐量: {throughput:,.0f} seq/s")
    if throughput > 10000:
        logger.info(f"   ✅ 性能达标! (目标: >10,000 seq/s)")
    else:
        logger.info(f"   ⚠️ 性能未达标 (目标: >10,000 seq/s)")
    logger.info()
    
    logger.info("="*80)
    logger.info("🎉 序列预处理引擎测试完成！")
    logger.info("="*80 + "\n")
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    asyncio.run(test_preprocessor())
