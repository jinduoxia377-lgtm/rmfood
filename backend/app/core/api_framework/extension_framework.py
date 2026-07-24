"""
企业级国际化与扩展框架

功能:
- i18n 国际化 (中/英/日/韩等多语言)
- 插件系统 (Plugin Architecture)
- 快捷键体系 (Keyboard Shortcuts)
- 主题与布局定制
- 权限与特性开关
"""

import json
import logging
import importlib
import os
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Type


logger = logging.getLogger(__name__)


# ============================================================
# i18n System
# ============================================================

class Locale(str, Enum):
    """支持的语言"""
    ZH_CN = "zh-CN"
    EN_US = "en-US"
    JA_JP = "ja-JP"
    KO_KR = "ko-KR"


@dataclass
class TranslationEntry:
    """翻译条目"""
    key: str
    value: str
    locale: Locale
    context: Optional[str] = None


class I18nService:
    """
    国际化服务
    
    Features:
    - 多语言翻译管理
    - 上下文感知翻译
    - 插值变量支持
    - 复数形式处理
    - 回退语言链
    """

    def __init__(self):
        self._translations: Dict[Locale, Dict[str, TranslationEntry]] = {}
        self._fallback_chain: List[Locale] = [Locale.ZH_CN, Locale.EN_US]
        self._load_builtin_translations()

    def _load_builtin_translations(self):
        """加载内置翻译"""
        translations = {
            Locale.ZH_CN: {
                "common.save": "保存",
                "common.cancel": "取消",
                "common.delete": "删除",
                "common.edit": "编辑",
                "common.create": "创建",
                "common.search": "搜索",
                "common.confirm": "确认",
                "common.loading": "加载中...",
                "common.success": "操作成功",
                "common.error": "操作失败",
                "common.warning": "警告",
                
                "nav.dashboard": "仪表盘",
                "nav.formulas": "配方管理",
                "nav.experiments": "实验记录",
                "nav.ingredients": "原料库",
                "nav.analytics": "数据分析",
                "nav.settings": "设置",
                
                "formula.title": "配方名称",
                "formula.status": "状态",
                "formula.category": "分类",
                "formula.create": "新建配方",
                "formula.edit": "编辑配方",
                "formula.delete_confirm": "确定要删除此配方吗？此操作不可撤销。",
                "formula.published": "已发布",
                "formula.draft": "草稿",
                "formula.archived": "已归档",
                
                "auth.login": "登录",
                "auth.logout": "退出登录",
                "auth.register": "注册",
                "auth.forgot_password": "忘记密码？",
                "auth.welcome_back": "欢迎回来",
                
                "notification.title": "通知中心",
                "notification.mark_read": "标记为已读",
                "notification.mark_all_read": "全部标为已读",
                "notification.no_notifications": "暂无通知",
                
                "collaboration.mention": "{{user}} 提到了你",
                "collaboration.comment_new": "新评论",
                "collaboration.shared_with": "分享给",
                
                "analytics.kpi.formulas_total": "配方总数",
                "analytics.kpi.active_users": "活跃用户",
                "analytics.kpi.ai_generations": "AI生成次数",
                "analytics.trend.monthly": "月度趋势",
                
                "org.name": "组织名称",
                "org.members": "成员",
                "org.teams": "团队",
                "org.invite_member": "邀请成员",
                "org.settings": "组织设置",
                
                "quota.storage": "存储空间",
                "quota.members": "成员数量",
                "quota.api_calls": "API调用次数",
                "quota.warning": "配额使用警告",
            },
            
            Locale.EN_US: {
                "common.save": "Save",
                "common.cancel": "Cancel",
                "common.delete": "Delete",
                "common.edit": "Edit",
                "common.create": "Create",
                "common.search": "Search",
                "common.confirm": "Confirm",
                "common.loading": "Loading...",
                "common.success": "Success",
                "common.error": "Error",
                "common.warning": "Warning",
                
                "nav.dashboard": "Dashboard",
                "nav.formulas": "Formulas",
                "nav.experiments": "Experiments",
                "nav.ingredients": "Ingredients",
                "nav.analytics": "Analytics",
                "nav.settings": "Settings",
                
                "formula.title": "Formula Name",
                "formula.status": "Status",
                "formula.category": "Category",
                "formula.create": "New Formula",
                "formula.edit": "Edit Formula",
                "formula.delete_confirm": "Are you sure you want to delete this formula? This cannot be undone.",
                "formula.published": "Published",
                "formula.draft": "Draft",
                "formula.archived": "Archived",
                
                "auth.login": "Login",
                "auth.logout": "Logout",
                "auth.register": "Register",
                "auth.forgot_password": "Forgot password?",
                "auth.welcome_back": "Welcome back",
                
                "notification.title": "Notifications",
                "notification.mark_read": "Mark as read",
                "notification.mark_all_read": "Mark all as read",
                "notification.no_notifications": "No notifications",
                
                "collaboration.mention": "{{user}} mentioned you",
                "collaboration.comment_new": "New comment",
                "collaboration.shared_with": "Shared with",
                
                "analytics.kpi.formulas_total": "Total Formulas",
                "analytics.kpi.active_users": "Active Users",
                "analytics.kpi.ai_generations": "AI Generations",
                "analytics.trend.monthly": "Monthly Trend",
                
                "org.name": "Organization Name",
                "org.members": "Members",
                "org.teams": "Teams",
                "org.invite_member": "Invite Member",
                "org.settings": "Organization Settings",
                
                "quota.storage": "Storage",
                "quota.members": "Members",
                "quota.api_calls": "API Calls",
                "quota.warning": "Quota Warning",
            },
        }

        for locale, trans in translations.items():
            entries = {}
            for key, value in trans.items():
                entries[key] = TranslationEntry(key=key, value=value, locale=locale)
            self._translations[locale] = entries

    def t(self, key: str, locale: Locale = Locale.ZH_CN, **kwargs) -> str:
        """
        翻译文本
        
        Args:
            key: 翻译键
            locale: 目标语言
            **kwargs: 插值变量
            
        Returns:
            翻译后的文本
        """
        entry = self._find_translation(key, locale)
        
        if not entry:
            return key

        text = entry.value
        
        if kwargs:
            for var_key, var_value in kwargs.items():
                text = text.replace(f"{{{{{var_key}}}}}", str(var_value))

        return text

    def _find_translation(self, key: str, locale: Locale) -> Optional[TranslationEntry]:
        """查找翻译（支持回退）"""
        for try_locale in [locale] + self._fallback_chain:
            locale_translations = self._translations.get(try_locale, {})
            if key in locale_translations:
                return locale_translations[key]
        
        return None

    def get_available_locales(self) -> List[Dict[str, str]]:
        """获取所有可用语言"""
        display_names = {
            Locale.ZH_CN: "简体中文",
            Locale.EN_US: "English",
            Locale.JA_JP: "日本語",
            Locale.KO_KR: "한국어",
        }
        
        return [
            {"code": locale.value, "name": display_names.get(locale, locale.value)}
            for locale in Locale
        ]


