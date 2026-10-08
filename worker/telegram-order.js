// Cloudflare Worker: приймає замовлення з лендінгу і пересилає в Telegram.
// Секрети (Settings → Variables): BOT_TOKEN, CHAT_ID. Необовʼязково: ALLOWED_ORIGIN (напр. https://sonline.com.ua).

const MAX_FIELD = 500;

const escapeHtml = (v) =>
  String(v ?? "").slice(0, MAX_FIELD).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function corsHeaders(env, origin) {
  const allowed = env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": allowed === "*" ? "*" : allowed,
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
  if (o.comment) lines.push(`💬 ${escapeHtml(o.comment)}`);
  return lines.join("\n");
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(env, origin);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return json({ ok: false, error: "method" }, 405, headers);
    if (env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN) return json({ ok: false, error: "origin" }, 403, headers);

    let order;
    try {
      order = await request.json();
    } catch {
      return json({ ok: false, error: "json" }, 400, headers);
    }

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
