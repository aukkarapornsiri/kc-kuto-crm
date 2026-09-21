import { chromium } from 'playwright';

const base = process.env.SITE_URL || 'http://127.0.0.1:4173/kc-kuto-crm/';
const browser = await chromium.launch({ headless: true });
const failures = [];
const results = [];

const groups = [
  { parent: 'Dashboard', children: [] },
  { parent: 'Leads', children: ['Lead Inbox', 'All Leads', 'Lead Kanban', 'Lead Assignment'] },
  { parent: 'Customers', children: ['Customer List', 'Customer 360', 'Accounts', 'Branches'] },
  { parent: 'Contacts', children: ['Contact List', 'Primary Contacts', 'Contact Activity History'] },
  { parent: 'Opportunities', children: ['Pipeline Kanban', 'Opportunity List', 'Forecast', 'Competitors'] },
  { parent: 'Quotations', children: ['Quotation List', 'Quotation Approval', 'Price Book', 'Quotation Templates'] },
  { parent: 'Contracts & Renewal', children: ['All Contracts', 'Renewal Alerts', 'Microsoft CSP', 'Warranty Tracking'] },
  { parent: 'Assets / Installed Base', children: ['All Assets', 'Installed Base', 'License Subscriptions', 'Assets by Customer'] },
  { parent: 'Tickets / Service Desk', children: ['All Tickets', 'Kanban View', 'SLA Monitoring', 'Knowledge Base'] },
  { parent: 'Activities', children: ['My Activities', 'Activity Timeline', 'Calendar View', 'Meetings', 'Follow-up Tasks'] },
  { parent: 'Documents', children: ['All Documents', 'Customer Documents', 'Document Templates', 'Archived Documents'] },
  { parent: 'Reports & Analytics', children: [] },
  { parent: 'AI Insights', children: ['AI Customer Summary', 'AI Next Best Action', 'AI Renewal Risk'] },
  { parent: 'Settings', children: [] },
];

async function clickExactVisible(page, label) {
  const exact = page.getByText(label, { exact: true });
  const count = await exact.count();
  for (let i = 0; i < count; i++) {
    const node = exact.nth(i);
    if (await node.isVisible().catch(() => false)) {
      await node.click({ timeout: 5000 }).catch(async () => {
        await node.locator('..').click({ timeout: 5000 });
      });
      return true;
    }
  }
  return false;
}

async function openMobileDrawer(page) {
  const drawerToggle = page.locator('button.lg\\:hidden').first();
  if (!(await drawerToggle.count())) return false;
  await drawerToggle.click({ timeout: 5000 });
  await page.waitForTimeout(180);
  return true;
}

async function assertHealthy(page, label) {
  await page.waitForTimeout(220);
  const body = await page.locator('body').innerText();
  if (/Something went wrong|Application error|Unhandled Runtime Error|เกิดข้อผิดพลาดร้ายแรง/i.test(body)) {
    failures.push(`${label}: fatal UI error`);
  }
  if (/Under Development|อยู่ระหว่างการพัฒนา/i.test(body)) {
    failures.push(`${label}: still renders Under Development placeholder`);
  }
}

for (const viewport of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport });
  const runtimeErrors = [];

  page.on('pageerror', err => runtimeErrors.push('pageerror: ' + err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!/favicon|ResizeObserver loop/i.test(txt)) runtimeErrors.push('console: ' + txt);
    }
  });
  page.on('response', res => {
    if (res.status() >= 400) runtimeErrors.push('http ' + res.status() + ': ' + res.url());
  });

  try {
    await page.goto(base, { waitUntil: 'networkidle', timeout: 30000 });

    const demo = page.getByRole('button', { name: /เข้าใช้งานโหมดทดลอง|Continue in Demo Mode/i });
    if (await demo.count()) {
      await demo.first().click();
      await page.waitForTimeout(700);
    }

    const en = page.getByRole('button', { name: 'EN', exact: true });
    if (await en.count()) {
      await en.first().click();
      await page.waitForTimeout(180);
    }

    await page.screenshot({ path: `test-artifacts/${viewport.name}-home.png`, fullPage: true });

    for (const group of groups) {
      if (viewport.name === 'mobile') await openMobileDrawer(page);

      const parentOk = await clickExactVisible(page, group.parent);
      if (!parentOk) {
        failures.push(`${viewport.name}: menu not found: ${group.parent}`);
        continue;
      }
      await assertHealthy(page, `${viewport.name}: ${group.parent}`);

      if (!group.children.length) {
        results.push(`${viewport.name}: ${group.parent} OK`);
        continue;
      }

      for (let index = 0; index < group.children.length; index++) {
        const child = group.children[index];

        if (viewport.name === 'mobile' && index > 0) {
          await openMobileDrawer(page);
          const reopened = await clickExactVisible(page, group.parent);
          if (!reopened) {
            failures.push(`${viewport.name}: cannot reopen menu: ${group.parent}`);
            break;
          }
          await page.waitForTimeout(120);
        }

        const childOk = await clickExactVisible(page, child);
        if (!childOk) {
          failures.push(`${viewport.name}: submenu not found: ${group.parent} > ${child}`);
          continue;
        }
        await assertHealthy(page, `${viewport.name}: ${group.parent} > ${child}`);
        results.push(`${viewport.name}: ${group.parent} > ${child} OK`);
      }
    }

    const th = page.getByRole('button', { name: 'TH', exact: true });
    if (await th.count()) {
      await th.first().click();
      await page.waitForTimeout(180);
      const thaiMode = await page.getByText('โหมดภาษาไทย', { exact: true }).count();
      if (!thaiMode) failures.push(`${viewport.name}: TH language toggle did not switch the UI`);
    }

    await page.screenshot({ path: `test-artifacts/${viewport.name}-final.png`, fullPage: true });
  } catch (e) {
    failures.push(`${viewport.name}: ${e.message}`);
  }

  failures.push(...runtimeErrors.map(x => `${viewport.name}: ${x}`));
  await page.close();
}

await browser.close();
console.log(results.join('\n'));
if (failures.length) {
  console.error('\nSMOKE FAILURES\n' + failures.join('\n'));
  process.exit(1);
}
console.log('\nKC KuTo full visible-menu smoke test passed.');