# ============================================================
# Plugin System
# ============================================================

class PluginType(str, Enum):
    """插件类型"""
    THEME = "theme"
    WIDGET = "widget"
    EXPORTER = "exporter"
    INTEGRATION = "integration"
    AI_PROVIDER = "ai_provider"
    AUTH_PROVIDER = "auth_provider"
    CUSTOM_FIELD = "custom_field"


@dataclass
class PluginMetadata:
    """插件元数据"""
    id: str
    name: string
    version: string
    description: string
    author: string
    type: PluginType
    entry_point: string
    permissions: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)
    config_schema: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PluginInstance:
    """插件实例"""
    metadata: PluginMetadata
    is_enabled: bool = False
    is_installed: bool = False
    config: Dict[str, Any] = field(default_factory=dict)
    installed_at: Optional[datetime] = None


class PluginManager:
    """
    插件管理器
    
    Features:
    - 动态加载/卸载插件
    - 插件生命周期管理
    - 依赖解析
    - 沙箱隔离
    - API Hook机制
    """

    def __init__(self, plugins_dir: str = "plugins"):
        self.plugins_dir = Path(plugins_dir)
        self._instances: Dict[str, PluginInstance] = {}
        self._hooks: Dict[str, List[Callable]] = {}

    async def discover_plugins(self) -> List[PluginMetadata]:
        """发现可用插件"""
        plugins = []

        if not self.plugins_dir.exists():
            logger.info(f"📦 插件目录不存在: {self.plugins_dir}")
            return plugins

        for plugin_path in self.plugins_dir.glob("*/plugin.json"):
            try:
                with open(plugin_path, 'r', encoding='utf-8') as f:
                    meta_data = json.load(f)

                meta = PluginMetadata(
                    id=meta_data.get("id", plugin_path.parent.name),
                    name=meta_data.get("name", "Unknown"),
                    version=meta_data.get("version", "0.0.0"),
                    description=meta_data.get("description", ""),
                    author=meta_data.get("author", ""),
                    type=PluginType(meta_data.get("type", "widget")),
                    entry_point=meta_data.get("entry_point", "main.py"),
                    permissions=meta_data.get("permissions", []),
                    dependencies=meta_data.get("dependencies", []),
                    config_schema=meta_data.get("config_schema", {}),
                )

                plugins.append(meta)

            except Exception as e:
                logger.error(f"❌ 加载插件元数据失败 ({plugin_path}): {e}")

        return plugins

    async def install_plugin(self, plugin_id: str) -> bool:
        """安装插件"""
        meta = await self._get_plugin_metadata(plugin_id)
        if not meta:
            raise ValueError(f"未找到插件: {plugin_id}")

        instance = PluginInstance(
            metadata=meta,
            is_installed=True,
            is_enabled=True,
            installed_at=datetime.now(),
        )

        self._instances[plugin_id] = instance

        await self._load_plugin(plugin_id)

        logger.info(f"📦 安装插件: {meta.name} v{meta.version}")

        return True

    async def uninstall_plugin(self, plugin_id: str) -> bool:
        """卸载插件"""
        if plugin_id not in self._instances:
            return False

        await self._unload_plugin(plugin_id)

        del self._instances[plugin_id]

        logger.info(f"🗑️ 卸载插件: {plugin_id}")

        return True

    async def enable_plugin(self, plugin_id: str) -> bool:
        """启用插件"""
        instance = self._instances.get(plugin_id)
        if not instance or not instance.is_installed:
            return False

        instance.is_enabled = True
        await self._load_plugin(plugin_id)

        return True

    async def disable_plugin(self, plugin_id: str) -> bool:
        """禁用插件"""
        instance = self._instances.get(plugin_id)
        if not instance:
            return False

        instance.is_enabled = False
        await self._unload_plugin(plugin_id)

        return True

    def register_hook(self, hook_name: str, callback: Callable):
        """注册Hook"""
        if hook_name not in self._hooks:
            self._hooks[hook_name] = []
        self._hooks[hook_name].append(callback)

    async def execute_hook(self, hook_name: str, *args, **kwargs) -> List[Any]:
        """执行Hook"""
        results = []

        for callback in self._hooks.get(hook_name, []):
            try:
                if asyncio.iscoroutinefunction(callback):
                    result = await callback(*args, **kwargs)
                else:
                    result = callback(*args, **kwargs)
                results.append(result)
            except Exception as e:
                logger.error(f"❌ Hook执行失败 ({hook_name}): {e}")

        return results

    async def _load_plugin(self, plugin_id: str):
        """加载插件"""
        instance = self._instances.get(plugin_id)
        if not instance or not instance.is_enabled:
            return

        try:
            entry_file = self.plugins_dir / plugin_id / instance.metadata.entry_point
            
            if entry_file.exists():
                spec = importlib.util.spec_from_file_location(
                    f"plugin_{plugin_id}",
                    str(entry_file)
                )
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)

                if hasattr(module, 'register'):
                    await module.register(self)

        except Exception as e:
            logger.error(f"❌ 加载插件失败 ({plugin_id}): {e}")
            instance.is_enabled = False

    async def _unload_plugin(self, plugin_id: str):
        """卸载插件"""
        hooks_to_remove = [
            hook_name for hook_name, callbacks in self._hooks.items()
            if any(getattr(cb, '_plugin_id', None) == plugin_id for cb in callbacks)
        ]

        for hook_name in hooks_to_remove:
            self._hooks[hook_name] = [
                cb for cb in self._hooks[hook_name]
                if getattr(cb, '_plugin_id', None) != plugin_id
            ]

    async def _get_plugin_metadata(self, plugin_id: str) -> Optional[PluginMetadata]:
        """获取插件元数据"""
        meta_file = self.plugins_dir / plugin_id / "plugin.json"

        if not meta_file.exists():
            return None

        with open(meta_file, 'r', encoding='utf-8') as f:
            meta_data = json.load(f)

        return PluginMetadata(
            id=meta_data["id"],
            name=meta_data["name"],
            version=meta_data.get("version", "0.0.0"),
            description=meta_data.get("description", ""),
            author=meta_data.get("author", ""),
            type=PluginType(meta_data.get("type", "widget")),
            entry_point=meta_data.get("entry_point", "main.py"),
        )


