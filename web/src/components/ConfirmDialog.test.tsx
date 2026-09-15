import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

function DialogExample() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>Cancel booking for Cloud Computing Workshop</button>
      <ConfirmDialog
        isOpen={isOpen}
        title="Cancel booking"
        confirmLabel="Confirm cancellation"
        onCancel={() => setIsOpen(false)}
        onConfirm={() => setIsOpen(false)}
      >
        <p>Are you sure?</p>
      </ConfirmDialog>
    </>
  );
}

describe('ConfirmDialog', () => {
  afterEach(cleanup);

  it('traps Tab and Shift+Tab inside the open dialog', async () => {
    const user = userEvent.setup();
    render(<DialogExample />);

    await user.click(screen.getByRole('button', { name: /cancel booking for cloud/i }));
    const keepBooking = screen.getByRole('button', { name: /keep booking/i });
    const confirmCancellation = screen.getByRole('button', { name: /confirm cancellation/i });

    expect(keepBooking).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirmCancellation).toHaveFocus();
    await user.tab();
    expect(keepBooking).toHaveFocus();
  });

  it.each([
    ['the cancellation button', async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: /keep booking/i }))],
    ['Escape', async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}')],
    ['confirmation', async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: /confirm cancellation/i }))],
  ])('returns focus to the cancellation trigger after %s closes the dialog', async (_path, closeDialog) => {
    const user = userEvent.setup();
    render(<DialogExample />);
    const trigger = screen.getByRole('button', { name: /cancel booking for cloud/i });

    await user.click(trigger);
    await closeDialog(user);

    expect(trigger).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
