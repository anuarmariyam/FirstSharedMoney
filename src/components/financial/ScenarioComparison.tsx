import { useId } from "react";
import type { SimulationOutput } from "../../types/domain";
import { formatMoney } from "../../lib/money";

/** Compare supplied engine outputs; never infer a baseline or calculate a delta. */
export function ScenarioComparison({
  before,
  after,
}: {
  before: SimulationOutput | null;
  after: SimulationOutput | null;
}) {
  const id = useId();
  const metrics = (output: SimulationOutput | null) => {
    if (!output) return null;
    const split = output.split;
    if (split.status === "unavailable") return null;
    return [
      split.monthlySharedTotalCents,
      split.allocations.A.monthlyContributionCents,
      split.allocations.B.monthlyContributionCents,
      split.allocations.A.availableAfterObligationsCents,
      split.allocations.B.availableAfterObligationsCents,
      output.effectiveInput.sharedExpenses.shared_savings,
      split.oneOffSharedTotalCents,
      output.reserveUsedCents,
      output.effectiveInput.sharedEmergencyFundCents,
    ];
  };
  const columns = [metrics(before), metrics(after)];
  return (
    <section className="scenario-comparison" aria-labelledby={id}>
      <h3 id={id}>Before & after</h3>
      <p className="field-hint">
        {!after
          ? "This demo explains scenarios without recalculating them. Scenario amounts are not available."
          : !before
            ? "Only the scenario result was supplied. No baseline is assumed."
            : "Compare the same model before and after the scenario. Remaining balances include personal obligations and one-time costs."}
      </p>
      {(before || after) && (
        <div className="finance-table-wrap">
          <table className="finance-table">
            <caption className="sr-only">
              Baseline and scenario amounts in USD
            </caption>
            <thead>
              <tr>
                <th scope="col">Budget detail</th>
                <th scope="col">Before</th>
                <th scope="col">After</th>
              </tr>
            </thead>
            <tbody>
              {[
                "Monthly plan",
                "Partner A / month",
                "Partner B / month",
                "Partner A remaining",
                "Partner B remaining",
                "Savings / month",
                "Uncovered one-time cost",
                "Reserve used",
                "Reserve remaining",
              ].map((label, i) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {columns.map((values, j) => (
                    <td
                      key={j}
                      className={
                        values && values[i] < 0 ? "finance-negative" : ""
                      }
                    >
                      {values ? formatMoney(values[i]) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {[before, after].map((output, index) =>
        output?.split.status === "unavailable" ? (
          <p className="finance-unavailable" key={index}>
            {index === 0 ? "Before" : "After"}: proportional split unavailable
            because both incomes are zero.
          </p>
        ) : null,
      )}
    </section>
  );
}
