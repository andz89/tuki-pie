import { matchesAddress } from './page-links';

// Image addresses containing every word of the filter, in page order.
export function filterImages(urls: string[], filter: string): string[] {
  return urls.filter((url) => matchesAddress(url, filter));
}

export const imagesWord = (count: number) =>
  `${count} image${count === 1 ? '' : 's'}`;
