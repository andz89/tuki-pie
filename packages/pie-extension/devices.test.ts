import { expect, it } from 'vitest';
import { DEVICE_GROUPS } from '../../src/shared/devices';
import { DEVICES, deviceEmulation } from './devices.js';

it('lists the same devices and sizes as Pie Launcher', () => {
  const app = DEVICE_GROUPS.flatMap((group) => group.devices);
  expect(app.map(({ name, width, height }) => [name, width, height])).toEqual(
    Object.entries(DEVICES).map(([name, { width, height }]) => [
      name,
      width,
      height,
    ]),
  );
});

it('puts the running Chrome version into the user agent', () => {
  const agent = deviceEmulation('Pixel 9')?.userAgent ?? '';
  expect(agent).not.toContain('%s');
  expect(agent).toContain('Pixel 9');
});

it('knows nothing of names that are not devices', () => {
  expect(deviceEmulation('toString')).toBeNull();
  expect(deviceEmulation('')).toBeNull();
});
