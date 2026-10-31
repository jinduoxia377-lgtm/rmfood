import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import { authApi } from '@/api/auth';

// Mock auth API — 组件通过 authApi.forgotPassword 发送重置邮件
vi.mock('@/api/auth', () => ({
  authApi: { forgotPassword: vi.fn() },
}));

// setup.ts 全局 mock 了 react-router-dom 的 Link（仅渲染 children，不产生锚点）。
// 本页面渲染 <Link to="/login"> 需要真实锚点（返回登录链接断言 / 键盘导航），
// 因此在测试文件内重新 mock，覆盖 setup 的默认实现（保留真实 MemoryRouter/Link）。
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}));

describe('ForgotPasswordPage', () => {
  const mockForgot = vi.mocked(authApi.forgotPassword);

  beforeEach(() => {
    mockForgot.mockReset();
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

  test('renders the forgot password page with all expected elements', () => {
    renderPage();

    // 品牌名（桌面 Logo 文本 + 移动端品牌条 h1）
    expect(screen.getAllByText('莱茵分子').length).toBeGreaterThan(0);
    // 标题与副标题
    expect(screen.getByText('找回密码')).toBeInTheDocument();
    expect(screen.getByText('请输入您的注册邮箱，我们将发送密码重置链接')).toBeInTheDocument();
    // 邮箱输入框
    expect(screen.getByPlaceholderText('请输入您的邮箱地址')).toBeInTheDocument();
    // 提交按钮
    expect(screen.getByRole('button', { name: '发送重置链接' })).toBeInTheDocument();
    // 表单 (aria-label="找回密码表单")
    expect(screen.getByRole('form')).toBeInTheDocument();
  });

  test('renders back-to-login and footer links', () => {
    renderPage();

    // 两个 "返回登录" 链接：卡片头图标链接 + 表单下方文本链接
    const backLinks = screen.getAllByRole('link', { name: '返回登录' });
    expect(backLinks.length).toBeGreaterThanOrEqual(2);
    backLinks.forEach((link) => expect(link).toHaveAttribute('href', '/login'));

    // 隐私政策 / 服务条款
    expect(screen.getByRole('link', { name: '隐私政策' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: '服务条款' })).toHaveAttribute('href', '/terms');
  });

  test('shows empty email error and does not call the API', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '发送重置链接' }));

    expect(screen.getByText('请输入邮箱地址')).toBeInTheDocument();
    expect(mockForgot).not.toHaveBeenCalled();
  });

  test('shows invalid email error on blur', () => {
    renderPage();

    const input = screen.getByPlaceholderText('请输入您的邮箱地址');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);

    expect(screen.getByText('请输入有效的邮箱地址')).toBeInTheDocument();
    expect(mockForgot).not.toHaveBeenCalled();
  });

  test('shows invalid email error on submit', () => {
    renderPage();

    const input = screen.getByPlaceholderText('请输入您的邮箱地址');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: '发送重置链接' }));

    expect(screen.getByText('请输入有效的邮箱地址')).toBeInTheDocument();
    expect(mockForgot).not.toHaveBeenCalled();
  });

  test('submits a valid email to forgotPassword exactly once', async () => {
    mockForgot.mockResolvedValue(undefined);
    renderPage();

    const input = screen.getByPlaceholderText('请输入您的邮箱地址');
    fireEvent.change(input, { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '发送重置链接' }));

    await waitFor(() => {
      expect(mockForgot).toHaveBeenCalledTimes(1);
      expect(mockForgot).toHaveBeenCalledWith('user@example.com');
    });
  });

  test('shows success state and hides the form on success', async () => {
    mockForgot.mockResolvedValue(undefined);
    renderPage();

    const input = screen.getByPlaceholderText('请输入您的邮箱地址');
    fireEvent.change(input, { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '发送重置链接' }));

    await waitFor(() => {
      expect(screen.getByText('密码重置邮件已发送')).toBeInTheDocument();
    });

    // 成功态：重发按钮出现（冷却期内 aria-label 为 "请 60s 后重新发送"）
    const resendButton = screen.getByRole('button', { name: /重新发送/ });
    expect(resendButton).toBeInTheDocument();
    expect(resendButton).toBeDisabled();

    // 表单已隐藏
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('请输入您的邮箱地址')).not.toBeInTheDocument();
  });

  test('shows error message and keeps the form when forgotPassword rejects', async () => {
    mockForgot.mockRejectedValue(new Error('network error'));
    renderPage();

    const input = screen.getByPlaceholderText('请输入您的邮箱地址');
    fireEvent.change(input, { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '发送重置链接' }));

    await waitFor(() => {
      expect(screen.getByText('发送失败，请检查邮箱地址后重试')).toBeInTheDocument();
    });

    // 错误态仍保留表单
    expect(screen.getByRole('form')).toBeInTheDocument();
    expect(mockForgot).toHaveBeenCalledTimes(1);
  });
});
