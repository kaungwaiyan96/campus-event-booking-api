import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';

interface UseModalDialogOptions {
  isOpen: boolean;
  isPending?: boolean;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
  onClose(): void;
}

export function useModalDialog({ isOpen, isPending = false, fallbackFocusRef, onClose }: UseModalDialogOptions) {
  const dialogRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    headingRef.current?.focus();
    const background = Array.from(document.body.children).filter((element) => !element.contains(dialogRef.current));
    const previous = background.map((element) => ({
      element,
      ariaHidden: element.getAttribute('aria-hidden'),
      inert: (element as HTMLElement).inert,
    }));

    previous.forEach(({ element }) => {
      (element as HTMLElement).inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    document.body.classList.add('dialog-open');

    return () => {
      previous.forEach(({ element, ariaHidden, inert }) => {
        (element as HTMLElement).inert = inert;
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      });
      document.body.classList.remove('dialog-open');

      if (previouslyFocused.current?.isConnected) previouslyFocused.current.focus();
      else fallbackFocusRef?.current?.focus();
      previouslyFocused.current = null;
    };
  }, [fallbackFocusRef, isOpen]);

  useEffect(() => {
    if (!isOpen || !isPending) return;
    dialogRef.current?.focus();
  }, [isOpen, isPending]);

  useEffect(() => {
    if (!isOpen || isPending) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isPending, onClose]);

  const trapFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;

    if (event.shiftKey && (current === first || current === headingRef.current || !dialogRef.current?.contains(current))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (current === last || current === headingRef.current || !dialogRef.current?.contains(current))) {
      event.preventDefault();
      first.focus();
    }
  };

  return { dialogRef, headingRef, trapFocus };
}
