import { useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

interface InlineEditProps {
  value: string;
  label: string;
  placeholder?: string;
  maxLength: number;
  className?: string;
  onSave: (value: string) => void;
  children: ReactNode;
}

// Text that turns into a field on click. Enter or clicking away saves, Esc
// cancels.
export function InlineEdit({
  value,
  label,
  placeholder,
  maxLength,
  className = '',
  onSave,
  children,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const isDone = useRef(false);

  if (!isEditing) {
    return (
      <button
        type="button"
        className={`inline-edit ${className}`}
        title="Click to change"
        aria-label={label}
        onClick={() => {
          isDone.current = false;
          setIsEditing(true);
        }}
      >
        {children}
      </button>
    );
  }

  const finish = (text: string, isSaved: boolean) => {
    if (isDone.current) {
      return;
    }
    isDone.current = true;
    setIsEditing(false);
    if (isSaved && text !== value) {
      onSave(text);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(event.currentTarget.value, true);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      finish(event.currentTarget.value, false);
    }
  };

  return (
    <input
      type="text"
      className="inline-edit-input"
      aria-label={label}
      defaultValue={value}
      placeholder={placeholder}
      maxLength={maxLength}
      autoFocus
      onFocus={(event) => event.target.select()}
      onBlur={(event) => finish(event.target.value, true)}
      onKeyDown={onKeyDown}
    />
  );
}
