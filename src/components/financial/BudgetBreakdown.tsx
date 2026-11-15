import { useId } from "react";
import type { FinancialInput, SplitCalculation } from "../../types/domain";
import { formatMoney } from "../../lib/money";

type AvailableSplit = Extract<SplitCalculation, { status: "available" }>;
const categories = [
  ["rent", "Rent & home"],
  ["utilities", "Utilities"],
  ["groceries", "Groceries"],
  ["other", "Other shared costs"],
  ["shared_savings", "Shared savings"],
] as const;

/** Amounts and total are supplied by the engine; only SVG geometry is normalized. */
export function BudgetBreakdown({
  expenses,
  monthlyTotalCents,
}: {
  expenses: FinancialInput["sharedExpenses"];
  monthlyTotalCents: AvailableSplit["monthlySharedTotalCents"];
}) {
  const titleId = useId();
  return (
    <section className="budget-breakdown" aria-labelledby={titleId}>
      <div className="section-title-row">
        <h3 id={titleId}>Where your money goes</h3>
        <span className="finance-unit">USD / month</span>
      </div>
      <div className="budget-breakdown-body">
        <div className="budget-donut" aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="46"
              fill="none"
              stroke="#ede9f2"
              strokeWidth="14"
            />
            {categories.map(([key], index) => {
              const length =
                monthlyTotalCents === 0
                  ? 0
                  : (expenses[key] / monthlyTotalCents) * 100;
              const start = categories
                .slice(0, index)
                .reduce(
                  (position, [category]) =>
                    position +
                    (monthlyTotalCents === 0
                      ? 0
                      : (expenses[category] / monthlyTotalCents) * 100),
                  0,
                );
              return (
                <circle
                  key={key}
                  className={`budget-color-${index}`}
                  cx="60"
                  cy="60"
                  r="46"
                  fill="none"
                  strokeWidth="14"
                  pathLength="100"
                  strokeDasharray={`${length} ${100 - length}`}
                  strokeDashoffset={-start}
                  transform="rotate(-90 60 60)"
                />
              );
            })}
          </svg>
          <div>
            <span>Monthly plan</span>
            <strong>{formatMoney(monthlyTotalCents)}</strong>
          </div>
        </div>
        <table className="budget-legend">
          <caption className="sr-only">
            Monthly budget by category. Savings are included in the total.
          </caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Monthly amount in USD</th>
            </tr>
          </thead>
          <tbody>
            {categories.map(([key, label], index) => (
              <tr key={key}>
                <th scope="row">
                  <i className={`budget-color-${index}`} aria-hidden="true" />
                  {label}
                </th>
                <td>{formatMoney(expenses[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-hint">
        {monthlyTotalCents === 0 ? "No monthly costs allocated. " : ""}Savings
        are included once. Your existing emergency reserve is separate.
      </p>
    </section>
  );
}
