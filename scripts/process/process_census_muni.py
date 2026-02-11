#!/usr/bin/env python3
"""市区町村別センサス特徴量テーブルの作成（比例得票分析用）

「市区町村のすがた 2024」のxlsファイル＋令和2年国勢調査xlsxからPCA/回帰用の変数を構築する。
一部の変数は元データに無いため代理指標を使用（pct_apartment, pct_nuclear_with_child等）。

入力:
  data/raw/census/shikuchoson_sugata_2024/A〜J_*.xls
  data/raw/census/r2_kokusei_2020/education_11_2_gakureki.xlsx
  data/raw/census/r2_kokusei_2020/shikuchoson_main_results.xlsx
  data/raw/gis/N03_2025/N03-20250101.shp（浜松新区の面積計算用）
出力: data/processed/census_muni.csv（1,892行 × 24列）
"""

from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd

from muni_code_canonical import (
    HAMAMATSU_NEW_WARDS,
    HAMAMATSU_OLD_CODES,
    SEIREI_PARENT_CODES,
    load_canonical_codes,
)

BASE = Path(__file__).resolve().parent.parent.parent
RAW = BASE / "data" / "raw" / "census" / "shikuchoson_sugata_2024"
RAW_KOKUSEI = BASE / "data" / "raw" / "census" / "r2_kokusei_2020"
GIS_SHP = BASE / "data" / "raw" / "gis" / "N03_2025" / "N03-20250101.shp"
OUT = BASE / "data" / "processed" / "census_muni.csv"

FILES = {
    "a": RAW / "A_jinkou_setai.xls",
    "c": RAW / "C_keizai_kiban.xls",
    "f": RAW / "F_roudou.xls",
    "h": RAW / "H_kyojuu.xls",
    "j": RAW / "J_fukushi_shakaihoshou.xls",
}


def read_sugata_xls(path: Path) -> pd.DataFrame:
    """Read one 市区町村のすがた xls and return normalized table keyed by muni_code."""
    raw = pd.read_excel(path, sheet_name=0, header=None)
    labels = raw.iloc[5].tolist()
    codes = raw.iloc[7].tolist()

    name_col = None
    code_col = None
    for i, label in enumerate(labels):
        if isinstance(label, str) and label.strip() == "市区町村":
            name_col = i
        if isinstance(label, str) and "ｺｰﾄﾞ" in label:
            code_col = i

    if name_col is None or code_col is None:
        raise ValueError(f"Could not find municipality columns in {path}")

    data = raw.iloc[10:].copy()
    code_headers = [str(c).strip() if isinstance(c, str) else f"col_{i}" for i, c in enumerate(codes)]
    data.columns = code_headers

    data["muni_name"] = data.iloc[:, name_col]
    data["muni_code_raw"] = data.iloc[:, code_col]

    # Normalize municipality code and keep only municipality rows (5-digit code)
    data["muni_code"] = (
        data["muni_code_raw"]
        .astype(str)
        .str.strip()
        .str.replace(r"\.0$", "", regex=True)
        .str.extract(r"(\d+)", expand=False)
        .str.zfill(5)
    )
    data = data[data["muni_code"].str.len() == 5].copy()
    # Drop prefecture aggregate rows (xx000). Keep municipality/ward rows.
    code_num = pd.to_numeric(data["muni_code"], errors="coerce")
    data = data[code_num.mod(1000) != 0].copy()

    # Drop seirei parent codes (政令市の親コード合計行)
    data = data[~data["muni_code"].isin(SEIREI_PARENT_CODES)].copy()

    # Keep metric columns matching known prefixes
    metric_prefixes = ("A", "C", "F", "H", "J")
    keep_cols = ["muni_code", "muni_name"] + [c for c in data.columns if c.startswith(metric_prefixes)]
    out = data[keep_cols].copy()

    # Convert metric columns to numeric
    for col in out.columns:
        if col.startswith(metric_prefixes):
            out[col] = pd.to_numeric(out[col], errors="coerce")

    # Deduplicate (some files can include duplicate labels)
    out = out.drop_duplicates(subset=["muni_code"], keep="first")
    return out


