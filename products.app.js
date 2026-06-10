const {
  useState
} = React;
const TG = "https://t.me/lavr5000";
const PORTFOLIO = "https://lavr5000.github.io/";
const EMAIL = "lavr5000xxx@gmail.com";

/* ---------- Icons (line-style, currentColor stroke) ---------- */
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
  })),
  tg: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21.8 4.3l-3 14.2c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.5-.9.5l.3-4.6 8.4-7.6c.4-.3-.1-.5-.6-.2L7.4 12.4l-4.5-1.4c-1-.3-1-1 .2-1.5L20.5 2.9c.8-.3 1.5.2 1.3 1.4z"
  })),
  back: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M19 12H5M11 6l-6 6 6 6"
  }))
};

/* ---------- Page chrome i18n (product data lives in products.js) ---------- */
const i18n = {
  ru: {
    nav: {
      portfolio: "Портфолио",
      products: "Продукты",
      contacts: "Контакты"
    },
    hero: {
      eyebrow: "AI-инструменты для стройки",
      title: ["AI-продукты для ", "ПТО, сметчиков", " и снабжения"],
      sub: "Превращаю рабочую документацию и рутину стройки в готовые Excel-файлы, списки и письма. Загрузил — получил результат.",
      cta: "Смотреть продукты"
    },
    products: {
      kicker: "Каталог",
      title: "Продукты",
      desc: "Готовые AI-сервисы для конкретных задач. Цены ориентировочные — финальная зависит от объёма.",
      empty: "Скоро здесь появятся продукты."
    },
    statuses: {
      available: "Доступен",
      soon: "Скоро",
      dev: "В разработке",
      planned: "В планах"
    },
    demo: {
      kicker: "Демо",
      title: "Пример выдачи",
      desc: "Фрагмент реальной ведомости: открытая РД с госзакупок (раздел КЖ, подземная автостоянка), 23 листа → 110 позиций. Данные обезличены.",
      cols: {
        pos: "Поз.",
        name: "Наименование",
        unit: "Ед.",
        qty: "Кол-во",
        sheet: "Лист",
        status: "Статус"
      },
      note: "Статусы уверенности: OK — считано из векторного слоя PDF; PIVOT — выведено косвенно, требует сверки инженером. Полная легенда статусов прилагается к каждой выдаче."
    },
    io: {
      in: "Вход:",
      out: "Выход:"
    },
    cardCta: "Заказать в Telegram",
    from: "от",
    how: {
      kicker: "Процесс",
      title: "Как заказать",
      steps: [{
        t: "Напишите в Telegram",
        d: "Опишите задачу и пришлите файл — PDF, Excel, фото или аудио с объекта."
      }, {
        t: "Я обрабатываю",
        d: "Прогоняю через AI-пайплайн и проверяю результат. Обычно 1 рабочий день."
      }, {
        t: "Получаете Excel",
        d: "Готовый файл с данными, ссылками на источник и пометками о проверке."
      }],
      note: "Source refs на каждый лист. Честные статусы проверки. Не финальная смета — подготовка данных."
    },
    footer: {
      tag: "Практические AI-интеграции для строительных процессов.",
      contacts: "Контакты",
      nav: "Навигация",
      portfolio: "Портфолио",
      products: "Продукты",
      legal: "Документы",
      oferta: "Публичная оферта",
      privacy: "Политика обработки ПДн",
      back: "Вернуться в портфолио",
      rights: "Все права защищены."
    }
  },
  en: {
    nav: {
      portfolio: "Portfolio",
      products: "Products",
      contacts: "Contacts"
    },
    hero: {
      eyebrow: "AI tools for construction",
      title: ["AI products for ", "QS, estimators", " & procurement"],
      sub: "I turn construction paperwork and routine into ready-made Excel files, lists and letters. Upload a file — get the result.",
      cta: "View products"
    },
    products: {
      kicker: "Catalog",
      title: "Products",
      desc: "Ready-made AI services for specific tasks. Prices are indicative — the final one depends on scope.",
      empty: "Products coming soon."
    },
    statuses: {
      available: "Available",
      soon: "Soon",
      dev: "In progress",
      planned: "Planned"
    },
    demo: {
      kicker: "Demo",
      title: "Sample output",
      desc: "A fragment of a real takeoff: open tender drawings (KZh section, underground parking), 23 sheets → 110 items. Data anonymized.",
      cols: {
        pos: "Item",
        name: "Description",
        unit: "Unit",
        qty: "Qty",
        sheet: "Sheet",
        status: "Status"
      },
      note: "Confidence statuses: OK — read from the PDF vector layer; PIVOT — derived indirectly, needs engineer review. A full status legend ships with every delivery."
    },
    io: {
      in: "In:",
      out: "Out:"
    },
    cardCta: "Order on Telegram",
    from: "from",
    how: {
      kicker: "Process",
      title: "How to order",
      steps: [{
        t: "Message on Telegram",
        d: "Describe the task and send a file — PDF, Excel, a photo or audio from site."
      }, {
        t: "I process it",
        d: "Run it through the AI pipeline and verify the output. Usually one business day."
      }, {
        t: "You get Excel",
        d: "A ready file with data, source references and verification notes."
      }],
      note: "Source refs on every sheet. Honest verification statuses. Not a final estimate — data preparation."
    },
    footer: {
      tag: "Practical AI integrations for construction workflows.",
      contacts: "Contacts",
      nav: "Navigation",
      portfolio: "Portfolio",
      products: "Products",
      legal: "Legal",
      oferta: "Public offer",
      privacy: "Privacy policy",
      back: "Back to portfolio",
      rights: "All rights reserved."
    }
  }
};

