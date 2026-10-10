"""扫描 app/ 下所有 Python 文件，找出「用到但未定义/未导入」的全局名（NameError 隐患）。

只做保守判定：名称在同一模块的全局作用域里出现于 import / 赋值 / def / class /
函数参数 / 局部赋值 / 推导式 / with-as / except-as / global 声明，即视为已定义。
排除 builtins。用于发现 defaultdict 这类漏 import 导致的运行时 500。
"""
import ast
import builtins
import os
import sys

BUILTIN = set(dir(builtins)) | {'__name__', '__file__', '__doc__', '__package__',
                                '__spec__', '__loader__', '__builtins__', '__debug__'}


class Collector(ast.NodeVisitor):
    def __init__(self):
        self.defined = set()
        self.used = {}   # name -> lineno

    # ── 定义侧 ──
    def visit_Import(self, node):
        for a in node.names:
            self.defined.add((a.asname or a.name.split('.')[0]))
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        for a in node.names:
            if a.name != '*':
                self.defined.add(a.asname or a.name)

    def visit_FunctionDef(self, node):
        self.defined.add(node.name)
        self._args(node.args)
        for d in node.decorator_list:
            self.visit(d)
        if node.returns:
            self.visit(node.returns)
        for st in node.body:
            self.visit(st)

    visit_AsyncFunctionDef = visit_FunctionDef

    def visit_ClassDef(self, node):
        self.defined.add(node.name)
        for st in node.body:
            self.visit(st)

    def visit_Name(self, node):
        if isinstance(node.ctx, (ast.Store, ast.Del)):
            self.defined.add(node.id)
        else:
            self.used.setdefault(node.id, node.lineno)
        self.generic_visit(node)

    def _args(self, a):
        for arg in list(a.posonlyargs) + list(a.args) + list(a.kwonlyargs):
            self.defined.add(arg.arg)
        if a.vararg:
            self.defined.add(a.vararg.arg)
        if a.kwarg:
            self.defined.add(a.kwarg.arg)

    def visit_Global(self, node):
        for n in node.names:
            self.defined.add(n)

    def visit_Nonlocal(self, node):
        for n in node.names:
            self.defined.add(n)

    def visit_Lambda(self, node):
        self._args(node.args)
        self.visit(node.body)

    def visit_ExceptHandler(self, node):
        if node.name:
            self.defined.add(node.name)
        self.generic_visit(node)

    def visit_With(self, node):
        for item in node.items:
            if item.optional_vars is not None:
                self.visit(item.optional_vars)
        for st in node.body:
            self.visit(st)

    visit_AsyncWith = visit_With


def scan(path):
    try:
        src = open(path, encoding='utf-8').read()
        tree = ast.parse(src)
    except Exception:
        return []
    # 全局层收集
    g = Collector()
    for st in tree.body:
        g.visit(st)

    # 逐函数再收集一次（参数与局部变量），但要保留全局 used 的行号
    all_used = dict(g.used)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            c = Collector()
            body = node.body if isinstance(node, ast.ClassDef) else node.body
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                c._args(node.args)
            for st in body:
                c.visit(st)
            all_used.update(c.used)   # 行号可能重复，无所谓
            g.defined |= c.defined
    return [(n, ln) for n, ln in sorted(all_used.items(), key=lambda x: x[1])
            if n not in g.defined and n not in BUILTIN]


def main():
    roots = sys.argv[1:] or ['app']
    hits = 0
    for root in roots:
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in
                           ('venv', '__pycache__', '.git', 'node_modules', 'migrations')]
            for fn in filenames:
                if not fn.endswith('.py'):
                    continue
                p = os.path.join(dirpath, fn)
                for name, ln in scan(p):
                    print(f'{p}:{ln}: 未定义名称 `{name}`')
                    hits += 1
    print(f'--- 合计 {hits} 处')


if __name__ == '__main__':
    main()
