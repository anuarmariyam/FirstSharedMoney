import type { SplitCalculation } from "../../types/domain";
import { formatMoney } from "../../lib/money";

export function FinancialSummary({
  result,
}: {
  result: Extract<SplitCalculation, { status: "available" }>;
}) {
  return (
    <div className="financial-summary">
      {(["A", "B"] as const).map((slot) => (
        <div className={`partner-summary partner-summary-${slot}`} key={slot}>
          <div className="flex items-center gap-2">
            <span className={`avatar ${slot === "B" ? "avatar-light" : ""}`}>
              {slot}
            </span>
            <strong>Partner {slot}</strong>
          </div>
          <span className="summary-label">Monthly contribution</span>
          <div className="contribution">
            {formatMoney(result.allocations[slot].monthlyContributionCents)}
            <span> / mo</span>
          </div>
          <div className="summary-details">
            <div>
              <span>Of take-home income</span>
              <strong>
                {result.allocations[slot].incomeBurdenPercent === null
                  ? "N/A"
                  : `${result.allocations[slot].incomeBurdenPercent}%`}
              </strong>
            </div>
            <div>
              <span>After shared costs</span>
              <strong>
                {formatMoney(
                  result.allocations[slot].incomeAfterSharedCostsCents,
                )}
              </strong>
            </div>
            <div>
              <span>After personal obligations</span>
              <strong>
                {formatMoney(
                  result.allocations[slot].availableAfterObligationsCents,
                )}
              </strong>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
