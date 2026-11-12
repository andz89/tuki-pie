import { useRef, useState } from 'react';
import type { PageReport } from '../../shared/types';
import { ChromeImage } from './ChromeImage';
import { InfoCard, InfoEmpty } from './InfoCard';
import { shareImageSource } from './page-info-view';

const COULD_NOT_LOAD = (
  <p className="info-warning">Could not load this image.</p>
);

function SharePreview({ source, alt }: { source: string; alt: string }) {
  const [didFail, setDidFail] = useState(false);
  // The full image is fetched only while the big view is open.
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  if (didFail) {
    return COULD_NOT_LOAD;
  }
  return (
    <>
      <button
        type="button"
        className="info-share-open"
        aria-label={`Show ${alt} full size`}
        title="Click to enlarge"
        onClick={() => {
          setIsOpen(true);
          dialogRef.current?.showModal();
        }}
      >
        <ChromeImage
          className="info-share-image"
          url={source}
          size="thumb"
          alt={alt}
          onBroken={() => setDidFail(true)}
        />
      </button>
      {/* A click anywhere, or Escape, closes the big view. */}
      <dialog
        ref={dialogRef}
        className="info-share-dialog"
        aria-label={alt}
        onClick={() => dialogRef.current?.close()}
        onClose={() => setIsOpen(false)}
      >
        {isOpen && (
          <ChromeImage
            url={source}
            size="full"
            alt={alt}
            fallback={COULD_NOT_LOAD}
          />
        )}
      </dialog>
    </>
  );
}

export function SocialCard({
  images,
  pageUrl,
}: {
  images: PageReport['featuredImages'];
  pageUrl: string;
}) {
  return (
    <InfoCard title="Social">
      {images.length === 0 ? (
        <InfoEmpty>None found</InfoEmpty>
      ) : (
        <ul className="info-list">
          {images.map(({ property, url }) => {
            const source = shareImageSource(url, pageUrl);
            return (
              <li key={`${property}|${url}`}>
                <strong>{property}</strong> {url}
                {source === null ? (
                  <p className="info-warning">Could not load this image.</p>
                ) : (
                  <SharePreview source={source} alt={`${property} preview`} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </InfoCard>
  );
}
