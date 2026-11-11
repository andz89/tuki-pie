import { createContext, useContext, useId } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import type { LimitedList } from '../../shared/page-audit';
import { PieIcon } from '../components/icons/SliceIcon';
import { moreNote } from './page-info-view';

// Given by the sortable wrapper, so each card gets a drag handle and a
// collapse button without passing them through every card component.
export interface CardControls {
  collapsed: boolean;
  onToggle: () => void;
  handleProps: HTMLAttributes<HTMLButtonElement>;
}

export const CardControlsContext = createContext<CardControls | null>(null);

interface InfoCardProps {
  title: string;
  count?: number;
  children: ReactNode;
}

export function InfoCard({ title, count, children }: InfoCardProps) {
  const controls = useContext(CardControlsContext);
  const bodyId = useId();
  const collapsed = controls?.collapsed ?? false;

  const heading = (
    <>
      {title}
      {count !== undefined && count > 0 && (
        <span className="info-count">{count}</span>
      )}
    </>
  );

  if (!controls) {
    return (
      <section className="info-card" aria-label={title}>
        <h2>{heading}</h2>
        {children}
      </section>
    );
  }

  return (
    <section
      className={collapsed ? 'info-card is-collapsed' : 'info-card'}
      aria-label={title}
    >
      <div className="info-card-header">
        <button
          type="button"
          className="drag-handle"
          aria-label={`Drag ${title}`}
          title="Drag to reorder"
          {...controls.handleProps}
        >
          ⠿
        </button>
        <h2>
          <button
            type="button"
            className="info-card-toggle"
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            title={collapsed ? 'Show' : 'Hide'}
            onClick={controls.onToggle}
          >
            {heading}
            <span className="info-card-chevron">
              <PieIcon type="chevron" size={14} />
            </span>
          </button>
        </h2>
      </div>
      <div id={bodyId} className="info-card-body" hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}

export function InfoGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="info-group">
      <h3>{label}</h3>
      {children}
    </div>
  );
}

export function InfoEmpty({ children }: { children: ReactNode }) {
  return <p className="info-empty">{children}</p>;
}

export function MoreNote({ list }: { list: LimitedList<unknown> }) {
  const note = moreNote(list);
  return note ? <p className="info-more">{note}</p> : null;
}
