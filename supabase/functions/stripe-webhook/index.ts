import { createClient } from "npm:@supabase/supabase-js@2";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const env = (n: string) => (Deno.env.get(n) ?? "").trim();
const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function getSecret(name: string) {
  const direct = env(name);
  if (direct) return direct;
  const { data, error } = await admin.rpc("kc_get_integration_secret", { p_name: name });
  return error ? "" : String(data ?? "").trim();
}

function parseSignature(header: string) {
  const parts = header.split(",").map((x) => x.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1] ?? "";
  const v1 = parts.filter(([k]) => k === "v1").map(([,v]) => v);
  return { t, v1 };
}

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2,"0")).join("");
}

function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripe(raw: string, header: string, secret: string) {
  const { t, v1 } = parseSignature(header);
  if (!t || !v1.length) return false;
  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(Date.now()/1000 - ts) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
  const sig = toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)));
  return v1.some((x) => safeEq(x,sig));
}

async function logWebhook(event: any, ok: boolean, error?: string | null) {
  try {
    await admin.from("integration_sync_runs").insert({
      provider:"stripe",
      resource:event?.type ?? "webhook",
      direction:"webhook",
      status:ok?"success":"failed",
      records_seen:1,
      records_updated:ok?1:0,
      records_failed:ok?0:1,
      details:{ event_id:event?.id ?? null, event_type:event?.type ?? null },
      error_message:error ?? null,
      finished_at:new Date().toISOString(),
    });
  } catch {}
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error:"Method not allowed" },405);
  const secret = await getSecret("STRIPE_WEBHOOK_SECRET");
  if (!secret) return json({ error:"Stripe webhook is not configured" },503);

  const raw = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  if (!(await verifyStripe(raw,signature,secret))) return json({ error:"Invalid Stripe signature" },401);

  let event: any;
  try { event = JSON.parse(raw); } catch { return json({ error:"Invalid JSON" },400); }

  if (!event?.id || !event?.type) return json({ error:"Stripe event id/type missing" },400);
  const { data: prior } = await admin.from("billing_webhook_events").select("status").eq("event_id",event.id).maybeSingle();
  if (prior?.status === "processed") return json({ received:true, duplicate:true });
  const { error: reserveError } = await admin.from("billing_webhook_events").upsert({
    event_id:event.id,event_type:event.type,status:"received",error_message:null,received_at:new Date().toISOString()
  },{onConflict:"event_id"});
  if (reserveError) return json({ error:"Unable to reserve webhook event" },500);

  try {
    const obj = event?.data?.object ?? {};
    if (event.type === "checkout.session.completed") {
      await admin.from("billing_account").update({
        customer_external_id: obj.customer ?? null,
        subscription_external_id: obj.subscription ?? null,
        plan_key: obj.metadata?.plan_key ?? null,
        status: obj.payment_status === "paid" ? "active" : "configured",
        metadata: { checkout_session_id: obj.id, payment_status: obj.payment_status ?? null },
        updated_at: new Date().toISOString(),
      }).eq("id",1);
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await admin.from("billing_account").update({
        customer_external_id: obj.customer ?? null,
        subscription_external_id: obj.id ?? null,
        plan_key: obj.metadata?.plan_key ?? undefined,
        status: event.type === "customer.subscription.deleted" ? "canceled" : (obj.status ?? "unknown"),
        current_period_end: obj.current_period_end ? new Date(obj.current_period_end*1000).toISOString() : null,
        cancel_at_period_end: Boolean(obj.cancel_at_period_end),
        metadata: { stripe_status: obj.status ?? null },
        updated_at: new Date().toISOString(),
      }).eq("id",1);
    }

    if (event.type === "invoice.payment_failed") {
      await admin.from("billing_account").update({
        status:"past_due",
        metadata:{ last_failed_invoice:obj.id ?? null },
        updated_at:new Date().toISOString(),
      }).eq("id",1);
    }

    await admin.from("integration_connections").update({
      status:"connected", enabled:true, last_checked_at:new Date().toISOString(),
      last_success_at:new Date().toISOString(), last_error:null, updated_at:new Date().toISOString()
    }).eq("provider","stripe");

    await admin.from("billing_webhook_events").update({
      status:"processed",processed_at:new Date().toISOString(),error_message:null
    }).eq("event_id",event.id);
    await logWebhook(event,true);
    return json({ received:true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Webhook processing failed";
    await admin.from("billing_webhook_events").update({
      status:"failed",processed_at:new Date().toISOString(),error_message:message
    }).eq("event_id",event.id);
    await logWebhook(event,false,message);
    return json({ error:message },500);
  }
});
