import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, Modifier } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { CardControlsContext } from './InfoCard';
import {
  loadLayout,
  moveCard,
  saveLayout,
  toggleCollapsed,
} from './page-info-layout';
import type { CardId, CardLayout } from './page-info-layout';

// The pointer must move a little first, so a click on the handle stays a click.
const DRAG_DISTANCE_PX = 4;

// Cards sit in one column, so they only move up and down.
const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});

function SortableCard({
  id,
  collapsed,
  onToggle,
  children,
}: {
  id: CardId;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? 'info-card-slot is-dragging' : 'info-card-slot'}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <CardControlsContext.Provider
        value={{
          collapsed,
          onToggle,
          handleProps: { ...attributes, ...listeners },
        }}
      >
        {children}
      </CardControlsContext.Provider>
    </div>
  );
}

export function SortableCards({ cards }: { cards: Record<CardId, ReactNode> }) {
  const [layout, setLayout] = useState<CardLayout>(loadLayout);

  useEffect(() => {
    saveLayout(layout);
  }, [layout]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) {
      return;
    }
    setLayout((current) => ({
      ...current,
      order: moveCard(current.order, active.id as CardId, over.id as CardId),
    }));
  };

  const toggle = (id: CardId) =>
    setLayout((current) => ({
      ...current,
      collapsed: toggleCollapsed(current.collapsed, id),
    }));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={layout.order}
        strategy={verticalListSortingStrategy}
      >
        {layout.order.map((id) => (
          <SortableCard
            key={id}
            id={id}
            collapsed={layout.collapsed.includes(id)}
            onToggle={() => toggle(id)}
          >
            {cards[id]}
          </SortableCard>
        ))}
      </SortableContext>
    </DndContext>
  );
}
