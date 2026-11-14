import type { BasisPoints, Cents } from "../types/domain";

export const MAX_CENTS = 1_000_000_000_000;
export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CENTS)
    throw new RangeError("Invalid integer cents.");
  return value as Cents;
}
export function basisPoints(value: number): BasisPoints {
  if (!Number.isInteger(value) || value < 0 || value > 10_000)
    throw new RangeError("Invalid basis points.");
  return value as BasisPoints;
}
export type MoneyParseResult =
  { ok: true; value: Cents } | { ok: false; error: string };
/** Exact input parsing only; this is not the financial simulation engine. */
export function parseMoneyInput(raw: string): MoneyParseResult {
  const text = raw.trim();
  if (!text) return { ok: false, error: "Enter an amount. Zero is okay." };
  if (
    text.length > 40 ||
    !/^(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?|\.\d{1,2})$/.test(text)
  )
    return {
      ok: false,
      error:
        "Use a positive dollar amount or zero, with up to two decimal places.",
    };
  const [whole = "", fraction = ""] = text.replaceAll(",", "").split(".");
  const result = BigInt(whole || "0") * 100n + BigInt(fraction.padEnd(2, "0"));
  if (result > BigInt(MAX_CENTS))
    return {
      ok: false,
      error: "Enter an amount no greater than $10,000,000,000.",
    };
  return { ok: true, value: cents(Number(result)) };
}
export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 100 === 0 ? 0 : 2,
  }).format(value / 100);
}
