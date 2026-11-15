import { test as base, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { modelFixtures } from "../../src/features/simulator/demo-fixtures.ts";
import { parseMoneyInput } from "../../src/lib/money.ts";
import { questions } from "../../src/features/questionnaire/catalog.ts";
import { validateAnswer } from "../../src/features/questionnaire/validation.ts";

async function writeIfChanged(file: string, source: string) {
  if (await readFile(file, 'utf8').catch(() => null) !== source) await writeFile(file, source);
}

const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await use(errors);
      expect(errors, "Browser console and uncaught errors").toEqual([]);
    },
    { auto: true },
  ],
});

test("money parsing rejects invalid amounts and preserves exact cents", () => {
  expect(parseMoneyInput("1,234.56")).toEqual({ ok: true, value: 123456 });
  expect(parseMoneyInput(".50")).toEqual({ ok: true, value: 50 });
  expect(parseMoneyInput("0")).toEqual({ ok: true, value: 0 });
  expect(parseMoneyInput("10000000000.00")).toEqual({
    ok: true,
    value: 1000000000000,
  });
  for (const value of [
    "-1",
    "1.001",
    "1e3",
    "Infinity",
    "1,23",
    "",
    "10000000000.01",
  ])
    expect(parseMoneyInput(value).ok, value).toBe(false);
  expect(questions).toHaveLength(15);
  expect(questions.filter((question) => question.required)).toHaveLength(14);
  expect(validateAnswer(questions[2], [])).toBeTruthy();
  expect(validateAnswer(questions[4], "not-an-option")).toBeTruthy();
  expect(validateAnswer(questions[13], "10001")).toBeTruthy();
  expect(validateAnswer(questions[14], "x".repeat(501))).toBeTruthy();
});

test("landing links, browser history, and mobile navigation work", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Money is personal.",
  );
  await page
    .getByRole("link", { name: "Explore Preview", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/sessions\/demo$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A plan begins",
  );
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("link", { name: "Explore the numbers", exact: true })
    .click();
  await expect(page).toHaveURL(/\/simulator$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "balance",
  );
  await page.goBack();
  await expect(page).toHaveURL(/\/sessions\/demo$/);
  await page.goto("/does-not-exist");
  await expect(page.getByRole("heading")).toContainText(
    "isn’t part of your plan",
  );
});

