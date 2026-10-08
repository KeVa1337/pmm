// Cloudflare Worker для лендінгу:
//   POST /               — приймає замовлення і пересилає в Telegram
//   POST /np/cities      — пошук міста в Новій пошті      { q }
//   POST /np/warehouses  — відділення Нової пошти у місті { cityRef }
//   GET  /np/cities?q=Київ — те саме для перевірки в браузері
// Змінні (Settings → Variables and Secrets): BOT_TOKEN (Secret), CHAT_ID.
// Необовʼязково: NP_API_KEY (Secret) — ключ API Нової пошти; ALLOWED_ORIGIN — адреса сайту.

const MAX_FIELD = 500;
const NP_URL = "https://api.novaposhta.ua/v2.0/json/";

const escapeHtml = (v) =>
  String(v ?? "").slice(0, MAX_FIELD).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

export function formatOrder(o) {
  const size = `${Number(o.width)}×${Number(o.length)} см`;
  const lines = [
    o.customSize ? "🛠 <b>Заявка на розмір під замовлення</b>" : "🛏 <b>Нове замовлення</b>",
    "",
    `Матрац «${escapeHtml(o.product)}», ${size} × ${Number(o.qty) || 1} шт.`,
    `Сума: <b>${escapeHtml(o.customSize ? "ціна за запитом" : o.total)}</b>`,
    "",
    `👤 ${escapeHtml(o.name)}`,
    `📞 ${escapeHtml(o.phone)}`,
  ];
  if (o.city) lines.push(`🏙 ${escapeHtml(o.city)}`);
  if (o.warehouse) lines.push(`🚚 Нова пошта: ${escapeHtml(o.warehouse)}`);
  if (o.comment) lines.push(`💬 ${escapeHtml(o.comment)}`);
  return lines.join("\n");
}

async function np(env, modelName, calledMethod, methodProperties) {
  const res = await fetch(NP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: env.NP_API_KEY || "", modelName, calledMethod, methodProperties }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error((data.errors || []).join("; ") || "np error");
  return data.data || [];
}

export async function searchCities(env, q) {
  const query = String(q || "").trim().slice(0, 50);
  if (query.length < 2) return [];
  const data = await np(env, "Address", "searchSettlements", { CityName: query, Limit: "15", Page: "1" });
  return (data[0]?.Addresses || [])
    .filter((a) => a.DeliveryCity && Number(a.Warehouses) > 0)
    .map((a) => ({ ref: a.DeliveryCity, name: a.Present || a.MainDescription }));
}

export async function listWarehouses(env, cityRef) {
  if (!/^[0-9a-f-]{36}$/i.test(String(cityRef || ""))) return [];
  const data = await np(env, "AddressGeneral", "getWarehouses", { CityRef: cityRef, Limit: "500", Page: "1" });
  return data
    // Матрац у поштомат не влізе
    .filter((w) => w.CategoryOfWarehouse !== "Postomat" && !/поштомат/i.test(w.Description || ""))
    .map((w) => {
      const d = w.ReceivingLimitationsOnDimensions || {};
      return {
        ref: w.Ref,
        number: w.Number,
        name: w.Description,
        maxWeight: Number(w.TotalMaxWeightAllowed) || Number(w.PlaceMaxWeightAllowed) || 0,
        maxDims: [Number(d.Length) || 0, Number(d.Width) || 0, Number(d.Height) || 0],
      };
    })
    .sort((a, b) => Number(a.number) - Number(b.number));
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(env);
    const path = new URL(request.url).pathname.replace(/\/+$/, "");

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    // Перевірка довідника Нової пошти в браузері: /np/cities?q=Київ
    if (request.method === "GET" && path === "/np/cities") {
      try {
        const items = await searchCities(env, new URL(request.url).searchParams.get("q"));
        return json({ ok: true, version: 2, items }, 200, headers);
      } catch (e) {
        return json({ ok: false, version: 2, error: "novaposhta", detail: String(e.message || e) }, 502, headers);
      }
    }

    if (request.method !== "POST") return json({ ok: false, error: "method" }, 405, headers);
    if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) return json({ ok: false, error: "origin" }, 403, headers);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "json" }, 400, headers);
    }

    if (path === "/np/cities" || path === "/np/warehouses") {
      try {
        const items = path === "/np/cities" ? await searchCities(env, body.q) : await listWarehouses(env, body.cityRef);
        return json({ ok: true, items }, 200, { ...headers, "Cache-Control": "public, max-age=3600" });
      } catch (e) {
        return json({ ok: false, error: "novaposhta", detail: String(e.message || e) }, 502, headers);
      }
    }

    if (path !== "") return json({ ok: false, error: "not_found" }, 404, headers);

    const order = body;
    // Пастка для ботів: приховане поле має бути порожнім
    if (order.website) return json({ ok: true }, 200, headers);

    const phoneDigits = String(order.phone || "").replace(/\D/g, "");
    if (String(order.name || "").trim().length < 2 || phoneDigits.length < 10 || phoneDigits.length > 12) {
      return json({ ok: false, error: "validation" }, 400, headers);
    }

    const tg = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.CHAT_ID, text: formatOrder(order), parse_mode: "HTML" }),
    });

    if (!tg.ok) return json({ ok: false, error: "telegram" }, 502, headers);
    return json({ ok: true }, 200, headers);
  },
};
