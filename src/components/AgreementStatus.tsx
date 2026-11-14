import type { AgreementVersion } from "../types/domain";
import { Icon } from "./Icon";

type Status = AgreementVersion["status"];
const statuses: { key: Status; label: string }[] = [
  { key: "draft", label: "Draft" },
  { key: "proposed", label: "Proposed" },
  { key: "under_review", label: "Under Review" },
  { key: "approved", label: "Approved" },
];
export function AgreementStatus({ status = "draft" }: { status?: Status }) {
  return (
    <ol className="agreement-status" aria-label="Planned agreement workflow">
      {statuses.map((item, index) => (
        <li
          key={item.key}
          aria-current={status === item.key ? "step" : undefined}
          className={status === item.key ? "current" : ""}
        >
          <span>
            {status === item.key ? (
              <Icon name="document" size={15} />
            ) : (
              index + 1
            )}
          </span>
          <strong>{item.label}</strong>
        </li>
      ))}
    </ol>
  );
}
