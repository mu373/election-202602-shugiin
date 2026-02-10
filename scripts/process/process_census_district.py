#!/usr/bin/env python3
"""選挙区別センサスデータの整形（国勢調査18表 → PCA用変数約21個）

入力: data/raw/census/senkyoku2022_toukei/*.csv（選挙区集計済み国勢調査）
      data/master/district_master.csv（選挙区マスター）
出力: data/processed/census_district.csv（289行 × 約25列）
"""

import sys
import pandas as pd
import numpy as np
from pathlib import Path

# --- Paths ---------------------------------------------------------------
BASE = Path(__file__).resolve().parent.parent.parent
RAW_CENSUS = BASE / "data" / "raw" / "census" / "senkyoku2022_toukei"
MASTER = BASE / "data" / "master" / "district_master.csv"
OUT = BASE / "data" / "processed" / "census_district.csv"


# --- Helper ---------------------------------------------------------------
def read_census(filename: str) -> pd.DataFrame:
    """Read a cp932-encoded census CSV and index by kucode."""
    path = RAW_CENSUS / filename
    df = pd.read_csv(path, encoding="cp932")
    df["kucode"] = df["kucode"].astype(int)
    return df.set_index("kucode")


# --- File map -------------------------------------------------------------
FILES = {
    "f02":  "02_人口総数_外国人人口_世帯数.csv",
    "f03a": "03_a_年齢別人口_男女計.csv",
    "f04a": "04_a_配偶関係別人口_男女計.csv",
    "f06a": "06_01_a_世帯の家族類型・世帯員の年齢による世帯の種類別一般世帯数_総数.csv",
    "f06b": "06_01_b_世帯の家族類型・世帯員の年齢による世帯の種類別一般世帯数_6歳未満世帯員のいる一般世帯.csv",
    "f06c": "06_01_c_世帯の家族類型・世帯員の年齢による世帯の種類別一般世帯数_18歳未満世帯員のいる一般世帯.csv",
    "f07":  "07_01_住宅の所有の関係別一般世帯数.csv",
    "f08":  "08_01_住宅の建て方別一般世帯数.csv",
    "f09c": "09_c_労働力状態別人口_女.csv",
    "f11a": "11_a_産業（大分類）別就業者数（15歳以上）_男女計.csv",
    "f13a": "13_a_在学か否かの別・最終卒業学校の種類別人口（15歳以上）_男女計.csv",
    "f14a": "14_a_在学学校・未就学の種類別人口_男女計.csv",
    "f16a": "16_01_a_従業地・通学地別就業者・通学者数（15歳以上）_男女計.csv",
}


