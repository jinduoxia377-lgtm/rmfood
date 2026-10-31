import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import ResetPasswordPage from '../../pages/auth/ResetPasswordPage';

// Mock auth API — 组件通过 authApi.resetPassword(token, newPassword) 提交重置
vi.mock('@/api/auth', () => ({
  authApi: { resetPassword: vi.fn() },
}));

// setup.ts 全局 mock 了 react-router-dom 的 Link（仅渲染 children，不产生锚点）。
// 键盘导航 / 锚点断言需要真实 <a>，因此在测试文件内重新 mock，保留真实 router 行为。
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}));

describe('ResetPasswordPage Accessibility Tests', () => {
  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={['/auth/reset-password?token=abc123']}>
        <ResetPasswordPage />
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

    const newPw = screen.getByPlaceholderText('请输入新密码');
    const showPwBtn = screen.getByRole('button', { name: '显示密码' });
    const confirmPw = screen.getByPlaceholderText('请再次输入新密码');
    const showConfirmBtn = screen.getByRole('button', { name: '显示确认密码' });
    const submitBtn = screen.getByRole('button', { name: '重置密码' });

    // 聚焦新密码输入框（autoFocus 已聚焦，此处显式聚焦以确保确定性）
    newPw.focus();
    expect(newPw).toHaveFocus();

    // Tab 依次到达：新密码 → 显示密码按钮 → 确认密码 → 显示确认按钮 → 提交按钮
    await user.tab();
    expect(showPwBtn).toHaveFocus();

    await user.tab();
    expect(confirmPw).toHaveFocus();

    await user.tab();
    expect(showConfirmBtn).toHaveFocus();

    await user.tab();
    expect(submitBtn).toHaveFocus();
  });

  test('should have proper ARIA attributes', async () => {
    renderPage();

    await waitFor(() => {
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-label', '重置密码表单');

      const newPw = screen.getByPlaceholderText('请输入新密码');
      expect(newPw).toHaveAttribute('type', 'password');
      expect(newPw).toHaveAttribute('aria-required', 'true');

      const submitBtn = screen.getByRole('button', { name: '重置密码' });
      expect(submitBtn).toHaveAttribute('type', 'submit');
      expect(submitBtn).toHaveAttribute('aria-label', '重置密码');
    });
  });

  test('should have proper labels for screen readers', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('新密码')).toBeInTheDocument();
      expect(screen.getByLabelText('确认新密码')).toBeInTheDocument();
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '重置密码' })).toBeInTheDocument();
    });
  });

  test('should have skip link for accessibility', async () => {
    renderPage();

    await waitFor(() => {
      const skipLink = screen.getByText('跳转到重置密码表单');
      expect(skipLink).toHaveAttribute('href', '#rhine-reset-form');
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
