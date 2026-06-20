/* products.js — single source of truth for the AI products catalog (products.html).
 * Mirrors the scenarios.js pattern (window.STROYOPS_SCENARIOS).
 *
 * APPEND-ONLY: a new product = one new object at the END of the array.
 * Existing entries are never reordered or rewritten by hand.
 * i18n lives INSIDE each record ({ ru, en }) so RU/EN can never desync.
 * This file is the only artifact the `stroysite-product-publish` skill edits.
 *
 * Field contract (required = *):
 *   id*       unique kebab-case, immutable
 *   slug*     URL fragment (#product/<slug>) — reserved for future sub-pages
 *   order     ascending sort (default 999)
 *   visible   default true; set false to hide without deleting
 *   status*   available | soon | dev | planned   -> pill colour
 *   icon      list | diff | mail | mic | spark    (unknown -> 'list')
 *   categories* audience filter keys:
 *            estimators | designers | construction-control | pto | procurement
 *   price*    { ru, en }  numeric string, no currency symbol
 *   title*    { ru, en }
 *   tagline   { ru, en }
 *   audience  { ru, en }
 *   input     { ru, en }
 *   output    { ru, en }
 *   serviceType  telegram | request_form | external_app | info_page  (v1: all open Telegram)
 *   cta       { tgText: { ru, en } }  optional prefilled Telegram message
 *   tier*     free | paid | freemium
 *   free_quota  number | null  (for freemium = quota size; null for paid/free)
 *
 * A record missing id / title.ru / price.ru is skipped at render time and never
 * breaks the grid (see normalize() in products.html).
 */