test("questionnaire validates, remembers local navigation, and finishes with optional consents", async ({
  page,
}) => {
  await page.goto("/sessions/demo/questionnaire");
  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page.getByRole("alert")).toContainText("Add an answer");
  const amount = page.getByRole("textbox", { name: "Amount in dollars" });
  for (const value of ["-20", "12.345", "10000000000.01"]) {
    await amount.fill(value);
    await page.getByRole("button", { name: "Next question" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/questionnaire$/);
  }
  await amount.fill("0");
  await page.getByRole("button", { name: "Next question" }).click();
  await expect(page).toHaveURL(/step=2$/);
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(amount).toHaveValue("0");
  await page.getByRole("button", { name: "Use example answers" }).click();
  for (let index = 1; index < 15; index++) {
    await page.getByRole("button", { name: "Next question" }).click();
    await expect(page).toHaveURL(new RegExp(`step=${index + 1}$`));
  }
  await expect(
    page.getByRole("textbox", { name: "Your private note" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review sharing choices" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "You choose what to share.",
  );
  await expect(page.getByRole("checkbox")).toHaveCount(2);
  for (const checkbox of await page.getByRole("checkbox").all())
    await expect(checkbox).not.toBeChecked();
  await page
    .getByRole("button", { name: "Finish preview", exact: true })
    .click();
  await expect(page).toHaveURL(/questionnaire\/complete$/);
  await expect(page.getByText("Not selected", { exact: true })).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole("heading")).toContainText("still in progress");
});

test("direct consent navigation cannot skip required questions", async ({
  page,
}) => {
  await page.goto("/sessions/demo/questionnaire/consent");
  await expect(page.getByRole("heading")).toContainText("questions still need");
  await page.getByRole("link", { name: "Continue my questionnaire" }).click();
  await expect(page).toHaveURL(/step=1$/);
});

test("keyboard access and the mobile drawer keep focus in visible controls", async ({
  page,
}, info) => {
  await page.goto("/sessions/demo");
  const navigation = page.getByRole("navigation", { name: "Your plan" });
  if (info.project.name === "mobile") {
    await expect(navigation).not.toBeVisible();
    const trigger = page.getByRole("button", { name: "Open navigation" });
    await trigger.click();
    await expect(
      page.getByRole("link", { name: "Our starting point", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(navigation).not.toBeVisible();
    await expect(trigger).toBeFocused();
  } else {
    await expect(navigation).toBeVisible();
    await page
      .getByRole("link", { name: "My questionnaire", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/questionnaire$/);
  }
});

test("fixture results never pretend to recalculate changed inputs", async ({
  page,
}) => {
  await page.goto("/sessions/demo/simulator");
  await expect(
    page.getByText("Explore a fixed example budget", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".financial-summary")).toContainText("$2,000");
  await page.getByRole("button", { name: "Equal", exact: true }).click();
  await expect(page.locator(".financial-summary")).toContainText("$1,600");
  await page
    .getByRole("textbox", { name: "Rent & home", exact: true })
    .fill("2500");
  await expect(
    page.getByRole("heading", {
      name: "Start your plan to explore your own numbers.",
    }),
  ).toBeVisible();
  await expect(page.locator(".financial-summary")).toHaveCount(0);
  await page.getByRole("button", { name: "Restore example plan" }).click();
  await page.getByRole("button", { name: "Custom", exact: true }).click();
  await page.getByRole("slider", { name: "Partner A’s share" }).focus();
  await page.getByRole("slider", { name: "Partner A’s share" }).press("Home");
  await expect(page.locator(".financial-summary")).toHaveCount(0);
  await page.getByRole("button", { name: "An unexpected bill" }).click();
  await expect(
    page.getByText("Scenario example only", { exact: true }),
  ).toBeVisible();
});

test("agreement editing validates and produces only an unapproved draft", async ({
  page,
}) => {
  await page.goto("/sessions/demo/agreement");
  await expect(
    page.getByRole("button", { name: "Approve as Partner A" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Approve as Partner B" }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Discuss a purchase above" })
    .fill("-10");
  await page.getByRole("button", { name: "Preview draft document" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Discuss a purchase above" })
    .fill("750");
  await page.getByLabel("Next review date").fill("2020-01-01");
  await page.getByRole("button", { name: "Preview draft document" }).click();
  await expect(page.getByRole("alert")).toContainText("after today");
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 30);
  await page
    .getByLabel("Next review date")
    .fill(next.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Preview draft document" }).click();
  await expect(page).toHaveURL(/agreement\/preview$/);
  await expect(page.locator(".agreement-document")).toContainText("$750");
  await expect(
    page.getByText("UNAPPROVED DRAFT", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Not approved · Preview", { exact: true }),
  ).toHaveCount(2);
});

test("live actions are disabled and invitation fragments are removed", async ({
  page,
}) => {
  await page.goto("/create");
  await expect(
    page.getByRole("button", { name: "Create session" }),
  ).toBeDisabled();
  await page.goto("/join#token=example-preview-token");
  await expect(page).toHaveURL(/\/join$/);
  await expect(
    page.getByRole("button", { name: "Join session" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Expired", exact: true }).click();
  await expect(
    page.getByText("Invitation expired — example error state only.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.goto("/sessions/not-a-real-session");
  await expect(page.getByRole("heading")).toContainText(
    "Open your shared plan",
  );
});

test("screens render without horizontal overflow at the target viewport", async ({
  page,
}, info) => {
  await mkdir("artifacts/screenshots", { recursive: true });
  const screens = [
    ["landing", "/"],
    ["create", "/create"],
    ["join", "/join"],
    ["overview", "/sessions/demo"],
    ["questionnaire", "/sessions/demo/questionnaire"],
    ["differences", "/sessions/demo/differences"],
    ["simulator", "/sessions/demo/simulator"],
    ["agreement", "/sessions/demo/agreement"],
    ["document", "/sessions/demo/agreement/preview"],
  ];
  for (const [name, path] of screens) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow, `${name} horizontal overflow`).toBe(false);
    await page.screenshot({
      path: `artifacts/screenshots/${info.project.name}-${name}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
});

// Isolated, example presentation harness; generated under ignored artifacts/.
// No routes, production fixtures, API mocks or financial calculators are added.
test.beforeAll(async () => {
  await mkdir("artifacts", { recursive: true });
  await writeIfChanged(
    "artifacts/financial-preview.tsx",
    `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { FinancialSummary } from '/src/features/simulator/FinancialSummary';
    import { BudgetBreakdown } from '/src/components/financial/BudgetBreakdown';
    import { ScenarioComparison } from '/src/components/financial/ScenarioComparison';
    import { ContributionComparison } from '/src/components/financial/ContributionComparison';
    import { AgreementConfirmations } from '/src/features/agreement/presentation/AgreementConfirmations';
    export function mount(props) {
      document.getElementById('root').style.display = 'none';
      const target = document.createElement('main');
      target.id = 'financial-test-preview';
      target.className = 'surface';
      target.style.cssText = 'padding:20px;max-width:900px;margin:12px auto';
      document.body.append(target);
      createRoot(target).render(<>
        {props.result && props.result.status === 'available' && <FinancialSummary result={props.result} />}
        {props.result && props.result.status === 'unavailable' && <ContributionComparison result={props.result} />}
        {props.expenses && <BudgetBreakdown expenses={props.expenses} monthlyTotalCents={props.total} />}
        {props.scenario && <ScenarioComparison {...props.scenario} />}
        {props.confirmations && <AgreementConfirmations version={props.version} />}
      </>);
    }
  `,
  );
});

test("budget chart exposes exact categories, shares, and savings once", async ({
  page,
}) => {
  await page.goto("/sessions/demo/simulator");
  const legend = page.getByRole("table", {
    name: /Monthly budget by category/,
  });
  await expect(legend.getByRole("row")).toHaveCount(6);
  await expect(
    legend.getByRole("row", { name: "Shared savings $0" }),
  ).toBeVisible();
  await expect(page.getByText("62.5% of monthly plan").first()).toBeVisible();
  await expect(page.getByText("37.5% of monthly plan").first()).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Partner A budget" }),
  ).toContainText("$2,400");
  await expect(
    page.getByRole("region", { name: "Partner B budget" }),
  ).toContainText("$1,500");
});

test("negative balances, zero income, one-time costs and warnings stay visible", async ({
  page,
}, info) => {
  await page.goto("/");
  const allocation = {
    monthlyContributionCents: 5000,
    oneOffContributionCents: 5000,
    totalContributionCents: 10000,
    incomeBurdenPercent: null,
    incomeAfterSharedCostsCents: -10000,
    availableAfterObligationsCents: -15000,
  };
  const result = {
    ...modelFixtures.equal.result,
    monthlySharedTotalCents: 10000,
    oneOffSharedTotalCents: 10000,
    allocations: { A: allocation, B: allocation },
    warnings: [
      { code: "zero_income", partnerSlot: "A" },
      { code: "income_shortfall", partnerSlot: "B" },
      { code: "reserve_exhausted", partnerSlot: null },
    ],
  };
  await page.addScriptTag({
    type: "module",
    content: `import { mount } from '/artifacts/financial-preview.tsx'; mount(${JSON.stringify({ result })});`,
  });
  const preview = page.locator("#financial-test-preview");
  await expect(preview).toContainText("N/A · no income");
  await expect(preview).toContainText("-$150");
  await expect(preview).toContainText("One-time contribution");
  await expect(preview).toContainText("Total for this scenario");
  await expect(
    preview.getByRole("status", { name: "Financial warnings" }),
  ).toContainText("Emergency reserve exhausted");
  await expect(preview.locator(".finance-negative").first()).toHaveCSS(
    "color",
    "rgb(161, 47, 59)",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `artifacts/screenshots/${info.project.name}-financial-shortfall.png`,
    fullPage: true,
  });
});

test("zero budgets and unavailable proportional outputs never invent amounts", async ({
  page,
}) => {
  await page.goto("/");
  await page.addScriptTag({
    type: "module",
    content: `import { mount } from '/artifacts/financial-preview.tsx'; mount(${JSON.stringify({ result: { status: "unavailable", model: { kind: "proportional" }, reason: "zero_total_income" }, expenses: { rent: 0, utilities: 0, groceries: 0, other: 0, shared_savings: 0 }, total: 0, scenario: { before: null, after: null } })});`,
  });
  const preview = page.locator("#financial-test-preview");
  await expect(preview).toContainText("both incomes are zero");
  await expect(preview).toContainText("No monthly costs allocated");
  await expect(preview).not.toContainText("NaN");
  await expect(preview).not.toContainText("Infinity");
  await expect(preview.locator(".financial-summary")).toHaveCount(0);
  await expect(
    preview.getByRole("table", {
      name: "Baseline and scenario amounts in USD",
    }),
  ).toHaveCount(0);
  await expect(preview).toContainText("Scenario amounts are not available");
});

test("before and after render supplied outputs including savings and reserve", async ({
  page,
}, info) => {
  await page.goto("/");
  const input = {
    sharedExpenses: {
      rent: 220000,
      utilities: 30000,
      groceries: 50000,
      other: 20000,
      shared_savings: 50000,
    },
    sharedEmergencyFundCents: 0,
  };
  // Snapshots from the supplied backend engine: Proportional, $500 savings,
  // then a $1,400 one-time expense using the existing $1,000 reserve.
  const before = {
    effectiveInput: { ...input, sharedEmergencyFundCents: 100000 },
    reserveUsedCents: 0,
    split: {
      ...modelFixtures.proportional.result,
      monthlySharedTotalCents: 370000,
      allocations: {
        A: { monthlyContributionCents: 231250, oneOffContributionCents: 0,
          totalContributionCents: 231250, incomeBurdenPercent: "46.25",
          incomeAfterSharedCostsCents: 268750, availableAfterObligationsCents: 208750 },
        B: { monthlyContributionCents: 138750, oneOffContributionCents: 0,
          totalContributionCents: 138750, incomeBurdenPercent: "46.25",
          incomeAfterSharedCostsCents: 161250, availableAfterObligationsCents: 131250 },
      },
    },
  };
  const after = {
    effectiveInput: input,
    reserveUsedCents: 100000,
    split: {
      ...before.split,
      oneOffSharedTotalCents: 40000,
      allocations: {
        A: { ...before.split.allocations.A, oneOffContributionCents: 25000,
          totalContributionCents: 256250, incomeBurdenPercent: "51.25",
          incomeAfterSharedCostsCents: 243750, availableAfterObligationsCents: 183750 },
        B: { ...before.split.allocations.B, oneOffContributionCents: 15000,
          totalContributionCents: 153750, incomeBurdenPercent: "51.25",
          incomeAfterSharedCostsCents: 146250, availableAfterObligationsCents: 116250 },
      },
    },
  };
  await page.addScriptTag({
    type: "module",
    content: `import { mount } from '/artifacts/financial-preview.tsx'; mount(${JSON.stringify({ scenario: { before, after } })});`,
  });
  const table = page.getByRole("table", {
    name: "Baseline and scenario amounts in USD",
  });
  await expect(
    table.getByRole("row", { name: "Monthly plan $3,700 $3,700" }),
  ).toBeVisible();
  await expect(
    table.getByRole("row", { name: "Savings / month $500 $500" }),
  ).toBeVisible();
  await expect(
    table.getByRole("row", { name: "Reserve used $0 $1,000" }),
  ).toBeVisible();
  await expect(
    table.getByRole("row", { name: "Uncovered one-time cost $0 $400" }),
  ).toBeVisible();
  await page.screenshot({
    path: `artifacts/screenshots/${info.project.name}-scenario-comparison.png`,
    fullPage: true,
  });
});

test("consent and print preview preserve independent choices and unapproved status", async ({
  page,
}, info) => {
  await page.goto("/sessions/demo/questionnaire");
  await page.getByRole("button", { name: "Use example answers" }).click();
  for (let index = 1; index < 15; index++)
    await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "Review sharing choices" }).click();
  const choices = page.getByRole("checkbox");
  await expect(choices).toHaveCount(2);
  await expect(choices.nth(0)).not.toBeChecked();
  await expect(choices.nth(1)).not.toBeChecked();
  await choices.nth(0).check();
  await expect(choices.nth(1)).not.toBeChecked();
  await page.screenshot({
    path: `artifacts/screenshots/${info.project.name}-consent.png`,
    fullPage: true,
  });
  await page.goto("/sessions/demo/agreement/preview");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).not.toBeVisible();
  await expect(page.locator(".document-toolbar")).not.toBeVisible();
  await expect(
    page.getByText("UNAPPROVED DRAFT", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Not approved · Preview", { exact: true }),
  ).toHaveCount(2);
  await page.screenshot({
    path: `artifacts/screenshots/${info.project.name}-document-print.png`,
    fullPage: true,
  });
});

test("server confirmations display one partner without confirming the other", async ({
  page,
}) => {
  await page.goto("/");
  const version = {
    versionNumber: 7,
    status: "under_review",
    approvals: {
      A: {
        versionId: "version-7",
        approvedAt: "2026-11-14T10:00:00Z",
        contentHash: "a".repeat(64),
      },
      B: null,
    },
  };
  await page.addScriptTag({
    type: "module",
    content: `import { mount } from '/artifacts/financial-preview.tsx'; mount(${JSON.stringify({ confirmations: true, version })});`,
  });
  const region = page.getByRole("region", { name: "Partner confirmations" });
  await expect(region).toContainText("Version 7 · under review");
  await expect(region.getByText("Confirmed", { exact: true })).toHaveCount(1);
  await expect(
    region.getByText("Pending confirmation", { exact: true }),
  ).toHaveCount(1);
  await expect(region).not.toContainText("Version ID:");
  await expect(region).toContainText("Nov 14, 2026");
});
