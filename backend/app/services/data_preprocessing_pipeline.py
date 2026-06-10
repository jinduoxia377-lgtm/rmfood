"""
数据预处理流水线模块
实现专利权利要求 I2、I3：数据标准化处理
"""
from typing import List, Dict, Optional, Callable, Any, Tuple
from dataclasses import dataclass
import pandas as pd
import numpy as np
from collections import defaultdict
import json
import os


@dataclass
class PipelineConfig:
    """流水线配置"""
    missing_value_strategy: str = "auto"
    outlier_method: str = "iqr"
    normalization: str = "standard"
    feature_selection_threshold: float = 0.1


class DataPreprocessingPipeline:
    """数据预处理流水线"""

    def __init__(self, config: PipelineConfig = None):
        self.config = config or PipelineConfig()
        self.steps = []
        self.statistics = {}
        self.fitted = False

    def add_step(
        self,
        name: str,
        transformer: Callable,
        params: dict = None
    ):
        """添加预处理步骤"""
        self.steps.append({
            "name": name,
            "transformer": transformer,
            "params": params or {}
        })

    def fit_transform(self, data: pd.DataFrame) -> pd.DataFrame:
        """拟合并转换（训练模式）"""
        result = data.copy()

        for step in self.steps:
            transformer = step["transformer"]
            params = step["params"]

            if hasattr(transformer, "fit_transform"):
                result = transformer.fit_transform(result, **params)
            elif hasattr(transformer, "fit") and hasattr(transformer, "transform"):
                transformer.fit(result, **params)
                result = transformer.transform(result, **params)

        self.fitted = True
        return result

    def transform(self, data: pd.DataFrame) -> pd.DataFrame:
        """仅转换（推理模式）"""
        if not self.fitted:
            raise ValueError("Pipeline must be fitted before transform")

        result = data.copy()
        for step in self.steps:
            transformer = step["transformer"]
            if hasattr(transformer, "transform"):
                result = transformer.transform(result)

        return result

    def process(self, data: pd.DataFrame) -> pd.DataFrame:
        """执行完整预处理流程"""
        return self.fit_transform(data)

    def process_batch(self, data_list: List[dict]) -> List[dict]:
        """批量处理"""
        df = pd.DataFrame(data_list)
        processed_df = self.process(df)
        return processed_df.to_dict("records")


