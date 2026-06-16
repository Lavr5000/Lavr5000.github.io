(function (window, React) {
  "use strict";

  const TG = "https://t.me/lavr5000";

  const ico = {
    spark: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "none"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z",
      stroke: "currentColor",
      strokeWidth: "1.6",
      strokeLinejoin: "round"
    })),
    list: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "none",
      strokeWidth: "1.6",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M8 6h11M8 12h11M8 18h11"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "4",
      cy: "6",
      r: "1"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "4",
      cy: "12",
      r: "1"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "4",
      cy: "18",
      r: "1"
    })),
    diff: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "none",
      strokeWidth: "1.6",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M4 6h7M4 18h7M16 3v18"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M14 8l2.5-2.5L19 8M19 16l-2.5 2.5L14 16"
    })),
    mail: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "none",
      strokeWidth: "1.6",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "5",
      width: "18",
      height: "14",
      rx: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M3.5 7l8.5 6 8.5-6"
    })),
    mic: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "none",
      strokeWidth: "1.6",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("rect", {
      x: "9",
      y: "3",
      width: "6",
      height: "11",
      rx: "3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M5 11a7 7 0 0014 0M12 18v3"
    })),
    arrowRight: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "none",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M5 12h14M13 6l6 6-6 6"
    })),
    arrowDown: /*#__PURE__*/React.createElement("svg", {
      viewBox: "0 0 24 24",
      fill: "none",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M12 5v14M6 13l6 6 6-6"
    }))
  };

  const STATUSES = ["available", "soon", "dev", "planned"];
  const ICON_KEYS = ["list", "diff", "mail", "mic", "spark"];
  const CATEGORIES = [
    { key: "estimators", ru: "Сметчики", en: "Estimators" },
    { key: "designers", ru: "Проектировщики", en: "Designers" },
    { key: "construction-control", ru: "Стройконтроль", en: "Construction control" },
    { key: "pto", ru: "ПТО", en: "QS / PTO" },
    { key: "procurement", ru: "Снабжение", en: "Procurement" }
  ];
  const CATALOG_STYLE = `
    .catalog-filter-wrap{display:grid;gap:10px;margin:-12px 0 22px}
    .category-filter{display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-height:42px;overflow-x:auto;padding:2px 0 4px;scrollbar-width:thin}
    .category-chip{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:8px 12px;border:1px solid var(--border-strong);border-radius:100px;background:var(--bg-card);color:var(--text-2);font:500 13px/1.15 var(--font-sans);white-space:nowrap;cursor:pointer;transition:color .2s var(--ease),background .2s var(--ease),border-color .2s var(--ease),box-shadow .2s var(--ease)}
    .category-chip:hover,.category-chip:focus-visible{color:var(--text);border-color:var(--accent);outline:none}
    .category-chip[aria-pressed="true"]{color:#0A0A0A;background:var(--accent);border-color:var(--accent);box-shadow:0 8px 20px -14px var(--accent-glow)}
    .category-chip[aria-disabled="true"]{color:var(--text-3);border-color:var(--border);background:rgba(107,107,117,.08);cursor:default}
    .category-chip[aria-disabled="true"]:focus-visible{border-color:var(--amber);box-shadow:0 0 0 2px rgba(245,185,79,.18)}
    .chip-count{font-family:var(--font-mono);font-variant-numeric:tabular-nums}
    .chip-roadmap{font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--amber)}
    .catalog-result-count{font-family:var(--font-mono);font-size:12px;color:var(--text-3);min-height:18px}
    .catalog-zones{display:grid;gap:26px}
    .catalog-zone{display:grid;gap:13px}
    .zone-head{display:flex;align-items:baseline;justify-content:space-between;gap:14px;border-top:1px solid var(--border);padding-top:18px}
    .zone-title{font-size:15px;font-weight:600;letter-spacing:-.01em;color:var(--text)}
    .zone-count{font-family:var(--font-mono);font-size:12px;color:var(--text-3)}
    .catalog-roadmap{opacity:.82}
    .roadmap-rail{display:flex;gap:14px;overflow-x:auto;padding:1px 0 8px;scrollbar-width:thin}
    .roadmap-rail .price-card{flex:0 0 min(330px,86vw);border-color:var(--border);background:rgba(16,16,21,.72)}
    .roadmap-rail .price-card:hover{transform:translateY(-2px);border-color:var(--border-strong);box-shadow:none}
    .card-badges{display:flex;flex-direction:column;align-items:flex-end;gap:7px}
    .ready-badge{font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.055em;text-transform:uppercase;color:#0A0A0A;background:var(--green);border:1px solid var(--green);border-radius:100px;padding:3px 8px;white-space:nowrap}
    .roadmap-empty,.available-empty{color:var(--text-3);font-size:14px;border:1px dashed var(--border-strong);border-radius:var(--radius);padding:14px 16px;background:rgba(16,16,21,.45)}
    @media (max-width:720px){.category-filter{flex-wrap:nowrap}.zone-head{align-items:flex-start;flex-direction:column;gap:4px}.card-badges{align-items:flex-start}.card-top{gap:12px}}
  `;

  function pick(o, lang) {
    return o && (o[lang] != null ? o[lang] : o.ru) || "";
  }

  function normalize(p, lang) {
    const tgText = p.cta && p.cta.tgText ? pick(p.cta.tgText, lang) : "";
    const ctaUrl = p.cta && typeof p.cta.url === "string" ? p.cta.url : "";
    return {
      key: p.id,
      icon: ICON_KEYS.includes(p.icon) ? p.icon : "list",
      status: STATUSES.includes(p.status) ? p.status : "planned",
      categories: Array.isArray(p.categories) ? p.categories : [],
      aud: pick(p.audience, lang),
      title: pick(p.title, lang),
      tag: pick(p.tagline, lang),
      in: pick(p.input, lang),
      out: pick(p.output, lang),
      price: pick(p.price, lang),
      href: ctaUrl || TG + (tgText ? "?text=" + encodeURIComponent(tgText) : ""),
      target: ctaUrl ? undefined : "_blank",
      rel: ctaUrl ? undefined : "noopener noreferrer"
    };
  }

  function getProducts(lang) {
    const raw = Array.isArray(window.AI_PRODUCTS) ? window.AI_PRODUCTS : [];
    return raw.filter(p => p && p.id && p.title && p.title.ru && p.price && p.price.ru && p.visible !== false).slice().sort((a, b) => (a.order != null ? a.order : 999) - (b.order != null ? b.order : 999)).map(p => normalize(p, lang));
  }

  function ymGoal(name) {
    try {
      if (window.ym && window.YM_COUNTER_ID) window.ym(window.YM_COUNTER_ID, "reachGoal", name);
    } catch (e) {}
  }

  function PriceCard({
    p,
    t,
    ctaLabel,
    readyBadge
  }) {
    return /*#__PURE__*/React.createElement("a", {
      className: "price-card",
      href: p.href,
      target: p.target,
      rel: p.rel,
      onClick: () => ymGoal("cta_" + p.key)
    }, /*#__PURE__*/React.createElement("div", {
      className: "card-top"
    }, /*#__PURE__*/React.createElement("span", {
      className: "card-icon"
    }, ico[p.icon]), /*#__PURE__*/React.createElement("span", {
      className: "card-badges"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pill " + p.status
    }, t.statuses[p.status]), readyBadge ? /*#__PURE__*/React.createElement("span", {
      className: "ready-badge"
    }, readyBadge) : null)), /*#__PURE__*/React.createElement("div", {
      className: "card-audience"
    }, p.aud), /*#__PURE__*/React.createElement("h3", {
      className: "card-title"
    }, p.title), /*#__PURE__*/React.createElement("p", {
      className: "card-tagline"
    }, p.tag), /*#__PURE__*/React.createElement("div", {
      className: "io"
    }, /*#__PURE__*/React.createElement("div", {
      className: "io-row"
    }, /*#__PURE__*/React.createElement("span", {
      className: "io-label"
    }, t.io.in), /*#__PURE__*/React.createElement("span", {
      className: "io-val"
    }, p.in)), /*#__PURE__*/React.createElement("div", {
      className: "io-arrow"
    }, /*#__PURE__*/React.createElement("span", {
      className: "line"
    }), ico.arrowDown, /*#__PURE__*/React.createElement("span", {
      className: "line"
    })), /*#__PURE__*/React.createElement("div", {
      className: "io-row"
    }, /*#__PURE__*/React.createElement("span", {
      className: "io-label"
    }, t.io.out), /*#__PURE__*/React.createElement("span", {
      className: "io-val"
    }, p.out))), /*#__PURE__*/React.createElement("div", {
      className: "card-foot"
    }, /*#__PURE__*/React.createElement("div", {
      className: "price"
    }, /*#__PURE__*/React.createElement("span", {
      className: "price-from mono"
    }, t.from), /*#__PURE__*/React.createElement("span", {
      className: "price-num"
    }, Number(p.price).toLocaleString("ru-RU")), /*#__PURE__*/React.createElement("span", {
      className: "price-cur"
    }, "\u20BD")), /*#__PURE__*/React.createElement("span", {
      className: "card-cta"
    }, ctaLabel || t.cardCta, ico.arrowRight)));
  }

  function catalogCopy(lang) {
    if (lang === "en") {
      return {
        all: "All",
        result: count => "Shown: " + count,
        available: "Available now",
        roadmap: "In development",
        readyBadge: "Ready service",
        notify: "Notify me",
        availableEmpty: "No ready services in this category yet.",
        roadmapEmpty: "No roadmap services in this category yet.",
        count: count => count + " items",
        roadmapState: "in development",
        disabledLabel: label => label + ": in development",
        notifyText: title => "Hi! Please notify me when “" + title + "” is available. I have read the offer terms: https://ai-vibes.ru/oferta.html"
      };
    }
    return {
      all: "Все",
      result: count => "Показано: " + count,
      available: "Доступно сейчас",
      roadmap: "В разработке",
      readyBadge: "Рабочий сервис",
      notify: "Уведомить",
      availableEmpty: "В выбранной категории пока нет доступных сервисов.",
      roadmapEmpty: "В выбранной категории пока нет сервисов в разработке.",
      count: count => count + " шт.",
      roadmapState: "в разработке",
      disabledLabel: label => label + ": в разработке",
      notifyText: title => "Здравствуйте! Уведомите меня, когда сервис «" + title + "» будет доступен. С офертой ознакомлен(а): https://ai-vibes.ru/oferta.html"
    };
  }

  function countByCategory(list) {
    return CATEGORIES.reduce((acc, c) => {
      acc[c.key] = list.filter(p => p.categories.includes(c.key)).length;
      return acc;
    }, {});
  }

  function CategoryFilter({
    active,
    onSelect,
    counts,
    total,
    visibleCount,
    lang
  }) {
    const copy = catalogCopy(lang);
    const chips = [{
      key: "all",
      label: copy.all,
      count: total
    }].concat(CATEGORIES.map(c => ({
      key: c.key,
      label: c[lang] || c.ru,
      count: counts[c.key] || 0
    })));
    return /*#__PURE__*/React.createElement("div", {
      className: "catalog-filter-wrap"
    }, /*#__PURE__*/React.createElement("div", {
      className: "category-filter",
      role: "toolbar",
      "aria-label": lang === "en" ? "Audience categories" : "Категории аудитории"
    }, chips.map(chip => {
      const disabled = chip.key !== "all" && chip.count === 0;
      const pressed = active === chip.key;
      return /*#__PURE__*/React.createElement("button", {
        key: chip.key,
        type: "button",
        className: "category-chip",
        "aria-pressed": pressed,
        "aria-disabled": disabled ? "true" : undefined,
        "aria-label": disabled ? copy.disabledLabel(chip.label) : undefined,
        title: disabled ? copy.roadmapState : undefined,
        onClick: disabled ? undefined : () => onSelect(chip.key)
      }, /*#__PURE__*/React.createElement("span", null, chip.label), /*#__PURE__*/React.createElement("span", {
        className: "chip-count"
      }, "(", chip.count, ")"), disabled ? /*#__PURE__*/React.createElement("span", {
        className: "chip-roadmap"
      }, copy.roadmapState) : null);
    })), /*#__PURE__*/React.createElement("p", {
      className: "catalog-result-count",
      "aria-live": "polite"
    }, copy.result(visibleCount)));
  }

  function notificationProduct(p, lang) {
    const copy = catalogCopy(lang);
    return Object.assign({}, p, {
      href: TG + "?text=" + encodeURIComponent(copy.notifyText(p.title)),
      target: "_blank",
      rel: "noopener noreferrer"
    });
  }

  function Catalog({
    t,
    lang
  }) {
    const [active, setActive] = React.useState("all");
    const list = getProducts(lang);
    const counts = countByCategory(list);
    const filtered = list.filter(p => active === "all" || p.categories.includes(active));
    const available = filtered.filter(p => p.status === "available");
    const roadmap = filtered.filter(p => p.status !== "available");
    const copy = catalogCopy(lang);
    return /*#__PURE__*/React.createElement("section", {
      className: "products",
      id: "products"
    }, /*#__PURE__*/React.createElement("style", null, CATALOG_STYLE), /*#__PURE__*/React.createElement("div", {
      className: "container"
    }, /*#__PURE__*/React.createElement("div", {
      className: "sec-head"
    }, /*#__PURE__*/React.createElement("div", {
      className: "sec-kicker"
    }, t.products.kicker), /*#__PURE__*/React.createElement("h2", {
      className: "sec-title"
    }, t.products.title), /*#__PURE__*/React.createElement("p", {
      className: "sec-desc"
    }, t.products.desc)), /*#__PURE__*/React.createElement(CategoryFilter, {
      active: active,
      onSelect: setActive,
      counts: counts,
      total: list.length,
      visibleCount: filtered.length,
      lang: lang
    }), /*#__PURE__*/React.createElement("div", {
      className: "catalog-zones"
    }, /*#__PURE__*/React.createElement("section", {
      className: "catalog-zone catalog-available",
      "aria-labelledby": "catalog-available-title"
    }, /*#__PURE__*/React.createElement("div", {
      className: "zone-head"
    }, /*#__PURE__*/React.createElement("h3", {
      className: "zone-title",
      id: "catalog-available-title"
    }, copy.available), /*#__PURE__*/React.createElement("span", {
      className: "zone-count"
    }, copy.count(available.length))), available.length ? /*#__PURE__*/React.createElement("div", {
      className: "grid"
    }, available.map(p => /*#__PURE__*/React.createElement(PriceCard, {
      key: p.key,
      p: p,
      t: t,
      readyBadge: copy.readyBadge
    }))) : /*#__PURE__*/React.createElement("p", {
      className: "available-empty"
    }, copy.availableEmpty)), /*#__PURE__*/React.createElement("section", {
      className: "catalog-zone catalog-roadmap",
      "aria-labelledby": "catalog-roadmap-title"
    }, /*#__PURE__*/React.createElement("div", {
      className: "zone-head"
    }, /*#__PURE__*/React.createElement("h3", {
      className: "zone-title",
      id: "catalog-roadmap-title"
    }, copy.roadmap), /*#__PURE__*/React.createElement("span", {
      className: "zone-count"
    }, copy.count(roadmap.length))), roadmap.length ? /*#__PURE__*/React.createElement("div", {
      className: "roadmap-rail"
    }, roadmap.map(p => /*#__PURE__*/React.createElement(PriceCard, {
      key: p.key,
      p: notificationProduct(p, lang),
      t: t,
      ctaLabel: copy.notify
    }))) : /*#__PURE__*/React.createElement("p", {
      className: "roadmap-empty"
    }, copy.roadmapEmpty)))));
  }

  function renderCatalog({
    t,
    lang
  }) {
    return /*#__PURE__*/React.createElement(Catalog, {
      t: t,
      lang: lang
    });
  }

  window.AIVibesCatalog = {
    getProducts: getProducts,
    normalize: normalize,
    PriceCard: PriceCard,
    CategoryFilter: CategoryFilter,
    renderCatalog: renderCatalog
  };
})(window, React);
