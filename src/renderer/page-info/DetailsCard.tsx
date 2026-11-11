import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  TITLE_MAX,
} from '../../shared/page-audit';
import type { PageReport } from '../../shared/types';
import { InfoCard } from './InfoCard';
import { isLengthOk } from './page-info-view';

interface DetailRowProps {
  label: string;
  value: string | null;
  range?: { min: number; max: number };
}

function DetailRow({ label, value, range }: DetailRowProps) {
  return (
    <div className="info-row">
      <p className="info-label">
        {label}
        {value !== null && range && (
          <span
            className={
              isLengthOk(value.length, range.min, range.max)
                ? 'info-length'
                : 'info-length is-off'
            }
          >
            {value.length}/{range.max}
          </span>
        )}
      </p>
      {value === null ? (
        <p className="info-missing">Missing</p>
      ) : (
        <p className="info-value">{value}</p>
      )}
    </div>
  );
}

export function DetailsCard({ meta }: { meta: PageReport['meta'] }) {
  return (
    <InfoCard title="Page details">
      <DetailRow
        label="Title"
        value={meta.title}
        range={{ min: 1, max: TITLE_MAX }}
      />
      <DetailRow
        label="Description"
        value={meta.description}
        range={{ min: DESCRIPTION_MIN, max: DESCRIPTION_MAX }}
      />
      <DetailRow label="Language" value={meta.lang} />
      <DetailRow label="Canonical URL" value={meta.canonical} />
    </InfoCard>
  );
}
