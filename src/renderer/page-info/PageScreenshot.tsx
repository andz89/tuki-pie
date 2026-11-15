import { useRef } from 'react';
import { DESKTOP, DEVICE_GROUPS } from '../../shared/devices';
import {
  SECTION_KINDS,
  SECTION_KIND_LABELS,
} from '../../shared/section-selector';
import type { SectionKind } from '../../shared/section-selector';
import { MAX_SECTION_SELECTOR } from '../../shared/types';
import { usePageInfoStore } from './page-info.store';

const STITCHED_NOTE =
  "Chrome didn't allow a one-pass capture here, so the page was scrolled and stitched. Fixed headers appear once, at the top.";

export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Picks the size, as in Chrome's device menu, and whether the page loads
// again as that device first.
function SizePicker({ disabled }: { disabled: boolean }) {
  const { device, reload } = usePageInfoStore((state) => state.captureSize);
  const setSize = usePageInfoStore((state) => state.setCaptureSize);
  return (
    <div className="screenshot-size">
      <label>
        View as{' '}
        <select
          value={device}
          disabled={disabled}
          onChange={(event) => setSize({ device: event.target.value })}
        >
          <option value={DESKTOP}>Desktop (the Chrome tab as it is)</option>
          {DEVICE_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.devices.map((each) => (
                <option key={each.name} value={each.name}>
                  {each.name} ({each.width} x {each.height})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {device !== DESKTOP && (
        <label className="screenshot-reload">
          <input
            type="checkbox"
            checked={reload}
            disabled={disabled}
            onChange={(event) => setSize({ reload: event.target.checked })}
          />
          <span>
            Reload the page as this device first
            <span className="info-note">
              Use this if the picture still looks like desktop. Anything typed
              into the page is lost.
            </span>
          </span>
        </label>
      )}
    </div>
  );
}

// What the field asks for in each kind.
const SECTION_HELP: Record<SectionKind, { placeholder: string; note: string }> =
  {
    class: {
      placeholder: 'et_pb_section et_flex_section',
      note: 'One or more class names of the same element, without periods.',
    },
    id: {
      placeholder: 'hero',
      note: "The element's id, without #.",
    },
    mixed: {
      placeholder: '.pricing #hero',
      note: 'Put a period before each class (.name) and a # before each id (#name).',
    },
  };

// One part of the page instead of all of it: class names, an id, or both as
// CSS. Enter takes the picture, like the button.
function SectionField({
  disabled,
  onEnter,
}: {
  disabled: boolean;
  onEnter: () => void;
}) {
  const section = usePageInfoStore((state) => state.captureSize.section);
  const setSize = usePageInfoStore((state) => state.setCaptureSize);
  const kind = usePageInfoStore((state) => state.sectionKind);
  const setKind = usePageInfoStore((state) => state.setSectionKind);
  const help = SECTION_HELP[kind];
  return (
    <div className="screenshot-section">
      <span id="screenshot-section-label">Section</span>
      <div className="screenshot-section-row">
        <select
          value={kind}
          disabled={disabled}
          aria-label="Section is given as"
          onChange={(event) => setKind(event.target.value as SectionKind)}
        >
          {SECTION_KINDS.map((each) => (
            <option key={each} value={each}>
              {SECTION_KIND_LABELS[each]}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={section}
          disabled={disabled}
          maxLength={MAX_SECTION_SELECTOR}
          spellCheck={false}
          placeholder={help.placeholder}
          aria-labelledby="screenshot-section-label"
          aria-describedby="screenshot-section-note"
          onChange={(event) => setSize({ section: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onEnter();
            }
          }}
        />
      </div>
      <span id="screenshot-section-note" className="info-note">
        {help.note} Leave empty for the whole page.
      </span>
    </div>
  );
}

// The whole checked page as a picture. Only the button takes one: opening
// this tab never does, since it brings the Chrome tab forward for a moment.
export function PageScreenshot({
  chromeConnected,
}: {
  chromeConnected: boolean;
}) {
  const screenshot = usePageInfoStore((state) => state.screenshot);
  const take = usePageInfoStore((state) => state.takeScreenshot);
  const save = usePageInfoStore((state) => state.saveScreenshot);
  const copy = usePageInfoStore((state) => state.copyScreenshot);
  const viewerRef = useRef<HTMLDialogElement>(null);
  const { status, shot, problem, notice } = screenshot;
  const taking = status === 'taking';

  const takeButton = (label: string) => (
    <button
      type="button"
      className="link-button button-on"
      disabled={!chromeConnected || taking}
      onClick={() => void take()}
    >
      {label}
    </button>
  );

  return (
    <div className="page-screenshot">
      <SizePicker disabled={taking} />
      <SectionField
        disabled={taking}
        onEnter={() => {
          if (chromeConnected) {
            void take();
          }
        }}
      />
      {shot === null ? (
        <div className="page-screenshot-start">
          <p className="info-note">
            A picture of the whole page, or of one section, as Chrome shows it.
          </p>
          {takeButton('Take screenshot')}
        </div>
      ) : (
        <div className="link-summary">
          <p>
            <strong>
              {shot.device && `${shot.device}: `}
              {shot.section && `Section ${shot.section}: `}
              {shot.width.toLocaleString()} x {shot.height.toLocaleString()} px
            </strong>{' '}
            · {fileSize(shot.bytes)}
          </p>
          {shot.matches !== null && shot.matches > 1 && (
            <p className="info-note">
              {shot.matches.toLocaleString()} elements match. This is the first.
            </p>
          )}
          <div className="link-actions">
            {takeButton('Retake')}
            <button
              type="button"
              className="link-button"
              disabled={taking}
              onClick={() => void save()}
            >
              Save
            </button>
            <button
              type="button"
              className="link-button"
              disabled={taking}
              onClick={() => void copy()}
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {!chromeConnected && <p className="info-note">Chrome not connected.</p>}
      {taking && <p role="status">Taking the screenshot…</p>}
      {problem && <p role="alert">{problem}</p>}
      {notice && <p role="status">{notice}</p>}

      {shot !== null && (
        <>
          {shot.stitched && (
            <p className="info-note">
              {STITCHED_NOTE}
              {shot.stitchReason && ` Chrome said: ${shot.stitchReason}`}
            </p>
          )}
          <button
            type="button"
            className="page-screenshot-image"
            aria-label="Show at full size"
            title="Show at full size"
            onClick={() => viewerRef.current?.showModal()}
          >
            <img src={shot.imageUrl} alt="The whole page" />
          </button>
          {/* A click anywhere, or Escape, closes it. */}
          <dialog
            ref={viewerRef}
            className="screenshot-viewer"
            aria-label="Screenshot at full size"
            onClick={() => viewerRef.current?.close()}
          >
            <img src={shot.imageUrl} alt="The whole page" />
          </dialog>
        </>
      )}
    </div>
  );
}
