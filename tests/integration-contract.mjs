import fs from 'node:fs';

const bundle = fs.readFileSync('app-C2ITSffc.js','utf8');
const server = fs.readFileSync('supabase/functions/server/index.ts','utf8');
const webhook = fs.readFileSync('supabase/functions/stripe-webhook/index.ts','utf8');

const failures = [];
const requireText = (src, text, label) => {
  if (!src.includes(text)) failures.push(`missing ${label}: ${text}`);
};

for (const endpoint of [
  '/integrations/status',
  '/integrations/configure',
  '/integrations/check',
  '/intune-devices',
  '/calendar/pull',
  '/calendar/push',
  '/inventory/pull',
  '/billing/checkout',
  '/billing/portal',
]) requireText(bundle, endpoint, 'frontend endpoint');

for (const provider of [
  'microsoft_intune',
  'microsoft_calendar',
  'google_calendar',
  'inventory',
  'stripe',
]) {
  requireText(bundle, provider, 'frontend provider');
  requireText(server, provider, 'backend provider');
}

requireText(bundle, 'Stripe Webhook URL', 'Stripe webhook UI');
requireText(bundle, 'webhook_url', 'Stripe webhook backend field');
requireText(server, 'DeviceManagementManagedDevices', 'Intune permission/endpoint');
requireText(server, 'calendarView', 'Microsoft Calendar pull');
requireText(server, '/calendar/pull', 'Calendar pull route');
requireText(server, 'Calendars', 'Microsoft Calendar integration');
requireText(server, 'www.googleapis.com/calendar/v3', 'Google Calendar API');
requireText(server, 'Inventory system is not configured', 'Inventory configuration guard');
requireText(server, 'webhookVerified', 'Stripe verified-webhook gate');
requireText(server, 'waiting for the first signature-verified webhook event', 'Stripe configured-not-connected state');
requireText(server, 'Checkout created; waiting for a signature-verified Stripe webhook before Connected', 'Stripe checkout guard');
requireText(webhook, 'verifyStripe', 'Stripe signature verification');
requireText(webhook, 'stripe-signature', 'Stripe signature header');
requireText(webhook, 'status:"connected"', 'Stripe connected transition after verified webhook');

const forbiddenSecretPatterns = [
  /sk_(?:live|test)_[A-Za-z0-9]{16,}/,
  /whsec_[A-Za-z0-9]{16,}/,
  /AIza[0-9A-Za-z_-]{30,}/,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
];
for (const [name, src] of [['bundle', bundle], ['server', server], ['webhook', webhook]]) {
  for (const pattern of forbiddenSecretPatterns) {
    if (pattern.test(src)) failures.push(`hard-coded secret-like value found in ${name}: ${pattern}`);
  }
}

if (failures.length) {
  console.error('Integration contract failures:\n' + failures.join('\n'));
  process.exit(1);
}
console.log('KC KuTo integration contract passed.');
