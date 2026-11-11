import { z } from 'zod';
import { IpcChannels } from '../../shared/ipc-channels';
import { takeScreenshot } from '../screenshot/screenshot';
import {
  finishPicking,
  sectionPickerImage,
} from '../windows/screenshot-window';
import { handle } from './handle';

const NoInput = z.tuple([]);
const Points = z.number().finite().min(-100000).max(100000);
const AreaInput = z.tuple([
  z.object({
    x: Points,
    y: Points,
    width: Points.nonnegative(),
    height: Points.nonnegative(),
  }),
]);

export function registerScreenshotIpc(): void {
  handle(
    IpcChannels.screenshotTake,
    z.tuple([z.enum(['screen', 'section'])]),
    (mode) => takeScreenshot(mode),
  );
  handle(IpcChannels.screenshotImage, NoInput, () => sectionPickerImage());
  handle(IpcChannels.screenshotPick, AreaInput, (area) => finishPicking(area));
  handle(IpcChannels.screenshotCancel, NoInput, () => finishPicking(null));
}
