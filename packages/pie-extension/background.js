import { createConnection, createRequestHandler } from './connection.js';
import { watchTabs } from './events.js';
import { createSuggestionStore } from './suggestions-store.js';
import { createTabs } from './tabs.js';

const ALARM = 'pie-connect';

let connection = null;
const sendEvent = (name) => connection?.sendEvent(name);

const tabs = createTabs({ chrome, sendEvent });
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
    setSuggestions: suggestions.save,
  }),
});

watchTabs({ chrome, tabs, sendEvent });

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
