"""SymMap 中药材数据清洗和导入脚本

从 SymMap v2.0 数据库下载并清洗药材数据，导入到 symmap_herbs 表。
同时通过 TCMSP_id 字段与 tcm_herbs 表建立关联。
"""
import pandas as pd
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def clean_symmap_data(file_path: str) -> pd.DataFrame:
    """
    清洗 SymMap Excel 数据

    Args:
        file_path: Excel 文件路径

    Returns:
        清洗后的 DataFrame
    """
    logger.info(f"读取 SymMap 数据: {file_path}")
    df = pd.read_excel(file_path, engine='openpyxl')

    logger.info(f"原始数据: {len(df)} 条记录")

    # 1. 去除被抑制的记录 (Suppress == 1)
    df = df[df['Suppress'] == 0].copy()
    logger.info(f"去除抑制记录后: {len(df)} 条")

    # 2. 处理中文字段编码
    df['Chinese_name'] = df['Chinese_name'].astype(str).replace('nan', '')
    df['Pinyin_name'] = df['Pinyin_name'].astype(str).replace('nan', '')
    df['Latin_name'] = df['Latin_name'].astype(str).replace('nan', '')
    df['English_name'] = df['English_name'].astype(str).replace('nan', '')
    df['Properties_Chinese'] = df['Properties_Chinese'].astype(str).replace('nan', '')
    df['Properties_English'] = df['Properties_English'].astype(str).replace('nan', '')
    df['Meridians_Chinese'] = df['Meridians_Chinese'].astype(str).replace('nan', '')
    df['Meridians_English'] = df['Meridians_English'].astype(str).replace('nan', '')
    df['Class_Chinese'] = df['Class_Chinese'].astype(str).replace('nan', '')
    df['Class_English'] = df['Class_English'].astype(str).replace('nan', '')
    df['Alias'] = df['Alias'].astype(str).replace('nan', '')

    # 3. 处理数值字段
    df['TCMSP_id'] = pd.to_numeric(df['TCMSP_id'], errors='coerce')
    df['TCMID_id'] = pd.to_numeric(df['TCMID_id'], errors='coerce')
    df['TCM-ID_id'] = pd.to_numeric(df['TCM-ID_id'], errors='coerce')
    df['HERBDB_ID'] = df['HERBDB_ID'].astype(str).replace('nan', '')

    # 4. 去除空中文名
    df = df[df['Chinese_name'].str.strip() != ''].copy()

    # 5. 标准化字段名（映射到 ORM 模型）
    df_cleaned = pd.DataFrame()
    df_cleaned['symmap_id'] = df['Herb_id'].astype(int)
    df_cleaned['name_cn'] = df['Chinese_name'].str.strip()
    df_cleaned['name_pinyin'] = df['Pinyin_name'].str.strip()
    df_cleaned['name_latin'] = df['Latin_name'].str.strip()
    df_cleaned['name_eng'] = df['English_name'].str.strip()
    df_cleaned['nature_cn'] = df['Properties_Chinese'].str.strip()
    df_cleaned['nature_eng'] = df['Properties_English'].str.strip()
    df_cleaned['meridians_cn'] = df['Meridians_Chinese'].str.strip()
    df_cleaned['meridians_eng'] = df['Meridians_English'].str.strip()
    df_cleaned['category_cn'] = df['Class_Chinese'].str.strip()
    df_cleaned['category_eng'] = df['Class_English'].str.strip()
    df_cleaned['use_part'] = df['UsePart'].str.strip() if 'UsePart' in df.columns else ''
    df_cleaned['tcmsp_id'] = df['TCMSP_id'].astype('Int64')  # 使用支持 NA 的整数类型
    df_cleaned['tcmid_id'] = df['TCMID_id'].astype('Int64')
    df_cleaned['tcmid2_id'] = df['TCM-ID_id'].astype('Int64')
    df_cleaned['herbdb_id'] = df['HERBDB_ID'].str.strip()
    df_cleaned['alias'] = df['Alias'].str.strip()
    df_cleaned['source_version'] = 'v2.0_symmap'
    df_cleaned['synced_at'] = datetime.now(timezone.utc)

    logger.info(f"清洗完成: {len(df_cleaned)} 条有效记录")

    # 导出为 CSV
    csv_path = 'C:/Users/Administrator/AppData/Local/Temp/symmap_herbs_cleaned.csv'
    df_cleaned.to_csv(csv_path, index=False, encoding='utf-8-sig')
    logger.info(f"数据已导出到: {csv_path}")

    return df_cleaned


def get_data_statistics(df: pd.DataFrame) -> dict:
    """获取数据统计信息"""
    stats = {
        'total': len(df),
        'with_tcmsp_id': df['tcmsp_id'].notna().sum(),
        'with_nature_cn': (df['nature_cn'] != '').sum(),
        'with_meridians_cn': (df['meridians_cn'] != '').sum(),
        'with_category_cn': (df['category_cn'] != '').sum(),
        'with_alias': (df['alias'] != '').sum(),
    }
    return stats


def main():
    """主函数"""
    import sys
    sys.stdout.reconfigure(encoding='utf-8')

    # 配置日志
    logging.basicConfig(level=logging.INFO)

    # 清洗数据
    df = clean_symmap_data('C:/Users/Administrator/AppData/Local/Temp/symmap_herbs_v2.xlsx')

    # 打印统计信息
    stats = get_data_statistics(df)
    print("\n=== SymMap 数据统计 ===")
    print(f"总记录数: {stats['total']}")
    print(f"有TCMSP_id: {stats['with_tcmsp_id']}")
    print(f"有四气数据: {stats['with_nature_cn']}")
    print(f"有归经数据: {stats['with_meridians_cn']}")
    print(f"有分类数据: {stats['with_category_cn']}")
    print(f"有别名: {stats['with_alias']}")

    # 打印前10条数据
    print("\n=== 前10条数据示例 ===")
    for _, row in df.head(10).iterrows():
        print(f"  {row['symmap_id']}: {row['name_cn']} ({row['name_latin']}) TCMSP_id={row['tcmsp_id']}")


if __name__ == "__main__":
    main()
