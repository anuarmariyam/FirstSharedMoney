import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { liveEnvironment } from "./environment.ts";
import { questionnaireValues } from "./questionnaire-fixtures.ts";
import { parseQuestionnaire } from "../../supabase/functions/_shared/questionnaire-contract.ts";
import { questions } from "../../src/features/questionnaire/catalog.ts";
import { isUUID } from "../../supabase/functions/_shared/session-contract.ts";

test("real questionnaires autosave privately, recover from network/revision errors, and persist independent consents", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const env = liveEnvironment();
  const database = new Client({
    connectionString: env.databaseURL,
    ssl: {
      rejectUnauthorized: true,
      ...(env.caFile ? { ca: readFileSync(env.caFile, "utf8") } : {}),
    },
    connectionTimeoutMillis: 10000,
  });
  await database.connect();
  const contextA = await browser.newContext(),
    contextB = await browser.newContext();
  const a = await contextA.newPage(),
    b = await contextB.newPage();
  const pages = [a, b];
  const errors: string[] = [];
  for (const page of pages)
    page.on("pageerror", (error) => errors.push(error.name));
  const storageKey = `fsm-auth-${new URL(env.url).hostname}`;
  let cleanupFailed = false;
  async function identity(page: Page) {
    return page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw
        ? ((JSON.parse(raw) as { user?: { id?: string } }).user?.id ?? null)
        : null;
    }, storageKey);
  }
  async function fillAndSave(page: Page, value: string) {
    const saved = page.waitForResponse(
      (response) =>
        response.url().includes("/answers/monthly_income") &&
        response.request().method() === "PUT" &&
        response.status() === 200,
    );
    await page.getByRole("textbox", { name: "Amount in dollars" }).fill(value);
    await saved;
    await expect(page.getByRole("status")).toHaveText("Saved");
  }
  async function fillRequiredViaRealAPI(page: Page, coupleId: string) {
    // Use a genuine browser Auth session; never print or assert on its token.
    const jwt = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw
        ? (JSON.parse(raw) as { access_token?: string }).access_token
        : undefined;
    }, storageKey);
    if (!jwt) throw new Error("Real browser identity is missing.");
    async function call(path: string, method = "GET", body?: unknown) {
      const response = await fetch(
        `${env.url}/functions/v1/fsm-api/v1/couples/${coupleId}/${path}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${jwt}`,
            apikey: env.key,
            "Content-Type": "application/json",
            origin: "http://127.0.0.1:5175",
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok)
        throw new Error(
          "Real questionnaire fixture request failed; payload suppressed.",
        );
      return parseQuestionnaire((await response.json()).data);
    }
    let q = await call("questionnaire");
    for (const question of questions.filter((q) => q.required))
      if (!q.answers.some((answer) => answer.questionCode === question.code))
        q = await call(`answers/${question.code}`, "PUT", {
          questionCode: question.code,
          value: questionnaireValues[question.code],
          expectedRevision: q.revision,
        });
  }
  try {
    await a.goto("http://127.0.0.1:5175/create");
    await a
      .getByRole("button", { name: "Create session", exact: true })
      .click();
    await expect(a).toHaveURL(/\/sessions\/[a-f0-9-]{36}$/);
    const id = new URL(a.url()).pathname.split("/").at(-1)!;
    const invitation = await a
      .getByLabel("Single-use partner invitation")
      .inputValue();
    try {
      await b.goto(invitation);
    } catch {
      throw new Error("Separate partner could not open the invitation.");
    }
    await b.getByRole("button", { name: "Join session", exact: true }).click();
    await expect(b).toHaveURL(/\/sessions\/[a-f0-9-]{36}$/);
    const aId = await identity(a),
      bId = await identity(b);
    expect(isUUID(aId) && isUUID(bId) && aId !== bId).toBe(true);
    const base = `http://127.0.0.1:5175/sessions/${id}/questionnaire`;
    await a.goto(base);
    await b.goto(base);
    await expect(
      b.getByRole("textbox", { name: "Amount in dollars" }),
    ).toHaveValue("");
    await fillAndSave(a, "5010.55");
    await a.reload();
    await expect(
      a.getByRole("textbox", { name: "Amount in dollars" }),
    ).toHaveValue("5010.55");
    await b.reload();
    await expect(
      b.getByRole("textbox", { name: "Amount in dollars" }),
    ).toHaveValue("");

    const other = await contextA.newPage();
    other.on("pageerror", (error) => errors.push(error.name));
    await other.goto(base);
    await expect(
      other.getByRole("textbox", { name: "Amount in dollars" }),
    ).toHaveValue("5010.55");
    await fillAndSave(a, "5200.10");
    const conflict = other.waitForResponse(
      (response) =>
        response.url().includes("/answers/monthly_income") &&
        response.status() === 409,
    );
    await other
      .getByRole("textbox", { name: "Amount in dollars" })
      .fill("5300.20");
    await conflict;
    await expect(
      other.getByText("Saved answer for this question:", { exact: false }),
    ).toContainText("5200.10");
    await expect(
      other.getByRole("textbox", { name: "Amount in dollars" }),
    ).toHaveValue("5300.20");
    const resolved = other.waitForResponse(
      (response) =>
        response.url().includes("/answers/monthly_income") &&
        response.status() === 200,
    );
    await other.getByRole("button", { name: "Keep my changes" }).click();
    await resolved;
    await expect(other.getByRole("status")).toHaveText("Saved");
    await other.close();
    await a.reload();
    await expect(
      a.getByRole("textbox", { name: "Amount in dollars" }),
    ).toHaveValue("5300.20");

    // Abort only backend traffic: local Vite/HMR remains online, with no mocked API responses.
    await contextA.route("**/functions/v1/fsm-api/**", (route) =>
      route.abort("internetdisconnected"),
    );
    await a.getByRole("textbox", { name: "Amount in dollars" }).fill("5400.30");
    await expect(a.getByRole("alert")).toContainText(
      "server could not be reached",
    );
    await expect(
      a.getByRole("textbox", { name: "Amount in dollars" }),
    ).toHaveValue("5400.30");
    await contextA.unroute("**/functions/v1/fsm-api/**");
    const retried = a.waitForResponse(
      (response) =>
        response.url().includes("/answers/monthly_income") &&
        response.status() === 200,
    );
    await a.getByRole("button", { name: "Retry saving" }).click();
    await retried;
    await expect(a.getByRole("status")).toHaveText("Saved");

    await fillRequiredViaRealAPI(a, id);
    await fillRequiredViaRealAPI(b, id);
    await a.goto(`${base}?step=15`);
    const noteSaved = a.waitForResponse(
      (response) =>
        response.url().includes("/answers/discussion_note") &&
        response.status() === 200,
    );
    await a
      .getByRole("textbox", { name: "Your private note" })
      .fill("Sample A private note");
    await noteSaved;
    await expect(a.getByRole("status")).toHaveText("Saved");
    await a.getByRole("button", { name: "Review sharing choices" }).click();
    await expect(a).toHaveURL(/\/consent$/);
    for (const checkbox of await a.getByRole("checkbox").all())
      await expect(checkbox).not.toBeChecked();
    await a.getByRole("button", { name: "Submit my answers" }).click();
    await expect(
      a.getByRole("heading", { name: "Your perspective is saved." }),
    ).toBeVisible();
    await a.reload();
    await expect(a.getByText("Not allowed", { exact: true })).toHaveCount(2);
    await a.getByRole("link", { name: "Sharing choices", exact: true }).click();
    await a.getByRole("checkbox").nth(0).check();
    await a.getByRole("button", { name: "Save sharing choices" }).click();
    await expect(a).toHaveURL(/\/complete$/);
    await a.reload();
    await expect(a.getByText("Allowed", { exact: true })).toHaveCount(1);

    await b.goto(`${base}/consent`);
    for (const checkbox of await b.getByRole("checkbox").all())
      await expect(checkbox).not.toBeChecked();
    await b.getByRole("checkbox").nth(1).check();
    await b.getByRole("button", { name: "Submit my answers" }).click();
    await expect(
      b.getByRole("heading", { name: "Your perspective is saved." }),
    ).toBeVisible();
    await b.reload();
    await expect(b.getByText("Allowed", { exact: true })).toHaveCount(1);
    await expect(
      b.getByText("Sample A private note", { exact: true }),
    ).toHaveCount(0);
    await a.getByRole("button", { name: "Edit my answers" }).click();
    await expect(
      a.getByRole("textbox", { name: "Amount in dollars" }),
    ).toHaveValue("5400.30");
    await a.reload();
    await expect(
      a.getByRole("textbox", { name: "Amount in dollars" }),
    ).toHaveValue("5400.30");
    await a.goto(`${base}/consent`);
    for (const checkbox of await a.getByRole("checkbox").all())
      await expect(checkbox).not.toBeChecked();
    await b.reload();
    await expect(b.getByText("Allowed", { exact: true })).toHaveCount(1);
    expect(errors).toEqual([]);
  } finally {
    await contextA.unroute("**/functions/v1/fsm-api/**").catch(() => undefined);
    const ids = [];
    for (const page of pages) {
      const id = await identity(page).catch(() => null);
      if (isUUID(id)) ids.push(id);
    }
    try {
      if (ids.length) {
        await database.query(
          "delete from public.couples where created_by_auth_user_id=any($1::uuid[])",
          [ids],
        );
        await database.query(
          "delete from auth.users u where u.id=any($1::uuid[]) and not exists(select 1 from public.partners p where p.auth_user_id=u.id) and not exists(select 1 from public.couples c where c.created_by_auth_user_id=u.id)",
          [ids],
        );
      }
    } catch {
      cleanupFailed = true;
      console.error(
        "Questionnaire live cleanup failed; inspect only test-owned records.",
      );
    }
    await contextA.close();
    await contextB.close();
    await database.end();
  }
  expect(cleanupFailed, "Targeted live questionnaire cleanup").toBe(false);
});
