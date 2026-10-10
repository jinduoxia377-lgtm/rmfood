import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import LoginPage from '../pages/auth/LoginPage';
import { useAuthStore } from '../stores/auth';
// Mock stores
vi.mock('../stores/auth');
// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}));

describe('LoginPage', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  let mockLogin: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockLogin = vi.fn();
    // useAuthStore(selector) — 组件使用 useAuthStore((s) => s.login)，
    // mock 实现为 "调用 selector，传入 state 对象"
    (useAuthStore as unknown as { mockImplementation: (fn: unknown) => void }).mockImplementation(
      (selector: (s: { login: () => void }) => unknown) => selector({ login: mockLogin })
    );
  });

  test('renders login page', () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getAllByText('莱茵分子').length).toBeGreaterThan(0);
    expect(screen.getByText('欢迎回来')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入用户名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入平台' })).toBeInTheDocument();
  });

  test('validates form submission', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    const loginButton = screen.getByRole('button', { name: '进入平台' });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(mockLogin).not.toHaveBeenCalled();
    });
  });

  test('validates username length', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    const usernameInput = screen.getByPlaceholderText('请输入用户名');
    fireEvent.change(usernameInput, { target: { value: 'ab' } });

    const loginButton = screen.getByRole('button', { name: '进入平台' });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('用户名至少需要 3 个字符')).toBeInTheDocument();
    });
  });

  test('validates password length', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    const passwordInput = screen.getByPlaceholderText('请输入密码');
    fireEvent.change(passwordInput, { target: { value: '12345' } });

    const loginButton = screen.getByRole('button', { name: '进入平台' });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('密码至少需要 6 个字符')).toBeInTheDocument();
    });
  });

  test('submits login form successfully', async () => {
    const originalTimeout = setTimeout
    let navTimer: ReturnType<typeof setTimeout> | undefined
    ;(globalThis as { setTimeout: unknown }).setTimeout = ((fn: () => void, ms: number) => {
      if (ms === 1200) navTimer = originalTimeout(fn, 0)
      return originalTimeout(fn, ms) as unknown as ReturnType<typeof setTimeout>
    }) as typeof setTimeout

    mockLogin.mockResolvedValue(undefined)

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    // 填写用户名和密码
    const usernameInput = screen.getByPlaceholderText('请输入用户名');
    const passwordInput = screen.getByPlaceholderText('请输入密码');

    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'admin123' } });

    // 点击登录按钮
    const loginButton = screen.getByRole('button', { name: '进入平台' });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin', 'admin123');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    }, 5000);

    ;(globalThis as { setTimeout: unknown }).setTimeout = originalTimeout;
  });

  test('handles login failure', async () => {
    mockLogin.mockRejectedValue({ response: { status: 401 } });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    // 填写用户名和密码
    const usernameInput = screen.getByPlaceholderText('请输入用户名');
    const passwordInput = screen.getByPlaceholderText('请输入密码');

    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

    // 点击登录按钮
    const loginButton = screen.getByRole('button', { name: '进入平台' });
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('用户名或密码错误')).toBeInTheDocument();
    });
  });

  test('renders in dark mode', () => {

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getAllByText('莱茵分子').length).toBeGreaterThan(0);
    expect(screen.getByText('欢迎回来')).toBeInTheDocument();
  });

  test('has accessible form elements', () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    const loginButton = screen.getByRole('button', { name: '进入平台' });

    expect(loginButton).toHaveAttribute('aria-label');
  });

  test('toggles password visibility', () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    const passwordInput = screen.getByPlaceholderText('请输入密码');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByLabelText('显示密码');
    fireEvent.click(toggleButton);

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(toggleButton).toHaveAttribute('aria-label', '隐藏密码');
  });
});
