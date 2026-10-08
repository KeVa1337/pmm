(() => {
  // Куди надсилати замовлення (POST JSON). Порожньо — лише показуємо підтвердження.
  const ORDER_ENDPOINT = "";

  const PRODUCT = { name: "Азалія", height: 22 };

  // Розміри та ціни (грн)
  const SIZES = [
    { w: 140, l: 200, price: 7900 },
    { w: 160, l: 200, price: 8865 },
    { w: 180, l: 200, price: 10017 },
  ];

  const state = { size: 1, qty: 1 };

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString("uk-UA").replace(/,/g, " ") + " ₴";
  const sizeLabel = ({ w, l }) => `${w} × ${l}`;
  const sizeCategory = (w) => (w <= 90 ? "Односпальний" : w <= 140 ? "Півтораспальний" : "Двоспальний");
  const currentSize = () => SIZES[state.size];

  // ---------- Render ----------
  function renderSizes() {
    $("sizes").innerHTML = SIZES.map((s, i) => `
      <label class="model">
        <input type="radio" name="size" value="${i}" ${i === state.size ? "checked" : ""}>
        ${s.tag ? `<span class="model__tag">${s.tag}</span>` : ""}
        <span class="model__name">${sizeLabel(s)} см</span>
        <span class="model__meta">${sizeCategory(s.w)}</span>
        <span class="model__from">${fmt(s.price)}</span>
      </label>`).join("");
  }

  function renderTable() {
    $("priceTable").innerHTML = `
      <thead><tr><th>Розмір, см</th><th>Висота</th><th>Ціна</th></tr></thead>
      <tbody>${SIZES.map((s, i) => `
        <tr data-i="${i}"><td>${sizeLabel(s)}</td><td>${PRODUCT.height} см</td><td>${fmt(s.price)}</td></tr>`).join("")}
      </tbody>`;
  }

  // ---------- Summary ----------
  function update() {
    const s = currentSize();
    $("sumModel").textContent = PRODUCT.name;
    $("sumSize").textContent = `${sizeLabel(s)} см`;
    $("sumHeight").textContent = `${PRODUCT.height} см`;
    $("sumStock").textContent = "В наявності";
    $("sumQty").textContent = state.qty;
    $("qty").textContent = state.qty;
    $("price").textContent = fmt(s.price * state.qty);

    // Превʼю: пропорційний прямокутник
    const scale = 150 / 220;
    const bed = $("bedPreview");
    bed.style.width = `${Math.round(s.w * scale)}px`;
    bed.style.height = `${Math.round(s.l * scale * 0.85)}px`;
    $("bedLabel").textContent = sizeLabel(s);
    $("bedCaption").textContent = sizeCategory(s.w);
  }

  function selectSize(i) {
    state.size = i;
    document.querySelectorAll('input[name="size"]').forEach((inp) => { inp.checked = Number(inp.value) === i; });
    update();
  }

  // ---------- Events ----------
  function bindConfigurator() {
    $("sizes").addEventListener("change", (e) => selectSize(Number(e.target.value)));
    $("qtyMinus").addEventListener("click", () => { state.qty = Math.max(1, state.qty - 1); update(); });
    $("qtyPlus").addEventListener("click", () => { state.qty = Math.min(10, state.qty + 1); update(); });
    $("priceTable").addEventListener("click", (e) => {
      const row = e.target.closest("tr[data-i]");
      if (!row) return;
      selectSize(Number(row.dataset.i));
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
      $("modalOrder").textContent =
        `Матрац «${PRODUCT.name}», ${sizeLabel(currentSize())} см × ${state.qty} шт. — ${$("price").textContent}`;
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

      const { w, l, price } = currentSize();
      const order = {
        ...Object.fromEntries(new FormData(form)),
        product: PRODUCT.name,
        width: w,
        length: l,
        height: PRODUCT.height,
        qty: state.qty,
        price,
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

  renderSizes();
  renderTable();
  bindConfigurator();
  bindModal();
  bindNav();
  update();
  $("year").textContent = new Date().getFullYear();
})();
