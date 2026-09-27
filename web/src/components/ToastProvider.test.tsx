import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './ToastProvider';

function ToastTrigger() {
  const { notify } = useToast();
  return <>
    <button type="button" onClick={() => notify({ tone: 'success', message: 'Booking saved' })}>Show success</button>
    <button type="button" onClick={() => notify({ tone: 'error', message: 'Booking failed' })}>Show error</button>
  </>;
}

describe('ToastProvider', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('uses status for routine messages and allows manual dismissal', async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ToastTrigger /></ToastProvider>);

    await user.click(screen.getByRole('button', { name: /show success/i }));
    expect(screen.getByRole('status')).toHaveTextContent('Booking saved');

    await user.click(screen.getByRole('button', { name: /dismiss booking saved/i }));
    expect(screen.queryByText('Booking saved')).not.toBeInTheDocument();
  });

  it('uses alert for errors and dismisses feedback after five seconds', () => {
    vi.useFakeTimers();
    render(<ToastProvider><ToastTrigger /></ToastProvider>);

    act(() => screen.getByRole('button', { name: /show error/i }).click());
    expect(screen.getByRole('alert')).toHaveTextContent('Booking failed');

    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.queryByText('Booking failed')).not.toBeInTheDocument();
  });
});
