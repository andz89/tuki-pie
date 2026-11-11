// The sizes the Screenshot tab offers, as in Chrome DevTools' device menu.
// The extension keeps the same devices with their user agents
// (packages/pie-extension/devices.js); a test checks they match.

export interface Device {
  name: string;
  width: number;
  height: number;
}

export const DEVICE_GROUPS: { label: string; devices: Device[] }[] = [
  {
    label: 'Mobile',
    devices: [
      { name: 'iPhone SE', width: 375, height: 667 },
      { name: 'iPhone 16', width: 393, height: 852 },
      { name: 'iPhone 16 Pro Max', width: 440, height: 956 },
      { name: 'Pixel 9', width: 412, height: 924 },
      { name: 'Pixel 9 Pro', width: 427, height: 952 },
      { name: 'Pixel 10', width: 412, height: 924 },
      { name: 'Samsung Galaxy A55', width: 360, height: 800 },
    ],
  },
  {
    label: 'Foldables',
    devices: [
      { name: 'Pixel 9 Pro Fold', width: 412, height: 922 },
      { name: 'Galaxy Z Fold 6', width: 412, height: 968 },
    ],
  },
  {
    label: 'Tablets',
    devices: [
      { name: 'iPad Mini', width: 768, height: 1024 },
      { name: 'iPad Pro 13', width: 1032, height: 1376 },
      { name: 'Surface Pro 10', width: 960, height: 1440 },
    ],
  },
  {
    label: 'Smart Displays',
    devices: [{ name: 'Nest Hub Max', width: 1280, height: 800 }],
  },
];

export const DEVICE_NAMES = DEVICE_GROUPS.flatMap((group) =>
  group.devices.map((device) => device.name),
);

// "" is the Chrome tab as it is.
export const DESKTOP = '';
