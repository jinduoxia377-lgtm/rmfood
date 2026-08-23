"""
创建 12 个配方案例数据
"""
import asyncio
import sys
sys.path.insert(0, '.')

from app.core.database.session import get_db
from app.services.formula.formula_module import FormulaService
from app.schemas.formula import FormulaCreate
from datetime import datetime, timezone, timedelta

async def create_test_formulas():
    async for session in get_db():
        service = FormulaService(session)

        # Check existing count
        formulas, total = await service.list_formulas(page=1, page_size=100)
        if total > 0:
            print(f'已有 {total} 个配方，跳过创建')
            return

        print('创建 12 个配方案例...')

        test_formulas = [
            {
                'name': '补肾益气方',
                'description': '用于肾气不足引起的腰膝酸软、头晕耳鸣',
                'target_effects': ['补肾益气', '强筋健骨'],
            },
            {
                'name': '清热解毒方',
                'description': '用于热毒壅盛引起的咽喉肿痛、口舌生疮',
                'target_effects': ['清热解毒', '消肿止痛'],
            },
            {
                'name': '活血化瘀方',
                'description': '用于血瘀证引起的痛经、跌打损伤',
                'target_effects': ['活血化瘀', '通经止痛'],
            },
            {
                'name': '健脾养胃方',
                'description': '用于脾胃虚弱引起的食欲不振、腹胀便溏',
                'target_effects': ['健脾和胃', '益气生津'],
            },
            {
                'name': '滋阴润肺方',
                'description': '用于肺阴不足引起的干咳少痰、咽喉干燥',
                'target_effects': ['滋阴润肺', '清热生津'],
            },
            {
                'name': '安神助眠方',
                'description': '用于心脾两虚引起的心悸失眠、健忘多梦',
                'target_effects': ['养心安神', '健脾补血'],
            },
            {
                'name': '疏肝理气方',
                'description': '用于肝气郁结引起的情志抑郁、胸胁胀痛',
                'target_effects': ['疏肝解郁', '理气宽中'],
            },
            {
                'name': '补气养血方',
                'description': '用于气血两虚引起的面色萎黄、头晕乏力',
                'target_effects': ['补气养血', '调经止带'],
            },
            {
                'name': '祛风除湿方',
                'description': '用于风寒湿痹引起的关节疼痛、屈伸不利',
                'target_effects': ['祛风除湿', '通络止痛'],
            },
            {
                'name': '温阳散寒方',
                'description': '用于阳虚寒盛引起的手脚冰凉、畏寒喜暖',
                'target_effects': ['温阳散寒', '回阳救逆'],
            },
            {
                'name': '化痰止咳方',
                'description': '用于痰湿咳嗽引起的咳嗽痰多、胸闷恶心',
                'target_effects': ['燥湿化痰', '止咳平喘'],
            },
            {
                'name': '消食导滞方',
                'description': '用于食积停滞引起的不思饮食、脘腹胀满',
                'target_effects': ['消食化积', '行气止痛'],
            },
        ]

        for i, formula_data in enumerate(test_formulas, 1):
            # Create with slight time offset
            base_time = datetime.now(timezone.utc) - timedelta(days=30-i*2)
            try:
                created = await service.create_formula(
                    FormulaCreate(
                        name=formula_data['name'],
                        description=formula_data['description'],
                        target_effects=formula_data['target_effects'],
                    ),
                    creator_id=1,
                    organization_id=None,
                )
                # Manually update timestamps since create_formula sets them
                from sqlalchemy import text
                await session.execute(text(f"""
                    UPDATE formulas
                    SET created_at = :created_at, updated_at = :updated_at
                    WHERE id = :id
                """), {
                    'created_at': base_time,
                    'updated_at': base_time + timedelta(hours=i),
                    'id': created.id,
                })
                print(f'  ✓ {i}. {formula_data["name"]} (ID: {created.id})')
            except Exception as e:
                print(f'  ✗ {i}. {formula_data["name"]}: {e}')

        await session.commit()
        print(f'\n完成！共创建 12 个配方案例')
        break

if __name__ == "__main__":
    asyncio.run(create_test_formulas())
