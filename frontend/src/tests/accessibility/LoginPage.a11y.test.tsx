import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import axe from 'axe-core';
import LoginPage from '../../pages/auth/LoginPage';
import { useAuthStore } from '../../stores/auth';
vi.mock('../../stores/auth');
describe('LoginPage Accessibility Tests', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  beforeEach(() => {
    (useAuthStore as unknown as vi.Mock).mockReturnValue({
      login: vi.fn(),
    });
  });

  test('should have no accessibility violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

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

  test('should have proper keyboard navigation', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      const usernameInput = screen.getByPlaceholderText('请输入用户名');
      const passwordInput = screen.getByPlaceholderText('请输入密码');
      const loginButton = screen.getByRole('button', { name: '登录' });

      expect(usernameInput).not.toHaveAttribute('tabindex', '-1');
      expect(passwordInput).not.toHaveAttribute('tabindex', '-1');
      expect(loginButton).not.toHaveAttribute('tabindex', '-1');
    });
  });

  test('should have proper ARIA attributes', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      const loginButton = screen.getByRole('button', { name: '登录' });

      expect(loginButton).toHaveAttribute('type', 'submit');
      expect(loginButton).toHaveAttribute('aria-label', '登录');
    });
  });

  test('should have proper labels for screen readers', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('用户名')).toBeInTheDocument();
      expect(screen.getByLabelText('密码')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
    });
  });

  test('should have skip link for accessibility', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      const skipLink = screen.getByText('跳转到登录表单');
      expect(skipLink).toHaveAttribute('href', '#login-main-content');
      expect(skipLink).toHaveAttribute('tabindex', '0');
    });
  });

  test('should have proper form structure', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();
    });
  });
});
