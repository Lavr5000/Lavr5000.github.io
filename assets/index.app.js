(function (window, document, React, ReactDOM) {
  "use strict";

  const DEFAULT_UPLOAD_LABEL = { ru: "Загрузить файл", en: "Upload file" };
  const LIVE_UPLOAD_LABEL = { ru: "Загрузить чертёж", en: "Upload drawings" };

  function ymGoal(name) {
    try {
      if (window.ym && window.YM_COUNTER_ID) window.ym(window.YM_COUNTER_ID, "reachGoal", name);
    } catch (e) {}
  }

  const text = {
    en: {
      "nav.catalog": "Catalog",
      "nav.about": "About",
      "nav.contacts": "Contacts",
      "nav.cta": "Upload PDF",
      "hero.title": "Project documentation PDF → verified Excel",
      "hero.sub": "Upload working drawings and get a quantity and materials schedule. Every row links back to the source sheet.",
      "hero.cta": LIVE_UPLOAD_LABEL.en,
      "hero.sample": "View sample Excel",
      "metrics.time": "per schedule",
      "metrics.source": "items with source",
      "metrics.price": "per document",
      "upload.title": "Drop PDF here",
      "upload.button": LIVE_UPLOAD_LABEL.en,
      "preview.title": "Static sample",
      "preview.badge": "sample",
      "preview.rd": "Sheet fragment: walls, screed, insulation",
      "table.name": "Works / materials description",
      "table.unit": "Unit",
      "table.qty": "Qty",
      "table.source": "Source",
      "table.status": "Status",
      "rows.0.name": "External brick wall masonry",
      "rows.1.name": "Cement floor screed",
      "rows.2.name": "Pipeline insulation",
      "status.ok": "Verified",
      "status.warn": "Needs review",
      "status.source": "Source found",
      "chips.statuses": "review statuses",
      "chips.noManual": "no manual markup",
      "how.title": "How it works",
      "how.0.t": "Upload PDF",
      "how.0.d": "Send working drawings through the service form: file, email and offer consent.",
      "how.1.t": "We extract quantities",
      "how.1.d": "The system reads sheets, builds rows and marks items where an engineer should review the input.",
      "how.2.t": "Receive Excel",
      "how.2.d": "The spreadsheet arrives by email with quantities, units and verification statuses.",
      "catalog.title": "Choose a system for your task",
      "catalog.hint": "Filter the catalog by role: estimators, designers, construction control, QS/PTO or procurement. Ready services are separated from the roadmap.",
      "source.title": "Verification matters more than a pretty table",
      "source.body": "The result is built as an engineering schedule: source document, Excel rows and confidence status stay separate. A doubtful item is never disguised as final.",
      "source.ok": "Read directly from the document.",
      "source.warn": "Assumption or indirect calculation.",
      "source.found": "The row is tied to the source fragment.",
      "strip.years": "in construction",
      "strip.gov": "contracts and acceptance",
      "strip.roles": "native result language",
      "strip.about": "About the author",
      "contacts.title": "Discuss documentation",
      "contacts.body": "Send the task, drawing section type and desired Excel format. For the live takeoff service, upload the PDF right away.",
      "contacts.upload": LIVE_UPLOAD_LABEL.en,
      "footer.offer": "Offer",
      "footer.privacy": "Privacy"
    }
  };

  const catalogText = {
    ru: {
      products: { kicker: "Каталог", title: "Системы", desc: "Выберите роль, чтобы увидеть рабочие сервисы и ближайший roadmap." },
      statuses: { available: "Доступен", soon: "Скоро", dev: "В разработке", planned: "В планах" },
      io: { in: "Вход:", out: "Выход:" },
      cardCta: "Открыть сервис",
      from: "от"
    },
    en: {
      products: { kicker: "Catalog", title: "Systems", desc: "Choose a role to see ready services and the nearest roadmap." },
      statuses: { available: "Available", soon: "Soon", dev: "In progress", planned: "Planned" },
      io: { in: "In:", out: "Out:" },
      cardCta: "Open service",
      from: "from"
    }
  };

  let lang = "ru";
  let root = null;

  function setPageLang(next) {
    lang = next === "en" ? "en" : "ru";
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-lang]").forEach(function (button) {
      const on = button.getAttribute("data-lang") === lang;
      button.classList.toggle("on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      const key = node.getAttribute("data-i18n");
      const value = lang === "en" ? text.en[key] : null;
      if (value) node.textContent = value;
      if (lang === "ru" && node.dataset.ru) node.textContent = node.dataset.ru;
    });
    renderCatalog();
  }

  function rememberRussianText() {
    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      if (!node.dataset.ru) node.dataset.ru = node.textContent;
    });
  }

  function renderCatalog() {
    const mount = document.getElementById("catalog-root");
    if (!mount || !window.AIVibesCatalog || !ReactDOM) return;
    if (!root) root = ReactDOM.createRoot(mount);
    root.render(window.AIVibesCatalog.renderCatalog({ t: catalogText[lang], lang: lang }));
  }

  function wireButtons() {
    document.querySelectorAll("[data-lang]").forEach(function (button) {
      button.addEventListener("click", function () {
        setPageLang(button.getAttribute("data-lang"));
      });
    });
    document.querySelectorAll("[data-upload-cta]").forEach(function (link) {
      link.addEventListener("click", function () {
        ymGoal("cta_" + link.getAttribute("data-upload-cta"));
      });
    });
    document.querySelectorAll(".dropzone").forEach(function (zone) {
      ["dragenter", "dragover"].forEach(function (eventName) {
        zone.addEventListener(eventName, function (event) {
          event.preventDefault();
          zone.classList.add("dragover");
        });
      });
      ["dragleave", "drop"].forEach(function (eventName) {
        zone.addEventListener(eventName, function (event) {
          event.preventDefault();
          zone.classList.remove("dragover");
          if (eventName === "drop") ymGoal("upload_dropzone");
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    rememberRussianText();
    wireButtons();
    setPageLang("ru");
    window.AIVibesUploadLabels = { default: DEFAULT_UPLOAD_LABEL, materialTakeoff: LIVE_UPLOAD_LABEL };
  });
})(window, document, React, ReactDOM);
