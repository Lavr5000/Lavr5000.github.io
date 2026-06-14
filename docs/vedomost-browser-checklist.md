# Ручной чек-лист vedomost.html

1. Открыть `vedomost.html` с локального origin, разрешённого в `scripts/mock_api.mjs`.
2. Убедиться, что страница не грузит CDN или внешние runtime-ресурсы.
3. Проверить обязательные поля: без PDF, email или согласия отправка не создаёт заказ.
4. Выбрать не-PDF: страница отклоняет файл до API-запросов.
5. Выбрать PDF больше 25 МБ: страница отклоняет файл до API-запросов.
6. Выбрать скан без текстового слоя: текст отказа показан дословно, заказ не создаётся.
7. Выбрать `tests/fixtures/text.pdf`, заполнить email, включить согласие и опциональный opt-in.
8. Проверить в DevTools Network, что `POST /api/orders` отправляет `website: ""`, `consent_version: "dev-0"` и `optin_extended_retention`.
9. Проверить, что `order_token` и `upload_token` не появляются в URL или query string.
10. Проверить, что `POST /api/upload` отправляет один файл и `Authorization: Bearer <upload_token>`.
11. Проверить polling `GET /api/status` каждые 5 секунд с `Authorization: Bearer <order_token>`.
12. Убедиться, что UI проходит стадии `queued`, `parsing`, `awaiting_payment`.
13. При `payment_url: null` показать сообщение `менеджер выставит счёт`, без кнопки оплаты.
14. При ненулевом `payment_url` в ответе mock/API показать кнопку оплаты.
15. Проверить honeypot: вручную заполнить скрытое поле `website`, API отвечает fake-success без загрузки.
16. Проверить ошибки API: единый формат `{error_code, message, retry_after}` корректно отображается пользователю.
