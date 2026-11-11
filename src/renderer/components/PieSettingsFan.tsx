import { PIE_SCALES } from '../../shared/schemas/settings.schema';
import { usePieStore } from '../stores/pie.store';
import { useSettingsStore } from '../stores/settings.store';
import { PieFanRow } from './PieFanRow';
import type { FanCircle } from './PieFanRow';
import {
  BUBBLE_DISTANCE,
  PIE_SIZE,
  fanAngles,
  polarPoint,
} from './pie-geometry';
import {
  accentName,
  nextAccent,
  nextPin,
  nextSize,
  nextTheme,
} from './settings-cycle';

const CIRCLE_COUNT = 7;
const SIZE_CIRCLE = 3;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function PieSettingsFan({
  middle,
  sliceIndex,
}: {
  middle: number;
  sliceIndex: number;
}) {
  const theme = useSettingsStore((state) => state.theme);
  const accent = useSettingsStore((state) => state.accent);
  const size = useSettingsStore((state) => state.size);
  const pin = useSettingsStore((state) => state.pin);
  const update = useSettingsStore((state) => state.update);
  const openSettings = usePieStore((state) => state.openSettings);
  const moveWindowBy = usePieStore((state) => state.moveWindowBy);
  const changeVolume = usePieStore((state) => state.changeVolume);
  const setHovered = usePieStore((state) => state.setHovered);
  const closePie = usePieStore((state) => state.close);

  // Resizes, then shifts the donut so the Size circle stays under the mouse.
  const cycleSize = async () => {
    const next = nextSize(size);
    const growth = PIE_SCALES[size] - PIE_SCALES[next];
    const { x, y } = polarPoint(
      fanAngles(middle, CIRCLE_COUNT)[SIZE_CIRCLE],
      BUBBLE_DISTANCE,
    );
    await update({ size: next });
    moveWindowBy(
      Math.round((x - PIE_SIZE / 2) * growth),
      Math.round((y - PIE_SIZE / 2) * growth),
    );
    // Windows can report the mouse as gone while the window moves under it.
    setHovered(sliceIndex);
  };

  const circles: FanCircle[] = [
    {
      id: 'open',
      icon: 'settings',
      label: 'Settings',
      value: 'Open panel',
      onClick: openSettings,
    },
    {
      id: 'theme',
      icon: theme === 'dark' ? 'moon' : 'sun',
      label: 'Theme',
      value: capitalize(theme),
      onClick: () => void update({ theme: nextTheme(theme) }),
    },
    {
      id: 'color',
      icon: 'palette',
      label: 'Color',
      value: accentName(accent),
      onClick: () => void update({ accent: nextAccent(accent) }),
    },
    {
      id: 'size',
      icon: 'resize',
      label: 'Size',
      value: capitalize(size),
      onClick: () => void cycleSize(),
    },
    {
      id: 'volume',
      icon: 'volume',
      label: 'Volume',
      value: 'Scroll, or click to mute',
      onClick: () => changeVolume('mute'),
      onWheel: (event) => changeVolume(event.deltaY < 0 ? 'up' : 'down'),
    },
    {
      id: 'pin',
      icon: pin === 'pinned' ? 'pin' : 'pin-off',
      label: 'Pin',
      value: capitalize(pin),
      onClick: () => void update({ pin: nextPin(pin) }),
    },
    {
      id: 'close',
      icon: 'close',
      label: 'Close',
      value: 'Hide the launcher',
      onClick: closePie,
    },
  ];

  return (
    <PieFanRow className="pie-settings-fan" middle={middle} circles={circles} />
  );
}
