import type { ReactNode } from 'react';
import type { PageReport } from '../../shared/types';
import { CommentsCard } from './CommentsCard';
import { DetailsCard } from './DetailsCard';
import { InfoCard, InfoEmpty } from './InfoCard';
import { IssuesCard } from './IssuesCard';
import { SeoCard } from './SeoCard';
import { SortableCards } from './SortableCards';
import { TrackingCard } from './TrackingCard';

// The share images as addresses, for a page no longer open in Chrome: only
// the page being checked may have its pictures fetched.
export function SocialAddressCard({
  images,
}: {
  images: PageReport['featuredImages'];
}) {
  return (
    <InfoCard title="Social">
      {images.length === 0 ? (
        <InfoEmpty>None found</InfoEmpty>
      ) : (
        <ul className="info-list">
          {images.map(({ property, url }) => (
            <li key={`${property}|${url}`}>
              <strong>{property}</strong> {url}
            </li>
          ))}
        </ul>
      )}
    </InfoCard>
  );
}

// The Page info cards, in the order you dragged them. Page Info passes its
// Social card with pictures; a saved site passes the addresses.
export function PageInfoCards({
  report,
  social,
}: {
  report: PageReport;
  social: ReactNode;
}) {
  return (
    <SortableCards
      cards={{
        issues: <IssuesCard issues={report.issues} />,
        details: <DetailsCard meta={report.meta} />,
        seo: <SeoCard seo={report.seo} />,
        tracking: <TrackingCard tracking={report.tracking} />,
        social,
        comments: <CommentsCard hyvorTalk={report.hyvorTalk} />,
      }}
    />
  );
}
