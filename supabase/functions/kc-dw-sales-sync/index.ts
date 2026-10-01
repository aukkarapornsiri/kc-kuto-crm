import { enrichmentRequest, staleSO } from "./so-sync-model.mjs";
import { createClient } from "npm:@supabase/supabase-js@2.115.0";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

const emailOk = (v: unknown) =>
  typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.toLowerCase());

const amount = (v: unknown, min = 0, max = 100000000000) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

async function sha256(s: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
  );
  return Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
}

function parseInstant(v: unknown) {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function bangkokPeriod(d: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return year && month ? `${year}-${month}-01` : null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ message: "Method not allowed" }, 405);

  try {
    const key = req.headers.get("x-kc-integration-key") || "";
    if (key.length < 32 || key.length > 200) {
      return json({ message: "Unauthorized" }, 401);
    }

    const rec = await db
      .from("kc_dw_integration_keys")
      .select("key_hash,active")
      .eq("name", "crm_powerapp_sales")
      .maybeSingle();

    if (rec.error || !rec.data || rec.data.active !== true) {
      return json({ message: "Unauthorized" }, 401);
    }
    if ((await sha256(key)) !== rec.data.key_hash) {
      return json({ message: "Unauthorized" }, 401);
    }

    const requestId = (req.headers.get("x-kc-request-id") || "").trim();
    if (requestId && !/^[A-Za-z0-9._:-]{8,120}$/.test(requestId)) {
      return json({ message: "Invalid request id" }, 400);
    }

    if (requestId) {
      const seen = await db
        .from("kc_dw_sales_sync_audit")
        .select("id,status")
        .eq("request_id", requestId)
        .maybeSingle();
      if (seen.error) throw new Error(seen.error.message);
      if (seen.data?.status === "success") {
        return json({ ok: true, duplicate: true, synced: 0 });
      }
    }

    const raw = await req.text();
    if (raw.length > 500000) return json({ message: "Payload too large" }, 413);

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ message: "Invalid JSON" }, 400);
    }

    if (body?.sourceBasis !== "converted_so") {
      return json(
        {
          code: "CONVERTED_SO_REQUIRED",
          message: "Sales actual must come from successfully converted Sales Orders (SO).",
        },
        422,
      );
    }

    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length < 1 || rows.length > 200) {
      return json({ message: "rows must contain 1-200 items" }, 400);
    }

    const mapped = await db
      .from("kc_dw_sales_identity_map")
      .select("sales_email")
      .eq("active", true);
    if (mapped.error) throw new Error(mapped.error.message);

    const allowedEmails = new Set(
      (mapped.data || []).map((x: any) => String(x.sales_email).toLowerCase()),
    );

    const ids = rows.map((r: any) => String(r.soId || "").trim());
    if (new Set(ids).size !== ids.length) return json({message:"Duplicate soId in request"},400);
    const oldRows = await db.from("kc_dw_sales_order_facts")
      .select("source_so_id,sales_email,sales_name,period_month,source_updated_at,customer_id,customer_source_id,customer_name,product_lines,currency")
      .eq("source_system","crm_powerapp").in("source_so_id",ids);
    if(oldRows.error) throw new Error(oldRows.error.message);
    const previous = new Map((oldRows.data || []).map((r: any)=>[r.source_so_id,r]));
    const facts: any[] = [];
    let ignoredStale = 0;
    const affected = new Map<string, { salesEmail: string; periodMonth: string; salesName: string }>();

    for (const r of rows) {
      if(r.status && !["converted","cancelled","voided"].includes(r.status)) return json({message:"Only converted SO, cancelled or voided statuses are accepted"},400);
      const sourceSoId =
        typeof r.soId === "string" ? r.soId.trim().slice(0, 160) : "";
      const soNumber =
        typeof r.soNumber === "string" ? r.soNumber.trim().slice(0, 120) : "";
      const salesEmail =
        typeof r.salesEmail === "string" ? r.salesEmail.trim().toLowerCase() : "";
      const salesName =
        typeof r.salesName === "string" ? r.salesName.trim().slice(0, 200) : "";
      const convertedAt = parseInstant(r.convertedAt);
      const periodMonth = convertedAt ? bangkokPeriod(convertedAt) : null;
      const netAmount = amount(r.netAmount);
      const grossProfit = amount(r.grossProfit, -100000000000, 100000000000);
      const status =
        r.status === "cancelled" || r.status === "voided" ? r.status : "converted";
      const sourceUpdated = r.sourceUpdatedAt ? parseInstant(r.sourceUpdatedAt) : null;

      if (
        !sourceSoId || String(r.soId).trim().length>160 || String(r.soNumber||'').trim().length>120 || r.netAmount===null || r.netAmount===undefined || r.netAmount==='' || typeof r.netAmount==='boolean' ||
        !soNumber ||
        !emailOk(salesEmail) ||
        !allowedEmails.has(salesEmail) ||
        !convertedAt ||
        !periodMonth ||
        netAmount === null ||
        grossProfit === null
      ) {
        return json(
          { message: "Invalid converted SO row", salesEmail, soNumber },
          400,
        );
      }

      const old: any = previous.get(sourceSoId);
      if (r.sourceUpdatedAt && !sourceUpdated) return json({message:"Invalid sourceUpdatedAt"},400);
      if(staleSO(old,sourceUpdated?.toISOString())){ignoredStale++;continue;}
      let extra: any;
      try { extra=enrichmentRequest(r,old); } catch(e) { return json({message:e instanceof Error?e.message:"Invalid SO metadata",soNumber},400); }
      if(extra.customerChanged){
        if(extra.customerId && extra.customerCode) {
          const c = await db.from("customers").select("id,code,name").eq("id",extra.customerId).maybeSingle();
          if(c.error)throw new Error(c.error.message);
          if(!c.data || c.data.code!==extra.customerCode)return json({message:"customerId and customerCode must refer to the same CRM customer",soNumber},400);
          extra.customer_id=c.data.id;extra.customer_name=c.data.name;
        } else if(extra.customerId || extra.customerCode) {
          const c = await db.from("customers").select("id,name").eq(extra.customerId?"id":"code",extra.customerId||extra.customerCode).maybeSingle();
          if(c.error)throw new Error(c.error.message);
          if(!c.data)return json({message:"CRM customer not found; use a valid customerId or customerCode",soNumber},400);
          extra.customer_id=c.data.id;extra.customer_name=c.data.name;
        } else {extra.customer_id=null;}
      }
      if(old)affected.set(`${old.sales_email}|${old.period_month}`, {salesEmail:old.sales_email,periodMonth:old.period_month,salesName:old.sales_name});
      facts.push({
        customer_id:extra.customer_id,customer_source_id:extra.customer_source_id,customer_name:extra.customer_name,product_lines:extra.product_lines,currency:extra.currency,
        source_system: "crm_powerapp",
        source_so_id: sourceSoId,
        so_number: soNumber,
        sales_email: salesEmail,
        sales_name: salesName,
        converted_at: convertedAt.toISOString(),
        period_month: periodMonth,
        net_amount: netAmount,
        gross_profit: grossProfit,
        status,
        source_updated_at: sourceUpdated?.toISOString() || old?.source_updated_at || null,
        synced_at: new Date().toISOString(),
      });

      affected.set(`${salesEmail}|${periodMonth}`, {
        salesEmail,
        periodMonth,
        salesName,
      });
    }

    if(!facts.length)return json({ok:true,source_basis:"converted_so",synced:0,ignored_stale:ignoredStale});
    const upsertFacts = await db
      .from("kc_dw_sales_order_facts")
      .upsert(facts, { onConflict: "source_system,source_so_id" })
      .select("sales_email,period_month");

    if (upsertFacts.error) throw new Error(upsertFacts.error.message);

    for (const item of affected.values()) {
      const [factRows, existing] = await Promise.all([
        db
          .from("kc_dw_sales_order_facts")
          .select("net_amount,gross_profit,source_updated_at,converted_at")
          .eq("sales_email", item.salesEmail)
          .eq("period_month", item.periodMonth)
          .eq("status", "converted").eq("currency","THB"),
        db
          .from("kc_dw_sales_performance")
          .select("*")
          .eq("sales_email", item.salesEmail)
          .eq("period_month", item.periodMonth)
          .maybeSingle(),
      ]);

      if (factRows.error) throw new Error(factRows.error.message);
      if (existing.error) throw new Error(existing.error.message);

      const validFacts = factRows.data || [];
      const actualRevenue = validFacts.reduce(
        (sum: number, row: any) => sum + Number(row.net_amount || 0),
        0,
      );
      const grossProfit = validFacts.reduce(
        (sum: number, row: any) => sum + Number(row.gross_profit || 0),
        0,
      );
      const latestSourceUpdated = validFacts
        .map((row: any) => row.source_updated_at || row.converted_at)
        .filter(Boolean)
        .sort()
        .at(-1) || null;

      const base = existing.data || {};
      const performance = {
        sales_email: item.salesEmail,
        sales_name: item.salesName || base.sales_name || "",
        period_month: item.periodMonth,
        target_amount: Number(base.target_amount || 0),
        actual_revenue: actualRevenue,
        gross_profit: grossProfit,
        pipeline_amount: Number(base.pipeline_amount || 0),
        weighted_pipeline: Number(base.weighted_pipeline || 0),
        forecast_amount: Number(base.forecast_amount || 0),
        won_deals: validFacts.length,
        open_opportunities: Number(base.open_opportunities || 0),
        win_rate: Number(base.win_rate || 0),
        new_customers: Number(base.new_customers || 0),
        source_system: base.source_system || "crm_powerapp",
        source_updated_at: base.source_updated_at || latestSourceUpdated,
        actual_revenue_basis: "converted_so",
        actual_revenue_source_updated_at: latestSourceUpdated,
        synced_at: new Date().toISOString(),
      };

      const save = await db
        .from("kc_dw_sales_performance")
        .upsert(performance, { onConflict: "sales_email,period_month" });

      if (save.error) throw new Error(save.error.message);
    }

    await db
      .from("kc_dw_integration_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("name", "crm_powerapp_sales");

    await db.from("kc_dw_sales_sync_audit").insert({
      source: "crm_powerapp_convert_so",
      rows_received: rows.length,
      rows_synced: upsertFacts.data?.length ?? 0,
      request_id: requestId || null,
      status: "success",
    });

    return json({
      ok: true,
      source_basis: "converted_so",
      ignored_stale: ignoredStale,
      synced: upsertFacts.data?.length ?? 0,
      affected_periods: [...affected.values()].map((x) => ({
        salesEmail: x.salesEmail,
        periodMonth: x.periodMonth,
      })),
    });
  } catch (e) {
    console.error(e);
    try {
      await db.from("kc_dw_sales_sync_audit").insert({
        source: "crm_powerapp_convert_so",
        rows_received: 0,
        rows_synced: 0,
        request_id: null,
        status: "failed",
        error_message: e instanceof Error ? e.message.slice(0, 1000) : "unknown",
      });
    } catch {}
    return json({ message: "Sales SO sync failed" }, 502);
  }
});
