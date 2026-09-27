import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ApiProvider } from '../api/ApiProvider';
import { AuthProvider } from '../auth/AuthProvider';

function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <AuthProvider>
        <ApiProvider>{children}</ApiProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

export function renderWithAppProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: AppProviders, ...options });
}
