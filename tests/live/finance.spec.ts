import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { liveEnvironment } from "./environment.ts";
import { submitFinanceFixture } from "./finance-fixture.ts";
import { money } from "../../src/engines/financial.ts";
import { parseQuestionnaire } from "../../supabase/functions/_shared/questionnaire-contract.ts";
import { isUUID } from "../../supabase/functions/_shared/session-contract.ts";

test("live derived comparison and financial scenarios update, persist and honor independent withdrawal", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const env = liveEnvironment();
  if (env.ref !== "lgboxbtxutgggvluhhqt")
    throw new Error("Unexpected test project.");
  const db = new Client({
    connectionString: env.databaseURL,
    ssl: {
      rejectUnauthorized: true,
      ...(env.caFile ? { ca: readFileSync(env.caFile, "utf8") } : {}),
    },
    connectionTimeoutMillis: 10000,
  });
  await db.connect();
  const ca = await browser.newContext(),
    cb = await browser.newContext(),
    a = await ca.newPage(),
    b = await cb.newPage();
  const storageKey = `fsm-auth-${new URL(env.url).hostname}`;
  let cleanupFailed = false;
  const errors: string[] = [];
  a.on("pageerror", (error) => errors.push(error.name));
  b.on("pageerror", (error) => errors.push(error.name));
  async function identity(page: Page) {
    return page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw
        ? ((JSON.parse(raw) as { user?: { id?: string } }).user?.id ?? null)
        : null;
    }, storageKey);
  }
  async function client(page: Page) {
    const jwt = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw
        ? (JSON.parse(raw) as { access_token?: string }).access_token
        : undefined;
    }, storageKey);
    if (!jwt) throw new Error("Real browser session missing.");
    return createClient(env.url, env.key, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  async function changed(action: () => Promise<unknown>) {
    const saved = a.waitForResponse(
      (r) =>
        /\/scenarios$/.test(new URL(r.url()).pathname) &&
        r.request().method() === "POST" &&
        r.ok(),
    );
    await action();
    await saved;
    await expect(a.getByText("Saved scenario", { exact: true })).toBeVisible();
  }
  const contributions = () => a.locator(".financial-summary .contribution");
  try {
    await a.goto("http://127.0.0.1:5175/create");
    await a
      .getByRole("button", { name: "Create session", exact: true })
      .click();
    await expect(a).toHaveURL(/\/sessions\/[a-f0-9-]{36}$/);
    const id = new URL(a.url()).pathname.split("/").at(-1)!;
    const invite = await a
      .getByLabel("Single-use partner invitation")
      .inputValue();
    try {
      await b.goto(invite);
    } catch {
      throw new Error("Could not open partner invitation.");
    }
    await b.getByRole("button", { name: "Join session", exact: true }).click();
    await expect(b).toHaveURL(/\/sessions\/[a-f0-9-]{36}$/);
    const aa = await client(a),
      bb = await client(b);
    let qa = await submitFinanceFixture(
      aa,
      id,
      {
        monthly_income: { kind: "money", cents: money(500000) },
        personal_obligations: { kind: "money", cents: money(60000) },
        discussion_note: { kind: "text", text: "PRIVATE_A_BROWSER_NOTE" },
      },
      { comparison: true, budget: false },
    );
    let qb = await submitFinanceFixture(
      bb,
      id,
      {
        monthly_income: { kind: "money", cents: money(300000) },
        personal_obligations: { kind: "money", cents: money(30000) },
        split_preference: { kind: "single_choice", value: "proportional" },
        discussion_note: { kind: "text", text: "PRIVATE_B_BROWSER_NOTE" },
      },
      { comparison: true, budget: false },
    );
    const root = `http://127.0.0.1:5175/sessions/${id}`;
    await a.goto(`${root}/differences`);
    await expect(
      a.getByRole("heading", { name: "Different Expectations" }),
    ).toBeVisible();
    await expect(a.locator(".comparison-different")).not.toHaveCount(0);
    await expect(
      a.getByText("PRIVATE_A_BROWSER_NOTE", { exact: false }),
    ).toHaveCount(0);
    await expect(a.getByText("$5,000.00", { exact: false })).toHaveCount(0);
    await a.goto(`${root}/simulator`);
    await expect(
      a.getByRole("heading", { name: "Your shared budget is not ready." }),
    ).toBeVisible();
    const privacy = async (
      c: typeof aa,
      revision: number,
      comparison: boolean,
      budget: boolean,
    ) => {
      const response = await c.rpc("fsm_update_privacy", {
        p_couple_id: id,
        p_expected_revision: revision,
        p_comparison: comparison,
        p_budget: budget,
      });
      if (response.error)
        throw new Error("Fixture privacy update failed; data suppressed.");
      return parseQuestionnaire(response.data);
    };
    qa = await privacy(aa, qa.revision, false, true);
    qb = await privacy(bb, qb.revision, false, true);
    await a.goto(`${root}/differences`);
    await expect(
      a.getByRole("heading", {
        name: "Your perspectives are not ready to compare.",
      }),
    ).toBeVisible();
    await a.goto(`${root}/simulator`);
    await expect(a.getByText("Saved scenario", { exact: true })).toBeVisible();
    await changed(() =>
      a.getByRole("textbox", { name: "Rent & home", exact: true }).fill("3200"),
    );
    await expect(contributions().nth(0)).toContainText("$2,000");
    await expect(contributions().nth(1)).toContainText("$1,200");
    const insights = a.getByRole('region', { name: 'Your Financial Insights' });
    await insights.getByRole('button', { name: 'Generate Insights' }).click();
    await expect(insights).toContainText('Your shared monthly plan is $3,200');
    await expect(insights).toContainText('No information is sent to an outside AI service');
    await changed(() =>
      a.getByRole("button", { name: "Equal", exact: true }).click(),
    );
    await expect(contributions().nth(0)).toContainText("$1,600");
    await changed(() =>
      a.getByRole("textbox", { name: "Rent & home", exact: true }).fill("0.01"),
    );
    await expect(contributions().nth(0)).toContainText("$0.01");
    await expect(contributions().nth(1)).toHaveText("$0 / mo");
    await changed(() =>
      a.getByRole("textbox", { name: "Rent & home", exact: true }).fill("3200"),
    );
    await changed(() =>
      a.getByRole("button", { name: "Rent +$300", exact: true }).click(),
    );
    await expect(contributions().nth(0)).toContainText("$1,750");
    await changed(() =>
      a.getByRole("button", { name: "Rent +$300", exact: true }).click(),
    );
    await changed(() =>
      a
        .getByRole("textbox", {
          name: "Shared reserve available now",
          exact: true,
        })
        .fill("600"),
    );
    await changed(() =>
      a
        .getByRole("button", { name: "$1,000 unexpected cost", exact: true })
        .click(),
    );
    await expect(a.getByText("Reserve used:", { exact: false })).toContainText(
      "$600",
    );
    await expect(
      a.getByText("Uncovered one-off expense:", { exact: false }),
    ).toContainText("$400");
    const savedURL = a.url();
    expect(new URL(savedURL).searchParams.has("scenario")).toBe(true);
    await a.reload();
    await expect(a.getByText("Saved scenario", { exact: true })).toBeVisible();
    await expect(
      a.getByRole("textbox", { name: "Rent & home", exact: true }),
    ).toHaveValue("3200.00");
    await expect(
      a.getByText("Uncovered one-off expense:", { exact: false }),
    ).toContainText("$400");
    await a.setViewportSize({ width: 390, height: 844 });
    expect(
      await a.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    qb = await privacy(bb, qb.revision, false, false);
    await a.goto(savedURL);
    await expect(
      a.getByRole("heading", { name: "Your shared budget is not ready." }),
    ).toBeVisible();
    await expect(a.locator(".financial-summary")).toHaveCount(0);
    await expect(
      a.getByText("PRIVATE_B_BROWSER_NOTE", { exact: false }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    const ids = [];
    for (const page of [a, b]) {
      const value = await identity(page).catch(() => null);
      if (isUUID(value)) ids.push(value);
    }
    try {
      if (ids.length) {
        await db.query(
          "delete from public.couples where created_by_auth_user_id=any($1::uuid[])",
          [ids],
        );
        await db.query(
          "delete from auth.users u where u.id=any($1::uuid[]) and not exists(select 1 from public.partners p where p.auth_user_id=u.id) and not exists(select 1 from public.couples c where c.created_by_auth_user_id=u.id)",
          [ids],
        );
      }
    } catch {
      cleanupFailed = true;
      console.error(
        "Live finance cleanup failed; inspect only test-created records.",
      );
    }
    await ca.close();
    await cb.close();
    await db.end();
  }
  expect(cleanupFailed, "Targeted finance cleanup").toBe(false);
});
