import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { agreementFixture } from "../backend/agreement-fixture.ts";
import { financialInput } from "../../src/engines/financial.ts";

// Offline UI contracts only. No Supabase connection, identity or persistence proof.
const input = financialInput({
  currency: "USD",
  sourceRevisions: { A: 17, B: 17 },
  partners: {
    A: { monthlyNetIncomeCents: 500000, monthlyPersonalObligationsCents: 60000 },
    B: { monthlyNetIncomeCents: 300000, monthlyPersonalObligationsCents: 30000 },
  },
  sharedExpenses: { rent: 0, utilities: 0, groceries: 0, other: 0, shared_savings: 0 },
  sharedEmergencyFundCents: 0,
  oneOffSharedExpenseCents: 0,
});

test.beforeAll(async () => {
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/live-ui-preview.tsx", `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { createMemoryRouter, RouterProvider, Outlet } from 'react-router';
    import { AuthContext } from '/src/app/auth-context';
    import { fsmClient } from '/src/services/fsm-client';
    import { SessionServiceError } from '/src/services/session-error';
    import { financialEngine } from '/src/engines/financial';
    import { LiveSimulatorPage } from '/src/features/simulator/LiveSimulatorPage';
    import { LiveAgreementPage } from '/src/features/agreement/LiveAgreementPage';
    export function mount(props) {
      document.getElementById('root').style.display = 'none';
      const target = document.createElement('main');
      target.id = 'offline-live-preview';
      target.className = 'surface';
      target.style.cssText = 'padding:16px;max-width:1100px;margin:auto';
      document.body.append(target);
      window.offlineUiCalls = [];
      window.offlineDenyFinances = props.denyFinances ?? false;
      fsmClient.request = async (operation, body, resource) => {
        window.offlineUiCalls.push({ operation, body, resource });
        if (operation === 'getFinancialInputs') {
          if (window.offlineDenyFinances)
            throw new SessionServiceError('CONSENT_REQUIRED', 'Both partners must share budget inputs.');
          return props.input;
        }
        if (operation === 'getCurrentAgreement') return props.version;
        if (operation === 'createScenario') {
          const input = { ...props.input, sharedExpenses: body.sharedExpenses,
            sharedEmergencyFundCents: body.sharedEmergencyFundCents };
          return { id: crypto.randomUUID(), coupleId: resource.coupleId,
            createdByPartnerId: props.version.createdByPartnerId, input,
            model: body.model, stressTest: body.stressTest,
            output: financialEngine.simulate(input, body.model, body.stressTest),
            createdAt: props.version.createdAt };
        }
        throw new SessionServiceError('OFFLINE_ONLY', 'No approval or export is performed by this offline test.');
      };
      const session = { id: props.version.coupleId,
        viewerPartnerId: 'fictional-viewer-B',
        partners: [{ id: 'fictional-viewer-B', slot: 'B' }] };
      const router = createMemoryRouter([{
        path: '/sessions/:coupleId', element: <Outlet context={{session}} />,
        children: [
          { path: 'simulator', element: <LiveSimulatorPage /> },
          { path: 'agreement', element: <LiveAgreementPage preview /> },
        ]
      }], { initialEntries: ['/sessions/' + session.id + '/' + props.view] });
      createRoot(target).render(
        <AuthContext.Provider value={{ userId: 'fictional-offline-B', restoring: false,
          error: null, issued: null, rememberInvitation() {} }}>
          <RouterProvider router={router} />
        </AuthContext.Provider>);
    }
  `);
});

async function mount(page: Page, props: Record<string, unknown>) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await page.addScriptTag({
    type: "module",
    content: `import { mount } from '/artifacts/live-ui-preview.tsx'; mount(${JSON.stringify({ input, ...props })});`,
  });
  return { preview: page.locator("#offline-live-preview"), errors };
}

test("live simulator charts follow API results and the existing stress engine", async ({ page }) => {
  const { preview, errors } = await mount(page, { view: "simulator", version: agreementFixture() });
  await preview.getByRole("textbox", { name: "Rent & home", exact: true }).fill("3200.01");
  await expect(preview.getByText("Saved scenario", { exact: true })).toBeVisible();
  const budget = preview.getByRole("table", { name: /Monthly budget by category/ });
  await expect(budget).toContainText("$3,200.01");
  await expect(preview.getByRole("region", { name: "Partner A budget" })).toContainText("$2,000.01");
  await expect(preview.getByRole("region", { name: "Partner B budget" })).toContainText("$1,200");
  await preview.getByRole("button", { name: "Equal", exact: true }).click();
  await expect(preview.getByRole("region", { name: "Partner A budget" })).toContainText("$1,600.01");
  await expect(preview.getByRole("region", { name: "Partner B budget" })).toContainText("$1,600");
  await preview.getByRole("button", { name: "Rent +$300", exact: true }).click();
  const comparison = preview.getByRole("table", { name: "Baseline and scenario amounts in USD" });
  await expect(comparison.getByRole("row", { name: "Monthly plan $3,200.01 $3,500.01" })).toBeVisible();
  await expect(budget).toContainText("$3,500.01");
  await expect(preview.getByRole("link", { name: "Create money agreement" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test("live agreement presents server confirmations and retains explicit approval and PDF gates", async ({ page }) => {
  const version = agreementFixture("under_review", 50000);
  const { preview, errors } = await mount(page, { view: "agreement", version });
  await expect(preview.getByRole("table", { name: "Agreed monthly shared budget in USD" })).toContainText("$3,700");
  const confirmations = preview.getByRole("region", { name: "Partner confirmations" });
  await expect(confirmations.getByText("Confirmed", { exact: true })).toHaveCount(1);
  await expect(confirmations.getByText("Pending confirmation", { exact: true })).toHaveCount(1);
  await expect(confirmations).toContainText(version.contentHash);
  const confirm = preview.getByRole("button", { name: "Confirm as Partner B" });
  await expect(confirm).toBeDisabled();
  await expect(preview.getByRole("button", { name: "Download PDF" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await preview.getByRole("checkbox", { name: /I reviewed version/ }).check();
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(preview.getByRole("alert")).toContainText("No approval or export is performed");
  const calls = await page.evaluate(() => (window as unknown as {
    offlineUiCalls: { operation: string; body: unknown }[];
  }).offlineUiCalls.filter((call) => call.operation === "approveAgreement"));
  expect(calls).toHaveLength(1);
  expect(calls[0].body).toEqual({ expectedHeadVersionId: version.id, expectedContentHash: version.contentHash });
  await expect(confirmations.getByText("Confirmed", { exact: true })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("approved preview enables PDF only while the finance consent gate remains available", async ({ page }) => {
  const { preview, errors } = await mount(page, { view: "agreement", version: agreementFixture("approved") });
  const download = preview.getByRole("button", { name: "Download PDF" });
  await expect(download).toBeEnabled();
  await expect(preview.getByRole("region", { name: "Partner confirmations" }).getByText("Confirmed", { exact: true })).toHaveCount(2);
  await page.evaluate(() => {
    (window as unknown as { offlineDenyFinances: boolean }).offlineDenyFinances = true;
    window.dispatchEvent(new Event("focus"));
  });
  await expect(preview.getByText("Both partners must share budget inputs.")).toBeVisible();
  await expect(download).toBeDisabled();
  await expect(preview.getByRole("button", { name: /Confirm as Partner/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("live simulator hides all financial charts when sharing is unavailable", async ({ page }) => {
  const { preview, errors } = await mount(page, { view: "simulator", version: agreementFixture(), denyFinances: true });
  await expect(preview.getByRole("heading", { name: "Your shared budget is not ready." })).toBeVisible();
  await expect(preview.getByText("Both partners must share budget inputs.")).toBeVisible();
  await expect(preview.locator(".budget-overview-cards, .budget-donut, .financial-summary")).toHaveCount(0);
  await expect(preview.getByRole("link", { name: "My sharing choices" })).toBeVisible();
  expect(errors).toEqual([]);
});
