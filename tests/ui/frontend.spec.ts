import { test as base, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { parseMoneyInput } from "../../src/lib/money.ts";
import { questions } from "../../src/features/questionnaire/catalog.ts";
import { validateAnswer } from "../../src/features/questionnaire/validation.ts";

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
    .getByRole("link", { name: "Try Demo", exact: true })
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
  await page.getByRole("button", { name: "Use fictional example" }).click();
  for (let index = 1; index < 15; index++)
    await page.getByRole("button", { name: "Next question" }).click();
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
    page.getByText("hand-authored fictional fixtures"),
  ).toBeVisible();
  await expect(page.locator(".financial-summary")).toContainText("$2,000");
  await page.getByRole("button", { name: "Equal", exact: true }).click();
  await expect(page.locator(".financial-summary")).toContainText("$1,600");
  await page
    .getByRole("textbox", { name: "Rent & home", exact: true })
    .fill("2500");
  await expect(
    page.getByRole("heading", {
      name: "Your draft inputs are ready for an engine.",
    }),
  ).toBeVisible();
  await expect(page.locator(".financial-summary")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Restore the fictional example" })
    .click();
  await page.getByRole("button", { name: "Custom", exact: true }).click();
  await page.getByRole("slider", { name: "Partner A’s share" }).focus();
  await page.getByRole("slider", { name: "Partner A’s share" }).press("Home");
  await expect(page.locator(".financial-summary")).toHaveCount(0);
  await page.getByRole("button", { name: "An unexpected bill" }).click();
  await expect(
    page.getByText("Stress calculation not connected", { exact: true }),
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
    page.getByText("Not approved · not connected", { exact: true }),
  ).toHaveCount(2);
});

test("live actions are disabled and invitation fragments are removed", async ({
  page,
}) => {
  await page.goto("/create");
  await expect(
    page.getByRole("button", { name: "Create session — not connected" }),
  ).toBeDisabled();
  await page.goto("/join#token=fictional-preview-token");
  await expect(page).toHaveURL(/\/join$/);
  await expect(
    page.getByRole("button", { name: "Join session — not connected" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Expired", exact: true }).click();
  await expect(
    page.getByText("Invitation expired — example error state only.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.goto("/sessions/not-a-real-session");
  await expect(page.getByRole("heading")).toContainText("not connected yet");
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
