import { chromium } from "@playwright/test";

const baseUrl = (process.env.STATIC_DEMO_URL ?? "http://127.0.0.1:3100").replace(/\/$/, "");
const appRoutes = [
  "/app/accounts/", "/app/accounts/4704/", "/app/agents/", "/app/approvals/",
  "/app/audit/", "/app/briefing/", "/app/evaluation/", "/app/health/", "/app/help/",
  "/app/help/decides/", "/app/help/diagrams/", "/app/how-it-works/", "/app/incidents/",
  "/app/incidents/INC-2026-0001/", "/app/cases/INC-2026-0001/", "/app/lab/", "/app/memory/",
  "/app/notebook/", "/app/opportunities/", "/app/outcomes/", "/app/problems/", "/app/risks/",
  "/app/settings/", "/app/sources/", "/app/time-to-action/", "/app/workflows/",
];
const publicRoutes = ["/", "/forgot/", "/register/", "/verify/", "/google/"];
const demoRoles = ["Business Head", "Operations Manager", "Account Manager", "Sales Manager", "Support Manager", "QA Head"];

const browser = await chromium.launch({ headless: true });
const errors = [];
const failedRequests = [];

function observe(page) {
  page.on("pageerror", (error) => errors.push(`${page.url()}: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${page.url()}: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    if (!failure.includes("ERR_ABORTED")) failedRequests.push(`${request.url()}: ${failure}`);
  });
}

async function newPage() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  observe(page);
  return { context, page };
}

async function visit(page, route) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  if (!response || !response.ok()) throw new Error(`${route} returned ${response?.status() ?? "no response"}`);
  await page.waitForTimeout(300);
}

async function signInAs(page, role) {
  await visit(page, "/");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("button", { name: /User portal/ }).click();
  await page.getByRole("button", { name: new RegExp(`^${role}`) }).click();
  await page.waitForURL(/\/app\/?$/);
  await page.getByTestId("home").waitFor();
  await page.getByTestId("home-welcome").waitFor();
  await page.locator(".demo-notice").first().waitFor();
}

async function joinWithCode(code, email) {
  const { context, page } = await newPage();
  await visit(page, "/register/");
  await page.getByLabel("Company code").fill(code);
  await page.getByText(/You're joining/).waitFor();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Full name").fill(`Static ${code} User`);
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("demo-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/app\/?$/);
  await page.getByTestId("home-welcome").waitFor();
  await context.close();
}

try {
  const publicCheck = await newPage();
  for (const route of publicRoutes) await visit(publicCheck.page, route);
  await publicCheck.page.getByRole("heading", { name: "Google sign-in failed" }).waitFor();
  await publicCheck.page.getByText("Supabase is not configured; changes stay in this browser only.").waitFor();
  await publicCheck.context.close();

  const appCheck = await newPage();
  await signInAs(appCheck.page, "Operations Manager");

  for (const route of appRoutes) {
    await visit(appCheck.page, route);
    if (appCheck.page.url().replace(baseUrl, "").startsWith("/?next=")) throw new Error(`${route} redirected to sign-in`);
    await appCheck.page.locator(".demo-notice").first().waitFor();
  }

  await visit(appCheck.page, "/app/incidents/INC-2026-0001/");
  await appCheck.page.getByTestId("pipe-investigate").click();
  await appCheck.page.getByTestId("why-takeaway").waitFor();

  await visit(appCheck.page, "/app/lab/");
  await appCheck.page.getByText("How it works", { exact: true }).last().scrollIntoViewIfNeeded();
  await appCheck.page.getByRole("button", { name: /1\. Inject the saved scenario/ }).click();

  await appCheck.page.getByRole("button", { name: "Ask STRATA" }).click();
  const assistant = appCheck.page.getByRole("dialog", { name: "Ask STRATA" });
  await assistant.waitFor();
  await assistant.locator(".ask-prompt").first().click();
  await assistant.getByText("Recorded demo answer.").waitFor();
  await appCheck.context.close();

  for (const role of demoRoles.filter((role) => role !== "Operations Manager")) {
    const roleCheck = await newPage();
    await signInAs(roleCheck.page, role);
    await roleCheck.context.close();
  }

  const invalidCode = await newPage();
  await visit(invalidCode.page, "/register/");
  await invalidCode.page.getByLabel("Company code").fill("BAD000");
  await invalidCode.page.getByText("No company uses that code. Check it with your business head.").waitFor();
  if (!(await invalidCode.page.getByRole("button", { name: "Continue" }).isDisabled())) throw new Error("Invalid company code enabled registration.");
  await invalidCode.context.close();

  for (const [index, code] of ["ALTADM", "ALTEMP", "ALTOPS", "ALTACC", "ALTSAL", "ALTSUP", "ALTQA1"].entries()) {
    await joinWithCode(code, `static.${index}.${code.toLowerCase()}@example.invalid`);
  }

  const reusedCode = await newPage();
  const reusedEmail = "static.reused@example.invalid";
  await visit(reusedCode.page, "/register/");
  await reusedCode.page.getByLabel("Company code").fill("ALTEMP");
  await reusedCode.page.getByRole("button", { name: "Continue" }).click();
  await reusedCode.page.getByLabel("Full name").fill("Static Reused User");
  await reusedCode.page.getByLabel("Work email").fill(reusedEmail);
  await reusedCode.page.getByRole("textbox", { name: "Password" }).fill("demo-password");
  await reusedCode.page.getByRole("button", { name: "Create account" }).click();
  await reusedCode.page.waitForURL(/\/app\/?$/);
  await visit(reusedCode.page, "/register/");
  await reusedCode.page.getByLabel("Company code").fill("ALTEMP");
  await reusedCode.page.getByRole("button", { name: "Continue" }).click();
  await reusedCode.page.getByLabel("Full name").fill("Static Reused User");
  await reusedCode.page.getByLabel("Work email").fill(reusedEmail);
  await reusedCode.page.getByRole("textbox", { name: "Password" }).fill("demo-password");
  await reusedCode.page.getByRole("button", { name: "Create account" }).click();
  await reusedCode.page.getByText(/already been used/).waitFor();
  await reusedCode.context.close();
} finally {
  await browser.close();
}

if (errors.length || failedRequests.length) {
  throw new Error(`Static QA found browser errors:\n${errors.join("\n")}\nFailed requests:\n${failedRequests.join("\n")}`);
}
console.log(`Verified ${publicRoutes.length + appRoutes.length + 1} exported routes, all quick roles, assistant, Google fallback, and local join-code fallback.`);
