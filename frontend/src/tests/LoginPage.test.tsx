import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from '../pages/auth/LoginPage';
import { useAuthStore } from '../stores/auth';
import { useTheme } from '../hooks/useTheme';

// Mock stores
jest.mock('../stores/auth');
jest.mock('../hooks/useTheme');

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
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

  beforeEach(() => {
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      login: jest.fn(),
    });
    
    (useTheme as unknown as jest.Mock).mockReturnValue({
      isDark: false,
      toggleTheme: jest.fn(),
    });
  });

  test('renders login page', () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('RMFOOD')).toBeInTheDocument();
    expect(screen.getByText('欢迎回来')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入用户名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入密码')).toBeInTheDocument();
    expect(screen.getByText('登录')).toBeInTheDocument();
  });

  test('validates form submission', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    const loginButton = screen.getByText('登录');
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('请输入用户名')).toBeInTheDocument();
      expect(screen.getByText('请输入密码')).toBeInTheDocument();
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
    
    const loginButton = screen.getByText('登录');
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('用户名至少需要3个字符')).toBeInTheDocument();
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
    
    const loginButton = screen.getByText('登录');
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('密码至少需要6个字符')).toBeInTheDocument();
    });
  });

  test('submits login form successfully', async () => {
    const mockLogin = jest.fn().mockResolvedValue({});
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      login: mockLogin,
    });

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
    const loginButton = screen.getByText('登录');
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin', 'admin123');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  test('handles login failure', async () => {
    const mockLogin = jest.fn().mockRejectedValue({ response: { status: 401 } });
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      login: mockLogin,
    });

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
    const loginButton = screen.getByText('登录');
    fireEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByText('用户名或密码错误')).toBeInTheDocument();
    });
  });

  test('renders in dark mode', () => {
    (useTheme as unknown as jest.Mock).mockReturnValue({
      isDark: true,
      toggleTheme: jest.fn(),
    });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('RMFOOD')).toBeInTheDocument();
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

    const usernameInput = screen.getByPlaceholderText('请输入用户名');
    const passwordInput = screen.getByPlaceholderText('请输入密码');
    const loginButton = screen.getByText('登录');

    expect(usernameInput).toHaveAttribute('aria-describedby');
    expect(passwordInput).toHaveAttribute('aria-describedby');
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

  test('toggles theme', () => {
    const mockToggleTheme = jest.fn();
    (useTheme as unknown as jest.Mock).mockReturnValue({
      isDark: false,
      toggleTheme: mockToggleTheme,
    });

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <LoginPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    const themeToggleButton = screen.getByTitle('切换到深色模式');
    fireEvent.click(themeToggleButton);

    expect(mockToggleTheme).toHaveBeenCalled();
  });
});
