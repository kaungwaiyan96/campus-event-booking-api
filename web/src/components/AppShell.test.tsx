import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('presents the academic product identity and public navigation', () => {
    render(<MemoryRouter><AppShell><p>Page body</p></AppShell></MemoryRouter>);
    expect(screen.getByRole('link', { name: /campus events/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument();
    expect(screen.getByText('Page body')).toBeInTheDocument();
  });
});
