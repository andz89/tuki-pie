// The default accent blue, as blue, green, red.
const RING_COLOR = [0xeb, 0x63, 0x25];

function clampToUnit(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

// Draws a small donut, one blue-green-red-alpha pixel at a time.
export function donutBitmap(size: number): Buffer {
  const bitmap = Buffer.alloc(size * size * 4);
  const center = (size - 1) / 2;
  const outerRadius = size / 2 - 1;
  const innerRadius = size / 4;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x - center, y - center);
      // Softens the edges by fading across the last pixel on each side.
      const alpha =
        clampToUnit(outerRadius - distance + 0.5) *
        clampToUnit(distance - innerRadius + 0.5);

      const offset = (y * size + x) * 4;
      RING_COLOR.forEach((channel, index) => {
        bitmap[offset + index] = Math.round(channel * alpha);
      });
      bitmap[offset + 3] = Math.round(alpha * 255);
    }
  }

  return bitmap;
}
