#!/usr/bin/env python3
"""Convert municipality-level proportional vote CSV to web JSON files."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


BASE = Path(__file__).resolve().parent.parent.parent
IN_CSV = BASE / "data" / "processed" / "hirei_shikuchouson.csv"
OUT_DIR = BASE / "web" / "data"
OUT_ELECTION = OUT_DIR / "election_data.json"
OUT_PARTIES = OUT_DIR / "parties.json"

PARTY_CODE_MAP = {
    "自由民主党": "jimin",
    "中道改革連合": "chudou",
    "チームみらい": "mirai",
    "日本維新の会": "ishin",
    "国民民主党": "kokumin",
    "日本共産党": "kyosan",
    "参政党": "sanseito",
    "日本保守党": "hoshu",
    "社会民主党": "shamin",
    "れいわ新選組": "reiwa",
    "減税日本・ゆうこく連合": "genzei_yuukoku",
    "安楽死制度を考える会": "anrakushi",
}


def main() -> None:
    if not IN_CSV.exists():
        raise FileNotFoundError(f"Input not found: {IN_CSV}")

    df = pd.read_csv(
        IN_CSV,
        dtype={
            "pref_code": str,
            "pref_name": str,
            "muni_code": str,
            "muni_name": str,
            "party_name": str,
        },
    )
    df["muni_code"] = df["muni_code"].astype(str).str.zfill(5)
    df["votes"] = pd.to_numeric(df["votes"], errors="coerce").fillna(0.0)
    df["valid_votes_muni"] = pd.to_numeric(
        df.get("valid_votes_muni"),
        errors="coerce",
    )

    muni_valid = (
        df.groupby("muni_code", as_index=False)["valid_votes_muni"]
        .max()
        .rename(columns={"valid_votes_muni": "valid_votes"})
    )
    vote_sum = (
        df.groupby("muni_code", as_index=False)["votes"]
        .sum()
        .rename(columns={"votes": "vote_sum"})
    )
    denom = muni_valid.merge(vote_sum, on="muni_code", how="outer")
    denom["valid_votes"] = denom["valid_votes"].fillna(denom["vote_sum"])
    denom["valid_votes"] = denom["valid_votes"].replace(0, pd.NA)

    df = df.merge(denom[["muni_code", "valid_votes"]], on="muni_code", how="left")
    df["vote_share"] = df["votes"] / df["valid_votes"]

    party_by_muni = (
        df.groupby(["muni_code", "party_name"], as_index=False)["votes"]
        .sum()
        .rename(columns={"votes": "party_votes"})
    )
    party_by_muni["party_code"] = party_by_muni["party_name"].map(PARTY_CODE_MAP)
    missing_codes = party_by_muni[party_by_muni["party_code"].isna()][
        "party_name"
    ].drop_duplicates()
    if not missing_codes.empty:
        missing = ", ".join(sorted(missing_codes.astype(str).tolist()))
        raise ValueError(f"Missing PARTY_CODE_MAP entries for: {missing}")
    party_by_muni = party_by_muni.merge(
        denom[["muni_code", "valid_votes"]],
        on="muni_code",
        how="left",
    )
    party_by_muni["vote_share"] = (
        party_by_muni["party_votes"] / party_by_muni["valid_votes"]
    )

    muni_meta = (
        df.groupby("muni_code", as_index=False)
        .agg(
            muni_name=("muni_name", "first"),
            pref_name=("pref_name", "first"),
        )
        .merge(denom[["muni_code", "valid_votes"]], on="muni_code", how="left")
    )

    party_dict = (
        party_by_muni.dropna(subset=["vote_share"])
        .groupby("muni_code")
        .apply(
            lambda g: {
                str(row["party_code"]): float(row["vote_share"])
                for _, row in g.iterrows()
            },
            include_groups=False,
        )
        .to_dict()
    )

    election_data = {}
    for _, row in muni_meta.iterrows():
        muni_code = str(row["muni_code"]).zfill(5)
        valid_votes = row["valid_votes"]
        election_data[muni_code] = {
            "name": row["muni_name"] if pd.notna(row["muni_name"]) else "",
            "pref": row["pref_name"] if pd.notna(row["pref_name"]) else "",
            "valid_votes": (
                int(valid_votes)
                if pd.notna(valid_votes)
                else None
            ),
            "parties": party_dict.get(muni_code, {}),
        }

    party_summary = (
        df.groupby("party_name", as_index=False)
        .agg(
            total_votes=("votes", "sum"),
            municipalities=("muni_code", lambda s: int(s[s.notna()].nunique())),
        )
        .sort_values("total_votes", ascending=False)
    )
    parties = [
        {
            "code": PARTY_CODE_MAP[str(row["party_name"])],
            "name": str(row["party_name"]),
            "total_votes": int(row["total_votes"]),
            "municipalities": int(row["municipalities"]),
        }
        for _, row in party_summary.iterrows()
    ]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_ELECTION.write_text(
        json.dumps(election_data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    OUT_PARTIES.write_text(
        json.dumps(parties, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(f"Saved {OUT_ELECTION} ({OUT_ELECTION.stat().st_size / 1024:.1f} KB)")
    print(f"Saved {OUT_PARTIES} ({OUT_PARTIES.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
