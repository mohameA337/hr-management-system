import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSubmit } from '../hooks/useSubmit';
import { FormAlert } from './ui';

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Runs once on open: Escape closes, focus moves into the dialog and back again on close.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKeyDown);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const firstInput = dialogRef.current?.querySelector<HTMLElement>('input, select, textarea');
    (firstInput ?? dialogRef.current)?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className={`modal ${wide ? 'modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="modal__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/** A modal containing a form: handles submit, the saving state and the error banner. */
export function FormModal({
  title,
  submitLabel = 'Save',
  onClose,
  onSubmit,
  formError,
  submitting,
  danger,
  wide,
  children,
}: {
  title: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: () => void;
  formError: string | null;
  submitting: boolean;
  danger?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  const formId = useId();
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <Modal
      title={title}
      onClose={onClose}
      wide={wide}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={formId} className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} disabled={submitting}>
            {submitting ? 'Saving…' : submitLabel}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate>
        <FormAlert message={formError} />
        {children}
      </form>
    </Modal>
  );
}

/** "Are you sure?" dialog. `onConfirm` may throw an API error, which is shown in the dialog. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const { submitting, errors, run } = useSubmit();
  return (
    <FormModal
      title={title}
      submitLabel={confirmLabel}
      danger={danger}
      submitting={submitting}
      formError={errors.message}
      onClose={onClose}
      onSubmit={() => void run(onConfirm)}
    >
      <p className="confirm-message">{message}</p>
    </FormModal>
  );
}
