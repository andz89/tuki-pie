import { createContext } from 'react';
import type { PageImage, PageImageSize, Result } from '../../shared/types';

// Where a ChromeImage gets its pictures. Without one, it uses the Page Info
// window's. The Info Card gives its own, so both share one image component.
export interface ChromeImageSource {
  connected: boolean;
  fetch(url: string, size: PageImageSize): Promise<Result<PageImage | null>>;
}

export const ChromeImageSourceContext = createContext<ChromeImageSource | null>(
  null,
);
