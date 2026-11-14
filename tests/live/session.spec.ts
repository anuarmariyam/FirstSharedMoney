import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { liveEnvironment } from "./environment.ts";
import { isUUID } from "../../supabase/functions/_shared/session-contract.ts";

test("real A/B identities survive reload and a third context cannot reuse the invitation", async ({
  browser,
}) => {
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
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  const [a, b, c] = pages;
  let cleanupFailed = false;
  const errors: string[] = [];
  pages.forEach((page) =>
    page.on("pageerror", (error) => errors.push(error.name)),
  );
  const storageKey = `fsm-auth-${new URL(env.url).hostname}`;
  async function identity(page: Page) {
    return page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const stored = JSON.parse(raw) as { user?: { id?: string } };
      return stored.user?.id ?? null;
    }, storageKey);
  }
  async function openInvite(page: Page, invitation: string) {
    // Do not let navigation diagnostics print a capability on a failing goto.
    try {
      await page.goto(invitation);
    } catch {
      throw new Error(
        "Could not open the invitation in the separate browser context.",
      );
    }
  }
  try {
    await a.goto("http://127.0.0.1:5175/create");
    await a
      .getByRole("textbox", { name: "What should we call you?" })
      .fill("Live Browser A");
    await a
      .getByRole("button", { name: "Create session", exact: true })
      .click();
    await expect(a).toHaveURL(/\/sessions\/[a-f0-9-]{36}$/);
    await expect(
      a.getByText("Session connected", { exact: true }).first(),
    ).toBeVisible();
    const aId = await identity(a);
    expect(isUUID(aId)).toBe(true);
    const invitation = await a
      .getByLabel("Single-use partner invitation")
      .inputValue();
    await openInvite(b, invitation);
    await b
      .getByRole("textbox", { name: "What should we call you?" })
      .fill("Live Browser B");
    await b.getByRole("button", { name: "Join session", exact: true }).click();
    await expect(b).toHaveURL(/\/sessions\/[a-f0-9-]{36}$/);
    const bId = await identity(b);
    expect(isUUID(bId) && aId !== bId).toBe(true);
    await expect(b.getByText("Partner B · You", { exact: true })).toBeVisible();
    await a.reload();
    await b.reload();
    await expect(a.getByText("Partner A · You", { exact: true })).toBeVisible();
    await expect(b.getByText("Partner B · You", { exact: true })).toBeVisible();
    expect((await identity(a)) === aId && (await identity(b)) === bId).toBe(
      true,
    );
    await openInvite(c, invitation);
    await c.getByRole("button", { name: "Join session", exact: true }).click();
    await expect(c.getByRole("alert")).toContainText("unavailable");
    expect((await identity(c)) !== aId && (await identity(c)) !== bId).toBe(
      true,
    );
    await openInvite(a, invitation);
    await a.getByRole("button", { name: "Join session", exact: true }).click();
    await expect(a.getByRole("alert")).toContainText(
      "already belongs to Partner A",
    );
    expect((await identity(a)) === aId).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    const owned: string[] = [];
    for (const page of pages) {
      const id = await identity(page).catch(() => null);
      if (isUUID(id)) owned.push(id);
    }
    try {
      // All contexts started with empty storage; these are newly created test users.
      if (owned.length) {
        await database.query(
          "delete from public.couples where created_by_auth_user_id = any($1::uuid[])",
          [owned],
        );
        await database.query(
          "delete from auth.users u where u.id = any($1::uuid[]) and not exists (select 1 from public.partners p where p.auth_user_id = u.id) and not exists (select 1 from public.couples c where c.created_by_auth_user_id = u.id)",
          [owned],
        );
      }
    } catch {
      cleanupFailed = true;
      console.error(
        "Live test cleanup failed. Inspect only test-created records in the disposable project.",
      );
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
      await database.end();
    }
  }
  expect(cleanupFailed, "Targeted live test cleanup").toBe(false);
});
