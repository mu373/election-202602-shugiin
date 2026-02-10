#!/usr/bin/env python3
"""47都道府県の比例得票CSVを統合・政党名正規化・検証

入力: data/raw/election/hirei/csv/*.csv（47ファイル）
      data/raw/election/hirei/party_mapping.json（政党名エイリアス）
      data/raw/election/hirei/logs/*.json（スクレイピングログ）
出力: data/processed/hirei_shikuchouson.csv（全国統合版、約20,000行）
"""

import csv
import json
import os
import sys
from pathlib import Path
from collections import defaultdict

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent.parent.parent
HIREI_DIR = BASE_DIR / "data" / "raw" / "election" / "hirei"
RAW_DIR = HIREI_DIR / "csv"
LOGS_DIR = HIREI_DIR / "logs"
OUT_DIR = BASE_DIR / "data" / "processed"

PREF_NAMES = {
    1: "北海道", 2: "青森県", 3: "岩手県", 4: "宮城県", 5: "秋田県", 6: "山形県",
    7: "福島県", 8: "茨城県", 9: "栃木県", 10: "群馬県", 11: "埼玉県", 12: "千葉県",
    13: "東京都", 14: "神奈川県", 15: "新潟県", 16: "富山県", 17: "石川県", 18: "福井県",
    19: "山梨県", 20: "長野県", 21: "岐阜県", 22: "静岡県", 23: "愛知県", 24: "三重県",
    25: "滋賀県", 26: "京都府", 27: "大阪府", 28: "兵庫県", 29: "奈良県", 30: "和歌山県",
    31: "鳥取県", 32: "島根県", 33: "岡山県", 34: "広島県", 35: "山口県", 36: "徳島県",
    37: "香川県", 38: "愛媛県", 39: "高知県", 40: "福岡県", 41: "佐賀県", 42: "長崎県",
    43: "熊本県", 44: "大分県", 45: "宮崎県", 46: "鹿児島県", 47: "沖縄県",
}


def load_party_mapping():
    with open(HIREI_DIR / "party_mapping.json", encoding="utf-8") as f:
        mapping = json.load(f)
    # Build reverse lookup: alias -> canonical name
    reverse = {}
    for canonical, aliases in mapping.items():
        reverse[canonical] = canonical
        for alias in aliases:
            reverse[alias] = canonical
    return reverse


def normalize_party(name, reverse_map):
    name = name.strip()
    if name in reverse_map:
        return reverse_map[name]
    # Try partial match
    for alias, canonical in reverse_map.items():
        if alias in name or name in alias:
            return canonical
    return name  # Return as-is if no match


