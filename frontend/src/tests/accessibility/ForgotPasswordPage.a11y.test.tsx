import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import ForgotPasswordPage from '../../pages/auth/ForgotPasswordPage';

// Mock auth API — 组件通过 authApi.forgotPassword 发送重置邮件
vi.mock('@/api/auth', () => ({
  authApi: { forgotPassword: vi.fn() },
}));

// setup.ts 全局 mock 了 react-router-dom 的 Link（仅渲染 children，不产生锚点）。
// 键盘导航测试需要真实的 <a> 锚点，因此在测试文件内重新 mock，覆盖 setup 默认实现。
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}));

describe('ForgotPasswordPage Accessibility Tests', () => {
  const renderPage = () =>
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

  test('should have no accessibility violations', async () => {
    const { container } = renderPage();

    // 等待表单渲染完整（含 aria-label 的 role="form"）
    await waitFor(() => {
      expect(screen.getByRole('form')).toBeInTheDocument();
    });

    const results = await axe.run(container, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },
    });

    expect(results.violations).toEqual([]);
  }, 15000);

  test('should have proper keyboard navigation through the form', async () => {
    const user = userEvent.setup();
    renderPage();

    const emailInput = screen.getByPlaceholderText('请输入您的邮箱地址');
    const submitButton = screen.getByRole('button', { name: '发送重置链接' });
    // 两个 "返回登录" 链接：卡片头图标链接 + 表单下方文本链接
    const backLinks = screen.getAllByRole('link', { name: '返回登录' });

    // 聚焦邮箱输入框（autoFocus 已聚焦，此处显式聚焦以确保确定性）
    emailInput.focus();
    expect(emailInput).toHaveFocus();

    // Tab 1: 邮箱输入框 → 提交按钮
    await user.tab();
    expect(submitButton).toHaveFocus();

    // Tab 2: 提交按钮 → 表单下方的 "返回登录" 文本链接（DOM 顺序紧随提交按钮）
    await user.tab();
    expect(backLinks[1]).toHaveFocus();
    expect(backLinks[1]).toHaveAttribute('href', '/login');
  });

  test('should have proper ARIA attributes', async () => {
    renderPage();

    await waitFor(() => {
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-label', '找回密码表单');

      const emailInput = screen.getByPlaceholderText('请输入您的邮箱地址');
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('aria-required', 'true');

      const submitButton = screen.getByRole('button', { name: '发送重置链接' });
      expect(submitButton).toHaveAttribute('type', 'submit');
      expect(submitButton).toHaveAttribute('aria-label', '发送重置链接');
    });
  });

  test('should have proper labels for screen readers', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('邮箱地址')).toBeInTheDocument();
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '发送重置链接' })).toBeInTheDocument();
    });
  });

  test('should have skip link for accessibility', async () => {
    renderPage();

    await waitFor(() => {
      const skipLink = screen.getByText('跳转到找回密码表单');
      expect(skipLink).toHaveAttribute('href', '#rhine-forgot-form');
    });
  });

  test('should have proper form structure', async () => {
    renderPage();

    await waitFor(() => {
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();
    });
  });
});
