#!/usr/bin/env python3
"""Build Japanese/English municipality, prefecture, and block name lookups."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


BASE = Path(__file__).resolve().parent.parent
IN_CSV = BASE / "data" / "processed" / "hirei_shikuchouson.csv"
OTTERSOU_TSV_URL = (
    "https://raw.githubusercontent.com/OtterSou/japan-municipalities/main/0-all.tsv"
)
OUT_DIR = BASE / "web" / "public" / "data"
OUT_JA = OUT_DIR / "names_ja.json"
OUT_EN = OUT_DIR / "names_en.json"

BLOCK_NAMES_JA = {
    "1": "北海道",
    "2": "東北",
    "3": "北関東",
    "4": "南関東",
    "5": "東京",
    "6": "北陸信越",
    "7": "東海",
    "8": "近畿",
    "9": "中国",
    "10": "四国",
    "11": "九州",
}

BLOCK_NAMES_EN = {
    "1": "Hokkaido",
    "2": "Tohoku",
    "3": "North Kanto",
    "4": "South Kanto",
    "5": "Tokyo",
    "6": "Hokuriku-Shinetsu",
    "7": "Tokai",
    "8": "Kinki",
    "9": "Chugoku",
    "10": "Shikoku",
    "11": "Kyushu",
}


def clean(value: object) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def read_csv_names() -> tuple[pd.DataFrame, dict[str, dict[str, str]], dict[str, str]]:
    if not IN_CSV.exists():
        raise FileNotFoundError(f"Input not found: {IN_CSV}")

    df = pd.read_csv(
        IN_CSV,
        dtype={
            "pref_code": str,
            "pref_name": str,
            "muni_code": str,
            "muni_name": str,
        },
        usecols=["pref_code", "pref_name", "muni_code", "muni_name"],
    )
    df["pref_code"] = df["pref_code"].astype(str).str.zfill(2)
    df["muni_code"] = df["muni_code"].astype(str).str.zfill(5)

    muni_df = (
        df[["muni_code", "muni_name", "pref_code", "pref_name"]]
        .drop_duplicates(subset=["muni_code"], keep="first")
        .copy()
    )
    pref_df = (
        df[["pref_code", "pref_name"]]
        .drop_duplicates(subset=["pref_code"], keep="first")
        .copy()
    )

    muni_ja: dict[str, dict[str, str]] = {}
    for _, row in muni_df.iterrows():
        muni_code = clean(row["muni_code"]).zfill(5)
        muni_name = clean(row["muni_name"])
        pref_name = clean(row["pref_name"])
        if not muni_code:
            continue
        muni_ja[muni_code] = {
            "short": muni_name,
            "full": f"{pref_name}{muni_name}" if pref_name else muni_name,
        }

    pref_ja = {
        clean(row["pref_code"]).zfill(2): clean(row["pref_name"])
        for _, row in pref_df.iterrows()
    }
    pref_ja = {k: v for k, v in pref_ja.items() if k and v}

    return muni_df, muni_ja, pref_ja


def read_ottersou() -> tuple[dict[str, list[dict[str, str]]], dict[str, str]]:
    otter = pd.read_csv(
        OTTERSOU_TSV_URL,
        sep="\t",
        dtype=str,
        usecols=["code", "full-en", "base-en", "level", "pref", "psub", "muni"],
    )

    rows_by_code: dict[str, list[dict[str, str]]] = {}
    for _, row in otter.iterrows():
        code = clean(row["code"]).zfill(5)
        if not code:
            continue
        item = {
            "code": code,
            "full-en": clean(row["full-en"]),
            "base-en": clean(row["base-en"]),
            "level": clean(row["level"]),
            "pref": clean(row["pref"]).zfill(2),
            "psub": clean(row["psub"]).zfill(5) if clean(row["psub"]) else "",
            "muni": clean(row["muni"]).zfill(5) if clean(row["muni"]) else "",
        }
        rows_by_code.setdefault(code, []).append(item)

    pref_en: dict[str, str] = {}
    pref_rows = otter[otter["level"] == "1"][["pref", "base-en"]].drop_duplicates(
        subset=["pref"],
        keep="first",
    )
    for _, row in pref_rows.iterrows():
        pref_code = clean(row["pref"]).zfill(2)
        base_en = clean(row["base-en"])
        if pref_code and base_en:
            pref_en[pref_code] = base_en

    return rows_by_code, pref_en


def pick_primary_row(rows_by_code: dict[str, list[dict[str, str]]], code: str) -> dict[str, str] | None:
    rows = rows_by_code.get(code, [])
    if not rows:
        return None

    rank = {"4": 4, "3": 3, "2": 2, "1": 1}
    return max(rows, key=lambda r: rank.get(r["level"], 0))


def pick_base_en(rows_by_code: dict[str, list[dict[str, str]]], code: str) -> str:
    if not code:
        return ""
    rows = rows_by_code.get(code, [])
    if not rows:
        return ""

    order = {"3": 0, "2": 1, "1": 2, "4": 3}
    for row in sorted(rows, key=lambda r: order.get(r["level"], 9)):
        if row["base-en"]:
            return row["base-en"]
    return ""


def build_en_names(
    muni_df: pd.DataFrame,
    rows_by_code: dict[str, list[dict[str, str]]],
    pref_en: dict[str, str],
) -> dict[str, dict[str, str]]:
    muni_en: dict[str, dict[str, str]] = {}

    for _, row in muni_df.iterrows():
        muni_code = clean(row["muni_code"]).zfill(5)
        pref_code = clean(row["pref_code"]).zfill(2)
        muni_name_ja = clean(row["muni_name"])
        pref_name = pref_en.get(pref_code, "")
        otter_row = pick_primary_row(rows_by_code, muni_code)

        short = ""
        full = ""

        if otter_row:
            base_en = otter_row["base-en"]
            full_en = otter_row["full-en"]
            level = otter_row["level"]

            if level == "4":
                parent_code = otter_row["muni"] or otter_row["psub"]
                parent_base = pick_base_en(rows_by_code, parent_code)
                short = " ".join(part for part in (parent_base, base_en) if part)
                specific = full_en or base_en
                full = ", ".join(part for part in (specific, parent_base, pref_name) if part)
            else:
                short = base_en
                is_tokyo_special_ward = pref_code == "13" and muni_name_ja.endswith("区")
                if is_tokyo_special_ward:
                    specific = full_en if "Ward" in full_en else f"{base_en} Ward"
                else:
                    specific = base_en
                full = ", ".join(part for part in (specific, pref_name) if part)

        muni_en[muni_code] = {"short": short, "full": full}

    return muni_en


def sorted_dict_values(data: dict[str, object]) -> dict[str, object]:
    return {k: data[k] for k in sorted(data)}


def main() -> None:
    muni_df, muni_ja, pref_ja = read_csv_names()
    rows_by_code, pref_en = read_ottersou()
    muni_en = build_en_names(muni_df, rows_by_code, pref_en)

    names_ja = {
        "muni": sorted_dict_values(muni_ja),
        "pref": sorted_dict_values(pref_ja),
        "block": BLOCK_NAMES_JA,
    }
    names_en = {
        "muni": sorted_dict_values(muni_en),
        "pref": sorted_dict_values(pref_en),
        "block": BLOCK_NAMES_EN,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JA.write_text(
        json.dumps(names_ja, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    OUT_EN.write_text(
        json.dumps(names_en, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(f"Saved {OUT_JA} ({OUT_JA.stat().st_size / 1024:.1f} KB)")
    print(f"Saved {OUT_EN} ({OUT_EN.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
