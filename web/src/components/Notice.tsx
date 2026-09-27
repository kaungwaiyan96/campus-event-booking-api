import type { ReactNode } from 'react';

interface NoticeProps {
  tone?: 'error' | 'info';
  title: string;
  children?: ReactNode;
}

export function Notice({ tone = 'info', title, children }: NoticeProps) {
  return (
    <section className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'} aria-live="polite">
      <h2>{title}</h2>
      {children && <div className="notice-content">{children}</div>}
    </section>
  );
}
