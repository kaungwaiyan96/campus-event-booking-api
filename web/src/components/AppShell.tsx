import type { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <div className="page-container header-content">
          <a className="brand" href="/">Campus Events</a>
          <nav aria-label="Primary">
            <a href="/">Events</a>
          </nav>
        </div>
      </header>
      <main className="page-container" id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="page-container">Campus Events</div>
      </footer>
    </div>
  );
}
