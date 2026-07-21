import { chromium } from '../app/qifinance-web/node_modules/@playwright/test/index.mjs';
import { writeFile } from 'node:fs/promises';

const recordStage = message => writeFile('browser-audit-result.txt', message.slice(0, 130), 'utf8');
await recordStage('Audit started; validating secret configuration.');

const required = ['QIFI_SUPABASE_URL', 'QIFI_SUPABASE_PUBLISHABLE_KEY', 'QIFI_SMOKE_EMAIL', 'QIFI_SMOKE_PASSWORD'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const authResponse = await fetch(`${process.env.QIFI_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: {
    apikey: process.env.QIFI_SUPABASE_PUBLISHABLE_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email: process.env.QIFI_SMOKE_EMAIL, password: process.env.QIFI_SMOKE_PASSWORD }),
});
if (!authResponse.ok) throw new Error(`Smoke-user authentication failed (${authResponse.status}).`);
const { access_token: accessToken } = await authResponse.json();
if (!accessToken) throw new Error('Smoke-user authentication returned no access token.');
await recordStage('Smoke-user authentication succeeded; launching Chromium.');

const viewports = [
  { name: 'mobile-320', width: 320, height: 720 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
];
const routes = ['/dashboard', '/transactions', '/transactions/new', '/imports', '/imports/review', '/reports', '/reconciliation', '/evidence'];
const failures = [];
const browser = await chromium.launch();
await recordStage('Chromium launched; starting required viewport audit.');

try {
  for (const viewport of viewports) {
    await recordStage(`${viewport.name}: opening production login.`);
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const runtimeErrors = [];
    page.on('console', message => {
      if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
    });
    page.on('pageerror', error => runtimeErrors.push(`page: ${error.message}`));
    page.on('requestfailed', request => {
      const failure = request.failure()?.errorText || 'unknown failure';
      if (!failure.includes('ERR_ABORTED')) runtimeErrors.push(`network: ${request.method()} ${request.url()} (${failure})`);
    });

    await page.goto('https://fi.qially.com/', { waitUntil: 'networkidle' });
    await recordStage(`${viewport.name}: production login loaded; selecting passphrase mode.`);
    await page.getByRole('button', { name: 'Or unlock with passphrase' }).click();
    await recordStage(`${viewport.name}: passphrase mode selected; entering session token.`);
    await page.locator('#qifi-passphrase').fill(accessToken);
    await recordStage(`${viewport.name}: session token entered; submitting login.`);
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await recordStage(`${viewport.name}: login submitted; waiting for authenticated shell.`);
    await page.locator('.app-shell').waitFor({ timeout: 20_000 });
    await recordStage(`${viewport.name}: authenticated; auditing routes.`);

    for (const route of routes) {
      await recordStage(`${viewport.name}: auditing ${route}.`);
      await page.goto(`https://fi.qially.com/#${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(250);
      const layout = await page.evaluate(() => ({
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
      }));
      if (layout.documentWidth > layout.viewportWidth + 1 || layout.bodyWidth > layout.viewportWidth + 1) {
        failures.push(`${viewport.name} ${route}: horizontal page overflow (${Math.max(layout.documentWidth, layout.bodyWidth)} > ${layout.viewportWidth})`);
      }
    }

    failures.push(...runtimeErrors.map(error => `${viewport.name}: ${error}`));
    await context.close();
  }

  const pwaContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await recordStage('Viewport routes passed; auditing production PWA control.');
  const pwaPage = await pwaContext.newPage();
  await pwaPage.goto('https://fi.qially.com/', { waitUntil: 'networkidle' });
  await pwaPage.evaluate(() => navigator.serviceWorker.ready);
  await pwaPage.reload({ waitUntil: 'networkidle' });
  await pwaPage.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15_000 });
  const pwa = await pwaPage.evaluate(async () => {
    const manifest = await fetch('/manifest.webmanifest').then(response => response.json());
    const registration = await navigator.serviceWorker.ready;
    return {
      display: manifest.display,
      startUrl: manifest.start_url,
      iconSizes: manifest.icons?.map(icon => icon.sizes) || [],
      serviceWorkerActive: Boolean(registration.active),
      serviceWorkerControlsPage: Boolean(navigator.serviceWorker.controller),
    };
  });
  if (pwa.display !== 'standalone' || pwa.startUrl !== '/' || !pwa.iconSizes.includes('192x192') || !pwa.iconSizes.includes('512x512')) {
    failures.push(`PWA manifest is incomplete: ${JSON.stringify(pwa)}`);
  }
  if (!pwa.serviceWorkerActive || !pwa.serviceWorkerControlsPage) {
    failures.push(`PWA service worker is not active and controlling the page: ${JSON.stringify(pwa)}`);
  }
  await pwaContext.close();
} finally {
  await browser.close();
}

if (failures.length) {
  await writeFile('browser-audit-result.txt', failures[0].replaceAll('\n', ' ').slice(0, 130), 'utf8');
  failures.forEach(failure => console.error(`::error title=Production browser audit::${failure.replaceAll('\n', ' ')}`));
  throw new Error(`Production browser audit failed:\n${failures.join('\n')}`);
}
await writeFile('browser-audit-result.txt', 'All required viewports, routes, console/network checks, manifest, and service worker passed.', 'utf8');
console.log(`Production browser audit passed: ${viewports.length} viewports x ${routes.length} authenticated routes; PWA manifest and service worker verified.`);