class AutoDataCleaner:
    """自动化数据清洗器"""

    def __init__(self):
        self.cleaning_rules = {}

    def clean_missing_values(
        self,
        df: pd.DataFrame,
        strategy: str = "auto"
    ) -> pd.DataFrame:
        """处理缺失值"""
        result = df.copy()

        for col in result.columns:
            missing_count = result[col].isna().sum()
            if missing_count == 0:
                continue

            missing_ratio = missing_count / len(result)

            if strategy == "auto":
                if result[col].dtype in ["int64", "float64"]:
                    if missing_ratio < 0.1:
                        strategy = "mean"
                    else:
                        strategy = "median"
                else:
                    strategy = "mode" if missing_ratio < 0.2 else "drop"

            if strategy == "mean" and result[col].dtype in ["int64", "float64"]:
                result[col].fillna(result[col].mean(), inplace=True)
            elif strategy == "median" and result[col].dtype in ["int64", "float64"]:
                result[col].fillna(result[col].median(), inplace=True)
            elif strategy == "mode":
                mode_val = result[col].mode()
                if len(mode_val) > 0:
                    result[col].fillna(mode_val[0], inplace=True)
            elif strategy == "drop":
                result.dropna(subset=[col], inplace=True)
            elif strategy == "interpolate":
                if result[col].dtype in ["int64", "float64"]:
                    result[col].interpolate(method="linear", inplace=True)

        return result

    def clean_duplicates(
        self,
        df: pd.DataFrame,
        subset: List[str] = None,
        keep: str = "first"
    ) -> pd.DataFrame:
        """删除重复记录"""
        return df.drop_duplicates(subset=subset, keep=keep)

    def normalize_text(self, df: pd.DataFrame, columns: List[str]) -> pd.DataFrame:
        """文本标准化"""
        result = df.copy()

        for col in columns:
            if col in result.columns:
                result[col] = result[col].astype(str).str.strip().str.lower()

        return result

    def handle_outliers(
        self,
        df: pd.DataFrame,
        method: str = "iqr",
        threshold: float = 3.0
    ) -> pd.DataFrame:
        """异常值处理"""
        result = df.copy()

        numeric_cols = result.select_dtypes(include=[np.number]).columns

        for col in numeric_cols:
            if method == "iqr":
                outlier_mask = self._detect_iqr_outliers(result[col], threshold)
            elif method == "zscore":
                outlier_mask = self._detect_zscore_outliers(result[col], threshold)
            elif method == "percentile":
                outlier_mask = self._detect_percentile_outliers(result[col])
            elif method == "winsorize":
                result[col] = self._winsorize(result[col], threshold)
                continue
            else:
                continue

            result.loc[outlier_mask, col] = result[col].median()

        return result

    def _detect_iqr_outliers(self, series: pd.Series, multiplier: float = 1.5) -> np.ndarray:
        """IQR方法检测异常值"""
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1

        lower_bound = q1 - multiplier * iqr
        upper_bound = q3 + multiplier * iqr

        return (series < lower_bound) | (series > upper_bound)

    def _detect_zscore_outliers(self, series: pd.Series, threshold: float = 3.0) -> np.ndarray:
        """Z-score方法检测异常值"""
        mean = series.mean()
        std = series.std()

        if std == 0:
            return np.zeros(len(series), dtype=bool)

        z_scores = np.abs((series - mean) / std)
        return z_scores > threshold

    def _detect_percentile_outliers(
        self,
        series: pd.Series,
        lower: float = 0.01,
        upper: float = 0.99
    ) -> np.ndarray:
        """百分位方法检测异常值"""
        lower_bound = series.quantile(lower)
        upper_bound = series.quantile(upper)

        return (series < lower_bound) | (series > upper_bound)

    def _winsorize(self, series: pd.Series, limits: Tuple[float, float] = (0.05, 0.05)) -> pd.Series:
        """Winsorize处理"""
        lower = series.quantile(limits[0])
        upper = series.quantile(1 - limits[1])
        return series.clip(lower=lower, upper=upper)


class OutlierDetector:
    """异常值检测器"""

    def __init__(self, method: str = "iqr"):
        self.method = method
        self.thresholds = {}

    def detect_all(
        self,
        df: pd.DataFrame,
        columns: List[str] = None
    ) -> dict:
        """综合异常值检测"""
        if columns is None:
            columns = df.select_dtypes(include=[np.number]).columns.tolist()

        results = {}

        for col in columns:
            series = df[col]
            if self.method == "iqr":
                mask = self.detect_iqr_outliers(series)
            elif self.method == "zscore":
                mask = self.detect_zscore_outliers(series)
            else:
                mask = self.detect_percentile_outliers(series)

            outlier_indices = df.index[mask].tolist()
            outlier_values = series[mask].tolist()

            results[col] = {
                "outlier_indices": outlier_indices,
                "outlier_values": outlier_values,
                "outlier_count": len(outlier_indices),
                "outlier_ratio": len(outlier_indices) / len(series) if len(series) > 0 else 0,
                "stats": {
                    "mean": series.mean(),
                    "std": series.std(),
                    "min": series.min(),
                    "max": series.max()
                }
            }

            self.thresholds[col] = {
                "lower": series.quantile(0.25) - 1.5 * (series.quantile(0.75) - series.quantile(0.25)),
                "upper": series.quantile(0.75) + 1.5 * (series.quantile(0.75) - series.quantile(0.25))
            }

        return results


