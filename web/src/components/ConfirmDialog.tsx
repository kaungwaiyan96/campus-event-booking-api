import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  pendingLabel?: string;
  isConfirming?: boolean;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
  onCancel(): void;
  onConfirm(): void;
}

export function ConfirmDialog({
  isOpen,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Keep booking',
  pendingLabel = 'Cancelling…',
  isConfirming = false,
  fallbackFocusRef,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      cancelButton.current?.focus();
      return;
    }

    if (previouslyFocused.current?.isConnected) {
      previouslyFocused.current.focus();
    } else {
      fallbackFocusRef?.current?.focus();
    }
    previouslyFocused.current = null;
  }, [fallbackFocusRef, isOpen]);

  useEffect(() => {
    if (isOpen && isConfirming) {
      dialog.current?.focus();
    }
  }, [isConfirming, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isConfirming) {
        onCancel();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isConfirming, isOpen, onCancel]);

  if (!isOpen) return null;

  const trapFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;

    const focusable = dialog.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;

    if (event.shiftKey && (current === first || !dialog.current?.contains(current))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (current === last || !dialog.current?.contains(current))) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="dialog-backdrop">
      <section ref={dialog} className="confirm-dialog" role="dialog" aria-modal="true" aria-busy={isConfirming} aria-labelledby="confirm-dialog-title" tabIndex={isConfirming ? -1 : undefined} onKeyDown={trapFocus}>
        <h2 id="confirm-dialog-title">{title}</h2>
        <div className="confirm-dialog-content">{children}</div>
        <div className="dialog-actions">
          <button ref={cancelButton} type="button" className="button-secondary" onClick={onCancel} disabled={isConfirming}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={isConfirming}>
            {isConfirming ? pendingLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
