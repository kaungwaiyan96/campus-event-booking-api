import { type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useModalDialog } from './useModalDialog';

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
  const { dialogRef: dialog, headingRef: heading, trapFocus } = useModalDialog({
    isOpen,
    isPending: isConfirming,
    fallbackFocusRef,
    onClose: onCancel,
  });

  if (!isOpen) return null;

  return createPortal(
    <div className="dialog-backdrop">
      <section ref={dialog} className="confirm-dialog" role="dialog" aria-modal="true" aria-busy={isConfirming} aria-labelledby="confirm-dialog-title" tabIndex={isConfirming ? -1 : undefined} onKeyDown={trapFocus}>
        <h2 ref={heading} id="confirm-dialog-title" tabIndex={-1}>{title}</h2>
        <div className="confirm-dialog-content">{children}</div>
        <div className="dialog-actions">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={isConfirming}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={isConfirming}>
            {isConfirming ? pendingLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
