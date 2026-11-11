import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { useEffect, useRef, useState } from 'react';
import { MAX_SHORTCUTS_PER_ROW } from '../../shared/schemas/shortcut.schema';
import type { Shortcut } from '../../shared/types';
import { SliceIcon } from '../components/icons/SliceIcon';
import type { PieIconName } from '../components/icons/SliceIcon';
import { ShortcutForm } from './ShortcutForm';
import type { ShortcutFormTarget } from './ShortcutForm';
import { isAppRequest, isSnippetRequest } from './form-request';
import { usePanelStore } from './panel.store';
import { TOP_ROW_END, dropSpot } from './shortcut-drop';
import type { DropSpot } from './shortcut-drop';

const ROW_ICONS: Record<Shortcut['type'], PieIconName> = {
  link: 'shortcut',
  path: 'folder',
  app: 'app',
  group: 'folder',
};

const TYPE_NAMES: Record<Shortcut['type'], string> = {
  link: 'Link',
  path: 'Local',
  app: 'App',
  group: 'Group',
};

interface ShortcutRowProps {
  item: Shortcut;
  index: number;
  rowLength: number;
  isNested: boolean;
  childCount: number;
  onEdit: () => void;
  onAddInside?: () => void;
  mark: DropSpot['mark'] | null;
}

// The pointer must move a little first, so a click on a button stays a click.
const DRAG_DISTANCE_PX = 4;

// The pointer decides where a drop goes. The keyboard has no pointer, so it
// uses the nearest row.
const findDropTarget: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  return under.length > 0 ? under : closestCenter(args);
};

const MARK_CLASSES: Record<DropSpot['mark'], string> = {
  inside: 'is-drop-inside',
  before: 'is-drop-before',
  after: 'is-drop-after',
};

