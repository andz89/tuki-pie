import { createActiveTab } from './active-tab.js';
import { createConnection, createRequestHandler } from './connection.js';
import { watchTabs } from './events.js';
import { createHistorySearch } from './history.js';
import { createImageFetcher } from './image.js';
import { createSuggestionStore } from './suggestions-store.js';
import { createTabs } from './tabs.js';

const ALARM = 'pie-connect';

let connection = null;
const sendEvent = (name, site) => connection?.sendEvent(name, site);

const tabs = createTabs({ chrome, sendEvent });
const activeTab = createActiveTab({ chrome, sendEvent });
const suggestions = createSuggestionStore(chrome.storage.local);

connection = createConnection({
  openSocket: (url) => new WebSocket(url),
  storage: chrome.storage.local,
  onRequest: createRequestHandler({
    open: tabs.open,
    reload: tabs.reload,
    stop: tabs.stop,
    read: tabs.read,
    goToTab: tabs.goToTab,
    showLink: tabs.showLink,
    openTabs: tabs.openTabs,
    activeTab: tabs.activeTab,
    capture: tabs.capture,
    forget: tabs.forget,
    setSuggestions: suggestions.save,
    image: createImageFetcher(),
    history: createHistorySearch(chrome),
    readActive: activeTab.readActive,
    showActiveLink: activeTab.showActiveLink,
    highlightActive: activeTab.highlightActive,
  }),
});

watchTabs({ chrome, tabs, sendEvent });
activeTab.watch();

// Wakes the worker every 30 seconds to connect when Pie Launcher wasn't
// running yet. The shortest period Chrome allows.
chrome.alarms.create(ALARM, { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) {
    void connection.connect();
  }
});

// Starting Chrome takes over again, even from another profile.
chrome.runtime.onStartup.addListener(() => connection.reconnect());
chrome.runtime.onInstalled.addListener(() => void connection.connect());

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.pieCode || changes.pieConnectAt)) {
    connection.reconnect();
  }
});

void connection.connect();