def main():
    debug = "--debug" in sys.argv

    # --- Load all census files -------------------------------------------
    data = {}
    for alias, fname in FILES.items():
        df = read_census(fname)
        data[alias] = df
        if debug:
            print(f"[{alias}] {fname}")
            print(f"  shape: {df.shape}")
            print(f"  columns: {df.columns.tolist()}")
            print()

    # --- Build result DataFrame ------------------------------------------
    f02 = data["f02"]
    result = pd.DataFrame(index=f02.index)

    # ID columns
    result["kuname"] = f02["kuname"]
    result["pop_total"] = f02["人口_総数"]

    # A. 人口構造
    f03a = data["f03a"]
    result["pct_elderly_65"] = f03a["人口_（再掲）65歳以上"] / f02["人口_総数"]
    result["pct_child_under15"] = f03a["人口_（再掲）15歳未満"] / f02["人口_総数"]
    result["pct_child_under5"] = f03a["人口_0～4歳"] / f02["人口_総数"]
    result["pct_foreign"] = f02["外国人人口"] / f02["人口_総数"]

    # A2. チームみらい関連の人口構造
    result["pct_working_age_3044"] = (
        f03a["人口_30～34歳"] + f03a["人口_35～39歳"] + f03a["人口_40～44歳"]
    ) / f02["人口_総数"]

    # B. SES・経済
    f13a = data["f13a"]
    graduates_known = f13a["人口_卒業者"] - f13a["人口_（卒業者）不詳"]
    result["pct_college"] = (f13a["人口_（卒業者）大学"] + f13a["人口_（卒業者）大学院"]) / graduates_known

    f11a = data["f11a"]
    total_employed = f11a["就業者数_0_総数"]
    result["pct_primary_ind"] = f11a["就業者数_R1_（再掲）第1次産業"] / total_employed
    result["pct_tertiary_ind"] = f11a["就業者数_R3_（再掲）第3次産業"] / total_employed

    result["pct_secondary_ind"] = f11a["就業者数_R2_（再掲）第2次産業"] / total_employed
    result["pct_ict_industry"] = f11a["就業者数_G_情報通信業"] / total_employed

    f09c = data["f09c"]
    female_15plus_known = f09c["人口_総数"] - f09c["人口_労働力状態「不詳」"]
    result["female_labor_participation"] = f09c["人口_労働力人口"] / female_15plus_known

    # C. 住居・都市度
    f07 = data["f07"]
    result["pct_owner_occupied"] = f07["一般世帯数_持ち家"] / f07["一般世帯数_主世帯"]

    f08 = data["f08"]
    result["pct_apartment"] = f08["一般世帯数_共同住宅"] / f08["一般世帯数_うち主世帯"]

    f16a = data["f16a"]
    commuters_known = (f16a["就業者・通学者数_総数（常住地による人口）"]
                       - f16a["就業者・通学者数_従業地・通学地「不詳」"])
    result["pct_commute_other_pref"] = f16a["就業者・通学者数_他県で従業・通学"] / commuters_known

    # D. 世帯・家族構造
    f06a = data["f06a"]
    general_hh = f06a["一般世帯数_総数"]
    result["pct_single_hh"] = f06a["一般世帯数_単独世帯"] / general_hh
    result["avg_hh_size"] = f02["人口_総数"] / f02["世帯数"]

    f04a = data["f04a"]
    pop15plus_known = f04a["人口_総数"] - f04a["人口_配偶関係「不詳」"]
    result["pct_married"] = f04a["人口_有配偶"] / pop15plus_known

    # E. 子育て成分
    result["pct_nuclear_with_child"] = f06a["一般世帯数_うち夫婦と子供から成る世帯"] / general_hh
    # ひとり親 = 核家族 - 夫婦のみ - 夫婦と子
    single_parent = (f06a["一般世帯数_核家族世帯"]
                     - f06a["一般世帯数_うち夫婦のみの世帯"]
                     - f06a["一般世帯数_うち夫婦と子供から成る世帯"])
    result["pct_single_parent"] = single_parent / general_hh

    f06b = data["f06b"]
    result["pct_hh_with_child_under6"] = f06b["一般世帯数_総数"] / general_hh

    f06c = data["f06c"]
    result["pct_hh_with_child_under18"] = f06c["一般世帯数_総数"] / general_hh

    f14a = data["f14a"]
    nursery = f14a["人口_（未就学者）保育園・保育所"]
    kindergarten = f14a["人口_（未就学者）幼稚園"]
    result["nursery_ratio"] = nursery / (nursery + kindergarten)

    # --- Merge with district master --------------------------------------
    master = pd.read_csv(MASTER)
    master["kucode"] = master["district_code"].astype(int)
    master = master.set_index("kucode")

    result = result.join(master[["pref_code", "pref_name", "block_id", "block_name"]])

    # Reorder columns: ID first, then variables
    id_cols = ["kuname", "pref_code", "pref_name", "block_id", "block_name", "pop_total"]
    var_cols = [c for c in result.columns if c not in id_cols]
    result = result[id_cols + var_cols]
    result.index.name = "kucode"

    # --- Validation -------------------------------------------------------
    n_rows = len(result)
    print(f"Rows: {n_rows}")
    assert n_rows == 289, f"Expected 289 rows, got {n_rows}"

    # Check rate columns are in [0, 1]
    rate_cols = [c for c in result.columns if c.startswith("pct_") or c in
                 ("female_labor_participation", "nursery_ratio")]
    for col in rate_cols:
        lo, hi = result[col].min(), result[col].max()
        assert 0 <= lo and hi <= 1, f"{col} out of [0,1]: [{lo:.4f}, {hi:.4f}]"
        assert result[col].notna().all(), f"{col} has NaN values"

    assert result["avg_hh_size"].notna().all(), "avg_hh_size has NaN values"

    print(f"All {len(rate_cols)} rate columns in [0, 1]. No NaN detected.")

    # --- Save -------------------------------------------------------------
    OUT.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(OUT, encoding="utf-8")
    print(f"Saved: {OUT}")

    # --- Summary ----------------------------------------------------------
    print(f"\nColumns ({len(result.columns)}): {result.columns.tolist()}")
    print(f"\ndescribe():\n{result[rate_cols + ['avg_hh_size', 'pop_total']].describe().round(4)}")

    # Spot check: Tokyo-1 vs Akita-3
    for ku, label in [(1301, "東京1区"), (503, "秋田3区")]:
        if ku in result.index:
            row = result.loc[ku]
            print(f"\n{label} ({ku}):")
            for col in rate_cols[:6]:
                print(f"  {col}: {row[col]:.4f}")


if __name__ == "__main__":
    main()
