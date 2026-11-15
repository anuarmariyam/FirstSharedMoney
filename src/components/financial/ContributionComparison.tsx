import type { SplitCalculation } from "../../types/domain";
import { formatMoney } from "../../lib/money";

export function ContributionComparison({
  result,
}: {
  result: SplitCalculation;
}) {
  if (result.status === "unavailable")
    return (
      <p className="finance-unavailable">
        Proportional split unavailable: both incomes are zero. Compare Equal or
        Custom.
      </p>
    );
  return (
    <div
      className="contribution-comparison"
      role="group"
      aria-label="Monthly contribution comparison"
    >
      {(["A", "B"] as const).map((slot) => {
        const amount = result.allocations[slot].monthlyContributionCents;
        // Drawing ratio only; never an affordability or accounting calculation.
        const share =
          result.monthlySharedTotalCents === 0
            ? null
            : (amount / result.monthlySharedTotalCents) * 100;
        return (
          <div
            className={`contribution-row contribution-row-${slot}`}
            key={slot}
          >
            <div>
              <span>Partner {slot}</span>
              <strong>
                {formatMoney(amount)} <small>/ month</small>
              </strong>
              <span>
                {share === null
                  ? "No monthly allocation"
                  : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(share)}% of monthly plan`}
              </span>
            </div>
            <div className="contribution-track" aria-hidden="true">
              <i style={{ width: `${share ?? 0}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
