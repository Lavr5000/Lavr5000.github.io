# -*- coding: utf-8 -*-
"""ntd_snapshot.py — разбор и ВАЛИДАЦИЯ офлайн-снимка перечня СП (R10, D-1/D-5).

Снимок собирает внешний python-скрипт (решение PO Р-1: книга в сеть не ходит).
Здесь — чистые функции без COM и без сети: схема, статусы, нормализация
обозначения, downgrade-guard. Ими пользуются сьют `std-snapshot`, юниты
слияния и — через ту же спецификацию — кнопка «Обновить нормативы» (Ф8).

Статусы реестра Росстандарта → StatusCode книги:
  «Действует» → ACTIVE · «Заменен» → REPLACED · «Отменен» → CANCELLED
  «Принят» (не вступил в силу) → PENDING, в книгу НЕ переносится (Р-2).
"""
import json
from pathlib import Path

STATUS_MAP = {
    "действует": "ACTIVE",
    "заменен": "REPLACED",
    "заменён": "REPLACED",
    "отменен": "CANCELLED",
    "отменён": "CANCELLED",
    "принят": "PENDING",
}
REQUIRED = ("source", "fetched_at", "total", "rows")
ROW_REQUIRED = ("designation", "title", "status")


def norm_designation(text):
    """trim + схлопывание пробелов + унификация тире + регистронезависимо.

    ЕДИНСТВЕННОЕ место нормализации: тем же ключом меряется `normalized_dup`
    в сьюте снимка и матчится снимок с применённой копией в слиянии — иначе
    «дублей нет» и «дубль создан» разошлись бы на первом же тире.
    """
    t = str(text or "")
    for dash in ("–", "—", "−", "‐", "‑"):
        t = t.replace(dash, "-")
    return " ".join(t.split()).strip().lower()   # split() съедает и CR/LF/TAB


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def validate(data, applied_fetched_at=None):
    """[ошибки]. Пусто = снимок можно применять (D-1: валидация ДО мутации)."""
    errs = []
    if not isinstance(data, dict):
        return ["снимок не является объектом"]
    for k in REQUIRED:
        if k not in data:
            errs.append("нет обязательного поля «%s»" % k)
    rows = data.get("rows")
    if not isinstance(rows, list) or not rows:
        errs.append("rows пуст или не список")
        rows = []
    try:
        total = int(data.get("total") or 0)
    except (TypeError, ValueError):
        total = 0
        errs.append("total не число")
    if total <= 0:
        errs.append("total <= 0")
    if rows and total and len(rows) != total:
        errs.append("total=%s != строк %d" % (data.get("total"), len(rows)))
    for i, r in enumerate(rows[:  # проверяем схему строк целиком: дешевле,
                               len(rows)], 1):        # чем поймать в мутации
        if not isinstance(r, dict):
            errs.append("строка %d не объект" % i)
            continue
        for k in ROW_REQUIRED:
            if k not in r:
                errs.append("строка %d: нет поля «%s»" % (i, k))
                break
    ver = data.get("snapshot_version")
    if ver is not None and int(ver) != 1:
        errs.append("неизвестная версия снимка: %r" % ver)
    if applied_fetched_at and str(data.get("fetched_at", "")) < \
            str(applied_fetched_at):
        errs.append("снимок старше применённого (%s < %s) — downgrade"
                    % (data.get("fetched_at"), applied_fetched_at))
    return errs


def to_records(data):
    """[{designation, key, title, status_code, pages}] — все статусы (D-1)."""
    out = []
    for r in data.get("rows", []):
        des = str(r.get("designation") or "").strip()
        status = STATUS_MAP.get(str(r.get("status") or "").strip().lower(), "")
        out.append({"designation": des, "key": norm_designation(des),
                    "title": str(r.get("title") or "").strip(),
                    "status_code": status,
                    "pages": str(r.get("pages") or "").strip()})
    return out


def counts(records):
    by = {}
    for r in records:
        by[r["status_code"]] = by.get(r["status_code"], 0) + 1
    keys = [r["key"] for r in records if r["key"]]
    return {"rows": len(records), "by_status": by,
            "normalized_dup": len(keys) - len(set(keys))}
