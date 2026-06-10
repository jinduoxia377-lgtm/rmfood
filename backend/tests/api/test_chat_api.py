"""
测试聊天API功能

覆盖测试：
1. 会话管理（创建/读取/更新/删除/列表）
2. 消息管理（创建/读取/单条删除/批量删除）
3. 导出功能（JSON/CSV格式，包含元数据）
"""

import pytest
import json
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.main import app
from app.models.chat import ChatSession, ChatMessage
from app.models import User
from app.core.database import get_db_session
from app.core.security import create_access_token

client = TestClient(app)

# ===== 测试数据 =====

TEST_USER_ID = 1
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "test_password"

# ===== 测试辅助函数 =====

async def create_test_user(db: AsyncSession) -> User:
    """创建测试用户"""
    user = User(
        id=TEST_USER_ID,
        email=TEST_USER_EMAIL,
        username="testuser",
        hashed_password="hashed_password",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

async def create_test_session(db: AsyncSession, user_id: int = TEST_USER_ID) -> ChatSession:
    """创建测试会话"""
    session = ChatSession(
        user_id=user_id,
        title="测试会话",
        message_count=0,
        is_active=True,
        tags=["test"],
        metadata_={"test": "data"},
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session

async def create_test_message(db: AsyncSession, session_id: int) -> ChatMessage:
    """创建测试消息"""
    message = ChatMessage(
        session_id=session_id,
        role="user",
        content="测试消息内容",
        timestamp=datetime.now(timezone.utc),
        is_edited=False,
        is_withdrawn=False,
        message_metadata={"key": "value"},
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message

def get_auth_headers(user_id: int = TEST_USER_ID) -> dict:
    """获取认证头"""
    token = create_access_token(data={"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}

# ===== 测试用例 =====

class TestChatAPI:
    """测试聊天API"""

    @pytest.mark.asyncio
    async def test_create_session(self):
        """测试创建会话"""
        async for db in get_db_session():
            await create_test_user(db)
            headers = get_auth_headers()
            
            response = client.post(
                "/chat/sessions",
                json={"title": "新会话", "tags": ["test", "new"]},
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "id" in data
            assert data["title"] == "新会话"
            assert data["tags"] == ["test", "new"]
            assert data["user_id"] == TEST_USER_ID
            assert data["is_active"] == True

    @pytest.mark.asyncio
    async def test_get_sessions(self):
        """测试获取会话列表"""
        async for db in get_db_session():
            await create_test_user(db)
            await create_test_session(db)
            headers = get_auth_headers()
            
            response = client.get("/chat/sessions", headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            assert "total" in data
            assert isinstance(data["items"], list)

    @pytest.mark.asyncio
    async def test_get_session(self):
        """测试获取会话详情"""
        async for db in get_db_session():
            await create_test_user(db)
            session = await create_test_session(db)
            headers = get_auth_headers()
            
            response = client.get(f"/chat/sessions/{session.id}", headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            assert "session" in data
            assert "messages" in data
            assert data["session"]["id"] == session.id

    @pytest.mark.asyncio
    async def test_update_session(self):
        """测试更新会话"""
        async for db in get_db_session():
            await create_test_user(db)
            session = await create_test_session(db)
            headers = get_auth_headers()
            
            response = client.put(
                f"/chat/sessions/{session.id}",
                json={"title": "更新后的标题", "tags": ["updated"]},
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["title"] == "更新后的标题"
            assert data["tags"] == ["updated"]

    @pytest.mark.asyncio
    async def test_delete_session(self):
        """测试删除会话"""
        async for db in get_db_session():
            await create_test_user(db)
            session = await create_test_session(db)
            headers = get_auth_headers()
            
            response = client.delete(f"/chat/sessions/{session.id}", headers=headers)
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            
            # 验证会话已被软删除
            get_response = client.get(f"/chat/sessions/{session.id}", headers=headers)
            assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_add_message(self):
        """测试添加消息"""
        async for db in get_db_session():
            await create_test_user(db)
            session = await create_test_session(db)
            headers = get_auth_headers()
            
            response = client.post(
                f"/chat/sessions/{session.id}/messages",
                json={"role": "user", "content": "测试消息"},
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "id" in data
            assert data["content"] == "测试消息"
            assert data["role"] == "user"

    @pytest.mark.asyncio
    async def test_delete_message(self):
        """测试删除单条消息"""
        async for db in get_db_session():
            await create_test_user(db)
            session = await create_test_session(db)
            message = await create_test_message(db, session.id)
            headers = get_auth_headers()
            
            response = client.delete(
                f"/chat/sessions/{session.id}/messages/{message.id}",
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            
            # 验证消息已删除
            get_response = client.get(
                f"/chat/sessions/{session.id}/messages/{message.id}",
                headers=headers
            )
            assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_batch_delete_messages(self):
        """测试批量删除消息"""
        async for db in get_db_session():
            await create_test_user(db)
            session = await create_test_session(db)
            message1 = await create_test_message(db, session.id)
            message2 = await create_test_message(db, session.id)
            headers = get_auth_headers()
            
            response = client.delete(
                f"/chat/sessions/{session.id}/messages/batch",
                json={"message_ids": [message1.id, message2.id]},
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["success"] == True
            assert data["deleted_count"] == 2

    @pytest.mark.asyncio
    async def test_export_session_json(self):
        """测试导出会话为JSON格式"""
        async for db in get_db_session():
            await create_test_user(db)
            session = await create_test_session(db)
            await create_test_message(db, session.id)
            headers = get_auth_headers()
            
            response = client.get(
                f"/chat/sessions/{session.id}/export/json?include_metadata=true",
                headers=headers
            )
            
            assert response.status_code == 200
            assert response.headers["content-type"] == "application/json"
            
            data = response.json()
            assert "session" in data
            assert "messages" in data
            assert "exported_at" in data
            assert data["export_format"] == "json"
            assert data["include_metadata"] == True
            assert len(data["messages"]) > 0

    @pytest.mark.asyncio
    async def test_export_session_csv(self):
        """测试导出会话为CSV格式"""
        async for db in get_db_session():
            await create_test_user(db)
            session = await create_test_session(db)
            await create_test_message(db, session.id)
            headers = get_auth_headers()
            
            response = client.get(
                f"/chat/sessions/{session.id}/export/csv?include_metadata=true",
                headers=headers
            )
            
            assert response.status_code == 200
            assert "text/csv" in response.headers["content-type"]
            
            # 验证CSV内容
            content = response.text
            assert "消息ID" in content
            assert "角色" in content
            assert "内容" in content
            assert "时间戳" in content

    @pytest.mark.asyncio
    async def test_export_all_sessions(self):
        """测试导出所有会话"""
        async for db in get_db_session():
            await create_test_user(db)
            await create_test_session(db)
            headers = get_auth_headers()
            
            response = client.get(
                "/chat/export/all/json?include_metadata=true",
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "user_id" in data
            assert "sessions" in data
            assert "exported_at" in data
            assert data["export_format"] == "json"

    @pytest.mark.asyncio
    async def test_search_sessions(self):
        """测试搜索会话"""
        async for db in get_db_session():
            await create_test_user(db)
            await create_test_session(db)
            headers = get_auth_headers()
            
            response = client.get(
                "/chat/sessions?search=测试",
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            assert isinstance(data["items"], list)

    @pytest.mark.asyncio
    async def test_get_messages_pagination(self):
        """测试消息分页"""
        async for db in get_db_session():
            await create_test_user(db)
            session = await create_test_session(db)
            await create_test_message(db, session.id)
            headers = get_auth_headers()
            
            response = client.get(
                f"/chat/sessions/{session.id}/messages?page=1&page_size=10",
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            assert "total" in data
            assert "page" in data
            assert "page_size" in data
            assert "total_pages" in data

    @pytest.mark.asyncio
    async def test_unauthorized_access(self):
        """测试未授权访问"""
        async for db in get_db_session():
            await create_test_user(db)
            session = await create_test_session(db)
            
            # 无认证头
            response = client.get(f"/chat/sessions/{session.id}")
            assert response.status_code == 401
            
            # 无效token
            headers = {"Authorization": "Bearer invalid_token"}
            response = client.get(f"/chat/sessions/{session.id}", headers=headers)
            assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_session_access(self):
        """测试访问他人会话"""
        async for db in get_db_session():
            await create_test_user(db)
            session = await create_test_session(db)
            
            # 使用不同用户ID的token
            headers = get_auth_headers(user_id=999)
            
            response = client.get(f"/chat/sessions/{session.id}", headers=headers)
            assert response.status_code == 404

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
