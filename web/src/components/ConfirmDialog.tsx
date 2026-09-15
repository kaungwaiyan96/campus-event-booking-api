import { useEffect, useRef, type ReactNode } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  isConfirming?: boolean;
  onCancel(): void;
  onConfirm(): void;
}

export function ConfirmDialog({
  isOpen,
  title,
  children,
  confirmLabel,
  isConfirming = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    cancelButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isConfirming) {
        onCancel();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isConfirming, isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="dialog-backdrop">
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <h2 id="confirm-dialog-title">{title}</h2>
        <div className="confirm-dialog-content">{children}</div>
        <div className="dialog-actions">
          <button ref={cancelButton} type="button" className="button-secondary" onClick={onCancel} disabled={isConfirming}>
            Keep booking
          </button>
          <button type="button" onClick={onConfirm} disabled={isConfirming}>
            {isConfirming ? 'Cancelling…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
