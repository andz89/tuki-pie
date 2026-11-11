import { useRef } from 'react';
import { DESKTOP, DEVICE_GROUPS } from '../../shared/devices';
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
      {shot === null ? (
        <div className="page-screenshot-start">
          <p className="info-note">
            A picture of the whole page, as Chrome shows it.
          </p>
          {takeButton('Take screenshot')}
        </div>
      ) : (
        <div className="link-summary">
          <p>
            <strong>
              {shot.device && `${shot.device}: `}
              {shot.width.toLocaleString()} x {shot.height.toLocaleString()} px
            </strong>{' '}
            · {fileSize(shot.bytes)}
          </p>
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
            <img src={shot.dataUrl} alt="The whole page" />
          </button>
          {/* A click anywhere, or Escape, closes it. */}
          <dialog
            ref={viewerRef}
            className="screenshot-viewer"
            aria-label="Screenshot at full size"
            onClick={() => viewerRef.current?.close()}
          >
            <img src={shot.dataUrl} alt="The whole page" />
          </dialog>
        </>
      )}
    </div>
  );
}