def read_education_xlsx(path: Path) -> pd.DataFrame:
    """Read education_11_2_gakureki.xlsx and return pct_college and working-age pop by muni.

    Returns DataFrame with columns: muni_code, pct_college, pop_30_44
    """
    raw = pd.read_excel(path, sheet_name=0, header=None)
    # Data starts at row 10
    # Col 2: 地域名 (XXXXX_名前), Col 3: sex, Col 4: age
    # Col 5: total, Col 6: 卒業者, Col 11: 大学, Col 12: 大学院, Col 16: 不詳
    data = raw.iloc[10:].copy()
    data.columns = range(data.shape[1])

    # Extract muni_code from col 2 (format: "01100_札幌市")
    data["muni_code"] = data[2].astype(str).str.extract(r"^(\d{5})", expand=False)
    data = data[data["muni_code"].notna()].copy()
    # Drop prefecture aggregates (xx000)
    code_num = pd.to_numeric(data["muni_code"], errors="coerce")
    data = data[code_num.mod(1000) != 0].copy()

    # Drop seirei parent codes
    data = data[~data["muni_code"].isin(SEIREI_PARENT_CODES)].copy()

    data["sex"] = data[3].astype(str)
    data["age"] = data[4].astype(str)
    for c in [5, 6, 11, 12, 16]:
        data[c] = pd.to_numeric(data[c], errors="coerce")

    # --- pct_college: filter sex=総数, age=総数 ---
    total_mask = data["sex"].str.contains("0_総数") & data["age"].str.contains("00_総数")
    edu_total = data[total_mask][["muni_code", 5, 6, 11, 12, 16]].copy()
    edu_total.columns = ["muni_code", "pop15plus", "graduates", "univ", "grad_school", "unknown"]

    # --- working age 30-44: filter sex=総数, age bands ---
    age_mask = data["sex"].str.contains("0_総数") & data["age"].isin([
        "04_30～34歳", "05_35～39歳", "06_40～44歳",
    ])
    age_data = data[age_mask][["muni_code", "age", 5]].copy()
    age_data.columns = ["muni_code", "age", "pop"]
    age_pivot = age_data.groupby("muni_code")["pop"].sum().reset_index()
    age_pivot.columns = ["muni_code", "pop_30_44"]

    result = edu_total[["muni_code", "pop15plus", "graduates", "univ", "grad_school", "unknown"]].merge(
        age_pivot, on="muni_code", how="outer"
    )
    return result.drop_duplicates(subset=["muni_code"], keep="first")


def read_main_results_xlsx(path: Path) -> pd.DataFrame:
    """Read shikuchoson_main_results.xlsx and return raw HH counts + pop for density.

    Column mapping (0-indexed):
      1: muni name (XXXXX_名前)
      4: pop_total (for density calc)
      37: 一般世帯 (general HH, denominator)
      44: 男親と子供 HH
      45: 女親と子供 HH
    """
    raw = pd.read_excel(path, sheet_name=0, header=None)
    # Data starts at row 9
    data = raw.iloc[9:].copy()
    data.columns = range(data.shape[1])

    # Extract muni_code from col 1 (format: "01100_札幌市")
    data["muni_code"] = data[1].astype(str).str.extract(r"^(\d{5})", expand=False)
    data = data[data["muni_code"].notna()].copy()
    code_num = pd.to_numeric(data["muni_code"], errors="coerce")
    data = data[code_num.mod(1000) != 0].copy()

    # Drop seirei parent codes
    data = data[~data["muni_code"].isin(SEIREI_PARENT_CODES)].copy()

    result = pd.DataFrame()
    result["muni_code"] = data["muni_code"].values
    result["ippan_hh"] = pd.to_numeric(data[37], errors="coerce").values
    result["male_parent_hh"] = pd.to_numeric(data[44], errors="coerce").values
    result["female_parent_hh"] = pd.to_numeric(data[45], errors="coerce").values

    return result.drop_duplicates(subset=["muni_code"], keep="first")


def _aggregate_hamamatsu(df: pd.DataFrame, metric_prefixes: tuple[str, ...]) -> pd.DataFrame:
    """旧浜松7区を新3区に集約（raw metric columns ベース）。

    count系カラム（metric_prefixes に合致）を合算。
    partial 割当（旧北区）は按分比で加算する。
    """
    old_rows = df[df["muni_code"].isin(HAMAMATSU_OLD_CODES)]
    if old_rows.empty:
        return df

    metric_cols = [c for c in df.columns if c.startswith(metric_prefixes)]
    new_rows = []

    for new_code, spec in HAMAMATSU_NEW_WARDS.items():
        row = {"muni_code": new_code, "muni_name": spec["name"]}

        # Sum full-assignment wards
        full_mask = old_rows["muni_code"].isin(spec["full"])
        sums = old_rows.loc[full_mask, metric_cols].sum()

        # Add partial (按分) wards
        for partial_code, ratio in spec["partial"].items():
            partial_mask = old_rows["muni_code"] == partial_code
            partial_vals = old_rows.loc[partial_mask, metric_cols]
            if not partial_vals.empty:
                sums = sums + partial_vals.iloc[0] * ratio

        for col in metric_cols:
            row[col] = sums[col]

        new_rows.append(row)

    # Remove old wards + parent code (22130)
    drop_codes = HAMAMATSU_OLD_CODES | {"22130"}
    df = df[~df["muni_code"].isin(drop_codes)].copy()
    df = pd.concat([df, pd.DataFrame(new_rows)], ignore_index=True)
    return df