function ShortcutRow({
  item,
  index,
  rowLength,
  isNested,
  childCount,
  onEdit,
  onAddInside,
  mark,
}: ShortcutRowProps) {
  const drag = useDraggable({ id: item.id });
  const drop = useDroppable({ id: item.id });
  const setRef = (node: HTMLLIElement | null) => {
    drag.setNodeRef(node);
    drop.setNodeRef(node);
  };
  const classes = [
    'slice-row',
    'has-handle',
    isNested && 'is-nested',
    drag.isDragging && 'is-dragging',
    mark && MARK_CLASSES[mark],
  ].filter(Boolean);

  const moveShortcut = usePanelStore((state) => state.moveShortcut);
  const removeShortcut = usePanelStore((state) => state.removeShortcut);

  const remove = () => {
    const inside = childCount === 1 ? '1 shortcut' : `${childCount} shortcuts`;
    if (
      childCount === 0 ||
      window.confirm(`Remove ${item.label} and the ${inside} inside it?`)
    ) {
      void removeShortcut(item.id);
    }
  };

  return (
    <li ref={setRef} className={classes.join(' ')}>
      <button
        type="button"
        className="drag-handle"
        aria-label={`Drag ${item.label}`}
        title="Drag to move"
        {...drag.attributes}
        {...drag.listeners}
      >
        ⠿
      </button>
      <span className="slice-row-icon">
        <SliceIcon type={ROW_ICONS[item.type]} x={0} y={0} />
      </span>
      <div className="slice-row-text">
        <div className="slice-row-label">{item.label}</div>
        <div className="slice-row-path" title={item.target ?? undefined}>
          {item.target ?? `${childCount} of ${MAX_SHORTCUTS_PER_ROW}`}
        </div>
      </div>
      <span className="slice-row-type">{TYPE_NAMES[item.type]}</span>
      <div className="slice-row-actions">
        <button
          type="button"
          className="button-icon"
          aria-label={`Move ${item.label} earlier`}
          disabled={index === 0}
          onClick={() => void moveShortcut(item.id, -1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="button-icon"
          aria-label={`Move ${item.label} later`}
          disabled={index === rowLength - 1}
          onClick={() => void moveShortcut(item.id, 1)}
        >
          ↓
        </button>
        {onAddInside && (
          <button
            type="button"
            className="button-quiet"
            aria-label={`Add a shortcut to ${item.label}`}
            disabled={childCount >= MAX_SHORTCUTS_PER_ROW}
            onClick={onAddInside}
          >
            Add
          </button>
        )}
        <button
          type="button"
          className="button-quiet"
          aria-label={`Edit ${item.label}`}
          onClick={onEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="button-quiet"
          aria-label={`Remove ${item.label}`}
          onClick={remove}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

function TopRowEnd({ isMarked }: { isMarked: boolean }) {
  const { setNodeRef } = useDroppable({ id: TOP_ROW_END });
  return (
    <li
      ref={setNodeRef}
      className={isMarked ? 'drop-zone is-drop-inside' : 'drop-zone'}
    >
      Drop here to take it out of the group
    </li>
  );
}

// Links and groups. Apps have their own tab.
export function ShortcutSection() {
  const allShortcuts = usePanelStore((state) => state.shortcuts);
  const shortcuts = allShortcuts.filter((item) => item.type !== 'app');
  const placeShortcut = usePanelStore((state) => state.placeShortcut);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor),
  );
  const formRequest = usePanelStore((state) => state.formRequest);
  const clearFormRequest = usePanelStore((state) => state.clearFormRequest);

  const sectionRef = useRef<HTMLElement>(null);
  const [formTarget, setFormTarget] = useState<ShortcutFormTarget | null>(null);
  // A new key starts a fresh form, even if one is already open.
  const [formKey, setFormKey] = useState(0);

  const openForm = (target: ShortcutFormTarget) => {
    setFormTarget(target);
    setFormKey((key) => key + 1);
  };

  // Requests come from the circles on the donut.
  useEffect(() => {
    if (
      !formRequest ||
      isSnippetRequest(formRequest) ||
      isAppRequest(formRequest)
    ) {
      return;
    }
    sectionRef.current?.scrollIntoView({ block: 'start' });
    if (formRequest.kind === 'shortcut') {
      openForm({ mode: 'new-shortcut', parentId: formRequest.parentId });
    } else if (formRequest.kind === 'group') {
      openForm({ mode: 'new-group' });
    }
    clearFormRequest();
  }, [formRequest, clearFormRequest]);

  const topRow = shortcuts.filter((item) => item.parentId === null);
  const childrenOf = (id: string) =>
    shortcuts.filter((item) => item.parentId === id);
  const isFull = topRow.length >= MAX_SHORTCUTS_PER_ROW;

  const dragged = shortcuts.find((item) => item.id === draggedId) ?? null;
  const spot =
    draggedId !== null && overId !== null
      ? dropSpot(shortcuts, draggedId, overId)
      : null;
  const markFor = (id: string) => (spot?.markId === id ? spot.mark : null);

  const endDrag = () => {
    setDraggedId(null);
    setOverId(null);
  };
  const onDragStart = ({ active }: DragStartEvent) => {
    setDraggedId(String(active.id));
  };
  const onDragOver = ({ over }: DragOverEvent) => {
    setOverId(over ? String(over.id) : null);
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const landing = over
      ? dropSpot(shortcuts, String(active.id), String(over.id))
      : null;
    endDrag();
    if (landing) {
      void placeShortcut(String(active.id), landing.parentId, landing.index);
    }
  };

  return (
    <section
      ref={sectionRef}
      className="panel-section"
      aria-labelledby="shortcuts-heading"
    >
      <div className="section-heading">
        <h2 id="shortcuts-heading">Shortcuts</h2>
        <span className="section-count">
          {topRow.length} of {MAX_SHORTCUTS_PER_ROW}
        </span>
        <button
          type="button"
          className="button"
          disabled={isFull}
          onClick={() => openForm({ mode: 'new-group' })}
        >
          Add group
        </button>
        <button
          type="button"
          className="button-primary"
          disabled={isFull}
          onClick={() => openForm({ mode: 'new-shortcut', parentId: null })}
        >
          Add shortcut
        </button>
      </div>

      {formTarget !== null && (
        <ShortcutForm
          key={formKey}
          target={formTarget}
          onClose={() => setFormTarget(null)}
        />
      )}

      {shortcuts.length === 0 ? (
        <p className="panel-hint">No shortcuts yet.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={findDropTarget}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={endDrag}
        >
          <ol className="slice-list">
            {topRow.flatMap((item, index) => {
              const children = childrenOf(item.id);
              return [
                <ShortcutRow
                  key={item.id}
                  item={item}
                  index={index}
                  rowLength={topRow.length}
                  isNested={false}
                  childCount={children.length}
                  mark={markFor(item.id)}
                  onEdit={() => openForm({ mode: 'edit', shortcut: item })}
                  onAddInside={
                    item.type === 'group'
                      ? () =>
                          openForm({ mode: 'new-shortcut', parentId: item.id })
                      : undefined
                  }
                />,
                ...children.map((child, childIndex) => (
                  <ShortcutRow
                    key={child.id}
                    item={child}
                    index={childIndex}
                    rowLength={children.length}
                    isNested
                    childCount={0}
                    mark={markFor(child.id)}
                    onEdit={() => openForm({ mode: 'edit', shortcut: child })}
                  />
                )),
              ];
            })}
            {dragged !== null && dragged.parentId !== null && (
              <TopRowEnd isMarked={spot?.markId === TOP_ROW_END} />
            )}
          </ol>
          <DragOverlay>
            {dragged && <div className="drag-preview">{dragged.label}</div>}
          </DragOverlay>
        </DndContext>
      )}
    </section>
  );
}
