import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AgreementVersion } from "../../../src/types/domain.ts";
import { parseAgreement, rulesFromAgreement } from "./agreement-contract.ts";

/** Server-only renderer. Authorization and current-head checks surround rendering. */
export async function agreementPDF(raw: AgreementVersion): Promise<Uint8Array> {
  const v = parseAgreement(raw);
  if (v.status !== "approved") throw new Error("INVALID_STATE");
  const rules = rulesFromAgreement(v),
    pdf = await PDFDocument.create();
  pdf.setTitle("First Money Agreement");
  pdf.setSubject(`Version ${v.versionNumber}; ${v.contentHash}`);
  pdf.setAuthor("FirstSharedMoney");
  pdf.setCreationDate(new Date(v.approvedAt));
  pdf.setModificationDate(new Date(v.approvedAt));
  const normal = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]),
    y = 744;
  const ink = rgb(0.19, 0.16, 0.24),
    purple = rgb(0.36, 0.25, 0.58);
  function line(text: string, strong = false, size = 11) {
    const font = strong ? bold : normal;
    let current = "";
    const lines: string[] = [];
    for (const word of text.split(" ")) {
      const next = current ? current + " " + word : word;
      if (font.widthOfTextAtSize(next, size) > 516 && current) {
        lines.push(current);
        current = word;
      } else current = next;
    }
    if (current) lines.push(current);
    for (const row of lines) {
      if (y < 60) {
        page = pdf.addPage([612, 792]);
        y = 744;
      }
      page.drawText(row, {
        x: 48,
        y,
        size,
        font,
        color: strong ? purple : ink,
      });
      y -= size + 7;
    }
  }
  const usd = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n / 100);
  const pretty = (s: string) => s.replaceAll("_", " ");
  line("First Money Agreement", true, 24);
  line(
    `Version ${v.versionNumber} | Approved ${new Date(v.approvedAt).toISOString().slice(0, 10)}`,
  );
  y -= 10;
  line("Your shared monthly plan", true, 15);
  line(
    `Monthly budget: ${usd(v.financialSummary.monthlySharedTotalCents)} (USD)`,
    true,
  );
  for (const i of v.items)
    if ("monthlyCents" in i)
      line(
        `${i.key === "shared_savings" ? "Shared savings" : pretty(i.key)}: ${usd(i.monthlyCents)}`,
      );
  const model = v.financialSummary.splitModel;
  line(
    `Contribution model: ${model.kind === "custom" ? `custom (Partner A ${model.partnerAShareBasisPoints / 100}%)` : pretty(model.kind)}`,
  );
  line(
    `Partner A contributes: ${usd(v.financialSummary.monthlyContributionsCents.A)} per month`,
    true,
  );
  line(
    `Partner B contributes: ${usd(v.financialSummary.monthlyContributionsCents.B)} per month`,
    true,
  );
  line(`Shared reserve: ${usd(v.financialSummary.sharedEmergencyFundCents)}`);
  y -= 8;
  line("Your agreed rules", true, 15);
  line(
    `Personal spending: ${rules.personalSpending === "independent" ? "Each partner manages personal purchases independently." : "Discuss personal purchases above the agreed threshold."}`,
  );
  line(
    `Existing debt: ${rules.debtExpectation === "individual_responsibility" ? "Each partner remains responsible for their personal debt." : "Discuss any support for personal debt before making it part of the plan."}`,
  );
  line(
    `Large purchase discussion threshold: ${usd(rules.largePurchaseThresholdCents)}`,
  );
  const emergency = {
    use_shared_reserve_then_discuss:
      "Use the shared reserve, then discuss next steps.",
    pause_savings_then_discuss: "Pause savings, then discuss next steps.",
    discuss_before_spending: "Discuss the situation before spending.",
  };
  line(`Emergency expenses: ${emergency[rules.emergencyRule]}`);
  line(
    `Budget review: ${pretty(rules.reviewFrequency)}. Next review: ${rules.nextReviewDate}.`,
  );
  y -= 8;
  line("Independent confirmations", true, 15);
  line(
    `Partner A confirmed: ${new Date(v.approvals.A.approvedAt).toISOString()}`,
  );
  line(
    `Partner B confirmed: ${new Date(v.approvals.B.approvedAt).toISOString()}`,
  );
  line(`Agreement ID: ${v.id}`, false, 9);
  line(`Source scenario: ${v.sourceScenarioId}`, false, 9);
  // Split the hash to avoid a long unbreakable word outside the print margin.
  line(
    `Content hash: ${v.contentHash.slice(0, 32)} ${v.contentHash.slice(32)}`,
    false,
    9,
  );
  y -= 8;
  line(
    "This personal financial planning agreement records your shared intentions. It is not legal advice, a legal certification, or professional financial advice.",
    false,
    9,
  );
  for (const [i, p] of pdf.getPages().entries())
    p.drawText(`FirstSharedMoney | ${i + 1} / ${pdf.getPageCount()}`, {
      x: 48,
      y: 30,
      size: 9,
      font: normal,
      color: ink,
    });
  return pdf.save({ useObjectStreams: false });
}
