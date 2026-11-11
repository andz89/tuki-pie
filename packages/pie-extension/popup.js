const STATUS = {
  connected: ['Connected', 'Page Info can check websites in this Chrome.'],
  'not-connected': [
    'Not connected',
    'Open Pie Launcher. Linking up can take about 30 seconds.',
  ],
  'no-code': ['Not connected', 'Paste the pairing code to connect.'],
  'bad-code': [
    "Pairing code doesn't match",
    'Paste the code from Pie Launcher Settings again.',
  ],
  replaced: [
    'Another Chrome profile is connected',
    'Press Connect to use this one instead.',
  ],
};
const CAN_CONNECT = new Set(['not-connected', 'replaced']);

const status = document.getElementById('status');
const note = document.getElementById('status-note');
const form = document.getElementById('pair');
const input = document.getElementById('code');
const connect = document.getElementById('connect');

function show(state) {
  const [title, text] = STATUS[state] ?? STATUS['no-code'];
  status.textContent = title;
  status.dataset.state = state ?? 'no-code';
  note.textContent = text;
  connect.hidden = !CAN_CONNECT.has(state);
}

chrome.storage.local
  .get(['pieCode', 'pieStatus'])
  .then(({ pieCode, pieStatus }) => {
    input.value = pieCode ?? '';
    show(pieStatus);
  });

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.pieStatus) {
    show(changes.pieStatus.newValue);
  }
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void chrome.storage.local.set({ pieCode: input.value.trim() });
});

connect.addEventListener('click', () => {
  void chrome.storage.local.set({ pieConnectAt: Date.now() });
});
