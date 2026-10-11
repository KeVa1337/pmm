(() => {
  // Адреса Cloudflare Worker, що пересилає замовлення в Telegram (див. worker/README.md).
  // Порожньо — замовлення нікуди не надсилаються, лише виводяться в консоль.
  const ORDER_ENDPOINT = "https://sonline-orders.bogit49.workers.dev";

  // Google Ads / Analytics (див. docs/google-ads.md). Порожні значення — теги не завантажуються.
  const GOOGLE = {
    ga4Id: "G-5VYQWM2DN0", // Google Analytics 4
    adsId: "AW-18248564723", // Google Ads
    adsLeadLabel: "1T_0CM-ywZkdEPP_y_1D", // конверсія «Замовлення матраца SonLine»
    adsContactLabel: "",// мітка конверсії «Дзвінок / Telegram» (необовʼязково)
  };

  const PRODUCT = { name: "Камелія", height: 22 };

  // Розміри в наявності та ціни (грн). factoryPrice — ціна на сайті виробника matroluxe.com
  const SIZES = [
    { w: 160, l: 200, price: 21990, factoryPrice: 24153 },
    { w: 180, l: 200, price: 23990, factoryPrice: 26552 },
  ];
  const CUSTOM = "custom"; // інший розмір під замовлення, ціна за запитом

  const state = { size: 0, qty: 1, cw: 150, cl: 200 };
  // Розмір з посилання, напр. ?size=180x200 (для реклами та Google Merchant)
  {
    const m = /^(\d{2,3})x(\d{3})$/.exec(new URLSearchParams(location.search).get("size") || "");
    const i = m ? SIZES.findIndex((s) => s.w === Number(m[1]) && s.l === Number(m[2])) : -1;
    if (i >= 0) state.size = i;
  }

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString("uk-UA").replace(/,/g, " ") + " ₴";
  const sizeLabel = ({ w, l }) => `${w} × ${l}`;
  const sizeCategory = (w) => (w <= 90 ? "Односпальний" : w <= 140 ? "Півтораспальний" : "Двоспальний");
  const isCustom = () => state.size === CUSTOM;
  const currentSize = () => (isCustom() ? { w: state.cw, l: state.cl, price: null } : SIZES[state.size]);

  // ---------- Render ----------
  function renderSizes() {
    $("sizes").innerHTML = SIZES.map((s, i) => `
      <label class="model">
        <input type="radio" name="size" value="${i}" ${i === state.size ? "checked" : ""}>
        ${s.tag ? `<span class="model__tag">${s.tag}</span>` : ""}
        <span class="model__name">${sizeLabel(s)} см</span>
        <span class="model__meta">${sizeCategory(s.w)}</span>
        <span class="model__old">${fmt(s.factoryPrice)}</span>
        <span class="model__from">${fmt(s.price)}</span>
      </label>`).join("") + `
      <label class="model model--custom">
        <input type="radio" name="size" value="${CUSTOM}" ${isCustom() ? "checked" : ""}>
        <span class="model__name">Інший розмір</span>
        <span class="model__meta">Під замовлення</span>
        <span class="model__from">Вигідна ціна</span>
      </label>`;
  }

  function renderTable() {
    $("priceTable").innerHTML = `
      <thead><tr><th>Розмір, см</th><th>Висота</th><th>Ціна виробника</th><th>Наша ціна</th></tr></thead>
      <tbody>${SIZES.map((s, i) => `
        <tr data-i="${i}"><td>${sizeLabel(s)}</td><td>${PRODUCT.height} см</td><td><s>${fmt(s.factoryPrice)}</s></td><td><b>${fmt(s.price)}</b></td></tr>`).join("")}
      </tbody>`;
  }

  // ---------- Summary ----------
  function update() {
    const s = currentSize();
    const custom = isCustom();
    $("sumModel").textContent = PRODUCT.name;
    $("sumSize").textContent = `${sizeLabel(s)} см`;
    $("sumHeight").textContent = `${PRODUCT.height} см`;
    $("sumStock").textContent = custom ? "Під замовлення" : "В наявності";
    $("sumQty").textContent = state.qty;
    $("qty").textContent = state.qty;
    $("price").textContent = custom ? "За запитом" : fmt(s.price * state.qty);
    $("price").classList.toggle("price--request", custom);
    $("priceLabel").textContent = custom
      ? "Менеджер розрахує вигідну ціну"
      : `Дешевше, ніж у виробника, на ${fmt((s.factoryPrice - s.price) * state.qty)}`;
    $("priceOld").textContent = custom ? "" : fmt(s.factoryPrice * state.qty);
    $("orderBtn").textContent = custom ? "Дізнатися ціну" : "Замовити";
    $("customSize").hidden = !custom;
    $("summaryNote").textContent = custom
      ? "Термін виготовлення уточнить менеджер"
      : "Оплата при отриманні · Доставка 1–3 дні";

    $("bedLabel").textContent = `${sizeLabel(s)} см`;
    $("bedCaption").textContent = custom ? "Під замовлення" : sizeCategory(s.w);
  }

  function selectSize(i) {
    state.size = i;
    document.querySelectorAll('input[name="size"]').forEach((inp) => { inp.checked = inp.value === String(i); });
    update();
  }

  // ---------- Events ----------
  function bindConfigurator() {
    $("sizes").addEventListener("change", (e) => {
      const v = e.target.value;
      selectSize(v === CUSTOM ? CUSTOM : Number(v));
    });

    for (const [id, key] of [["customW", "cw"], ["customL", "cl"]]) {
      const inp = $(id);
      const min = Number(inp.min), max = Number(inp.max);
      inp.addEventListener("input", () => {
        const v = Math.round(Number(inp.value));
        if (v >= min && v <= max) { state[key] = v; update(); }
      });
      inp.addEventListener("change", () => {
        const v = Math.min(max, Math.max(min, Math.round(Number(inp.value)) || state[key]));
        inp.value = v;
        state[key] = v;
        update();
      });
    }
    $("qtyMinus").addEventListener("click", () => { state.qty = Math.max(1, state.qty - 1); update(); });
    $("qtyPlus").addEventListener("click", () => { state.qty = Math.min(10, state.qty + 1); update(); });
    $("priceTable").addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-i]");
      if (!row) return;
      selectSize(Number(row.dataset.i));
      $("configurator").scrollIntoView({ behavior: "smooth" });
    });
  }

  // ---------- Analytics ----------
  const gtagReady = Boolean(GOOGLE.ga4Id || GOOGLE.adsId);
  function gtag() { window.dataLayer.push(arguments); }
  function initAnalytics() {
    if (!gtagReady) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = gtag;
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE.adsId || GOOGLE.ga4Id}`;
    document.head.appendChild(s);
    gtag("js", new Date());
    if (GOOGLE.ga4Id) gtag("config", GOOGLE.ga4Id);
    if (GOOGLE.adsId) gtag("config", GOOGLE.adsId, { allow_enhanced_conversions: true });
  }
  function track(event, params = {}) {
    if (gtagReady) gtag("event", event, params);
  }

  // Звідки прийшов покупець: utm-мітки та gclid з реклами (зберігаємо на час візиту)
  const SOURCE_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"];
  function captureSource() {
    const params = new URLSearchParams(location.search);
    const found = {};
    SOURCE_KEYS.forEach((k) => { if (params.get(k)) found[k] = params.get(k).slice(0, 150); });
    try {
      if (Object.keys(found).length) sessionStorage.setItem("source", JSON.stringify(found));
      return JSON.parse(sessionStorage.getItem("source") || "{}");
    } catch {
      return found;
    }
  }
  const SOURCE = captureSource();

  function toE164(phone) {
    const d = phone.replace(/\D/g, "");
    if (d.length === 12 && d.startsWith("380")) return "+" + d;
    if (d.length === 10 && d.startsWith("0")) return "+38" + d;
    return "";
  }

  function bindContactTracking() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href^='tel:'], a[href*='t.me/']");
      if (!a) return;
      const method = a.href.startsWith("tel:") ? "phone" : "telegram";
      track("contact", { method });
      if (GOOGLE.adsId && GOOGLE.adsContactLabel) {
        track("conversion", { send_to: `${GOOGLE.adsId}/${GOOGLE.adsContactLabel}` });
      }
    });
  }

  function bindStickyCta() {
    const bar = $("stickyCta");
    if (!bar || !("IntersectionObserver" in window)) return;
    const hidden = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => (en.isIntersecting ? hidden.add(en.target) : hidden.delete(en.target)));
      bar.classList.toggle("is-visible", hidden.size === 0);
    });
    [document.querySelector(".hero__actions"), $("configurator"), document.querySelector(".footer")]
      .filter(Boolean).forEach((el) => io.observe(el));
  }

  // ---------- Nova Poshta ----------
  const NP_ENDPOINT = ORDER_ENDPOINT ? ORDER_ENDPOINT.replace(/\/+$/, "") + "/np" : "";
  const np = { cityRef: "", warehouseRef: "", warehouses: [], failed: !NP_ENDPOINT };

  async function npRequest(path, body) {
    const res = await fetch(`${NP_ENDPOINT}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || res.statusText);
    return data.items;
  }

  // Матрац везуть пласким: довжина × ширина × висота
  const parcelDims = () => { const { w, l } = currentSize(); return [l, w, PRODUCT.height]; };
  function fitsDims(maxDims, parcel) {
    if (!maxDims || maxDims.every((d) => !d)) return true; // обмежень немає
    const lim = [...maxDims].sort((a, b) => b - a);
    const box = [...parcel].sort((a, b) => b - a);
    return box.every((d, i) => !lim[i] || d <= lim[i]);
  }

  function combo(input, list, { load, render, onPick }) {
    let items = [];
    let active = -1;
    let timer;
    let seq = 0;

    const close = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; };
    const highlight = (i) => {
      active = i;
      [...list.children].forEach((li, k) => li.setAttribute("aria-selected", String(k === i)));
      list.children[i]?.scrollIntoView({ block: "nearest" });
    };
    const show = (arr, emptyText) => {
      items = arr;
      list.innerHTML = arr.length
        ? arr.map((it, i) => `<li role="option" id="${list.id}-${i}" data-i="${i}">${render(it)}</li>`).join("")
        : `<li class="is-empty">${emptyText}</li>`;
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      active = -1;
    };
    const pick = (i) => { if (items[i]) { onPick(items[i]); close(); } };

    const run = () => {
      const my = ++seq;
      Promise.resolve(load(input.value.trim()))
        .then((res) => { if (my === seq && res) show(res.items, res.empty); })
        .catch(() => { if (my === seq) close(); });
    };

    input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 250); });
    input.addEventListener("focus", run);
    input.addEventListener("keydown", (e) => {
      if (list.hidden) return;
      if (e.key === "ArrowDown") { e.preventDefault(); highlight(Math.min(items.length - 1, active + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); highlight(Math.max(0, active - 1)); }
      else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(active); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    list.addEventListener("mousedown", (e) => {
      const li = e.target.closest("li[data-i]");
      if (li) { e.preventDefault(); pick(Number(li.dataset.i)); }
    });
    input.addEventListener("blur", () => setTimeout(close, 100));
  }

  function clearError(input) {
    input.classList.remove("is-invalid");
    input.form?.querySelector(`.error[data-for="${input.name}"]`)?.classList.remove("is-shown");
  }

  const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function bindNovaPoshta() {
    const city = $("npCity");
    const wh = $("npWh");
    const note = $("npWhNote");

    const fallbackToText = () => {
      np.failed = true;
      wh.disabled = false;
      wh.placeholder = "Номер або адреса відділення";
      note.textContent = "Довідник Нової пошти тимчасово недоступний — впишіть місто й відділення вручну.";
    };
    if (np.failed) fallbackToText();

    combo(city, $("npCityList"), {
      load: async (q) => {
        if (np.failed || q.length < 2) return null;
        try {
          return { items: await npRequest("cities", { q }), empty: "Місто не знайдено" };
        } catch {
          fallbackToText();
          return null;
        }
      },
      render: (c) => escapeHtml(c.name),
      onPick: async (c) => {
        city.value = c.name;
        clearError(city);
        np.cityRef = c.ref;
        np.warehouseRef = "";
        wh.value = "";
        wh.disabled = true;
        wh.placeholder = "Завантаження відділень…";
        note.textContent = "";
        try {
          np.warehouses = await npRequest("warehouses", { cityRef: c.ref });
          wh.disabled = false;
          wh.placeholder = "Номер або вулиця відділення";
        } catch {
          fallbackToText();
        }
      },
    });
    city.addEventListener("input", () => {
      if (np.failed) return;
      np.cityRef = "";
      np.warehouseRef = "";
      wh.value = "";
      wh.disabled = true;
      wh.placeholder = "Спочатку оберіть місто";
    });

    combo(wh, $("npWhList"), {
      load: (q) => {
        if (np.failed || !np.cityRef) return null;
        const parcel = parcelDims();
        const fitting = np.warehouses.filter((w) => fitsDims(w.maxDims, parcel));
        const pool = fitting.length ? fitting : np.warehouses;
        note.textContent = fitting.length && fitting.length < np.warehouses.length
          ? "Показано відділення, що приймають матрац такого розміру."
          : "";
        const needle = q.toLowerCase();
        const items = pool.filter((w) => !needle || w.name.toLowerCase().includes(needle) || String(w.number) === needle);
        return { items: items.slice(0, 100), empty: "Відділення не знайдено" };
      },
      render: (w) => escapeHtml(w.name),
      onPick: (w) => { wh.value = w.name; np.warehouseRef = w.ref; clearError(wh); },
    });
    wh.addEventListener("input", () => { if (!np.failed) np.warehouseRef = ""; });
  }

  function resetNovaPoshta() {
    np.cityRef = "";
    np.warehouseRef = "";
    np.warehouses = [];
    if (!np.failed) {
      $("npWh").disabled = true;
      $("npWh").placeholder = "Спочатку оберіть місто";
      $("npWhNote").textContent = "";
    }
  }

  // ---------- Order modal ----------
  function bindModal() {
    const modal = $("orderModal");
    const form = $("orderForm");
    const success = $("orderSuccess");

    const close = () => modal.close();

    $("orderBtn").addEventListener("click", () => {
      const note = isCustom() ? "під замовлення, ціна за запитом" : $("price").textContent;
      $("modalOrder").textContent =
        `Матрац «${PRODUCT.name}», ${sizeLabel(currentSize())} см × ${state.qty} шт. — ${note}`;
      form.hidden = false;
      success.hidden = true;
      modal.showModal();
      track("begin_checkout", { currency: "UAH", value: isCustom() ? 0 : currentSize().price * state.qty });
    });
    $("modalClose").addEventListener("click", close);
    $("successClose").addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

    // Помилка зникає, щойно поле редагують (крім полів НП — там лише після вибору зі списку)
    form.addEventListener("input", (e) => {
      if (e.target.name === "name" || e.target.name === "phone") clearError(e.target);
    });

    const validators = {
      name: (v) => v.trim().length >= 2,
      phone: (v) => /^\+?3?8?0\d{9}$/.test(v.replace(/[\s()\-]/g, "")),
      city: (v) => (np.failed ? v.trim().length >= 2 : Boolean(np.cityRef)),
      warehouse: (v) => (np.failed ? v.trim().length >= 1 : Boolean(np.warehouseRef)),
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let ok = true;
      for (const [field, check] of Object.entries(validators)) {
        const input = form.elements[field];
        const valid = check(input.value);
        input.classList.toggle("is-invalid", !valid);
        form.querySelector(`.error[data-for="${field}"]`).classList.toggle("is-shown", !valid);
        if (!valid && ok) { input.focus(); ok = false; }
      }
      if (!ok) return;

      const { w, l, price } = currentSize();
      const order = {
        ...Object.fromEntries(new FormData(form)),
        product: PRODUCT.name,
        width: w,
        length: l,
        height: PRODUCT.height,
        customSize: isCustom(),
        qty: state.qty,
        price,
        total: $("price").textContent,
        cityRef: np.cityRef,
        warehouseRef: np.warehouseRef,
        source: SOURCE,
      };

      const submitBtn = form.querySelector('[type="submit"]');
      submitBtn.disabled = true;
      try {
        if (ORDER_ENDPOINT) {
          const res = await fetch(ORDER_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(order),
          });
          if (!res.ok) throw new Error(res.statusText);
        } else {
          console.info("Замовлення:", order);
        }
        const value = price ? price * state.qty : 0;
        const orderId = `${Date.now()}`;
        if (gtagReady) {
          const e164 = toE164(order.phone || "");
          if (e164) gtag("set", "user_data", { phone_number: e164 });
          track("generate_lead", { currency: "UAH", value });
          if (GOOGLE.adsId && GOOGLE.adsLeadLabel) {
            track("conversion", {
              send_to: `${GOOGLE.adsId}/${GOOGLE.adsLeadLabel}`,
              value,
              currency: "UAH",
              transaction_id: orderId,
            });
          }
        }
        form.reset();
        resetNovaPoshta();
        form.hidden = true;
        success.hidden = false;
      } catch (err) {
        alert("Не вдалося надіслати замовлення. Спробуйте ще раз або звʼяжіться з нами: +380 63 664 06 06, Telegram @neonix_u.");
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  function bindNav() {
    const burger = $("burger");
    const nav = $("nav");
    burger.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open);
    });
    nav.addEventListener("click", (e) => {
      if (e.target.tagName === "A") {
        nav.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      }
    });
  }

  renderSizes();
  renderTable();
  bindConfigurator();
  initAnalytics();
  bindModal();
  bindNovaPoshta();
  bindContactTracking();
  bindStickyCta();
  bindNav();
  update();
  $("year").textContent = new Date().getFullYear();
})();
