/* ==========================================================================
   Room Scent — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : โหลด products.json, กรองตาม mood, ปุ่มสั่งซื้อ
   - order.html   : เติม #items และ #total จาก URL, ส่งออเดอร์ไป Apps Script
   - admin.html   : อ่าน CSV จาก Google Sheets แสดงเป็นตาราง
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     Config
     ------------------------------------------------------------------------ */
  var PRODUCTS_URL = "products.json";

  var ORDER_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbxxDdh82e52106ucfQHqrbK-U9iZveTVRUuKjiwz2paiOOEdIsC5ksLCegI47wwcu9d/exec";

  var ORDERS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQpjD-6fOuf1s8PCz8aE3TBU4ZklKvAzv1tYACVi_qB3ARnS3lZVazBk7oTTQ8NBQHyFfDxAIiB25n9/pub?gid=0&single=true&output=csv";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "relax", label: "Relax" },
    { key: "focus", label: "Focus" },
    { key: "romance", label: "Romance" }
  ];

  var MOOD_LABELS = {
    fresh: "Fresh",
    relax: "Relax",
    focus: "Focus",
    romance: "Romance"
  };

  /* ------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------ */
  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatPrice(value) {
    var n = Number(value);
    if (isNaN(n)) return String(value);
    return n.toLocaleString("th-TH") + " บาท";
  }

  /* ========================================================================
     1) หน้า product.html
     ======================================================================== */
  function initProductPage() {
    var filterBar = $("#filter-bar");
    var listEl = $("#product-list");
    if (!filterBar || !listEl) return;

    var products = [];
    var currentMood = "all";

    // ชื่อสินค้าเต็ม (ชื่อ + ไซส์) ใช้ส่งไปหน้า order
    function fullName(p) {
      return p.size ? p.name + " " + p.size : p.name;
    }

    function orderUrl(p) {
      var params = new URLSearchParams();
      params.set("item", fullName(p));
      params.set("price", p.price);
      return "order.html?" + params.toString();
    }

    function buildCard(p) {
      var card = el("article", "product-card mood-" + p.mood);

      var media = el("div", "product-card__media");
      var img = el("img");
      img.src = p.image;
      img.alt = fullName(p);
      img.loading = "lazy";
      media.appendChild(img);

      var body = el("div", "product-card__body");

      var moodTag = el("span", "mood-tag product-card__mood");
      moodTag.appendChild(el("span", "mood-dot"));
      moodTag.appendChild(el("span", null, MOOD_LABELS[p.mood] || p.mood));

      var title = el("h3", "product-card__title", p.name);
      var meta = el("p", "product-card__meta", p.size ? p.size : "");
      if (!p.size) meta.hidden = true;

      var footer = el("div", "product-card__footer");
      footer.appendChild(el("span", "price", formatPrice(p.price)));

      var buy = el("a", "btn btn--gold", "สั่งซื้อ");
      buy.href = orderUrl(p);
      footer.appendChild(buy);

      body.appendChild(moodTag);
      body.appendChild(title);
      body.appendChild(meta);
      body.appendChild(footer);

      card.appendChild(media);
      card.appendChild(body);
      return card;
    }

    function render() {
      listEl.textContent = "";

      var visible = products.filter(function (p) {
        return currentMood === "all" || p.mood === currentMood;
      });

      if (!visible.length) {
        listEl.appendChild(el("p", "text-muted", "ยังไม่มีสินค้าในหมวดนี้"));
        return;
      }

      var frag = document.createDocumentFragment();
      visible.forEach(function (p) {
        frag.appendChild(buildCard(p));
      });
      listEl.appendChild(frag);
    }

    function updateButtons() {
      var buttons = filterBar.querySelectorAll(".filter-btn");
      Array.prototype.forEach.call(buttons, function (btn) {
        var active = btn.dataset.mood === currentMood;
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function setMood(mood) {
      currentMood = mood;
      updateButtons();
      render();

      // อัปเดต URL ให้แชร์ลิงก์ที่กรองไว้ได้ (ไม่รีโหลดหน้า)
      try {
        var url = new URL(window.location.href);
        if (mood === "all") url.searchParams.delete("mood");
        else url.searchParams.set("mood", mood);
        window.history.replaceState(null, "", url.toString());
      } catch (e) {
        /* ไม่เป็นไร ถ้า history ใช้ไม่ได้ (เช่น เปิดแบบ file://) */
      }
    }

    function buildFilterBar() {
      filterBar.textContent = "";
      MOODS.forEach(function (m) {
        var btn = el("button", "filter-btn mood-" + m.key);
        btn.type = "button";
        btn.dataset.mood = m.key;
        btn.setAttribute("aria-pressed", "false");
        if (m.key !== "all") btn.appendChild(el("span", "mood-dot"));
        btn.appendChild(el("span", null, m.label));
        btn.addEventListener("click", function () {
          setMood(m.key);
        });
        filterBar.appendChild(btn);
      });
    }

    buildFilterBar();

    // mood เริ่มต้นจาก ?mood=xxx (ถ้าค่าไม่ถูกต้องให้ใช้ "all")
    var requested = (
      new URLSearchParams(window.location.search).get("mood") || ""
    ).toLowerCase();
    var valid = MOODS.some(function (m) {
      return m.key === requested;
    });
    currentMood = valid ? requested : "all";
    updateButtons();

    listEl.appendChild(el("p", "text-muted", "กำลังโหลดสินค้า..."));

    fetch(PRODUCTS_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = Array.isArray(data) ? data : [];
        render();
      })
      .catch(function (error) {
        console.error(error);
        listEl.textContent = "";
        listEl.appendChild(
          el("p", "text-muted", "โหลดรายการสินค้าไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง")
        );
      });
  }

  /* ========================================================================
     2) หน้า order.html
     ======================================================================== */
  function initOrderPage() {
    var form = $("#orderForm");
    if (!form) return;

    var itemsInput = $("#items");
    var totalInput = $("#total");

    // เติมชื่อสินค้าและราคาจาก URL ทันทีที่โหลดหน้า
    var params = new URLSearchParams(window.location.search);
    var item = params.get("item");
    var price = params.get("price");

    if (itemsInput && item) itemsInput.value = item;
    if (totalInput && price) totalInput.value = price;

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      if (typeof form.reportValidity === "function" && !form.reportValidity()) {
        return;
      }

      function val(id) {
        var node = document.getElementById(id);
        return node ? node.value.trim() : "";
      }

      var payload = {
        customerName: val("customerName"),
        contact: val("contact"),
        items: val("items"),
        total: val("total"),
        note: val("note")
      };

      // กันกดซ้ำระหว่างรอส่ง
      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(ORDER_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload)
      })
        .then(() => {
          window.location.href = "thankyou.html";
        })
        .catch(error => {
          console.error(error);
          alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ========================================================================
     3) หน้า admin.html
     ======================================================================== */

  // Parser CSV (RFC 4180): รองรับเครื่องหมายคำพูด, "" ที่ escape, คอมมาและขึ้นบรรทัดใหม่ในช่อง
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var i = 0;

    // ตัด BOM ถ้ามี
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    while (i < text.length) {
      var ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        field += ch;
        i++;
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        row.push(field);
        field = "";
        i++;
      } else if (ch === "\r" || ch === "\n") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i++;
      } else {
        field += ch;
        i++;
      }
    }

    // แถวสุดท้ายที่ไม่มีการขึ้นบรรทัดใหม่ปิดท้าย
    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }

    // ตัดแถวว่างทิ้ง
    return rows.filter(function (r) {
      return r.some(function (c) {
        return c.trim() !== "";
      });
    });
  }

  function initAdminPage() {
    var tbody = $("#ordersTable tbody");
    if (!tbody) return;

    var COLS = 6; // วันเวลา, ชื่อ, ติดต่อ, รายการ, ยอดรวม, หมายเหตุ

    function showMessage(message) {
      tbody.textContent = "";
      var tr = el("tr");
      var td = el("td", null, message);
      td.colSpan = COLS;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    function renderRows(rows) {
      tbody.textContent = "";
      var frag = document.createDocumentFragment();

      rows.forEach(function (r) {
        var tr = el("tr");
        for (var c = 0; c < COLS; c++) {
          var value = (r[c] || "").trim();
          if (c === 4 && value !== "" && !isNaN(Number(value))) {
            value = formatPrice(value);
          }
          tr.appendChild(el("td", null, value));
        }
        frag.appendChild(tr);
      });

      tbody.appendChild(frag);
    }

    showMessage("กำลังโหลดข้อมูล...");

    fetch(ORDERS_CSV_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);

        // แถวแรกคือหัวตาราง
        var data = rows.slice(1);

        if (!data.length) {
          showMessage("ยังไม่มีรายการสั่งซื้อ");
          return;
        }

        // ชีตเพิ่มแถวใหม่ต่อท้ายเสมอ จึงกลับลำดับให้รายการล่าสุดขึ้นก่อน
        data.reverse();
        renderRows(data);
      })
      .catch(function (error) {
        console.error(error);
        showMessage("โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง");
      });
  }

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  function init() {
    initProductPage();
    initOrderPage();
    initAdminPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
