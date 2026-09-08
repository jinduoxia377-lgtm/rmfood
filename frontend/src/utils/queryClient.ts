import { QueryClient, type DefaultOptions } from '@tanstack/react-query';

const defaultOptions: DefaultOptions = {
  queries: {
    retry: (failureCount, error) => {
      if (error && typeof error === 'object' && 'status' in error) {
        const status = error.status as number;
        if (status >= 500) {
          return failureCount < 2;
        }
        if (status === 429) {
          return failureCount < 1;
        }
      }
      return failureCount < 1;
    },
    // 🔒 P0: 延长 staleTime 至 5 分钟，减少重复 API 请求
    staleTime: 5 * 60 * 1000,
    // 🔒 P0: gcTime 延长至 10 分钟，延迟不活跃 query 的垃圾回收
    gcTime: 10 * 60 * 1000,
    // 🔒 P0: 移除 refetchOnMount: true，避免每次组件挂载都强制刷新
    //         仅在页面重新获得焦点时才刷新（更平滑的体验）
    refetchOnWindowFocus: 'always',
    refetchOnMount: false,
    refetchOnReconnect: true,
    // 🔒 P0: 网络不可用时使用缓存数据，不发起新请求
    networkMode: 'online',
  },
  mutations: {
    retry: 1,
  },
};

const createQueryClient = () => {
  return new QueryClient({
    defaultOptions,
  });
};

export const queryClient = createQueryClient();

export function prefetchQuery<T>(
  queryKey: unknown[],
  queryFn: () => Promise<T>,
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey,
    queryFn,
    // 🔒 P0: prefetch 也使用 5 分钟 staleTime，与默认策略一致
    staleTime: 5 * 60 * 1000,
  });
}

export function invalidateQueries(queryKey: unknown[]): void {
  queryClient.invalidateQueries({ queryKey });
}

export function setQueryData<T>(queryKey: unknown[], data: T): void {
  queryClient.setQueryData(queryKey, data);
}