def _aggregate_hamamatsu_edu(df: pd.DataFrame) -> pd.DataFrame:
    """浜松旧区→新区の集約（education data: raw counts）."""
    old_rows = df[df["muni_code"].isin(HAMAMATSU_OLD_CODES)]
    if old_rows.empty:
        return df

    count_cols = ["pop15plus", "graduates", "univ", "grad_school", "unknown", "pop_30_44"]
    count_cols = [c for c in count_cols if c in df.columns]
    new_rows = []

    for new_code, spec in HAMAMATSU_NEW_WARDS.items():
        row = {"muni_code": new_code}
        full_mask = old_rows["muni_code"].isin(spec["full"])
        sums = old_rows.loc[full_mask, count_cols].sum()
        for partial_code, ratio in spec["partial"].items():
            partial_mask = old_rows["muni_code"] == partial_code
            partial_vals = old_rows.loc[partial_mask, count_cols]
            if not partial_vals.empty:
                sums = sums + partial_vals.iloc[0] * ratio
        for col in count_cols:
            row[col] = sums[col]
        new_rows.append(row)

    drop_codes = HAMAMATSU_OLD_CODES | {"22130"}
    df = df[~df["muni_code"].isin(drop_codes)].copy()
    df = pd.concat([df, pd.DataFrame(new_rows)], ignore_index=True)
    return df


def _aggregate_hamamatsu_main(df: pd.DataFrame) -> pd.DataFrame:
    """浜松旧区→新区の集約（main results: raw HH counts）."""
    old_rows = df[df["muni_code"].isin(HAMAMATSU_OLD_CODES)]
    if old_rows.empty:
        return df

    count_cols = ["ippan_hh", "male_parent_hh", "female_parent_hh"]
    new_rows = []

    for new_code, spec in HAMAMATSU_NEW_WARDS.items():
        row = {"muni_code": new_code}
        full_mask = old_rows["muni_code"].isin(spec["full"])
        sums = old_rows.loc[full_mask, count_cols].sum()
        for partial_code, ratio in spec["partial"].items():
            partial_mask = old_rows["muni_code"] == partial_code
            partial_vals = old_rows.loc[partial_mask, count_cols]
            if not partial_vals.empty:
                sums = sums + partial_vals.iloc[0] * ratio
        for col in count_cols:
            row[col] = sums[col]
        new_rows.append(row)

    drop_codes = HAMAMATSU_OLD_CODES | {"22130"}
    df = df[~df["muni_code"].isin(drop_codes)].copy()
    df = pd.concat([df, pd.DataFrame(new_rows)], ignore_index=True)
    return df


def _compute_hamamatsu_pop_density(pop_series: pd.Series, muni_codes: pd.Series) -> pd.Series:
    """GIS シェープファイルから浜松新区の面積を計算し pop_density を設定。

    浜松新区以外の pop_density は NaN のまま返す（後続で df_main から取得）。
    """
    hamamatsu_new = {"22138", "22139", "22140"}
    mask = muni_codes.isin(hamamatsu_new)
    if not mask.any():
        return pd.Series(np.nan, index=muni_codes.index)

    gdf = gpd.read_file(GIS_SHP)
    gdf["muni_code"] = gdf["N03_007"]
    gdf_h = gdf[gdf["muni_code"].isin(hamamatsu_new)].copy()
    # Project to JGD2011 / UTM zone 54 for area calculation (meters)
    gdf_h = gdf_h.to_crs(epsg=6690)
    area_km2 = gdf_h.dissolve(by="muni_code")["geometry"].area / 1e6

    density = pd.Series(np.nan, index=muni_codes.index)
    for idx in muni_codes.index:
        code = muni_codes.loc[idx]
        if code in area_km2.index:
            pop = pop_series.loc[idx]
            if pd.notna(pop) and area_km2[code] > 0:
                density.loc[idx] = pop / area_km2[code]
    return density


