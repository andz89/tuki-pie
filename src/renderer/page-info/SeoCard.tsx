import type { CSSProperties } from 'react';
import type { PageReport } from '../../shared/types';
import { InfoCard, InfoEmpty, InfoGroup, MoreNote } from './InfoCard';

const HEADING_INDENT_PX = 12;

export function SeoCard({ seo }: { seo: PageReport['seo'] }) {
  const { robots, headings, hreflang } = seo;

  return (
    <InfoCard title="SEO">
      <InfoGroup label="Robots">
        {robots.length === 0 ? (
          <InfoEmpty>None found</InfoEmpty>
        ) : (
          <ul className="info-list">
            {robots.map(({ name, content }, index) => (
              <li key={index}>
                <strong>{name}</strong> {content}
              </li>
            ))}
          </ul>
        )}
      </InfoGroup>

      <InfoGroup label={`Headings (${headings.total})`}>
        {headings.total === 0 ? (
          <InfoEmpty>None found</InfoEmpty>
        ) : (
          <ul className="info-list">
            {headings.items.map(({ level, text }, index) => (
              <li
                key={index}
                className="info-heading"
                style={
                  {
                    paddingLeft: (level - 1) * HEADING_INDENT_PX,
                  } as CSSProperties
                }
              >
                <span className="info-tag">H{level}</span>
                {text || <em className="info-missing">empty</em>}
              </li>
            ))}
          </ul>
        )}
        <MoreNote list={headings} />
      </InfoGroup>

      <InfoGroup label={`Language versions (${hreflang.total})`}>
        {hreflang.total === 0 ? (
          <InfoEmpty>None found</InfoEmpty>
        ) : (
          <ul className="info-list">
            {hreflang.items.map(({ hreflang: code, href }, index) => (
              <li key={index}>
                <strong>{code}</strong> {href}
              </li>
            ))}
          </ul>
        )}
        <MoreNote list={hreflang} />
      </InfoGroup>
    </InfoCard>
  );
}
