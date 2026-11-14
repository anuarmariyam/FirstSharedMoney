import {
  PDFArray,
  PDFDocument,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";
import type { AgreementVersion } from "../../src/types/domain.ts";
import { rulesFromAgreement } from "../../supabase/functions/_shared/agreement-contract.ts";

/** Inspect the actual serialized PDF streams, not the renderer's input strings. */
export async function verifyAgreementPDF(
  bytes: Uint8Array,
  version: AgreementVersion,
) {
  if (version.status !== "approved")
    throw new Error("PDF evidence needs an approved version.");
  const pdf = await PDFDocument.load(bytes);
  const lines: string[] = [];
  for (const page of pdf.getPages()) {
    const contents = page.node.Contents();
    const streams =
      contents instanceof PDFArray
        ? Array.from({ length: contents.size() }, (_, i) => contents.lookup(i))
        : [contents];
    for (const stream of streams) {
      if (!(stream instanceof PDFRawStream))
        throw new Error("PDF content stream is missing.");
      const operators = new TextDecoder().decode(
        decodePDFRawStream(stream).decode(),
      );
      for (const match of operators.matchAll(/<([a-f0-9]+)>\s*Tj/gi))
        lines.push(Buffer.from(match[1], "hex").toString("latin1"));
    }
  }
  const text = lines.join(" ").replace(/\s+/g, " ");
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n / 100);
  const rules = rulesFromAgreement(version);
  const required = [
    "First Money Agreement",
    `Version ${version.versionNumber}`,
    `Monthly budget: ${money(version.financialSummary.monthlySharedTotalCents)} (USD)`,
    `Partner A contributes: ${money(version.financialSummary.monthlyContributionsCents.A)} per month`,
    `Partner B contributes: ${money(version.financialSummary.monthlyContributionsCents.B)} per month`,
    `Shared reserve: ${money(version.financialSummary.sharedEmergencyFundCents)}`,
    `Large purchase discussion threshold: ${money(rules.largePurchaseThresholdCents)}`,
    `Next review: ${rules.nextReviewDate}`,
    `Partner A confirmed: ${new Date(version.approvals.A.approvedAt).toISOString()}`,
    `Partner B confirmed: ${new Date(version.approvals.B.approvedAt).toISOString()}`,
    `Agreement ID: ${version.id}`,
    `Source scenario: ${version.sourceScenarioId}`,
    "not legal advice",
  ];
  for (const item of version.items)
    if ("monthlyCents" in item)
      required.push(
        `${item.key === "shared_savings" ? "Shared savings" : item.key.replaceAll("_", " ")}: ${money(item.monthlyCents)}`,
      );
  if (
    pdf.getTitle() !== "First Money Agreement" ||
    !pdf.getSubject()?.includes(version.contentHash) ||
    required.some((value) => !text.includes(value)) ||
    pdf
      .getPages()
      .some((page) => page.getWidth() !== 612 || page.getHeight() !== 792)
  )
    throw new Error(
      "Serialized PDF content does not match the approved version.",
    );
  return { text, pages: pdf.getPageCount() };
}
