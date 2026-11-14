import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { PDFDocument } from "pdf-lib";
import { readFileSync } from "node:fs";
import { liveEnvironment } from "./environment.ts";
import { submitFinanceFixture } from "./finance-fixture.ts";
import { isUUID } from "../../supabase/functions/_shared/session-contract.ts";
import { parseAgreement } from "../../supabase/functions/_shared/agreement-contract.ts";
import { verifyAgreementPDF } from "./pdf-evidence.ts";

test("real partners create review independently approve export and revise the same agreement", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const env = liveEnvironment();
  if (env.ref !== "lgboxbtxutgggvluhhqt")
    throw new Error("Unexpected test project");
  const db = new Client({
    connectionString: env.databaseURL,
    ssl: {
      rejectUnauthorized: true,
      ...(env.caFile ? { ca: readFileSync(env.caFile, "utf8") } : {}),
    },
    connectionTimeoutMillis: 10000,
  });
  await db.connect();
  const ac = await browser.newContext(),
    bc = await browser.newContext(),
    a = await ac.newPage(),
    b = await bc.newPage();
  const errors: string[] = [];
  for (const p of [a, b]) p.on("pageerror", (e) => errors.push(e.name));
  const storageKey = `fsm-auth-${new URL(env.url).hostname}`;
  let cleanupFailed = false;
  async function auth(page: Page) {
    return page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const s = JSON.parse(raw) as {
        access_token?: string;
        user?: { id?: string };
      };
      return { token: s.access_token, id: s.user?.id };
    }, storageKey);
  }
  async function client(page: Page) {
    const identity = await auth(page);
    if (!identity?.token) throw new Error("Real browser identity missing");
    return createClient(env.url, env.key, {
      global: { headers: { Authorization: "Bearer " + identity.token } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
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
      throw new Error(
        "Invitation navigation failed; private fragment suppressed",
      );
    }
    await b.getByRole("button", { name: "Join session", exact: true }).click();
    await expect(b).toHaveURL(/\/sessions\/[a-f0-9-]{36}$/);
    const aa = await client(a),
      bb = await client(b);
    await submitFinanceFixture(aa, id, {}, { comparison: true, budget: true });
    await submitFinanceFixture(bb, id, {}, { comparison: true, budget: true });
    const root = `http://127.0.0.1:5175/sessions/${id}`;
    await a.goto(root + "/simulator");
    await expect(a.getByText("Saved scenario", { exact: true })).toBeVisible();
    await a
      .getByRole("textbox", { name: "Rent & home", exact: true })
      .fill("3200");
    await expect(a.locator(".model-total strong")).toHaveText("$3,200");
    await expect(a.getByText("Saved scenario", { exact: true })).toBeVisible();
    await a
      .getByRole("link", { name: "Create money agreement", exact: true })
      .click();
    await a.getByRole("button", { name: "Create draft", exact: true }).click();
    await expect(
      a.getByRole("heading", { name: "Your shared plan, version 1." }),
    ).toBeVisible();
    await expect(
      a.getByRole("button", { name: "Download PDF" }),
    ).toBeDisabled();
    await a.getByRole("button", { name: "Propose this version" }).click();
    await expect(a.getByRole("checkbox")).toBeVisible();
    await expect(
      a.getByRole("button", { name: "Confirm as Partner A" }),
    ).toBeDisabled();
    await a.getByRole("checkbox").check();
    await a.getByRole("button", { name: "Confirm as Partner A" }).click();
    await expect(
      a.getByText("Your confirmation is saved.", { exact: false }),
    ).toBeVisible();
    await expect(
      a.getByRole("button", { name: "Download PDF" }),
    ).toBeDisabled();
    await b.goto(root + "/agreement");
    await expect(
      b.getByRole("button", { name: "Confirm as Partner B" }),
    ).toBeDisabled();
    await b.getByRole("checkbox").check();
    await b.getByRole("button", { name: "Confirm as Partner B" }).click();
    await expect(
      b.getByText("Both partners confirmed this version.", { exact: true }),
    ).toBeVisible();
    await a.reload();
    await expect(a.getByRole("button", { name: "Download PDF" })).toBeEnabled();
    const response = a.waitForResponse(
      (r) => r.url().endsWith("/pdf") && r.request().method() === "POST",
    );
    const downloading = a.waitForEvent("download");
    await a.getByRole("button", { name: "Download PDF" }).click();
    const r = await response;
    expect(r.ok()).toBe(true);
    expect(r.headers()["content-type"]).toBe("application/pdf");
    const download = await downloading;
    const downloadedPath = await download.path();
    expect(downloadedPath).not.toBeNull();
    const bytes = readFileSync(downloadedPath!);
    // Validate the saved artifact rather than relying on inspector response bodies.
    expect(bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe("First Money Agreement");
    const approved = await aa.rpc("fsm_get_agreement", {
      p_couple_id: id,
      p_version_id: null,
    });
    expect(approved.error).toBeNull();
    const evidence = await verifyAgreementPDF(
      bytes,
      parseAgreement(approved.data),
    );
    expect(evidence.text).toContain("Monthly budget: $3,200.00");
    expect(download.suggestedFilename()).toBe("First-Money-Agreement-v1.pdf");
    await a
      .getByRole("textbox", {
        name: "Large purchase discussion threshold",
        exact: true,
      })
      .fill("750");
    await a
      .getByRole("button", { name: "Save new version", exact: true })
      .click();
    await expect(
      a.getByRole("heading", { name: "Your shared plan, version 2." }),
    ).toBeVisible();
    await expect(
      a.getByRole("button", { name: "Download PDF" }),
    ).toBeDisabled();
    await a.reload();
    await expect(
      a.getByRole("heading", { name: "Your shared plan, version 2." }),
    ).toBeVisible();
    await expect(
      a.getByText("Awaiting confirmation", { exact: true }),
    ).toHaveCount(2);
    await expect(
      a.getByRole("button", { name: "Propose this version" }),
    ).toBeEnabled();
    const states = await db.query(
      "select version_number,status,(select count(*)::int from public.approvals where version_id=v.id) as confirmations from public.agreement_versions v where couple_id=$1 order by version_number",
      [id],
    );
    expect(states.rows).toEqual([
      { version_number: 1, status: "approved", confirmations: 2 },
      { version_number: 2, status: "draft", confirmations: 0 },
    ]);
    await a.setViewportSize({ width: 390, height: 844 });
    expect(
      await a.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    const ids: string[] = [];
    for (const p of [a, b]) {
      const identity = await auth(p).catch(() => null);
      if (isUUID(identity?.id)) ids.push(identity.id);
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
        "Agreement browser cleanup failed; inspect only test-owned records.",
      );
    }
    await ac.close();
    await bc.close();
    await db.end();
  }
  expect(cleanupFailed, "Targeted agreement cleanup").toBe(false);
});
