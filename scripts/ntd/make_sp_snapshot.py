# -*- coding: utf-8 -*-
"""make_sp_snapshot.py — сбор офлайн-снимка реестра СП (R10, решения Р-1/D-5).

Книга в сеть НЕ ходит: снимок собирает ЭТОТ скрипт, а кнопка «Обновить
нормативы» в книге только СЛИВАЕТ готовый файл со справочником (правила D-1).
Шагом сборки поставки скрипт не является.

R12 (решение ПО-3): скрипт стал ЗАДАЧЕЙ ПЛАНИРОВЩИКА — недельный таймер на
нашем VPS (`idm-ntd-publish.timer`) пересобирает снимок и публикует его на
`https://api.ai-vibes.ru/idm/`. Прежняя формулировка «ни задачей планировщика
не является» отменена этим решением. Ручной запуск по потребности остался.
Вежливость к чужому реестру (R12, Р-9): пауза между страницами, до трёх
попыток с отступом 2/6/18 с и ТОЛЬКО на восстановимых сбоях — 403/404 и
ошибка TLS не ретраятся.

Снимок хранит ВСЕ позиции реестра со статусами — заменённые и отменённые нужны,
чтобы пометить ссылки актов; в справочник книги добавляются только действующие.

  python rebuild-sandbox\\scripts\\make_sp_snapshot.py [--out <файл>]

Выход по умолчанию — `Нормативы (снимок ГГГГ-ММ-ДД).json` рядом со скриптом.
Схема файла (её же проверяет `ntd_snapshot.validate` до любой мутации книги):
  {snapshot_version, source, fetched_at, pages_fetched, total, by_status,
   rows: [{designation, title, pages, status}, …]}
"""
import argparse
import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
BASE = "https://protect.gost.ru/sp"
UA = {"User-Agent": "Mozilla/5.0"}
SNAPSHOT_VERSION = 1
PAGE_LIMIT = 60           # жёсткий стоп: реестр сегодня 38 страниц
TIMEOUT = 30
PAGE_PAUSE = 1.0          # пауза между страницами (была 0.4; 38 c раз в неделю)
BACKOFF = (2, 6, 18)      # отступ перед 2-й и 3-й попыткой; len = число ретраев
# Терминальные коды: повторять их — значит долбить реестр в бан без шанса
# на успех. Всё остальное (429, 5xx, таймаут, обрыв, DNS) — восстановимо.
TERMINAL_HTTP = (400, 401, 403, 404, 405, 410, 451)


class FetchFailed(RuntimeError):
    """Страница не получена. Ловится издателем: публикация не состоится,
    ранее опубликованный снимок остаётся на месте (R12, Р-8)."""

STATUS_RE = re.compile(
    r'rounded-full[^>]*>\s*(?:<span>[^<]*</span>)?\s*([^<]+?)\s*</span>')


def fetch(page, log=sys.stderr.write):
    """Одна страница реестра с ретраями по восстановимым сбоям (R12, Р-9)."""
    url = "%s?page=%d" % (BASE, page)
    for attempt in range(1, len(BACKOFF) + 2):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                return resp.status, resp.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as exc:
            if exc.code in TERMINAL_HTTP:
                raise FetchFailed("страница %d: HTTP %d — не ретраится"
                                  % (page, exc.code))
            why = "HTTP %d" % exc.code
        except urllib.error.URLError as exc:
            if isinstance(exc.reason, ssl.SSLError):
                raise FetchFailed("страница %d: ошибка TLS (%s) — не ретраится"
                                  % (page, exc.reason))
            why = "%s: %s" % (type(exc.reason).__name__, exc.reason)
        except (TimeoutError, OSError) as exc:
            why = "%s: %s" % (type(exc).__name__, exc)
        if attempt > len(BACKOFF):
            raise FetchFailed("страница %d: %d попытки исчерпаны (%s)"
                              % (page, attempt, why))
        pause = BACKOFF[attempt - 1]
        log("страница %d: попытка %d не удалась (%s), повтор через %d c\n"
            % (page, attempt, why, pause))
        time.sleep(pause)


def parse(html):
    """Строки таблицы реестра. Разбор ПОСТРОЧНЫЙ (сначала <tr>, потом поля):
    один общий regex на всю строку молча терял позиции без наименования."""
    out = []
    for tr in re.findall(r'<tr class="hover:[^"]*">.*?</tr>', html, re.S):
        m = re.search(r'<span>([^<]+)</span>\s*</a>', tr)
        if not m:
            continue
        t = re.search(r'<span class="line-clamp-2">([^<]*)</span>', tr)
        p = re.search(r'font-mono text-xs">\s*([^<]*?)\s*</td>', tr)
        s = STATUS_RE.search(tr)
        out.append({"designation": m.group(1).strip(),
                    "title": (t.group(1).strip() if t else ""),
                    "pages": (p.group(1).strip() if p else ""),
                    "status": (s.group(1) if s else "UNKNOWN")})
    return out


def collect(log=sys.stderr.write):
    rows, page = [], 1
    while page <= PAGE_LIMIT:
        status, html = fetch(page, log)
        got = parse(html)
        if not got:
            break
        rows.extend(got)
        log("страница %d: HTTP %d, строк %d (всего %d)\n"
            % (page, status, len(got), len(rows)))
        page += 1
        time.sleep(PAGE_PAUSE)
    by_status = {}
    for r in rows:
        by_status[r["status"]] = by_status.get(r["status"], 0) + 1
    return {"snapshot_version": SNAPSHOT_VERSION, "source": BASE,
            "fetched_at": date.today().isoformat(), "pages_fetched": page - 1,
            "total": len(rows), "by_status": by_status, "rows": rows}


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="")
    a = ap.parse_args()

    snap = collect()
    if not snap["rows"]:
        raise SystemExit("ОТКАЗ: реестр вернул 0 строк — снимок не записан")
    out = Path(a.out) if a.out else HERE / ("Нормативы (снимок %s).json"
                                            % snap["fetched_at"])
    out.write_text(json.dumps(snap, ensure_ascii=False, indent=1),
                   encoding="utf-8")
    print(json.dumps({k: v for k, v in snap.items() if k != "rows"},
                     ensure_ascii=False, indent=1))
    print("снимок:", out)


if __name__ == "__main__":
    main()
