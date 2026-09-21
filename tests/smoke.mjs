import { chromium } from 'playwright';

const base = process.env.SITE_URL || 'http://127.0.0.1:4173/kc-kuto-crm/';
const browser = await chromium.launch({ headless: true });
const failures = [];
const results = [];

const targets = [
  ['Dashboard', null],
  ['Leads', 'Lead Inbox'],
  ['Customers', 'Customer List'],
  ['Contacts', 'Contact List'],
  ['Opportunities', 'Opportunity List'],
  ['Quotations', 'Quotation List'],
  ['Contracts & Renewal', 'All Contracts'],
  ['Assets / Installed Base', 'All Assets'],
  ['Tickets / Service Desk', 'All Tickets'],
  ['Activities', 'My Activities'],
  ['Documents', 'All Documents'],
  ['Reports & Analytics', null],
  ['AI Insights', 'AI Customer Summary'],
  ['Settings', null],
];

async function clickText(page, english, thai) {
  const candidates = [english, thai].filter(Boolean);
  for (const label of candidates) {
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
  }
  return false;
}

const thai = new Map([
  ['Dashboard','แดชบอร์ด'],
  ['Leads','ลูกค้าเป้าหมาย'],
  ['Lead Inbox','กล่องรับลูกค้า'],
  ['Customers','ลูกค้า'],
  ['Customer List','รายชื่อลูกค้า'],
  ['Contacts','ผู้ติดต่อ'],
  ['Contact List','รายชื่อผู้ติดต่อ'],
  ['Opportunities','โอกาสการขาย'],
  ['Opportunity List','รายการโอกาสการขาย'],
  ['Quotations','ใบเสนอราคา'],
  ['Quotation List','รายการใบเสนอราคา'],
  ['Contracts & Renewal','สัญญาและต่ออายุ'],
  ['All Contracts','สัญญาทั้งหมด'],
  ['Assets / Installed Base','สินทรัพย์ และระบบที่ติดตั้ง'],
  ['All Assets','สินทรัพย์ทั้งหมด'],
  ['Tickets / Service Desk','Ticket / งานบริการ'],
  ['All Tickets','Ticket ทั้งหมด'],
  ['Activities','กิจกรรม'],
  ['My Activities','กิจกรรมของฉัน'],
  ['Documents','เอกสาร'],
  ['All Documents','เอกสารทั้งหมด'],
  ['Reports & Analytics','รายงานและการวิเคราะห์'],
  ['AI Insights','ข้อมูลเชิงลึกจาก AI'],
  ['AI Customer Summary','สรุปลูกค้าด้วย AI'],
  ['Settings','ตั้งค่าระบบ'],
]);

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
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: `test-artifacts/${viewport.name}-home.png`, fullPage: true });

    for (const [parent, child] of targets) {
      if (viewport.name === 'mobile') {
        const drawerToggle = page.locator('button.lg\\:hidden').first();
        if (await drawerToggle.count()) {
          await drawerToggle.click({ timeout: 5000 });
          await page.waitForTimeout(250);
        }
      }
      let ok = await clickText(page, parent, thai.get(parent));
      if (!ok) {
        failures.push(`${viewport.name}: menu not found: ${parent}`);
        continue;
      }
      await page.waitForTimeout(250);

      if (child) {
        const childOk = await clickText(page, child, thai.get(child));
        if (!childOk) failures.push(`${viewport.name}: submenu not found: ${parent} > ${child}`);
        await page.waitForTimeout(350);
      }

      const body = await page.locator('body').innerText();
      if (/Something went wrong|Application error|Unhandled Runtime Error|เกิดข้อผิดพลาดร้ายแรง/i.test(body)) {
        failures.push(`${viewport.name}: fatal UI error after ${parent}`);
      }
      results.push(`${viewport.name}: ${parent}${child ? ' > ' + child : ''} OK`);
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
console.log('\nKC KuTo smoke test passed.');