/* ---------- Registry normalize: a broken record is skipped, never crashes the grid ---------- */
const STATUSES = ["available", "soon", "dev", "planned"];
const ICON_KEYS = ["list", "diff", "mail", "mic", "spark"];
function pick(o, lang) {
  return o && (o[lang] != null ? o[lang] : o.ru) || "";
}
function getProducts(lang) {
  const raw = Array.isArray(window.AI_PRODUCTS) ? window.AI_PRODUCTS : [];
  return raw.filter(p => p && p.id && p.title && p.title.ru && p.price && p.price.ru && p.visible !== false).slice().sort((a, b) => (a.order != null ? a.order : 999) - (b.order != null ? b.order : 999)).map(p => {
    const tgText = p.cta && p.cta.tgText ? pick(p.cta.tgText, lang) : "";
    return {
      key: p.id,
      icon: ICON_KEYS.includes(p.icon) ? p.icon : "list",
      status: STATUSES.includes(p.status) ? p.status : "planned",
      aud: pick(p.audience, lang),
      title: pick(p.title, lang),
      tag: pick(p.tagline, lang),
      in: pick(p.input, lang),
      out: pick(p.output, lang),
      price: pick(p.price, lang),
      href: TG + (tgText ? "?text=" + encodeURIComponent(tgText) : "")
    };
  });
}

/* ---------- Yandex.Metrika goal helper (no-op until counter is installed) ---------- */
function ymGoal(name) {
  try {
    if (window.ym && window.YM_COUNTER_ID) window.ym(window.YM_COUNTER_ID, "reachGoal", name);
  } catch (e) {}
}

/* ---------- Demo rows: redacted fragment of a real takeoff (open tender drawings) ---------- */
const DEMO_ROWS = [{
  pos: "1",
  name: {
    ru: "Арматура Ø10 А500, ГОСТ 34028-2016 (Lобщ)",
    en: "Rebar Ø10 A500, GOST 34028-2016 (total len.)"
  },
  unit: {
    ru: "м.п.",
    en: "lm"
  },
  qty: "5 770,4",
  sheet: "7",
  st: "OK"
}, {
  pos: "2",
  name: {
    ru: "Арматура Ø20 А500, ГОСТ 34028-2016 (Lобщ)",
    en: "Rebar Ø20 A500, GOST 34028-2016 (total len.)"
  },
  unit: {
    ru: "м.п.",
    en: "lm"
  },
  qty: "1 001,58",
  sheet: "7",
  st: "OK"
}, {
  pos: "3",
  name: {
    ru: "Арматура Ø12 А500, ГОСТ 34028-2016 (Lобщ)",
    en: "Rebar Ø12 A500, GOST 34028-2016 (total len.)"
  },
  unit: {
    ru: "м.п.",
    en: "lm"
  },
  qty: "97,52",
  sheet: "7",
  st: "OK"
}, {
  pos: "Г1",
  name: {
    ru: "Стержень Ø16 А500С, L=1865",
    en: "Bar Ø16 A500C, L=1865"
  },
  unit: {
    ru: "шт.",
    en: "pcs"
  },
  qty: "110",
  sheet: "7",
  st: "OK"
}, {
  pos: "Г2",
  name: {
    ru: "Стержень Ø12 А500С, L=1645",
    en: "Bar Ø12 A500C, L=1645"
  },
  unit: {
    ru: "шт.",
    en: "pcs"
  },
  qty: "92",
  sheet: "7",
  st: "OK"
}, {
  pos: "—",
  name: {
    ru: "Бетон В30 F100 W4 (пилоны)",
    en: "Concrete B30 F100 W4 (pylons)"
  },
  unit: {
    ru: "м³",
    en: "m³"
  },
  qty: "—",
  sheet: "4",
  st: "PIVOT"
}];

