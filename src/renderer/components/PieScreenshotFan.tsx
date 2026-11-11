import { usePieStore } from '../stores/pie.store';
import { PieFanRow } from './PieFanRow';
import type { FanCircle } from './PieFanRow';

export function PieScreenshotFan({ middle }: { middle: number }) {
  const takeScreenshot = usePieStore((state) => state.takeScreenshot);

  const circles: FanCircle[] = [
    {
      id: 'screen',
      icon: 'screen',
      label: 'Entire screen',
      value: 'The whole screen',
      onClick: () => void takeScreenshot('screen'),
    },
    {
      id: 'section',
      icon: 'crop',
      label: 'Section',
      value: 'Drag to pick a part',
      onClick: () => void takeScreenshot('section'),
    },
  ];

  return (
    <PieFanRow
      className="pie-screenshot-fan"
      middle={middle}
      circles={circles}
    />
  );
}
