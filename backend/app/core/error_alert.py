"""
RMFOOD 错误预警系统
用于监控和预警系统中的错误
"""
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from .logging_config import get_logger
logger = get_logger(__name__)


class ErrorAlertSystem:
    """错误预警系统"""
    
    def __init__(self):
        self.error_history: List[Dict] = []
        self.error_threshold = 10  # 每分钟错误阈值
        self.alert_cooldown = 60  # 预警冷却时间（秒）
        self.last_alert_time = 0
    
    def record_error(self, error: Exception, context: Optional[str] = None):
        """记录错误"""
        error_info = {
            "timestamp": datetime.now(),
            "error_type": type(error).__name__,
            "error_message": str(error),
            "context": context
        }
        
        self.error_history.append(error_info)
        logger.error(f"错误记录: {error_info['error_type']}: {error_info['error_message']}")
        
        # 检查是否需要发送预警
        self.check_alert_needed()
    
    def check_alert_needed(self):
        """检查是否需要发送预警"""
        now = time.time()
        
        # 检查冷却时间
        if now - self.last_alert_time < self.alert_cooldown:
            return
        
        # 统计最近一分钟的错误数
        one_minute_ago = datetime.now() - timedelta(minutes=1)
        recent_errors = [e for e in self.error_history if e['timestamp'] > one_minute_ago]
        
        if len(recent_errors) >= self.error_threshold:
            self.send_alert(recent_errors)
            self.last_alert_time = now
    
    def send_alert(self, recent_errors: List[Dict]):
        """发送预警"""
        error_count = len(recent_errors)
        error_types = set(e['error_type'] for e in recent_errors)
        
        alert_message = (
            f"🚨 错误预警: 系统在过去一分钟内产生了 {error_count} 个错误\n"
            f"错误类型: {', '.join(error_types)}\n"
            f"最近错误: {recent_errors[-1]['error_message'] if recent_errors else '无'}"
        )
        
        # 这里可以集成邮件、短信、Webhook等通知方式
        logger.critical(alert_message)

        # 预警信息也通过日志输出
        logger.critical("\n" + "="*60)
        logger.critical(alert_message)
        logger.critical("="*60 + "\n")
    
    def get_error_stats(self, hours: int = 24) -> Dict:
        """获取错误统计信息"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        recent_errors = [e for e in self.error_history if e['timestamp'] > cutoff_time]
        
        error_counts = {}
        for error in recent_errors:
            error_type = error['error_type']
            error_counts[error_type] = error_counts.get(error_type, 0) + 1
        
        return {
            "total_errors": len(recent_errors),
            "error_counts": error_counts,
            "period_hours": hours
        }
    
    def clear_old_errors(self, hours: int = 24):
        """清理旧错误记录"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        self.error_history = [e for e in self.error_history if e['timestamp'] > cutoff_time]


# 创建错误预警系统实例
error_alert_system = ErrorAlertSystem()


def setup_error_handling(app):
    """
    设置错误预警系统。

    注意：异常处理已统一由 GlobalExceptionHandler 中间件负责。
    此函数仅初始化预警系统，不再注册异常处理器（避免冲突）。
    """
    
    logger.info("错误预警系统已初始化")