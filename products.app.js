const {
  useState
} = React;

const PORTFOLIO = "/about.html";

const i18n = {
  ru: {
    products: {
      kicker: "Каталог",
      title: "Продукты",
      desc: "Готовые AI-сервисы для конкретных задач. Цены ориентировочные — финальная зависит от объёма."
    },
    statuses: {
      available: "Доступен",
      soon: "Скоро",
      dev: "В разработке",
      planned: "В планах"
    },
    io: {
      in: "Вход:",
      out: "Выход:"
    },
    cardCta: "Заказать в Telegram",
    from: "от"
  },
  en: {
    products: {
      kicker: "Catalog",
      title: "Products",
      desc: "Ready-made AI services for specific tasks. Prices are indicative — the final one depends on scope."
    },
    statuses: {
      available: "Available",
      soon: "Soon",
      dev: "In progress",
      planned: "Planned"
    },
    io: {
      in: "In:",
      out: "Out:"
    },
    cardCta: "Order on Telegram",
    from: "from"
  }
};

function App() {
  const [lang] = useState(document.documentElement.lang === "en" ? "en" : "ru");
  React.useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return window.AIVibesCatalog.renderCatalog({
    t: i18n[lang],
    lang: lang,
    portfolioUrl: PORTFOLIO,
    rootUrl: "/"
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App, null));
