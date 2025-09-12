// tests/diagnostics/online-diagnostics.js
// Comprehensive diagnostics for https://pos-conejo-negro.onrender.com/online
// Captures console/page errors, network failures, HTTP errors, basic interactions,
// performance timings, screenshots, and writes a JSON report per run.

const { chromium, devices } = require("playwright");
const fs = require("fs");
const path = require("path");
const os = require("os");

function nowIso() { return new Date().toISOString(); }
function runIdStamp() { return nowIso().replace(/[:.]/g, "-"); }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      if (a.includes("=")) {
        const [k, v] = a.split("=");
        out[k.replace(/^--/, "")] = v;
      } else {
        const k = a.replace(/^--/, "");
        const v = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
        out[k] = v;
      }
    }
  }
  return out;
}

async function takeScreenshot(page, filePath) {
  try {
    await page.screenshot({ path: filePath, fullPage: true });
    return filePath;
  } catch {
    return null;
  }
}

async function collectPerformance(page) {
  try {
    return await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation");
      const navEntry = nav && nav[0] ? (nav[0].toJSON ? nav[0].toJSON() : null) : null;
      const timing = performance.timing ? JSON.parse(JSON.stringify(performance.timing)) : null;
      const resources = performance.getEntriesByType("resource").map(e => {
        const o = e.toJSON ? e.toJSON() : {};
        return {
          name: e.name,
          initiatorType: e.initiatorType,
          duration: e.duration,
          startTime: e.startTime,
          transferSize: o.transferSize ?? e.transferSize ?? null,
          encodedBodySize: o.encodedBodySize ?? null,
          decodedBodySize: o.decodedBodySize ?? null
        };
      });
      return {
        navigation: navEntry,
        timing,
        resourcesCount: resources.length,
        resourcesSample: resources.slice(0, 20)
      };
    });
  } catch (e) {
    return { error: e.message };
  }
}

async function runScenario(kind, browser, url, outDirs, timeoutMs) {
  const runStart = Date.now();
  const { shotsDir } = outDirs;

  const scenario = {
    scenario: kind,
    startedAt: nowIso(),
    url,
    events: [],
    console: [],
    pageErrors: [],
    httpErrors: [],
    networkFailures: [],
    screenshots: [],
    interactions: [],
    performance: null,
    crashed: false,
    gotoError: null,
    finishedAt: null,
    durationMs: null
  };

  let contextOptions = { ignoreHTTPSErrors: true, javaScriptEnabled: true, bypassCSP: true, locale: "es-MX" };
  if (kind === "mobile") {
    contextOptions = { ...contextOptions, ...devices["Pixel 5"] };
  } else {
    contextOptions = {
      ...contextOptions,
      viewport: { width: 1366, height: 768 },
      deviceScaleFactor: 1
    };
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // Event listeners
  const safePush = (arr, obj) => {
    try { arr.push(obj); } catch {}
  };

  page.on("console", async msg => {
    const entry = {
      ts: nowIso(),
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    };
    safePush(scenario.console, entry);
    if (msg.type() === "error") {
      const p = path.join(shotsDir, `${kind}-console-error-${Date.now()}.png`);
      await takeScreenshot(page, p).then(fp => { if (fp) scenario.screenshots.push(fp); });
    }
  });

  page.on("pageerror", async error => {
    safePush(scenario.pageErrors, { ts: nowIso(), message: error.message, stack: error.stack });
    const p = path.join(shotsDir, `${kind}-pageerror-${Date.now()}.png`);
    await takeScreenshot(page, p).then(fp => { if (fp) scenario.screenshots.push(fp); });
  });

  page.on("crash", async () => {
    scenario.crashed = true;
    const p = path.join(shotsDir, `${kind}-crash-${Date.now()}.png`);
    await takeScreenshot(page, p).then(fp => { if (fp) scenario.screenshots.push(fp); });
  });

  page.on("requestfailed", req => {
    safePush(scenario.networkFailures, {
      ts: nowIso(),
      url: req.url(),
      method: req.method(),
      failure: req.failure(),
      resourceType: req.resourceType()
    });
  });

  page.on("response", async res => {
    try {
      if (!res.ok()) {
        safePush(scenario.httpErrors, {
          ts: nowIso(),
          url: res.url(),
          status: res.status(),
          ok: res.ok(),
          headers: await res.headers()
        });
        if (res.status() >= 500) {
          const p = path.join(shotsDir, `${kind}-http-${res.status()}-${Date.now()}.png`);
          await takeScreenshot(page, p).then(fp => { if (fp) scenario.screenshots.push(fp); });
        }
      }
    } catch {}
  });

  // Navigate and login
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
    
    // Handle login
    console.log('Attempting login...');
    
    // Try auto-fill first
    const autoFillBtn = await page.locator('#auto-fill-btn');
    if (await autoFillBtn.isVisible()) {
      await autoFillBtn.click();
      await page.waitForTimeout(1000);
    } else {
      // Manual fill as fallback
      await page.fill('#login-email', 'admin@conejo.com');
      await page.fill('#login-password', 'admin123');
    }
    
    // Submit login
    await page.locator('#login-form button[type="submit"]').click();
    await page.waitForTimeout(5000); // Extended wait for login
    
    // Verify login success by checking for main app
    const mainApp = await page.locator('#main-app');
    const loginSuccess = await mainApp.isVisible();
    
    if (!loginSuccess) {
      throw new Error('Login verification failed - main app not visible');
    }
    console.log('Login successful');
  } catch (e) {
    scenario.gotoError = e.message || String(e);
    console.error('Login or navigation failed:', e.message);
  }

  // Base screenshot after load (or attempt)
  const firstShot = path.join(shotsDir, `${kind}-loaded-${Date.now()}.png`);
  await takeScreenshot(page, firstShot).then(fp => { if (fp) scenario.screenshots.push(fp); });

  // Collect performance data
  scenario.performance = await collectPerformance(page);

  // Basic functional checks/interactions (tolerant, logs success/failure)
  async function mark(action, target, ok, error) {
    const entry = { ts: nowIso(), action, target, ok };
    if (!ok && error) entry.error = error;
    scenario.interactions.push(entry);
  }

  // 1) Check that page content exists
  try {
    const hasBody = await page.locator("body").count();
    await mark("exists", "body", hasBody > 0, hasBody ? null : "No body element found");
  } catch (e) {
    await mark("exists", "body", false, e.message);
  }

  // 2) Look for key UI elements: "Agregar Gasto", "Ver Reporte"
  const targets = [
    { type: "button", role: "button", nameRe: /agregar gasto/i, alias: "Agregar Gasto" },
    { type: "button", role: "button", nameRe: /ver reporte/i, alias: "Ver Reporte" }
  ];

  for (const t of targets) {
    try {
      const loc = page.getByRole(t.role, { name: t.nameRe });
      const count = await loc.count();
      if (count > 0) {
        await mark("visible", t.alias, true);
        // Attempt a click but only if URL remains same domain and we can recover back
        try {
          await loc.first().click({ timeout: 3000 });
          await page.waitForTimeout(500);
          await mark("click", t.alias, true);
          const shot = path.join(shotsDir, `${kind}-${t.alias.replace(/\s+/g, "_")}-postclick-${Date.now()}.png`);
          await takeScreenshot(page, shot).then(fp => { if (fp) scenario.screenshots.push(fp); });
          // Best-effort: navigate back if click changed view
          try { await page.goBack({ timeout: 2000 }).catch(() => {}); } catch {}
        } catch (clickErr) {
          await mark("click", t.alias, false, clickErr.message);
        }
      } else {
        await mark("visible", t.alias, false, "Not found");
      }
    } catch (e) {
      await mark("visible", t.alias, false, e.message);
    }
  }

  // 3) Verify expense-related cues are present somewhere in the DOM
  const textChecks = [
    { textRe: /gasto/i, alias: "Text:Gasto" },
    { textRe: /monto/i, alias: "Text:Monto" },
    { textRe: /categor[ií]a/i, alias: "Text:Categoria" },
  ];
  for (const t of textChecks) {
    try {
      const match = await page.getByText(t.textRe, { exact: false }).count();
      await mark("text-present", t.alias, match > 0, match ? null : "Not found");
    } catch (e) {
      await mark("text-present", t.alias, false, e.message);
    }
  }

  // Finalize scenario
  scenario.finishedAt = nowIso();
  scenario.durationMs = Date.now() - runStart;

  await context.close();
  return scenario;
}

