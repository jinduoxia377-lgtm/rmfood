#!/usr/bin/env python3
"""
dependency-splitter.py
将现有的requirements.txt拆分为功能组
"""

import re

def categorize_line(line):
    """将依赖行分类到功能组"""
    if not line.strip() or line.startswith('#'):
        return 'comment'

    # 基础依赖
    if any(keyword in line.lower() for keyword in [
        'fastapi', 'uvicorn', 'pydantic', 'jsonschema',
        'python-multipart', 'httpx'
    ]):
        return 'base'

    # 认证和安全
    elif any(keyword in line.lower() for keyword in [
        'jose', 'passlib', 'bcrypt', 'bandit', 'audit'
    ]):
        return 'api'

    # 数据库
    elif any(keyword in line.lower() for keyword in [
        'sqlalchemy', 'aiosqlite', 'asyncpg', 'alembic'
    ]):
        return 'db'

    # 科学计算和机器学习
    elif any(keyword in line.lower() for keyword in [
        'numpy', 'scipy', 'torch', 'rdkit', 'transformers',
        'chromadb', 'python-docx', 'reportlab', 'openpyxl'
    ]):
        return 'ml'

    # 可观测性
    elif any(keyword in line.lower() for keyword in [
        'opentelemetry'
    ]):
        return 'prod'

    else:
        return 'base'

def read_requirements(filepath):
    """读取requirements.txt文件"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.readlines()

def write_requirements(filepath, lines, header=None):
    """写入requirements文件"""
    with open(filepath, 'w', encoding='utf-8') as f:
        if header:
            f.write(header)
        for line in lines:
            f.write(line)

def main():
    base_lines = []
    api_lines = []
    db_lines = []
    ml_lines = []
    prod_lines = []

    # 读取原始requirements.txt
    lines = read_requirements('requirements.txt')

    # 分类每一行
    for line in lines:
        category = categorize_line(line)

        if category == 'comment':
            # 注释写入所有文件
            base_lines.append(line)
            api_lines.append(line)
            db_lines.append(line)
            ml_lines.append(line)
            prod_lines.append(line)
        elif category == 'base':
            base_lines.append(line)
        elif category == 'api':
            api_lines.append(line)
        elif category == 'db':
            db_lines.append(line)
        elif category == 'ml':
            ml_lines.append(line)
        elif category == 'prod':
            prod_lines.append(line)

    # 写入各个文件
    write_requirements('requirements/base.txt', base_lines)

    api_header = "# API相关依赖（包含基础依赖）\n-r base.txt\n\n"
    write_requirements('requirements/api.txt', api_lines, api_header)

    db_header = "# 数据库相关依赖（包含基础依赖）\n-r base.txt\n\n"
    write_requirements('requirements/db.txt', db_lines, db_header)

    ml_header = "# 机器学习相关依赖（包含基础依赖）\n-r base.txt\n\n"
    write_requirements('requirements/ml.txt', ml_lines, ml_header)

    prod_header = "# 生产环境依赖（包含所有依赖）\n-r base.txt\n-r api.txt\n-r db.txt\n-r ml.txt\n\n"
    write_requirements('requirements/prod.txt', prod_lines, prod_header)

    # 开发依赖 - 从requirements-dev.txt复制
    dev_lines = read_requirements('requirements-dev.txt')
    dev_header = "# 开发工具依赖（包含基础依赖）\n-r base.txt\n\n"
    write_requirements('requirements/dev.txt', dev_lines, dev_header)

    print("依赖分离完成！")
    print("- base.txt:  基础核心依赖")
    print("- api.txt:   API和安全相关依赖")
    print("- db.txt:    数据库相关依赖")
    print("- ml.txt:    机器学习相关依赖")
    print("- dev.txt:   开发工具依赖")
    print("- prod.txt:  生产环境依赖")

if __name__ == '__main__':
    main()