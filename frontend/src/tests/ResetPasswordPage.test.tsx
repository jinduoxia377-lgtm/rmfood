import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';
import { authApi } from '@/api/auth';

// Mock auth API — 组件通过 authApi.resetPassword(token, newPassword) 提交重置
vi.mock('@/api/auth', () => ({
  authApi: { resetPassword: vi.fn() },
}));

// setup.ts 全局 mock 了 react-router-dom 的 Link（仅渲染 children，不产生锚点）。
// 本页面使用 useSearchParams + <Link>，需要真实的 router 行为（读 token / 渲染锚点），
// 因此在测试文件内重新 mock，保留真实 MemoryRouter/useSearchParams/Link。
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}));

describe('ResetPasswordPage', () => {
  const mockReset = vi.mocked(authApi.resetPassword);

  beforeEach(() => {
    mockReset.mockReset();
  });

  // 默认带 token 的初始路由；无 token 用例传入不带 query 的路由
  const renderPage = (initialPath = '/auth/reset-password?token=abc123') =>
    render(
      <MemoryRouter initialEntries={[initialPath]}>
        <ResetPasswordPage />
      </MemoryRouter>
    );

  const fillAndSubmit = (newPw: string, confirmPw: string) => {
    fireEvent.change(screen.getByPlaceholderText('请输入新密码'), { target: { value: newPw } });
    fireEvent.change(screen.getByPlaceholderText('请再次输入新密码'), { target: { value: confirmPw } });
    fireEvent.click(screen.getByRole('button', { name: '重置密码' }));
  };

  test('renders the reset form when a token is present', () => {
    renderPage();

    expect(screen.getAllByText('莱茵分子').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: '重置密码' })).toBeInTheDocument();
    expect(screen.getByText('请设置您的新密码')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入新密码')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请再次输入新密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置密码' })).toBeInTheDocument();
    expect(screen.getByRole('form')).toBeInTheDocument();
  });

  test('renders the invalid state (no form) when no token is present', () => {
    renderPage('/auth/reset-password');

    expect(screen.getByText('重置链接无效或已过期')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重新申请' })).toHaveAttribute('href', '/forgot-password');
    // 无效态有两个"返回登录"链接：卡片头返回箭头 + 无效态文本链接
    const backLinks = screen.getAllByRole('link', { name: '返回登录' });
    expect(backLinks.length).toBeGreaterThanOrEqual(2);
    backLinks.forEach((link) => expect(link).toHaveAttribute('href', '/login'));
    // 无 token → 不渲染表单
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  test('renders back-to-login link below the form when a token is present', () => {
    renderPage();

    const backLinks = screen.getAllByRole('link', { name: '返回登录' });
    expect(backLinks.length).toBeGreaterThanOrEqual(2);
    backLinks.forEach((link) => expect(link).toHaveAttribute('href', '/login'));
  });

  test('shows empty new-password error and does not call the API', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '重置密码' }));

    expect(screen.getByText('请输入新密码')).toBeInTheDocument();
    expect(mockReset).not.toHaveBeenCalled();
  });

  test('shows short password error on submit', () => {
    renderPage();

    fillAndSubmit('abc123', 'abc123');

    expect(screen.getByText('密码至少需要 8 个字符')).toBeInTheDocument();
    expect(mockReset).not.toHaveBeenCalled();
  });

  test('shows complexity error for password without upper/lower/digit', () => {
    renderPage();

    fillAndSubmit('abcdefgh', 'abcdefgh');

    expect(screen.getByText('密码必须包含大小写字母和数字')).toBeInTheDocument();
    expect(mockReset).not.toHaveBeenCalled();
  });

  test('shows mismatch error when confirm password differs', () => {
    renderPage();

    // 新密码必须是合法密码（>=8 且含大小写+数字）才会走到确认密码校验；
    // 故用 "Abcdef12" + "Abcdef13" 触发两次输入不一致。
    fillAndSubmit('Abcdef12', 'Abcdef13');

    expect(screen.getByText('两次输入的密码不一致')).toBeInTheDocument();
    expect(mockReset).not.toHaveBeenCalled();
  });

  test('submits a valid password to resetPassword exactly once with the token', async () => {
    mockReset.mockResolvedValue(undefined);
    renderPage();

    fillAndSubmit('Abcdef12', 'Abcdef12');

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledTimes(1);
      expect(mockReset).toHaveBeenCalledWith('abc123', 'Abcdef12');
    });
  });

  test('shows success state and hides the form on success', async () => {
    mockReset.mockResolvedValue(undefined);
    renderPage();

    fillAndSubmit('Abcdef12', 'Abcdef12');

    await waitFor(() => {
      expect(screen.getByText('密码重置成功')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: '去登录' })).toHaveAttribute('href', '/login');
    // 表单已隐藏
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  test.each([
    [401, { response: { status: 401, data: { detail: '重置令牌已使用，请重新申请' } } }, '重置链接无效或已过期，请重新申请'],
    [404, { response: { status: 404, data: { detail: '' } } }, '用户不存在，请重新申请'],
    [409, { response: { status: 409, data: { detail: '' } } }, '重置令牌正在被使用，请稍后再试'],
    [400, { response: { status: 400, data: { detail: '密码至少需要 8 个字符' } } }, '密码至少需要 8 个字符'],
  ])('maps status %i to the correct error message', async (status, err, expected) => {
    mockReset.mockRejectedValue(err);
    renderPage();

    fillAndSubmit('Abcdef12', 'Abcdef12');

    await waitFor(() => {
      expect(screen.getByText(expected)).toBeInTheDocument();
    });
    // 错误态仍保留表单
    expect(screen.getByRole('form')).toBeInTheDocument();
  });

  test('shows the strength meter label when a password is entered and hides it when empty', () => {
    renderPage();

    // 空密码 → 强度条不显示
    expect(screen.queryByText(/强|中等|非常强/)).not.toBeInTheDocument();

    const newPw = screen.getByPlaceholderText('请输入新密码');
    fireEvent.change(newPw, { target: { value: 'Abcdef12' } });

    // "Abcdef12" 长度 8 + 大写 + 小写 + 数字 → score 4 → "非常强"
    expect(screen.getByText('非常强')).toBeInTheDocument();
  });

  test('toggles new-password visibility', () => {
    renderPage();

    const newPw = screen.getByPlaceholderText('请输入新密码');
    expect(newPw).toHaveAttribute('type', 'password');

    const toggle = screen.getByRole('button', { name: '显示密码' });
    fireEvent.click(toggle);

    expect(newPw).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: '隐藏密码' })).toBeInTheDocument();
  });
});