def merge():
    reverse_map = load_party_mapping()
    all_rows = []
    found_prefs = set()
    issues = []

    for csv_path in sorted(RAW_DIR.glob("*.csv")):
        pref_code_str = csv_path.stem.split("_")[0]
        try:
            pref_code = int(pref_code_str)
        except ValueError:
            issues.append(f"Skipping file with unexpected name: {csv_path.name}")
            continue

        found_prefs.add(pref_code)
        with open(csv_path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                party_raw = row.get("party_name", "")
                party_norm = normalize_party(party_raw, reverse_map)
                votes_str = row.get("votes", "0").replace(",", "")
                try:
                    votes = int(votes_str)
                except ValueError:
                    votes = 0
                    issues.append(f"{csv_path.name}: non-numeric votes '{row.get('votes')}' for {party_raw} in {row.get('muni_name')}")

                if votes < 0:
                    issues.append(f"{csv_path.name}: negative votes {votes} for {party_raw} in {row.get('muni_name')}")

                out_row = {
                    "pref_code": row.get("pref_code", f"{pref_code:02d}"),
                    "pref_name": row.get("pref_name", PREF_NAMES.get(pref_code, "")),
                    "muni_code": row.get("muni_code", ""),
                    "muni_name": row.get("muni_name", ""),
                    "party_name": party_norm,
                    "votes": votes,
                }
                if "valid_votes" in row and row["valid_votes"]:
                    out_row["valid_votes"] = row["valid_votes"].replace(",", "")
                all_rows.append(out_row)

    # Check coverage
    missing = set(PREF_NAMES.keys()) - found_prefs
    print(f"\n=== Coverage Report ===")
    print(f"Prefectures with data: {len(found_prefs)}/47")
    if missing:
        print(f"Missing: {', '.join(f'{c:02d}_{PREF_NAMES[c]}' for c in sorted(missing))}")

    # Check logs for status
    success = partial = failed = 0
    for log_path in sorted(LOGS_DIR.glob("*.json")):
        with open(log_path, encoding="utf-8") as f:
            log = json.load(f)
        status = log.get("status", "unknown")
        if status == "success":
            success += 1
        elif status == "partial":
            partial += 1
        else:
            failed += 1
    print(f"Agent logs: {success} success, {partial} partial, {failed} failed")

    # Municipality count per prefecture
    muni_counts = defaultdict(set)
    for row in all_rows:
        muni_counts[row["pref_code"]].add(row["muni_name"])
    print(f"\nMunicipality counts per prefecture:")
    for code in sorted(muni_counts.keys()):
        print(f"  {code}: {len(muni_counts[code])} municipalities")

    # Unique parties found
    parties = set(row["party_name"] for row in all_rows)
    print(f"\nParties found ({len(parties)}): {', '.join(sorted(parties))}")

    if issues:
        print(f"\n=== Issues ({len(issues)}) ===")
        for issue in issues[:50]:
            print(f"  - {issue}")

    # Write output
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / "hirei_shikuchouson.csv"
    fieldnames = ["pref_code", "pref_name", "muni_code", "muni_name", "party_name", "votes"]
    has_valid_votes = any("valid_votes" in r for r in all_rows)

    if has_valid_votes:
        # Add municipality-level denominator robust to split counting districts.
        # valid_votes_muni prioritizes source valid_votes when available; otherwise
        # falls back to municipality-level sum of party votes.
        df = pd.DataFrame(all_rows)
        df["pref_code"] = df["pref_code"].astype(str).str.zfill(2)
        df["muni_code"] = df["muni_code"].astype(str).str.zfill(5)
        df["votes"] = pd.to_numeric(df["votes"], errors="coerce").fillna(0).astype(int)
        df["valid_votes"] = pd.to_numeric(df.get("valid_votes"), errors="coerce")

        muni_valid = (
            df[["pref_code", "muni_code", "muni_name", "valid_votes"]]
            .drop_duplicates(subset=["pref_code", "muni_code", "muni_name"])
            .groupby(["pref_code", "muni_code"], as_index=False)["valid_votes"]
            .sum(min_count=1)
            .rename(columns={"valid_votes": "valid_votes_muni"})
        )
        muni_votes_sum = (
            df.groupby(["pref_code", "muni_code"], as_index=False)["votes"]
            .sum()
            .rename(columns={"votes": "votes_sum_muni"})
        )
        muni_valid = muni_valid.merge(muni_votes_sum, on=["pref_code", "muni_code"], how="left")
        muni_valid["valid_votes_muni"] = muni_valid["valid_votes_muni"].where(
            muni_valid["valid_votes_muni"].notna(), muni_valid["votes_sum_muni"]
        )

        df = df.merge(muni_valid[["pref_code", "muni_code", "valid_votes_muni"]], on=["pref_code", "muni_code"], how="left")
        df["valid_votes_muni"] = pd.to_numeric(df["valid_votes_muni"], errors="coerce").astype("Int64").astype(str).replace("<NA>", "")

        fieldnames.append("valid_votes_muni")
        rows_to_write = df.to_dict(orient="records")
    else:
        rows_to_write = all_rows

    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows_to_write:
            writer.writerow({k: row.get(k, "") for k in fieldnames})

    print(f"\nWrote {len(rows_to_write)} rows to {out_path}")
    return len(missing)


if __name__ == "__main__":
    missing = merge()
    sys.exit(0 if missing == 0 else 1)
