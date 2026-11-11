import type { PageReport } from '../../shared/types';
import { InfoCard, InfoEmpty } from './InfoCard';

export function CommentsCard({
  hyvorTalk,
}: {
  hyvorTalk: PageReport['hyvorTalk'];
}) {
  return (
    <InfoCard title="Comments">
      {hyvorTalk === null ? (
        <InfoEmpty>None found</InfoEmpty>
      ) : (
        <ul className="info-list">
          {hyvorTalk.attributes.map(({ name, value }) => (
            <li key={name}>
              <strong>{name}</strong> {value}
            </li>
          ))}
        </ul>
      )}
    </InfoCard>
  );
}
