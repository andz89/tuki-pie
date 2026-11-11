import { useCallback, useEffect, useState } from 'react';
import type { ChromePairing, ChromeStatus } from '../../shared/types';
import { panelBridge } from './panel-bridge';

export const CHROME_STATUS_TEXT: Record<ChromeStatus, string> = {
  connected: 'Chrome connected',
  'not-connected': 'Chrome not connected',
  'port-in-use': 'Port in use by another program',
};

const NEW_CODE_WARNING =
  'Make a new pairing code? Chrome disconnects until you paste the new code into the extension.';

export function ChromeSection() {
  const [pairing, setPairing] = useState<ChromePairing | null>(null);
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const accept = useCallback(
    (result: Awaited<ReturnType<typeof panelBridge.chrome.get>>) => {
      if (result.ok) {
        setPairing(result.value);
        setProblem(null);
      } else {
        setProblem(result.error);
      }
    },
    [],
  );

  useEffect(() => {
    void panelBridge.chrome.get().then(accept);
    return panelBridge.chrome.onStatus((status) =>
      setPairing((current) => current && { ...current, status }),
    );
  }, [accept]);

  const copy = async () => {
    const result = await panelBridge.chrome.copyCode();
    setCopied(result.ok);
    if (result.ok) {
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const renew = async () => {
    if (window.confirm(NEW_CODE_WARNING)) {
      accept(await panelBridge.chrome.newCode());
      setCopied(false);
    }
  };

  return (
    <section className="panel-section" aria-labelledby="chrome-heading">
      <div className="section-heading">
        <h2 id="chrome-heading">Chrome</h2>
      </div>
      <p className="section-note">
        Page Info can check a website in Chrome, with your logins. In Chrome,
        open chrome://extensions, turn on Developer mode, choose Load unpacked,
        and pick the packages/pie-extension folder. Then paste this code into
        the extension's popup.
      </p>

      {problem && <p role="alert">{problem}</p>}

      {pairing && (
        <div className="chrome-pairing">
          <p
            className="chrome-status"
            data-status={pairing.status}
            role="status"
          >
            {CHROME_STATUS_TEXT[pairing.status]}
          </p>
          <div className="field">
            <label htmlFor="chrome-code">Pairing code</label>
            <div className="path-picker">
              <input
                id="chrome-code"
                type="text"
                readOnly
                spellCheck={false}
                value={pairing.code}
                onFocus={(event) => event.target.select()}
              />
              <button
                type="button"
                className="button-primary"
                onClick={() => void copy()}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => void renew()}
              >
                New code
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
