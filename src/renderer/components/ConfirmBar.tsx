import { useEffect, useRef } from 'react';
import './confirm-bar.css';

// A question asked in place, before something is lost or replaced. Escape
// cancels; the safe choice gets focus first.
export function ConfirmBar({
  message,
  confirm,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirm: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);

  return (
    <div
      className="confirm-bar"
      role="alertdialog"
      aria-label={message}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onCancel();
        }
      }}
    >
      <p>{message}</p>
      <div className="confirm-bar-buttons">
        <button
          type="button"
          className="button button-danger"
          onClick={onConfirm}
        >
          {confirm}
        </button>
        <button
          type="button"
          className="button"
          ref={cancelRef}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
