import type { AgreementVersion } from "../../../types/domain";

/** Read-only server metadata. No action, approval inference or local identity. */
export function AgreementConfirmations({
  version,
}: {
  version?: AgreementVersion;
}) {
  return (
    <section aria-label="Partner confirmations">
      <h2>05 / Independent confirmations</h2>
      <p>
        {version
          ? `Version ${version.versionNumber} · ${version.status.replace("_", " ")}`
          : "Demo draft · no server version · neither partner has approved."}
      </p>
      <div className="document-approval">
        {(["A", "B"] as const).map((slot) => {
          const approval = version?.approvals[slot];
          return (
            <div key={slot}>
              <strong>Partner {slot}</strong>
              <span>
                {approval
                  ? "Confirmed"
                  : version
                    ? "Pending confirmation"
                    : "Not approved · Demo"}
              </span>
              {approval && (
                <>
                  <span>Version ID: {approval.versionId}</span>
                  <time dateTime={approval.approvedAt}>
                    {new Intl.DateTimeFormat("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "UTC",
                    }).format(new Date(approval.approvedAt))}{" "}
                    UTC
                  </time>
                  <span className="confirmation-hash">
                    Content hash: {approval.contentHash}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
