import type { PageReport } from '../../shared/types';
import { InfoCard, InfoEmpty, InfoGroup, MoreNote } from './InfoCard';

export function TrackingCard({
  tracking,
}: {
  tracking: PageReport['tracking'];
}) {
  const { trackers, utm, mixedContent, unsafeBlankLinks } = tracking;

  return (
    <InfoCard title="Tracking" count={trackers.length}>
      <InfoGroup label="Tags">
        {trackers.length === 0 ? (
          <InfoEmpty>None found</InfoEmpty>
        ) : (
          <ul className="info-list">
            {trackers.map(({ name, ids, duplicateSrcs }) => (
              <li key={name}>
                <strong>{name}</strong>{' '}
                {ids.length > 0 ? ids.join(', ') : 'found, no ID'}
                {duplicateSrcs.map(({ src, count }) => (
                  <p key={src} className="info-warning">
                    Loaded {count} times: {src}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
        <p className="info-note">
          Tags that wait for cookie consent only show up after you accept
          cookies.
        </p>
      </InfoGroup>

      {utm.taggedCount > 0 && (
        <InfoGroup label={`UTM links (${utm.taggedCount})`}>
          {utm.campaigns.length > 0 && (
            <p className="info-value">Campaigns: {utm.campaigns.join(', ')}</p>
          )}
          {utm.problems.total === 0 ? (
            <InfoEmpty>
              Every UTM link has source, medium and campaign.
            </InfoEmpty>
          ) : (
            <ul className="info-list">
              {utm.problems.items.map(({ href, missing, empty }) => (
                <li key={href}>
                  {href}
                  <p className="info-warning">
                    {[
                      missing.length > 0 && `missing ${missing.join(', ')}`,
                      empty.length > 0 && `empty ${empty.join(', ')}`,
                    ]
                      .filter(Boolean)
                      .join('; ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <MoreNote list={utm.problems} />
        </InfoGroup>
      )}

      {mixedContent.total > 0 && (
        <InfoGroup label={`Files loaded over http (${mixedContent.total})`}>
          <ul className="info-list">
            {mixedContent.items.map(({ tag, url }, index) => (
              <li key={index}>
                <span className="info-tag">{tag}</span>
                {url}
              </li>
            ))}
          </ul>
          <MoreNote list={mixedContent} />
        </InfoGroup>
      )}

      {unsafeBlankLinks.total > 0 && (
        <InfoGroup
          label={`New-tab links without noopener (${unsafeBlankLinks.total})`}
        >
          <ul className="info-list">
            {unsafeBlankLinks.items.map((href) => (
              <li key={href}>{href}</li>
            ))}
          </ul>
          <MoreNote list={unsafeBlankLinks} />
        </InfoGroup>
      )}
    </InfoCard>
  );
}
