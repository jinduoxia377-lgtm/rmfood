#!/bin/bash
# generate-requirements.sh
# 生成锁定版本的requirements文件

set -e

echo "检查pip-tools..."
python -m pip install pip-tools wheel setuptools

echo "生成基础依赖..."
pip-compile requirements/base.in -o requirements/base.txt --verbose

echo "生成API依赖..."
pip-compile requirements/api.in -o requirements/api.txt --verbose

echo "生成数据库依赖..."
pip-compile requirements/db.in -o requirements/db.txt --verbose

echo "生成机器学习依赖..."
pip-compile requirements/ml.in -o requirements/ml.txt --verbose

echo "生成开发依赖..."
pip-compile requirements/dev.in -o requirements/dev.txt --verbose

echo "生成生产依赖..."
pip-compile requirements/prod.in -o requirements/prod.txt --verbose

echo "生成完整的requirements.txt..."
cp requirements/prod.txt requirements.txt

echo "全部生成完成！"
echo ""
echo "文件列表:"
ls -la requirements/*.txt