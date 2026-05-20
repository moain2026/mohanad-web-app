/**
 * Test render helper — wraps children in the providers our components
 * depend on (React-Query, ToastProvider, MemoryRouter).
 *
 * Use this in vitest specs that test components which call `useQuery` /
 * `useMutation` or `useToast`. Each `renderWithProviders` call creates a
 * **fresh** QueryClient so cached data never leaks between tests.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type RenderOptions, render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ToastProvider } from '@/components/ui/Toast';

interface ProvidersOptions {
  /** Initial entries for the MemoryRouter (defaults to ['/']). */
  initialEntries?: string[];
  /** Provide a pre-configured QueryClient to share state across renders. */
  queryClient?: QueryClient;
}

/** Build a QueryClient with retry disabled so failures surface fast. */
export function buildTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface AllProvidersProps {
  children: ReactNode;
  initialEntries: string[];
  queryClient: QueryClient;
}

function AllProviders({ children, initialEntries, queryClient }: AllProvidersProps): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

/**
 * Render `ui` wrapped with QueryClientProvider + ToastProvider + MemoryRouter.
 * Returns the result of `@testing-library/react`'s `render` plus the
 * `queryClient` used (so tests can directly invalidate / inspect cache).
 */
export function renderWithProviders(
  ui: ReactElement,
  options: ProvidersOptions & Omit<RenderOptions, 'wrapper'> = {},
): ReturnType<typeof render> & { queryClient: QueryClient } {
  const { initialEntries = ['/'], queryClient = buildTestQueryClient(), ...rest } = options;

  const result = render(ui, {
    wrapper: ({ children }) => (
      <AllProviders initialEntries={initialEntries} queryClient={queryClient}>
        {children}
      </AllProviders>
    ),
    ...rest,
  });

  return { ...result, queryClient };
}
