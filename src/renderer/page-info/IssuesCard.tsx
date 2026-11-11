import type { PageIssue } from '../../shared/page-audit';
import { InfoCard, InfoEmpty } from './InfoCard';

export function IssuesCard({ issues }: { issues: PageIssue[] }) {
  return (
    <InfoCard title="Issues" count={issues.length}>
      {issues.length === 0 ? (
        <InfoEmpty>No issues found.</InfoEmpty>
      ) : (
        <ul className="info-list">
          {issues.map(({ level, area, message }, index) => (
            <li key={index} className={`info-issue is-${level}`}>
              <strong>{area}</strong> {message}
            </li>
          ))}
        </ul>
      )}
    </InfoCard>
  );
}
