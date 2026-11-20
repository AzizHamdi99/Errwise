import type { OverviewCards, StatsRange } from "@errwise/shared";
import { rangeLabel } from "./range-select";
import { StatCard } from "./stat-card";

interface Props {
  /** Undefined while loading: the cards show skeletons. */
  cards: OverviewCards | undefined;
  range: StatsRange;
}

/** The four numbers on top of the project and the organization overview. */
export function SummaryCards({ cards, range }: Props) {
  const hint = `last ${rangeLabel(range).toLowerCase()}`;

  return (
    <section
      aria-label="Summary"
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
    >
      <StatCard
        label="Events"
        value={cards?.events}
        hint={hint}
        delta={
          cards
            ? { current: cards.events, previous: cards.eventsPrevious }
            : undefined
        }
      />
      <StatCard
        label="Unresolved issues"
        value={cards?.unresolved}
        hint="right now"
      />
      <StatCard label="New issues" value={cards?.newIssues} hint={hint} />
      <StatCard
        label="Regressed issues"
        value={cards?.regressedIssues}
        hint={`${hint}, approx.`}
      />
    </section>
  );
}