window.AI_PRODUCTS = [
  {
    id: "material-takeoff", slug: "material-takeoff", order: 10, visible: true,
    status: "available", icon: "list", serviceType: "request_form",
    categories: ["estimators", "pto", "procurement"],
    price: { ru: "990", en: "990" },
    title:   { ru: "Ведомость материалов из РД", en: "Material takeoff from drawings" },
    tagline: { ru: "Извлекаю материалы и объёмы из рабочей документации в структурный Excel.",
               en: "I extract materials and quantities from working drawings into a structured Excel." },
    audience:{ ru: "ПТО · сметчики · снабжение", en: "QS · estimators · procurement" },
    input:   { ru: "PDF рабочей документации", en: "PDF of working drawings" },
    output:  { ru: "Excel-ведомость материалов и объёмов", en: "Excel bill of materials & quantities" },
    cta: { url: "/vedomost.html", tgText: { ru: "Здравствуйте! Интересует «Ведомость материалов из РД». Прикладываю файл рабочей документации. С офертой ознакомлен(а): https://ai-vibes.ru/oferta.html",
                     en: "Hi! I'm interested in “Material takeoff from drawings”. Attaching the drawings. I have read the offer terms: https://ai-vibes.ru/oferta.html" } },
    tier: "paid", free_quota: null,
  },
  {
    id: "spec-reconciliation", slug: "spec-reconciliation", order: 20, visible: true,
    status: "soon", icon: "diff", serviceType: "request_form",
    categories: ["procurement", "pto"],
    price: { ru: "1490", en: "1490" },
    title:   { ru: "Сверка спецификаций", en: "Spec reconciliation" },
    tagline: { ru: "Сравниваю спецификацию поставщика с проектной и нахожу расхождения.",
               en: "I compare a supplier spec against the project one and flag every discrepancy." },
    audience:{ ru: "снабжение · ПТО", en: "procurement · QS" },
    input:   { ru: "Excel-спецификация + PDF проекта", en: "Excel supplier spec + PDF project" },
    output:  { ru: "Excel-таблица расхождений с пометками", en: "Excel discrepancy table with notes" },
    cta: { tgText: { ru: "Здравствуйте! Интересует «Сверка спецификаций». С офертой ознакомлен(а): https://ai-vibes.ru/oferta.html",
                     en: "Hi! I'm interested in “Spec reconciliation”. I have read the offer terms: https://ai-vibes.ru/oferta.html" } },
    tier: "paid", free_quota: null,
  },
  {
    id: "letters-claims", slug: "letters-claims", order: 30, visible: false,
    status: "dev", icon: "mail", serviceType: "request_form",
    categories: ["pto"],
    price: { ru: "590", en: "590" },
    title:   { ru: "Письма и претензии по шаблону", en: "Letters & claims from a template" },
    tagline: { ru: "Из короткого описания собираю официальное письмо в фирменном стиле.",
               en: "From a short brief I assemble an official letter in your house style." },
    audience:{ ru: "ПТО · РП", en: "QS · project managers" },
    input:   { ru: "Краткое описание ситуации", en: "Short description of the situation" },
    output:  { ru: "Готовое официальное письмо .docx", en: "Ready official letter .docx" },
    cta: { tgText: { ru: "Здравствуйте! Интересует «Письма и претензии по шаблону». С офертой ознакомлен(а): https://ai-vibes.ru/oferta.html",
                     en: "Hi! I'm interested in “Letters & claims from a template”. I have read the offer terms: https://ai-vibes.ru/oferta.html" } },
    tier: "paid", free_quota: null,
  },
  {
    id: "voice-transcription", slug: "voice-transcription", order: 40, visible: true,
    status: "planned", icon: "mic", serviceType: "request_form",
    categories: ["construction-control"],
    price: { ru: "790", en: "790" },
    title:   { ru: "Протокол планёрки из голосовых", en: "Meeting minutes from voice notes" },
    tagline: { ru: "Превращаю голосовые с планёрки в готовый протокол: решения, поручения, сроки.",
               en: "I turn meeting voice notes into ready minutes: decisions, action items, deadlines." },
    audience:{ ru: "прорабы · РП", en: "foremen · PMs" },
    input:   { ru: "Голосовые/аудио с планёрки", en: "Voice notes / meeting audio" },
    output:  { ru: "Протокол планёрки .docx + список поручений", en: "Minutes .docx + action list" },
    cta: { tgText: { ru: "Здравствуйте! Интересует «Протокол планёрки из голосовых». С офертой ознакомлен(а): https://ai-vibes.ru/oferta.html",
                     en: "Hi! I'm interested in “Meeting minutes from voice notes”. I have read the offer terms: https://ai-vibes.ru/oferta.html" } },
    tier: "paid", free_quota: null,
  },
  {
    id: "works-cost-estimate", slug: "works-cost-estimate", order: 50, visible: true,
    status: "soon", icon: "spark", serviceType: "request_form",
    categories: ["estimators", "pto"],
    price:{ ru: "1990", en: "1990" },
    title:{ ru: "Калькуляция работ из РД", en: "Works cost estimate from drawings" },
    tagline:{ ru: "Считаю стоимость работ по объёмам из рабочей документации — готовая калькуляция для КП.",
              en: "I price construction works from drawing quantities — a ready cost estimate for your bid." },
    audience:{ ru: "сметчики · ПТО · подрядчики", en: "estimators · QS · contractors" },
    input:{ ru: "PDF рабочей документации или ведомость объёмов",
            en: "Working drawings PDF or a quantities schedule" },
    output:{ ru: "Excel-калькуляция стоимости работ с живыми формулами",
             en: "Excel works cost estimate with live formulas" },
    cta: { tgText: { ru: "Здравствуйте! Интересует «Калькуляция работ из РД». Прикладываю документацию. С офертой ознакомлен(а): https://ai-vibes.ru/oferta.html",
                     en: "Hi! I'm interested in “Works cost estimate from drawings”. Attaching the drawings. I have read the offer terms: https://ai-vibes.ru/oferta.html" } },
    tier: "paid", free_quota: null,
  },
  {
    id: "nakladnaya-m15", slug: "nakladnaya-m15", order: 60, visible: false,
    status: "soon", icon: "list", serviceType: "request_form",
    categories: ["pto", "procurement", "estimators"],
    price: { ru: "79", en: "79" },
    title:   { ru: "Накладные М-15 → Excel", en: "M-15 delivery notes → Excel" },
    tagline: { ru: "Распознаю отсканированные накладные М-15 в структурный Excel для М-29.",
               en: "I turn scanned M-15 delivery notes into a structured Excel for M-29." },
    audience:{ ru: "ПТО · снабжение · сметчики", en: "QS · procurement · estimators" },
    input:   { ru: "PDF-скан накладных формы М-15", en: "PDF scan of M-15 delivery notes" },
    output:  { ru: "Excel: код/ед.изм/количество + лист «Свод»",
               en: "Excel: code/unit/qty + summary sheet" },
    cta: { url: "/nakladnaya.html", tgText: { ru: "Здравствуйте! Интересует «Накладные М-15 → Excel». Прикладываю PDF-скан накладных формы М-15. С офертой ознакомлен(а): https://ai-vibes.ru/oferta.html",
                     en: "Hi! I'm interested in “M-15 delivery notes → Excel”. Attaching the PDF scan of M-15 delivery notes. I have read the offer terms: https://ai-vibes.ru/oferta.html" } },
    // price.ru "79" must equal backend WEBINTAKE_M15_PAYMENT_AMOUNT/100 (7900 коп) — see test_payment_amount.py
    tier: "freemium", free_quota: 1,
  },
];