class AutoFeatureEngineer:
    """自动化特征工程"""

    def __init__(self):
        self.feature_transformations = {}
        self.selected_features = []

    def generate_interactions(
        self,
        df: pd.DataFrame,
        columns: List[str],
        operation: str = "multiply"
    ) -> pd.DataFrame:
        """生成特征交互"""
        result = df.copy()

        for i, col1 in enumerate(columns):
            for col2 in columns[i+1:]:
                if col1 not in result.columns or col2 not in result.columns:
                    continue

                if operation == "multiply":
                    result[f"{col1}_x_{col2}"] = result[col1] * result[col2]
                elif operation == "add":
                    result[f"{col1}_plus_{col2}"] = result[col1] + result[col2]
                elif operation == "divide":
                    result[f"{col1}_div_{col2}"] = result[col1] / (result[col2] + 1e-8)
                elif operation == "subtract":
                    result[f"{col1}_minus_{col2}"] = result[col1] - result[col2]

        return result

    def generate_polynomials(
        self,
        df: pd.DataFrame,
        columns: List[str],
        degree: int = 2
    ) -> pd.DataFrame:
        """生成多项式特征"""
        result = df.copy()

        for col in columns:
            if col not in result.columns:
                continue

            for d in range(2, degree + 1):
                result[f"{col}_pow_{d}"] = result[col] ** d

        return result

    def generate_binning(
        self,
        df: pd.DataFrame,
        column: str,
        n_bins: int = 5,
        strategy: str = "quantile"
    ) -> pd.DataFrame:
        """生成区间特征"""
        result = df.copy()

        if column not in result.columns:
            return result

        if strategy == "quantile":
            result[f"{column}_bin"] = pd.qcut(result[column], q=n_bins, labels=False, duplicates="drop")
        elif strategy == "uniform":
            result[f"{column}_bin"] = pd.cut(result[column], bins=n_bins, labels=False)
        elif strategy == "kmeans":
            from sklearn.cluster import KMeans
            values = result[column].values.reshape(-1, 1)
            kmeans = KMeans(n_clusters=n_bins, random_state=42)
            result[f"{column}_bin"] = kmeans.fit_predict(values)

        return result

    def generate_aggregations(
        self,
        df: pd.DataFrame,
        groupby: str,
        agg_columns: List[str],
        agg_functions: List[str] = None
    ) -> pd.DataFrame:
        """生成聚合特征"""
        if agg_functions is None:
            agg_functions = ["mean", "std", "min", "max"]

        result = df.copy()

        for col in agg_columns:
            if col not in result.columns or groupby not in result.columns:
                continue

            grouped = result.groupby(groupby)[col]

            for func in agg_functions:
                if func == "mean":
                    result[f"{col}_by_{groupby}_mean"] = grouped.transform("mean")
                elif func == "std":
                    result[f"{col}_by_{groupby}_std"] = grouped.transform("std")
                elif func == "min":
                    result[f"{col}_by_{groupby}_min"] = grouped.transform("min")
                elif func == "max":
                    result[f"{col}_by_{groupby}_max"] = grouped.transform("max")

        return result

    def select_features(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        method: str = "correlation",
        threshold: float = 0.1
    ) -> List[str]:
        """特征选择"""
        if method == "correlation":
            correlations = X.corrwith(y).abs()
            selected = correlations[correlations > threshold].index.tolist()
        elif method == "variance":
            variances = X.var()
            selected = variances[variances > threshold].index.tolist()
        else:
            selected = X.columns.tolist()

        self.selected_features = selected
        return selected