def safe_div(num: pd.Series, den: pd.Series) -> pd.Series:
    den = den.replace(0, np.nan)
    return num / den


def main() -> None:
    # --- Read sugata xls files ---
    df_a = read_sugata_xls(FILES["a"])
    df_c = read_sugata_xls(FILES["c"])
    df_f = read_sugata_xls(FILES["f"])
    df_h = read_sugata_xls(FILES["h"])
    df_j = read_sugata_xls(FILES["j"])

    # --- Aggregate Hamamatsu old wards → new wards (raw metrics) ---
    df_a = _aggregate_hamamatsu(df_a, ("A",))
    df_c = _aggregate_hamamatsu(df_c, ("C",))
    df_f = _aggregate_hamamatsu(df_f, ("F",))
    df_h = _aggregate_hamamatsu(df_h, ("H",))
    df_j = _aggregate_hamamatsu(df_j, ("J",))

    df = df_a.merge(df_c.drop(columns=["muni_name"]), on="muni_code", how="left")
    df = df.merge(df_f.drop(columns=["muni_name"]), on="muni_code", how="left")
    df = df.merge(df_h.drop(columns=["muni_name"]), on="muni_code", how="left")
    df = df.merge(df_j.drop(columns=["muni_name"]), on="muni_code", how="left")

    # --- Read kokusei 2020 xlsx files ---
    df_edu = read_education_xlsx(RAW_KOKUSEI / "education_11_2_gakureki.xlsx")
    df_edu = _aggregate_hamamatsu_edu(df_edu)

    df_main = read_main_results_xlsx(RAW_KOKUSEI / "shikuchoson_main_results.xlsx")
    df_main = _aggregate_hamamatsu_main(df_main)

    out = pd.DataFrame()
    out["muni_code"] = df["muni_code"]
    out["muni_name"] = df["muni_name"].astype(str).str.strip()
    out["pref_code"] = out["muni_code"].str[:2]
    out = out[out["pref_code"] != "00"].copy()

    # Core size columns
    out["pop_total"] = df["A1101"]
    out["n_hh_total"] = df["A7101"]

    # --- Keep district-style feature names for downstream compatibility ---
    out["pct_elderly_65"] = safe_div(df["A1303"], df["A1101"])
    out["pct_child_under15"] = safe_div(df["A1301"], df["A1101"])
    out["pct_child_under5"] = np.nan  # collinear with pct_child_under15, skip
    out["pct_foreign"] = safe_div(df["A1700"], df["A1101"])

    # pct_college from education file (compute from raw counts after aggregation)
    edu_merged = df_edu[["muni_code", "graduates", "univ", "grad_school", "unknown", "pop_30_44"]].copy()
    edu_denom = edu_merged["graduates"] - edu_merged["unknown"].fillna(0)
    edu_denom = edu_denom.replace(0, np.nan)
    edu_merged["pct_college"] = (edu_merged["univ"].fillna(0) + edu_merged["grad_school"].fillna(0)) / edu_denom

    out = out.merge(edu_merged[["muni_code", "pct_college", "pop_30_44"]], on="muni_code", how="left")
    out["pct_working_age_3044"] = safe_div(out["pop_30_44"], out["pop_total"])
    out.drop(columns=["pop_30_44"], inplace=True)

    out["pct_primary_ind"] = safe_div(df["F2201"], df["F1102"])
    out["pct_tertiary_ind"] = safe_div(df["F2221"], df["F1102"])
    out["pct_secondary_ind"] = (1.0 - out["pct_primary_ind"].fillna(0) - out["pct_tertiary_ind"].fillna(0)).clip(0, 1)
    # Set pct_secondary_ind to NaN where both components are NaN
    both_na = out["pct_primary_ind"].isna() & out["pct_tertiary_ind"].isna()
    out.loc[both_na, "pct_secondary_ind"] = np.nan

    out["pct_ict_industry"] = np.nan  # industry G ratio unavailable here
    out["female_labor_participation"] = np.nan  # sex-split labor not in these tables

    out["pct_owner_occupied"] = safe_div(df["H1310"], df["H1101"])
    # proxy: rental-house share (not strictly apartment share)
    out["pct_apartment"] = safe_div(df["H1320"], df["H1101"])
    # proxy: inter-municipality commuting share (not strictly other-prefecture share)
    out["pct_commute_other_pref"] = safe_div(df["F2705"], df["F1102"])

    out["pct_single_hh"] = safe_div(df["A810105"], df["A710101"])
    out["avg_hh_size"] = safe_div(df["A1101"], df["A7101"])
    out["pct_married"] = np.nan  # marital-status distribution unavailable

    # proxy: nuclear-family share (not specifically with children)
    out["pct_nuclear_with_child"] = safe_div(df["A810102"], df["A710101"])

    # pct_single_parent from main results (compute from raw counts after aggregation)
    main_merged = df_main[["muni_code", "ippan_hh", "male_parent_hh", "female_parent_hh"]].copy()
    main_denom = main_merged["ippan_hh"].replace(0, np.nan)
    main_merged["pct_single_parent"] = (
        (main_merged["male_parent_hh"].fillna(0) + main_merged["female_parent_hh"].fillna(0)) / main_denom
    )
    out = out.merge(main_merged[["muni_code", "pct_single_parent"]], on="muni_code", how="left")

    # pop_density: use main_results for most munis, GIS area for Hamamatsu new wards
    # (main_results has old wards which are now removed, so Hamamatsu needs GIS calc)
    df_main_density = read_main_results_density()
    out = out.merge(df_main_density[["muni_code", "pop_density"]], on="muni_code", how="left")

    # Compute and override Hamamatsu new wards with GIS-computed density
    hamamatsu_density = _compute_hamamatsu_pop_density(out["pop_total"], out["muni_code"])
    hamamatsu_mask = out["muni_code"].isin({"22138", "22139", "22140"})
    out.loc[hamamatsu_mask, "pop_density"] = hamamatsu_density.loc[hamamatsu_mask].values

    out["pct_hh_with_child_under6"] = np.nan
    out["pct_hh_with_child_under18"] = np.nan
    out["nursery_ratio"] = np.nan

    # taxable_income_per_capita from C_keizai_kiban.xls
    out["taxable_income_per_capita"] = safe_div(df["C120110"], df["C120120"])

    # --- Canonical codes validation ---
    try:
        canonical = load_canonical_codes()
        census_codes = set(out["muni_code"])
        missing = canonical - census_codes
        extra = census_codes - canonical
        if missing:
            print(f"WARNING: {len(missing)} codes in canonical but not in census: "
                  f"{sorted(missing)[:10]}{'...' if len(missing) > 10 else ''}")
        if extra:
            print(f"WARNING: {len(extra)} codes in census but not in canonical: "
                  f"{sorted(extra)[:10]}{'...' if len(extra) > 10 else ''}")
        if not missing and not extra:
            print(f"OK: census codes match canonical set ({len(canonical)} codes)")
    except FileNotFoundError:
        print("NOTE: adj_muni_nodes.csv not found, skipping canonical validation")

    # Diagnostics: how many are populated per feature
    feature_cols = [c for c in out.columns if c.startswith("pct_") or c in (
        "female_labor_participation", "nursery_ratio", "avg_hh_size",
        "pop_density", "taxable_income_per_capita",
    )]
    coverage = out[feature_cols].notna().mean().sort_values(ascending=False)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT, index=False, encoding="utf-8")

    print(f"Saved: {OUT}")
    print(f"Rows: {len(out)} municipalities")
    print(f"Columns: {len(out.columns)}")
    print("\nFeature non-null coverage:")
    for col, ratio in coverage.items():
        print(f"  {col:35s} {ratio:6.3f}")


def read_main_results_density() -> pd.DataFrame:
    """Read pop_density from main_results, excluding seirei parents and old Hamamatsu wards."""
    raw = pd.read_excel(RAW_KOKUSEI / "shikuchoson_main_results.xlsx", sheet_name=0, header=None)
    data = raw.iloc[9:].copy()
    data.columns = range(data.shape[1])
    data["muni_code"] = data[1].astype(str).str.extract(r"^(\d{5})", expand=False)
    data = data[data["muni_code"].notna()].copy()
    code_num = pd.to_numeric(data["muni_code"], errors="coerce")
    data = data[code_num.mod(1000) != 0].copy()
    data = data[~data["muni_code"].isin(SEIREI_PARENT_CODES)].copy()

    result = pd.DataFrame()
    result["muni_code"] = data["muni_code"].values
    result["pop_density"] = pd.to_numeric(data[11], errors="coerce").values
    return result.drop_duplicates(subset=["muni_code"], keep="first")


if __name__ == "__main__":
    main()