/* ---------- Components ---------- */
function Nav({
  lang,
  setLang,
  t
}) {
  return /*#__PURE__*/React.createElement("nav", {
    className: "nav"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container nav-inner"
  }, /*#__PURE__*/React.createElement("a", {
    className: "logo",
    href: PORTFOLIO
  }, /*#__PURE__*/React.createElement("span", {
    className: "logo-mark"
  }, ico.spark), /*#__PURE__*/React.createElement("span", null, "AI\xA0Vibes")), /*#__PURE__*/React.createElement("div", {
    className: "nav-right"
  }, /*#__PURE__*/React.createElement("a", {
    className: "nav-link",
    href: PORTFOLIO
  }, t.nav.portfolio), /*#__PURE__*/React.createElement("a", {
    className: "nav-link active",
    href: "#products"
  }, t.nav.products), /*#__PURE__*/React.createElement("a", {
    className: "nav-link contacts",
    href: "#footer"
  }, t.nav.contacts), /*#__PURE__*/React.createElement("div", {
    className: "lang-toggle",
    role: "group",
    "aria-label": "Language"
  }, /*#__PURE__*/React.createElement("button", {
    className: lang === "ru" ? "on" : "",
    onClick: () => setLang("ru")
  }, "RU"), /*#__PURE__*/React.createElement("button", {
    className: lang === "en" ? "on" : "",
    onClick: () => setLang("en")
  }, "EN")))));
}
function Hero({
  t
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container hero-inner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "eyebrow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), t.hero.eyebrow), /*#__PURE__*/React.createElement("h1", {
    className: "hero-title"
  }, t.hero.title[0], /*#__PURE__*/React.createElement("span", {
    className: "hl"
  }, t.hero.title[1]), t.hero.title[2]), /*#__PURE__*/React.createElement("p", {
    className: "hero-sub"
  }, t.hero.sub), /*#__PURE__*/React.createElement("a", {
    className: "btn btn-primary",
    href: "#products"
  }, t.hero.cta, ico.arrowDown)));
}
function PriceCard({
  p,
  t
}) {
  return /*#__PURE__*/React.createElement("a", {
    className: "price-card",
    href: p.href,
    target: "_blank",
    rel: "noopener noreferrer",
    onClick: () => ymGoal("cta_" + p.key)
  }, /*#__PURE__*/React.createElement("div", {
    className: "card-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "card-icon"
  }, ico[p.icon]), /*#__PURE__*/React.createElement("span", {
    className: "pill " + p.status
  }, t.statuses[p.status])), /*#__PURE__*/React.createElement("div", {
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
  }, t.cardCta, ico.arrowRight)));
}
function Products({
  t,
  lang
}) {
  const list = getProducts(lang);
  return /*#__PURE__*/React.createElement("section", {
    className: "products",
    id: "products"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-kicker"
  }, t.products.kicker), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t.products.title), /*#__PURE__*/React.createElement("p", {
    className: "sec-desc"
  }, t.products.desc)), /*#__PURE__*/React.createElement("div", {
    className: "grid"
  }, list.length ? list.map(p => /*#__PURE__*/React.createElement(PriceCard, {
    key: p.key,
    p: p,
    t: t
  })) : /*#__PURE__*/React.createElement("p", {
    className: "sec-desc"
  }, t.products.empty))));
}
function Demo({
  t,
  lang
}) {
  const L = o => o && (o[lang] != null ? o[lang] : o.ru) || "";
  const d = t.demo;
  return /*#__PURE__*/React.createElement("section", {
    className: "demo",
    id: "demo"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-kicker"
  }, d.kicker), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, d.title), /*#__PURE__*/React.createElement("p", {
    className: "sec-desc"
  }, d.desc)), /*#__PURE__*/React.createElement("div", {
    className: "demo-table-wrap"
  }, /*#__PURE__*/React.createElement("table", {
    className: "demo-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, d.cols.pos), /*#__PURE__*/React.createElement("th", null, d.cols.name), /*#__PURE__*/React.createElement("th", null, d.cols.unit), /*#__PURE__*/React.createElement("th", null, d.cols.qty), /*#__PURE__*/React.createElement("th", null, d.cols.sheet), /*#__PURE__*/React.createElement("th", null, d.cols.status))), /*#__PURE__*/React.createElement("tbody", null, DEMO_ROWS.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: i
  }, /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, r.pos), /*#__PURE__*/React.createElement("td", null, L(r.name)), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, L(r.unit)), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, r.qty), /*#__PURE__*/React.createElement("td", {
    className: "num"
  }, r.sheet), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
    className: "st " + (r.st === "OK" ? "ok" : "pivot")
  }, r.st))))))), /*#__PURE__*/React.createElement("p", {
    className: "demo-note"
  }, d.note)));
}
function How({
  t
}) {
  return /*#__PURE__*/React.createElement("section", {
    className: "how"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-kicker"
  }, t.how.kicker), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, t.how.title)), /*#__PURE__*/React.createElement("div", {
    className: "steps"
  }, t.how.steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    className: "step",
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    className: "step-num"
  }, "0", i + 1), /*#__PURE__*/React.createElement("div", {
    className: "step-title"
  }, s.t), /*#__PURE__*/React.createElement("div", {
    className: "step-text"
  }, s.d)))), /*#__PURE__*/React.createElement("p", {
    className: "note"
  }, t.how.note)));
}
function Footer({
  t
}) {
  return /*#__PURE__*/React.createElement("footer", {
    className: "footer",
    id: "footer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "footer-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "footer-brand"
  }, /*#__PURE__*/React.createElement("a", {
    className: "logo",
    href: PORTFOLIO
  }, /*#__PURE__*/React.createElement("span", {
    className: "logo-mark"
  }, ico.spark), /*#__PURE__*/React.createElement("span", null, "AI\xA0Vibes")), /*#__PURE__*/React.createElement("p", {
    className: "footer-tag"
  }, t.footer.tag)), /*#__PURE__*/React.createElement("div", {
    className: "footer-cols"
  }, /*#__PURE__*/React.createElement("div", {
    className: "footer-col"
  }, /*#__PURE__*/React.createElement("h4", null, t.footer.contacts), /*#__PURE__*/React.createElement("a", {
    href: TG,
    target: "_blank",
    rel: "noopener noreferrer"
  }, ico.tg, "Telegram @lavr5000"), /*#__PURE__*/React.createElement("a", {
    href: "mailto:" + EMAIL
  }, ico.mail, EMAIL)), /*#__PURE__*/React.createElement("div", {
    className: "footer-col"
  }, /*#__PURE__*/React.createElement("h4", null, t.footer.nav), /*#__PURE__*/React.createElement("a", {
    href: PORTFOLIO
  }, t.footer.portfolio), /*#__PURE__*/React.createElement("a", {
    href: "#products"
  }, t.footer.products)), /*#__PURE__*/React.createElement("div", {
    className: "footer-col"
  }, /*#__PURE__*/React.createElement("h4", null, t.footer.legal), /*#__PURE__*/React.createElement("a", {
    href: "oferta.html"
  }, t.footer.oferta), /*#__PURE__*/React.createElement("a", {
    href: "privacy.html"
  }, t.footer.privacy)))), /*#__PURE__*/React.createElement("div", {
    className: "footer-bottom"
  }, /*#__PURE__*/React.createElement("a", {
    className: "back-link",
    href: PORTFOLIO
  }, ico.back, t.footer.back), /*#__PURE__*/React.createElement("span", {
    className: "copy"
  }, "\xA9 2026 AI Vibes \xB7 ", t.footer.rights))));
}
function App() {
  const [lang, setLang] = useState("ru");
  const t = i18n[lang];
  React.useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Nav, {
    lang: lang,
    setLang: setLang,
    t: t
  }), /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(Hero, {
    t: t
  }), /*#__PURE__*/React.createElement(Products, {
    t: t,
    lang: lang
  }), /*#__PURE__*/React.createElement(Demo, {
    t: t,
    lang: lang
  }), /*#__PURE__*/React.createElement(How, {
    t: t
  })), /*#__PURE__*/React.createElement(Footer, {
    t: t
  }));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
