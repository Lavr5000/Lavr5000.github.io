# evals — снимки для шага D (перевод цветов на токены)

- `d-colormap.json` — карта замены цветов для сверки: `"#rrggbb": "#rrggbb"`, применяемая к «до» при построении ожидаемого снимка.
- `d-intended.txt` — снимки с ожидаемыми отличиями: `имя_снимка  # причина`; провал — `pct > 0.5` (% пикселей вне маски с отличием канала > 8).
- Сами снимки лежат в `evals/before-d/` и `evals/after-d/` (не коммитятся, в `.gitignore`; папка `evals` не публикуется — `.github/pages-drop.txt`).

Команды: `python scripts/d_snapshot.py shoot --out evals/before-d`, затем `python scripts/d_snapshot.py compare --before evals/before-d --after evals/after-d --colormap evals/d-colormap.json --intended evals/d-intended.txt`. Требует Pillow + numpy + Playwright (chromium).
