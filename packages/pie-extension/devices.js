// The devices in Chrome DevTools' device toolbar, ported from tuki, with the
// sizes, pixel ratios and user agents from Chrome's own list (devtools-frontend
// EmulatedDevices.ts). %s in a user agent is the running Chrome version.
// Pie Launcher lists the same names and sizes in src/shared/devices.ts.

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const android = (model, version = 14) =>
  `Mozilla/5.0 (Linux; Android ${version}; ${model}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/%s Mobile Safari/537.36`;

export const DEVICES = {
  'iPhone SE': { width: 375, height: 667, userAgent: IPHONE },
  'iPhone 16': { width: 393, height: 852, userAgent: IPHONE },
  'iPhone 16 Pro Max': { width: 440, height: 956, userAgent: IPHONE },
  'Pixel 9': { width: 412, height: 924, userAgent: android('Pixel 9') },
  'Pixel 9 Pro': { width: 427, height: 952, userAgent: android('Pixel 9 Pro') },
  'Pixel 10': { width: 412, height: 924, userAgent: android('Pixel 10', 16) },
  'Samsung Galaxy A55': {
    width: 360,
    height: 800,
    userAgent: android('SM-A556B'),
  },
  'Pixel 9 Pro Fold': {
    width: 412,
    height: 922,
    userAgent: android('Pixel 9 Pro Fold'),
  },
  'Galaxy Z Fold 6': {
    width: 412,
    height: 968,
    userAgent: android('SM-F956U'),
  },
  'iPad Mini': {
    width: 768,
    height: 1024,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  },
  'iPad Pro 13': {
    width: 1032,
    height: 1376,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  },
  'Surface Pro 10': {
    width: 960,
    height: 1440,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/%s Safari/537.36',
  },
  'Nest Hub Max': {
    width: 1280,
    height: 800,
    userAgent:
      'Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/%s Safari/537.36 CrKey/1.54.250320',
  },
};

export const chromeVersion = () =>
  globalThis.navigator?.userAgent?.match(/Chrome\/([\d.]+)/)?.[1] ?? '';

// How a tab is made to behave like `name`, or null for an unknown name. All
// of them are touch screens with mobile layout, as in Chrome's list. The
// picture stays at one image pixel per CSS pixel, so it isn't three times
// the size on a phone.
export function deviceEmulation(name) {
  const device = Object.hasOwn(DEVICES, name) ? DEVICES[name] : null;
  if (!device) {
    return null;
  }
  return {
    width: device.width,
    height: device.height,
    userAgent: device.userAgent.replace('%s', chromeVersion()),
  };
}
