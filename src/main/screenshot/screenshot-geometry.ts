export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

// The overlay measures in screen points, the image in pixels. On a scaled
// display there are more pixels than points, so the area is scaled up and kept
// inside the image.
export function pixelArea(
  selection: Area,
  scaleFactor: number,
  image: Size,
): Area | null {
  const left = clamp(Math.round(selection.x * scaleFactor), 0, image.width);
  const top = clamp(Math.round(selection.y * scaleFactor), 0, image.height);
  const right = clamp(
    Math.round((selection.x + selection.width) * scaleFactor),
    0,
    image.width,
  );
  const bottom = clamp(
    Math.round((selection.y + selection.height) * scaleFactor),
    0,
    image.height,
  );
  if (right - left < 1 || bottom - top < 1) {
    return null;
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function timeStamp(time: Date): string {
  const date = `${time.getFullYear()}-${twoDigits(time.getMonth() + 1)}-${twoDigits(time.getDate())}`;
  const clock = `${twoDigits(time.getHours())}${twoDigits(time.getMinutes())}${twoDigits(time.getSeconds())}`;
  return `${date} ${clock}`;
}

// Sorts by time in a folder, and has no characters Windows refuses in names.
export function screenshotFileName(time: Date): string {
  return `Screenshot ${timeStamp(time)}.png`;
}

const MAX_TITLE_LENGTH = 60;
const MAX_SECTION_LENGTH = 40;

// Text cleaned of characters Windows refuses, cut to `length`, without the
// trailing dots and spaces Windows drops.
const cleanName = (text: string, length: number) =>
  text
    // oxlint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, length)
    .replace(/[. ]+$/, '');

// A web page: its title, cleaned of characters Windows refuses, then the
// moment it was taken.
// With the device's name when it was taken as one: "Title iPhone 16 ...".
// With the section's selector when only that was taken: "Title .pricing ...".
export function pageScreenshotFileName(
  title: string,
  time: Date,
  device = '',
  section = '',
): string {
  const name = cleanName(title, MAX_TITLE_LENGTH);
  const as = device ? ` ${device}` : '';
  const part = cleanName(section, MAX_SECTION_LENGTH);
  const of = part ? ` ${part}` : '';
  return `${name || 'Web page'}${as}${of} ${timeStamp(time)}.jpg`;
}