class DataQualityMonitor:
    """数据质量监控器"""

    def __init__(self):
        self.quality_metrics = {}
        self.quality_history = []

    def compute_quality_score(self, df: pd.DataFrame) -> dict:
        """计算数据质量分数"""
        completeness = self._compute_completeness(df)
        consistency = self._compute_consistency(df)
        validity = self._compute_validity(df)
        timeliness = 0.8

        overall = (completeness + consistency + validity + timeliness) / 4

        issues = []
        if completeness < 0.9:
            issues.append(f"完整度不足: {completeness:.2%}")
        if consistency < 0.9:
            issues.append(f"一致性不足: {consistency:.2%}")
        if validity < 0.9:
            issues.append(f"有效性不足: {validity:.2%}")

        return {
            "overall_score": overall,
            "completeness": completeness,
            "consistency": consistency,
            "validity": validity,
            "timeliness": timeliness,
            "issues": issues
        }

    def _compute_completeness(self, df: pd.DataFrame) -> float:
        """计算完整度"""
        total_cells = df.shape[0] * df.shape[1]
        missing_cells = df.isna().sum().sum()
        return 1.0 - (missing_cells / total_cells) if total_cells > 0 else 0.0

    def _compute_consistency(self, df: pd.DataFrame) -> float:
        """计算一致性"""
        duplicates = df.duplicated().sum()
        return 1.0 - (duplicates / len(df)) if len(df) > 0 else 1.0

    def _compute_validity(self, df: pd.DataFrame) -> float:
        """计算有效性"""
        issues = 0
        total_checks = 0

        for col in df.columns:
            total_checks += 1

            if df[col].dtype in ["int64", "float64"]:
                inf_count = np.isinf(df[col]).sum()
                if inf_count > 0:
                    issues += inf_count / len(df)

        return max(0.0, 1.0 - issues)

    def generate_quality_report(
        self,
        df: pd.DataFrame,
        detailed: bool = False
    ) -> dict:
        """生成质量报告"""
        score = self.compute_quality_score(df)

        if detailed:
            missing_by_column = df.isna().sum().to_dict()
            duplicate_count = df.duplicated().sum()

            return {
                **score,
                "missing_by_column": missing_by_column,
                "duplicate_count": duplicate_count,
                "row_count": len(df),
                "column_count": len(df.columns)
            }

        return score

    def track_quality_history(
        self,
        df: pd.DataFrame,
        dataset_name: str = "default"
    ):
        """跟踪质量历史"""
        score = self.compute_quality_score(df)
        self.quality_history.append({
            "dataset": dataset_name,
            "score": score,
            "timestamp": pd.Timestamp.now()
        })

    def alert_on_quality_degradation(
        self,
        current_score: float,
        baseline_score: float,
        threshold: float = 0.1
    ) -> bool:
        """数据质量下降告警"""
        degradation = baseline_score - current_score
        return degradation > threshold


class PipelineManager:
    """流水线管理器"""

    def __init__(self):
        self.pipelines = {}

    def save_pipeline(self, name: str, pipeline: DataPreprocessingPipeline):
        """保存流水线"""
        pipeline_data = {
            "config": pipeline.config.__dict__ if hasattr(pipeline.config, "__dict__") else {},
            "steps": [
                {"name": s["name"], "params": s["params"]}
                for s in pipeline.steps
            ],
            "statistics": pipeline.statistics
        }

        self.pipelines[name] = pipeline_data

        import os
        os.makedirs("data/pipelines", exist_ok=True)
        filepath = f"data/pipelines/{name}.json"

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(pipeline_data, f, ensure_ascii=False, indent=2)

    def load_pipeline(self, name: str) -> Optional[DataPreprocessingPipeline]:
        """加载流水线"""
        if name in self.pipelines:
            pipeline_data = self.pipelines[name]
        else:
            import os
            filepath = f"data/pipelines/{name}.json"
            if not os.path.exists(filepath):
                return None

            with open(filepath, "r", encoding="utf-8") as f:
                pipeline_data = json.load(f)

        config = PipelineConfig(**pipeline_data.get("config", {}))
        pipeline = DataPreprocessingPipeline(config)

        return pipeline

    def create_default_pipeline(self) -> DataPreprocessingPipeline:
        """创建默认流水线"""
        config = PipelineConfig()
        pipeline = DataPreprocessingPipeline(config)

        pipeline.add_step("clean_missing", AutoDataCleaner().clean_missing_values, {"strategy": "auto"})
        pipeline.add_step("remove_duplicates", AutoDataCleaner().clean_duplicates, {})

        return pipeline

    def get_pipeline_info(self, name: str) -> dict:
        """获取流水线信息"""
        if name not in self.pipelines:
            return {}

        return {
            "name": name,
            "step_count": len(self.pipelines[name].get("steps", [])),
            "steps": [s["name"] for s in self.pipelines[name].get("steps", [])]
        }


__all__ = [
    "DataPreprocessingPipeline",
    "AutoDataCleaner",
    "OutlierDetector",
    "AutoFeatureEngineer",
    "DataQualityMonitor",
    "PipelineManager",
    "PipelineConfig"
]
