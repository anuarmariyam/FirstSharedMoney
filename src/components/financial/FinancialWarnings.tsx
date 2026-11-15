import type { FinancialWarning } from "../../types/domain";
import { Notice } from "../ui";

export function FinancialWarnings({
  warnings,
}: {
  warnings: readonly FinancialWarning[];
}) {
  if (!warnings.length) return null;
  return (
    <div
      className="financial-warnings"
      role="status"
      aria-label="Financial warnings"
    >
      {warnings.map((warning, i) => (
        <Notice
          key={`${warning.code}-${warning.partnerSlot}-${i}`}
          tone="warning"
          title={
            warning.code === "income_shortfall"
              ? "Budget shortfall"
              : warning.code === "zero_income"
                ? "No income"
                : "Emergency reserve exhausted"
          }
        >
          {warning.code === "reserve_exhausted"
            ? "The available emergency reserve has been used. Review the uncovered one-time cost for this scenario."
            : warning.code === "zero_income"
              ? `Partner ${warning.partnerSlot ?? ""} has no income in this scenario. An income share cannot be shown.`
              : `Partner ${warning.partnerSlot ?? ""} has a negative balance after modeled costs. Review the plan together.`}
        </Notice>
      ))}
    </div>
  );
}
