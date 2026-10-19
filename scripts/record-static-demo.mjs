import { mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = (process.env.STATIC_DEMO_URL ?? "http://127.0.0.1:3100").replace(/\/$/, "");
const mediaDir = path.resolve("docs/media");
const videoDir = path.join(mediaDir, ".playwright-video");

mkdirSync(mediaDir, { recursive: true });
mkdirSync(videoDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

async function open(route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
}

async function screenshot(name) {
  await page.screenshot({ path: path.join(mediaDir, name), fullPage: true });
}

try {
  await open("/");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("button", { name: /User portal/ }).click();
  await page.getByRole("button", { name: /Operations Manager/ }).click();
  await page.waitForURL(/\/app\/?$/);
  await page.getByTestId("home-welcome").waitFor();
  await screenshot("gallery-01-console.png");

  await open("/app/incidents/");
  await page.waitForSelector("[data-testid='page-template']");
  await screenshot("gallery-02-incidents.png");

  await open("/app/incidents/INC-2026-0001/");
  await page.getByTestId("pipe-investigate").click();
  await page.getByTestId("why-takeaway").waitFor();
  await screenshot("gallery-03-investigation.png");

  await open("/app/audit/");
  await page.waitForSelector("[data-testid='page-template']");
  await screenshot("gallery-04-audit.png");

  await open("/app/lab/");
  await page.getByText("How it works", { exact: true }).last().scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: /1\. Inject the saved scenario/ }).click();
  await screenshot("gallery-05-how-it-works.png");
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) renameSync(await video.path(), path.join(mediaDir, "strata-demo.webm"));
}

if (errors.length) throw new Error(`Browser errors during recording:\n${errors.join("\n")}`);
console.log("Saved docs/media/strata-demo.webm and five gallery screenshots.");
