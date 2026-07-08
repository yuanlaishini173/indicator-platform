from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"
DATA_DIR = DOCS_DIR / "data"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import main  # noqa: E402


def is_historical(month: str) -> bool:
    return month.startswith("HIST-")


def month_sort_value(month: str) -> int:
    if month.startswith("HIST-"):
        parts = month.split("-")
        return int(parts[-1]) * 12 + 12
    year, month_number = month.split("-")
    return int(year) * 12 + int(month_number)


def make_key(month: str, time_scope: str, start_month: str | None = None) -> str:
    return "|".join([time_scope, month, start_month or ""])


def period_payload(month: str, time_scope: str, start_month: str | None = None) -> dict[str, Any]:
    overview = main.aggregate_for_period(month, start_month, time_scope)
    ai_rows, ai_period = main.ai_district_rows_for_period(month, start_month, time_scope)
    level_rows, level_period = main.certificate_level_rows_for_period(month, start_month, time_scope)
    total = next((row for row in level_rows if row.get("district") == "合计"), None)
    return {
        "overview": overview,
        "aiDistricts": {"items": ai_rows, "count": len(ai_rows), **ai_period},
        "levelStats": {"items": level_rows, "total": total, "count": len(level_rows), **level_period},
    }


def build_payload() -> dict[str, Any]:
    meta = main.meta()
    months = meta.get("months", [])
    regular_months = sorted([month for month in months if not is_historical(month)], key=month_sort_value)
    payloads: dict[str, dict[str, Any]] = {}

    for month in months:
        payloads[make_key(month, "cumulative")] = period_payload(month, "cumulative")
        if is_historical(month):
            continue
        payloads[make_key(month, "since2021")] = period_payload(month, "since2021")
        for start_month in regular_months:
            if month_sort_value(start_month) <= month_sort_value(month):
                payloads[make_key(month, "range", start_month)] = period_payload(month, "range", start_month)

    latest_month = meta.get("latest_month") or (months[0] if months else "")
    default_scope = "since2021" if latest_month and not is_historical(latest_month) else "cumulative"
    default_start = regular_months[0] if regular_months else latest_month
    return {
        "exportedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "meta": meta,
        "regularMonths": regular_months,
        "defaultState": {
            "month": latest_month,
            "timeScope": default_scope,
            "startMonth": default_start,
        },
        "payloads": payloads,
    }


def main_export() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DOCS_DIR / ".nojekyll").write_text("", encoding="utf-8")
    payload = build_payload()
    (DATA_DIR / "site-data.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"GitHub Pages data exported: {DATA_DIR / 'site-data.json'}")
    print(f"Periods exported: {len(payload['payloads'])}")


if __name__ == "__main__":
    main_export()