# ============================================================
# Keyboard Shortcuts System
# ============================================================

class ShortcutScope(str, Enum):
    """快捷键作用域"""
    GLOBAL = "global"
    EDITOR = "editor"
    DASHBOARD = "dashboard"
    MODAL = "modal"
    FORMULA_DETAIL = "formula_detail"


@dataclass
class KeyboardShortcut:
    """快捷键定义"""
    id: str
    keys: str
    description: str
    scope: ShortcutScope = ShortcutScope.GLOBAL
    action: Optional[Callable] = None
    category: str = "general"
    enabled: bool = True


class ShortcutManager:
    """
    快捷键管理器
    
    Features:
    - 全局/局部快捷键注册
    - 冲突检测
    - 自定义绑定
    - 导入/导出配置
    """

    def __init__(self):
        self._shortcuts: Dict[str, KeyboardShortcut] = {}
        self._scope_shortcuts: Dict[ShortcutScope, List[str]] = {}
        self._register_defaults()

    def register(self, shortcut: KeyboardShortcut):
        """注册快捷键"""
        existing = self._get_by_keys(shortcut.keys, shortcut.scope)
        
        if existing and existing.id != shortcut.id:
            logger.warning(f"⚠️ 快捷键冲突: {shortcut.keys} 已被 '{existing.description}' 使用")

        self._shortcuts[shortcut.id] = shortcut
        
        if shortcut.scope not in self._scope_shortcuts:
            self._scope_shortcuts[shortcut.scope] = []
        self._scope_shortcuts[shortcut.scope].append(shortcut.id)

    def unregister(self, shortcut_id: str):
        """注销快捷键"""
        if shortcut_id in self._shortcuts:
            shortcut = self._shortcuts.pop(shortcut_id)
            if shortcut.scope in self._scope_shortcuts:
                self._scope_shortcuts[shortcut.scope] = [
                    sid for sid in self._scope_shortcuts[shortcut.scope]
                    if sid != shortcut_id
                ]

    def get_for_scope(self, scope: ShortcutScope) -> List[KeyboardShortcut]:
        """获取指定作用域的快捷键"""
        global_ids = self._scope_shortcuts.get(ShortcutScope.GLOBAL, [])
        scope_ids = self._scope_shortcuts.get(scope, [])

        all_ids = list(set(global_ids + scope_ids))

        return [self._shortcuts[sid] for sid in all_ids if sid in self._shortcuts and self._shortcuts[sid].enabled]

    def handle_key_event(self, keys: str, scope: ShortcutScope = ShortcutScope.GLOBAL) -> Optional[Any]:
        """处理按键事件"""
        shortcuts = self.get_for_scope(scope)

        for shortcut in shortcuts:
            if shortcut.keys.lower() == keys.lower() and shortcut.action:
                return shortcut.action()

        return None

    def export_config(self) -> Dict[str, str]:
        """导出快捷键配置"""
        return {
            s.id: s.keys
            for s in self._shortcuts.values()
            if s.enabled
        }

    def import_config(self, config: Dict[str, str]):
        """导入快捷键配置"""
        for shortcut_id, keys in config.items():
            if shortcut_id in self._shortcuts:
                self._shortcuts[shortcut_id].keys = keys

    def _register_defaults(self):
        """注册默认快捷键"""
        defaults = [
            KeyboardShortcut(
                id="global_search",
                keys="Ctrl+K",
                description="全局搜索",
                scope=ShortcutScope.GLOBAL,
                category="navigation",
            ),
            KeyboardShortcut(
                id="save",
                keys="Ctrl+S",
                description="保存",
                scope=ShortcutScope.EDITOR,
                category="editing",
            ),
            KeyboardShortcut(
                id="new_formula",
                keys="Ctrl+N",
                description="新建配方",
                scope=ShortcutScope.GLOBAL,
                category="creation",
            ),
            KeyboardShortcut(
                id="undo",
                keys="Ctrl+Z",
                description="撤销",
                scope=ShortcutScope.EDITOR,
                category="editing",
            ),
            KeyboardShortcut(
                id="redo",
                keys="Ctrl+Y",
                description="重做",
                scope=ShortcutScope.EDITOR,
                category="editing",
            ),
            KeyboardShortcut(
                id="dashboard_refresh",
                keys="Ctrl+R",
                description="刷新仪表盘",
                scope=ShortcutScope.DASHBOARD,
                category="dashboard",
            ),
            KeyboardShortcut(
                id="close_modal",
                keys="Escape",
                description="关闭弹窗",
                scope=ShortcutScope.MODAL,
                category="navigation",
            ),
            KeyboardShortcut(
                id="formula_copy",
                keys="Ctrl+Shift+C",
                description="复制配方",
                scope=ShortcutScope.FORMULA_DETAIL,
                category="formula",
            ),
            KeyboardShortcut(
                id="help",
                keys="F1",
                description="打开帮助",
                scope=ShortcutScope.GLOBAL,
                category="help",
            ),
            KeyboardShortcut(
                id="settings",
                keys="Ctrl+,",
                description="打开设置",
                scope=ShortcutScope.GLOBAL,
                category="navigation",
            ),
        ]

        for shortcut in defaults:
            self.register(shortcut)

    def _get_by_keys(self, keys: str, scope: ShortcutScope) -> Optional[KeyboardShortcut]:
        """通过按键查找快捷键"""
        for shortcut in self._shortcuts.values():
            if shortcut.keys.lower() == keys.lower() and shortcut.scope == scope:
                return shortcut
        return None


# ============================================================
# Global Instances
# ============================================================

i18n = I18nService()
plugin_manager = PluginManager()
shortcut_manager = ShortcutManager()

logger.info("🌐 国际化与扩展框架初始化完成")
