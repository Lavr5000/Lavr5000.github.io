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
 *   price*    { ru, en }  numeric string, no currency symbol
 *   title*    { ru, en }
 *   tagline   { ru, en }
 *   audience  { ru, en }
 *   input     { ru, en }
 *   output    { ru, en }
 *   serviceType  telegram | request_form | external_app | info_page  (v1: all open Telegram)
 *   cta       { tgText: { ru, en } }  optional prefilled Telegram message
 *
 * A record missing id / title.ru / price.ru is skipped at render time and never
 * breaks the grid (see normalize() in products.html).
 */
window.AI_PRODUCTS = [
  {
    id: "material-takeoff", slug: "material-takeoff", order: 10, visible: true,
    status: "available", icon: "list", serviceType: "request_form",
    price: { ru: "990", en: "990" },
    title:   { ru: "Ведомость материалов из РД", en: "Material takeoff from drawings" },
    tagline: { ru: "Извлекаю материалы и объёмы из рабочей документации в структурный Excel.",
               en: "I extract materials and quantities from working drawings into a structured Excel." },
    audience:{ ru: "ПТО · сметчики · снабжение", en: "QS · estimators · procurement" },
    input:   { ru: "PDF рабочей документации", en: "PDF of working drawings" },
    output:  { ru: "Excel-ведомость материалов и объёмов", en: "Excel bill of materials & quantities" },
    cta: { tgText: { ru: "Здравствуйте! Интересует «Ведомость материалов из РД». Прикладываю файл рабочей документации.",
                     en: "Hi! I'm interested in “Material takeoff from drawings”. Attaching the drawings." } },
  },
  {
    id: "spec-reconciliation", slug: "spec-reconciliation", order: 20, visible: true,
    status: "soon", icon: "diff", serviceType: "request_form",
    price: { ru: "1490", en: "1490" },
    title:   { ru: "Сверка спецификаций", en: "Spec reconciliation" },
    tagline: { ru: "Сравниваю спецификацию поставщика с проектной и нахожу расхождения.",
               en: "I compare a supplier spec against the project one and flag every discrepancy." },
    audience:{ ru: "снабжение · ПТО", en: "procurement · QS" },
    input:   { ru: "Excel-спецификация + PDF проекта", en: "Excel supplier spec + PDF project" },
    output:  { ru: "Excel-таблица расхождений с пометками", en: "Excel discrepancy table with notes" },
    cta: { tgText: { ru: "Здравствуйте! Интересует «Сверка спецификаций».",
                     en: "Hi! I'm interested in “Spec reconciliation”." } },
  },
  {
    id: "letters-claims", slug: "letters-claims", order: 30, visible: true,
    status: "dev", icon: "mail", serviceType: "request_form",
    price: { ru: "590", en: "590" },
    title:   { ru: "Письма и претензии по шаблону", en: "Letters & claims from a template" },
    tagline: { ru: "Из короткого описания собираю официальное письмо в фирменном стиле.",
               en: "From a short brief I assemble an official letter in your house style." },
    audience:{ ru: "ПТО · РП", en: "QS · project managers" },
    input:   { ru: "Краткое описание ситуации", en: "Short description of the situation" },
    output:  { ru: "Готовое официальное письмо .docx", en: "Ready official letter .docx" },
    cta: { tgText: { ru: "Здравствуйте! Интересует «Письма и претензии по шаблону».",
                     en: "Hi! I'm interested in “Letters & claims from a template”." } },
  },
  {
    id: "voice-transcription", slug: "voice-transcription", order: 40, visible: true,
    status: "planned", icon: "mic", serviceType: "request_form",
    price: { ru: "790", en: "790" },
    title:   { ru: "Расшифровка голосовых с объекта", en: "Site voice-note transcription" },
    tagline: { ru: "Превращаю аудио с площадки в структурированный отчёт и список задач.",
               en: "I turn audio from the site into a structured report and a task list." },
    audience:{ ru: "прорабы · РП", en: "foremen · PMs" },
    input:   { ru: "Аудио с объекта", en: "Audio from site" },
    output:  { ru: "Структурированный отчёт + задачи", en: "Structured report + tasks" },
    cta: { tgText: { ru: "Здравствуйте! Интересует «Расшифровка голосовых с объекта».",
                     en: "Hi! I'm interested in “Site voice-note transcription”." } },
  },
];
