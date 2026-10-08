(() => {
  // Куди надсилати замовлення (POST JSON). Порожньо — лише показуємо підтвердження.
  const ORDER_ENDPOINT = "";

  const DISCOUNT = 0.15;
  const CUSTOM_MARKUP = 0.2;

  const MODELS = [
    { id: "comfort", name: "Comfort", height: 18, firmness: "Середньо-жорсткий", perM2: 3200 },
    { id: "ortho", name: "Ortho Pro", height: 22, firmness: "Середній, 7 зон", perM2: 4600, tag: "Хіт" },
    { id: "premium", name: "Premium Memory", height: 26, firmness: "М'який верх / жорстка база", perM2: 6200 },
  ];

  // Стандартні розміри «ширина × довжина»
  const SIZES = [
    [70, 190], [80, 190], [80, 200], [90, 190], [90, 200],
    [120, 190], [120, 200], [140, 190], [140, 200],
    [160, 190], [160, 200], [180, 190], [180, 200], [200, 200],
  ];
  const WIDTHS = [...new Set(SIZES.map(([w]) => w))];
  const LENGTHS = [...new Set(SIZES.map(([, l]) => l))];
  const hasSize = (w, l) => SIZES.some(([sw, sl]) => sw === w && sl === l);

  const state = { model: "ortho", width: 160, length: 200, custom: false, cw: 150, cl: 195, qty: 1 };

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString("uk-UA").replace(/,/g, " ") + " ₴";
  const roundTo = (n, step) => Math.round(n / step) * step;

  function fullPrice(model, w, l, custom) {
    let p = model.perM2 * (w / 100) * (l / 100);
    if (custom) p *= 1 + CUSTOM_MARKUP;
    return roundTo(p, 10);
  }
  const salePrice = (full) => roundTo(full * (1 - DISCOUNT), 10) - 1;

  function sizeCategory(w) {
    if (w <= 90) return "Односпальний";
    if (w <= 140) return "Півтораспальний";
    return "Двоспальний";
  }

  const currentModel = () => MODELS.find((m) => m.id === state.model);
  const currentSize = () => (state.custom ? [state.cw, state.cl] : [state.width, state.length]);

  // ---------- Render controls ----------
  function renderModels() {
    $("models").innerHTML = MODELS.map((m) => `
      <label class="model">
        <input type="radio" name="model" value="${m.id}" ${m.id === state.model ? "checked" : ""}>
        ${m.tag ? `<span class="model__tag">${m.tag}</span>` : ""}
        <span class="model__name">${m.name}</span>
        <span class="model__meta">${m.height} см · ${m.firmness}</span>
        <span class="model__from">від ${fmt(salePrice(fullPrice(m, 70, 190, false)))}</span>
      </label>`).join("");
  }

  function renderChips(el, name, values, selected) {
    el.innerHTML = values.map((v) => `
      <label class="chip">
        <input type="radio" name="${name}" value="${v}" ${v === selected ? "checked" : ""}>
        <span>${v}</span>
      </label>`).join("");
  }

  function syncLengthAvailability() {
    document.querySelectorAll('input[name="length"]').forEach((inp) => {
      const l = Number(inp.value);
      inp.disabled = !hasSize(state.width, l);
      inp.checked = l === state.length;
    });
  }

  function renderTable() {
    const head = `<thead><tr><th>Розмір, см</th>${MODELS.map((m) => `<th>${m.name}</th>`).join("")}</tr></thead>`;
    const body = SIZES.map(([w, l]) => `
      <tr data-w="${w}" data-l="${l}">
        <td>${w} × ${l}</td>
        ${MODELS.map((m) => `<td>${fmt(salePrice(fullPrice(m, w, l, false)))}</td>`).join("")}
      </tr>`).join("");
    $("priceTable").innerHTML = head + `<tbody>${body}</tbody>`;
  }

  // ---------- Summary ----------
  function update() {
    const model = currentModel();
    const [w, l] = currentSize();
    const full = fullPrice(model, w, l, state.custom) * state.qty;
    const sale = salePrice(fullPrice(model, w, l, state.custom)) * state.qty;

    $("sumModel").textContent = model.name;
    $("sumSize").textContent = `${w} × ${l} см${state.custom ? " (нестанд.)" : ""}`;
    $("sumHeight").textContent = `${model.height} см`;
    $("sumFirm").textContent = model.firmness;
    $("sumQty").textContent = state.qty;
    $("qty").textContent = state.qty;
    $("priceOld").textContent = fmt(full);
    $("price").textContent = fmt(sale);

    // Превʼю: масштаб 200 см = 150 px по довжині
    const scale = 150 / 220;
    const bed = $("bedPreview");
    bed.style.width = `${Math.round(w * scale)}px`;
    bed.style.height = `${Math.round(l * scale * 0.85)}px`;
    $("bedLabel").textContent = `${w} × ${l}`;
    $("bedCaption").textContent = sizeCategory(w);

    $("widths").classList.toggle("is-off", state.custom);
    $("lengths").classList.toggle("is-off", state.custom);
  }

  // ---------- Events ----------
  function bindConfigurator() {
    $("models").addEventListener("change", (e) => {
      state.model = e.target.value;
      update();
    });

    $("widths").addEventListener("change", (e) => {
      state.width = Number(e.target.value);
      if (!hasSize(state.width, state.length)) {
        state.length = LENGTHS.find((l) => hasSize(state.width, l));
      }
      syncLengthAvailability();
      update();
    });

    $("lengths").addEventListener("change", (e) => {
      state.length = Number(e.target.value);
      update();
    });

    $("customToggle").addEventListener("change", (e) => {
      state.custom = e.target.checked;
      $("customSize").hidden = !state.custom;
      update();
    });

    const clampInput = (inp, key) => {
      const min = Number(inp.min), max = Number(inp.max);
      const handler = (commit) => {
        let v = Math.round(Number(inp.value));
        if (!Number.isFinite(v)) return;
        if (commit) {
          v = Math.min(max, Math.max(min, v));
          inp.value = v;
        }
        if (v >= min && v <= max) {
          state[key] = v;
          update();
        }
      };
      inp.addEventListener("input", () => handler(false));
      inp.addEventListener("change", () => handler(true));
    };
    clampInput($("customW"), "cw");
    clampInput($("customL"), "cl");

    $("qtyMinus").addEventListener("click", () => { state.qty = Math.max(1, state.qty - 1); update(); });
    $("qtyPlus").addEventListener("click", () => { state.qty = Math.min(10, state.qty + 1); update(); });

    $("priceTable").addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-w]");
      if (!row) return;
      state.width = Number(row.dataset.w);
      state.length = Number(row.dataset.l);
      state.custom = false;
      $("customToggle").checked = false;
      $("customSize").hidden = true;
      document.querySelectorAll('input[name="width"]').forEach((i) => { i.checked = Number(i.value) === state.width; });
      syncLengthAvailability();
      update();
      $("configurator").scrollIntoView({ behavior: "smooth" });
    });
  }

  // ---------- Order modal ----------
  function bindModal() {
    const modal = $("orderModal");
    const form = $("orderForm");
    const success = $("orderSuccess");

    const close = () => modal.close();

    $("orderBtn").addEventListener("click", () => {
      const [w, l] = currentSize();
      $("modalOrder").textContent =
        `${currentModel().name}, ${w}×${l} см × ${state.qty} шт. — ${$("price").textContent}`;
      form.hidden = false;
      success.hidden = true;
      modal.showModal();
    });
    $("modalClose").addEventListener("click", close);
    $("successClose").addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

    const validators = {
      name: (v) => v.trim().length >= 2,
      phone: (v) => /^\+?3?8?0\d{9}$/.test(v.replace(/[\s()\-]/g, "")),
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

      const [w, l] = currentSize();
      const order = {
        ...Object.fromEntries(new FormData(form)),
        model: currentModel().name,
        width: w,
        length: l,
        custom: state.custom,
        qty: state.qty,
        total: $("price").textContent,
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
        form.reset();
        form.hidden = true;
        success.hidden = false;
      } catch (err) {
        alert("Не вдалося надіслати замовлення. Спробуйте ще раз або зателефонуйте нам.");
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

  renderModels();
  renderChips($("widths"), "width", WIDTHS, state.width);
  renderChips($("lengths"), "length", LENGTHS, state.length);
  syncLengthAvailability();
  renderTable();
  bindConfigurator();
  bindModal();
  bindNav();
  update();
  $("year").textContent = new Date().getFullYear();
})();
