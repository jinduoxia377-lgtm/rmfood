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
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 60000,
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
    staleTime: 60000,
  });
}

export function invalidateQueries(queryKey: unknown[]): void {
  queryClient.invalidateQueries({ queryKey });
}

export function setQueryData<T>(queryKey: unknown[], data: T): void {
  queryClient.setQueryData(queryKey, data);
}
