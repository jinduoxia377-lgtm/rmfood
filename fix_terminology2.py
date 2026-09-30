# Fix terminology API and service - SQLAlchemy 2.0 compatibility

# Fix 1: api/terminology.py - statistics endpoint
path_api = r'D:\RMFOODFP\backend\app\api\terminology.py'
with open(path_api, 'r', encoding='utf-8') as f:
    content = f.read()

# Add func import
if 'from sqlalchemy import select' in content and 'func' not in content.split('from sqlalchemy import select')[1].split('\n')[0]:
    content = content.replace(
        'from sqlalchemy import select',
        'from sqlalchemy import select, func'
    )

# Fix count queries in statistics endpoint
old_stats = '''    total_terms = db.execute(select(Term).count()).scalar()
    total_categories = db.execute(select(TermCategory).count()).scalar()
    total_variants = db.execute(select(TermVariant).count()).scalar()
    total_validations = db.execute(select(TermValidation).count()).scalar()
    
    # 按分类统计
    category_stats = []
    categories = db.execute(select(TermCategory)).scalars().all()
    for cat in categories:
        term_count = db.execute(select(Term).filter(Term.category_id == cat.id).count()).scalar()'''

new_stats = '''    total_terms = db.execute(select(func.count()).select_from(Term)).scalar()
    total_categories = db.execute(select(func.count()).select_from(TermCategory)).scalar()
    total_variants = db.execute(select(func.count()).select_from(TermVariant)).scalar()
    total_validations = db.execute(select(func.count()).select_from(TermValidation)).scalar()
    
    # 按分类统计
    category_stats = []
    categories = db.execute(select(TermCategory)).scalars().all()
    for cat in categories:
        term_count = db.execute(select(func.count()).where(Term.category_id == cat.id).select_from(Term)).scalar()'''

if old_stats in content:
    content = content.replace(old_stats, new_stats)
    with open(path_api, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed api/terminology.py')
else:
    print('api/terminology.py pattern not found')

# Fix 2: services/terminology_service.py - update_statistics
path_svc = r'D:\RMFOODFP\backend\app\services\terminology_service.py'
with open(path_svc, 'r', encoding='utf-8') as f:
    content = f.read()

# Add func to imports
if 'from sqlalchemy import select, delete' in content:
    content = content.replace(
        'from sqlalchemy import select, delete',
        'from sqlalchemy import select, delete, func'
    )

# Fix update_statistics method - rewrite it completely
old_update_stats = '''    def update_statistics(self):
        """更新统计信息"""
        categories = self.db.execute(select(TermCategory)).scalars().all()
        
        for category in categories:
            term_count = self.db.execute(select(Term).filter(Term.category_id == category.id).count())).scalar()
            validation_count = self.db.execute(
                select(TermValidation).where(
                    TermValidation.matched_term_id == Term.id,
                    Term.category_id == category.id
                ).count()
            ).scalar()
            correction_count = self.db.execute(
                select(TermValidation).where(
                    TermValidation.correction_needed == True,
                    TermValidation.matched_term_id == Term.id,
                    Term.category_id == category.id
                ).count()
            ).scalar()
            
            stats = self.db.execute(
                select(TermValidation).where(TermCategory.id == category.id)
            ).scalar_one_or_none()
            
            if stats:
                stats.total_terms = term_count
                stats.validation_count = validation_count
                stats.correction_count = correction_count
                stats.accuracy_rate = (validation_count - correction_count) / max(validation_count, 1)
            else:
                stats = TermValidation(
                    category_id=category.id,
                    total_terms=term_count,
                    validation_count=validation_count,
                    correction_count=correction_count,
                    accuracy_rate=(validation_count - correction_count) / max(validation_count, 1)
                )
                self.db.add(stats)
        
        self.db.commit()'''

# Find the actual method content
lines = content.split('\n')
start_idx = None
end_idx = None
for i, line in enumerate(lines):
    if 'def update_statistics(self):' in line:
        start_idx = i
    if start_idx is not None and i > start_idx:
        # Find the next method or end of file
        if line.strip() and not line.startswith(' ') and not line.startswith('\t'):
            end_idx = i
            break
        if line.startswith('    def ') and i > start_idx + 1:
            end_idx = i
            break

if start_idx is not None:
    # Find the end of the method (next method def at same indent level)
    indent = len(lines[start_idx]) - len(lines[start_idx].lstrip())
    for i in range(start_idx + 1, len(lines)):
        line = lines[i]
        if line.strip() and (not line.startswith(' ' * (indent + 1)) or (line.startswith('    def ') and i > start_idx)):
            end_idx = i
            break
    if end_idx is None:
        end_idx = len(lines)
    
    new_method = '''    def update_statistics(self):
        """更新统计信息"""
        from app.models.terminology import TermStatistics
        categories = self.db.execute(select(TermCategory)).scalars().all()
        
        for category in categories:
            term_count = self.db.execute(
                select(func.count()).where(Term.category_id == category.id).select_from(Term)
            ).scalar()
            validation_count = self.db.execute(
                select(func.count()).select_from(TermValidation)
            ).scalar()
            correction_count = self.db.execute(
                select(func.count()).where(TermValidation.correction_needed == True).select_from(TermValidation)
            ).scalar()
            
            stats = self.db.execute(
                select(TermStatistics).where(TermStatistics.category_id == category.id)
            ).scalar_one_or_none()
            
            if stats:
                stats.total_terms = term_count
                stats.validation_count = validation_count
                stats.correction_count = correction_count
                stats.accuracy_rate = (validation_count - correction_count) / max(validation_count, 1)
            else:
                stats = TermStatistics(
                    category_id=category.id,
                    total_terms=term_count,
                    validation_count=validation_count,
                    correction_count=correction_count,
                    accuracy_rate=(validation_count - correction_count) / max(validation_count, 1)
                )
                self.db.add(stats)
        
        self.db.commit()

'''
    new_lines = lines[:start_idx] + [new_method] + lines[end_idx:]
    content = '\n'.join(new_lines)
    with open(path_svc, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed services/terminology_service.py')
else:
    print('update_statistics method not found')

print('Done')