(async () => {
  const args = parseArgs();
  const url = args.url || "https://pos-conejo-negro.onrender.com/online";
  const headless = args.headless !== "false";
  const timeoutMs = Number(args.timeout || 45000);

  const runId = runIdStamp();
  const baseOutDir = path.join("reports", "online", runId);
  ensureDir(baseOutDir);
  const shotsDir = path.join(baseOutDir, "screenshots");
  ensureDir(shotsDir);

  // Global report
  const report = {
    runId,
    targetUrl: url,
    startedAt: nowIso(),
    environment: {
      node: process.version,
      platform: `${os.type()} ${os.release()} (${os.platform()})`,
    },
    headless,
    scenarios: [],
    summary: {},
    finishedAt: null
  };

  const browser = await chromium.launch({ headless });

  // Node-level safety nets
  const nodeErrors = [];
  process.on("uncaughtException", (err) => {
    nodeErrors.push({ ts: nowIso(), type: "uncaughtException", message: err.message, stack: err.stack });
  });
  process.on("unhandledRejection", (reason) => {
    nodeErrors.push({ ts: nowIso(), type: "unhandledRejection", reason: String(reason) });
  });

  const scenariosToRun = [];
  if (args.desktop !== "false") scenariosToRun.push("desktop");
  if (args.mobile !== "false") scenariosToRun.push("mobile");

  for (const kind of scenariosToRun) {
    const scenario = await runScenario(kind, browser, url, { baseOutDir, shotsDir }, timeoutMs);
    report.scenarios.push(scenario);
  }

  await browser.close();

  // Summarize
  const sum = {
    totalScenarios: report.scenarios.length,
    consoleErrors: 0,
    pageErrors: 0,
    httpErrors: 0,
    networkFailures: 0,
    crashedPages: 0,
    gotoErrors: 0
  };

  for (const s of report.scenarios) {
    sum.consoleErrors += s.console.filter(c => c.type === "error").length;
    sum.pageErrors += s.pageErrors.length;
    sum.httpErrors += s.httpErrors.length;
    sum.networkFailures += s.networkFailures.length;
    sum.crashedPages += s.crashed ? 1 : 0;
    sum.gotoErrors += s.gotoError ? 1 : 0;
  }

  report.summary = {
    ...sum,
    functionalFindings: report.scenarios.map(s => ({
      scenario: s.scenario,
      interactions: s.interactions
    }))
  };

  report.nodeLevelErrors = nodeErrors;
  report.finishedAt = nowIso();

  const reportPath = path.join(baseOutDir, `online-diagnostics-${runId}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`Diagnostics report written to: ${reportPath}`);
  console.log(`Screenshots in: ${shotsDir}`);

  // Exit with non-zero if severe issues detected
  const severe = sum.pageErrors + sum.httpErrors + sum.networkFailures + sum.crashedPages + sum.gotoErrors;
  process.exit(severe > 0 ? 1 : 0);
})();
