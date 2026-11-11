import { usePanelStore } from './panel.store';

export function AllowedAppsSection() {
  const allowedApps = usePanelStore((state) => state.allowedApps);
  const removeAllowedApp = usePanelStore((state) => state.removeAllowedApp);

  return (
    <section className="panel-section" aria-labelledby="allowed-heading">
      <div className="section-heading">
        <h2 id="allowed-heading">Allowed apps</h2>
      </div>
      <p className="section-note">
        Only apps on this list can open from the donut. An app is added when you
        save it as a shortcut.
      </p>

      {allowedApps.length === 0 ? (
        <p className="section-empty">No apps allowed yet.</p>
      ) : (
        <ul className="allowed-list">
          {allowedApps.map((path) => (
            <li className="allowed-row" key={path}>
              <span className="allowed-path" title={path}>
                {path}
              </span>
              <button
                type="button"
                className="button-quiet"
                aria-label={`Remove ${path} from allowed apps`}
                onClick={() => void removeAllowedApp(path)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
