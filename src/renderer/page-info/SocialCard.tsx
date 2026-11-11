import { useRef, useState } from 'react';
import type { PageReport } from '../../shared/types';
import { InfoCard, InfoEmpty } from './InfoCard';
import { shareImageSource } from './page-info-view';

function SharePreview({ source, alt }: { source: string; alt: string }) {
  const [didFail, setDidFail] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  if (didFail) {
    return <p className="info-warning">Could not load this image.</p>;
  }
  return (
    <>
      <button
        type="button"
        className="info-share-open"
        aria-label={`Show ${alt} full size`}
        title="Click to enlarge"
        onClick={() => dialogRef.current?.showModal()}
      >
        <img
          className="info-share-image"
          src={source}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setDidFail(true)}
        />
      </button>
      {/* A click anywhere, or Escape, closes the big view. */}
      <dialog
        ref={dialogRef}
        className="info-share-dialog"
        aria-label={alt}
        onClick={() => dialogRef.current?.close()}
      >
        <img src={source} alt={alt} referrerPolicy="no-referrer" />
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
