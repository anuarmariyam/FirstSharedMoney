import type { SplitCalculation } from "../../types/domain";
import { formatMoney } from "../../lib/money";
import { ContributionComparison } from "../../components/financial/ContributionComparison";
import { FinancialWarnings } from "../../components/financial/FinancialWarnings";

export function FinancialSummary({
  result,
}: {
  result: Extract<SplitCalculation, { status: "available" }>;
}) {
  return (
    <>
      <ContributionComparison result={result} />
      <div className="financial-summary">
        {(["A", "B"] as const).map((slot) => {
          const allocation = result.allocations[slot];
          return (
            <section
              className={`partner-summary partner-summary-${slot}`}
              key={slot}
              aria-label={`Partner ${slot} budget`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`avatar ${slot === "B" ? "avatar-light" : ""}`}
                >
                  {slot}
                </span>
                <strong>Partner {slot}</strong>
              </div>
              <span className="summary-label">Monthly contribution</span>
              <div className="contribution">
                {formatMoney(allocation.monthlyContributionCents)}
                <span> / mo</span>
              </div>
              <dl className="summary-details">
                <div>
                  <dt>
                    Of take-home income
                    {result.oneOffSharedTotalCents > 0
                      ? " (incl. one-time cost)"
                      : ""}
                  </dt>
                  <dd>
                    {allocation.incomeBurdenPercent === null
                      ? "N/A · no income"
                      : `${allocation.incomeBurdenPercent}%`}
                  </dd>
                </div>
                <div>
                  <dt>
                    After shared costs
                    {result.oneOffSharedTotalCents > 0
                      ? " & one-time cost"
                      : ""}
                  </dt>
                  <dd
                    className={
                      allocation.incomeAfterSharedCostsCents < 0
                        ? "finance-negative"
                        : ""
                    }
                  >
                    {formatMoney(allocation.incomeAfterSharedCostsCents)}
                  </dd>
                </div>
                <div className="remaining-balance">
                  <dt>After personal obligations</dt>
                  <dd
                    className={
                      allocation.availableAfterObligationsCents < 0
                        ? "finance-negative"
                        : ""
                    }
                  >
                    {formatMoney(allocation.availableAfterObligationsCents)}
                  </dd>
                </div>
              </dl>
              {allocation.availableAfterObligationsCents < 0 && (
                <p className="finance-negative">
                  Shortfall · costs exceed available income
                </p>
              )}
              {result.oneOffSharedTotalCents > 0 && (
                <div className="one-off-detail">
                  <span>One-time contribution</span>
                  <strong>
                    {formatMoney(allocation.oneOffContributionCents)}
                  </strong>
                  <span>Total for this scenario</span>
                  <strong>
                    {formatMoney(allocation.totalContributionCents)}
                  </strong>
                </div>
              )}
            </section>
          );
        })}
      </div>
      <FinancialWarnings warnings={result.warnings} />
    </>
  );
}
