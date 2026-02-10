#!/usr/bin/env python3
"""Plot municipality-level census features on municipal polygons."""

from __future__ import annotations

import argparse
from pathlib import Path

import geopandas as gpd
import matplotlib.pyplot as plt
from matplotlib.cm import ScalarMappable
from matplotlib.colors import Colormap, Normalize
from matplotlib.font_manager import FontProperties
from matplotlib import font_manager
from matplotlib.ticker import PercentFormatter
import numpy as np
import pandas as pd


BASE = Path(__file__).resolve().parent.parent.parent
CENSUS_MUNI = BASE / "data" / "processed" / "census_muni.csv"
HIREI_MUNI = BASE / "data" / "processed" / "hirei_shikuchouson.csv"
MUNI_SHP = BASE / "data" / "raw" / "gis" / "N03_2025" / "N03-20250101.shp"
PREF_TURNOUT = (
    BASE / "data" / "raw" / "election" / "yukensha" / "r8_todofuken_yukensha.csv"
)
DEFAULT_OUT = BASE / "analysis" / "output" / "census_muni_map.png"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Plot a choropleth map using census_muni.csv and municipality shapefile."
    )
    parser.add_argument(
        "--column",
        default="party_vote_share",
        help=(
            "Metric to color-fill polygons. "
            "'voting_rate' uses prefecture turnout, "
            "'party_vote_share' uses hirei_shikuchouson.csv, "
            "other values read from census_muni.csv."
        ),
    )
    parser.add_argument(
        "--party",
        default="自由民主党",
        help="Party name for --column party_vote_share (default: 自由民主党).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Output image path (default: {DEFAULT_OUT}).",
    )
    parser.add_argument(
        "--figsize",
        type=float,
        nargs=2,
        metavar=("WIDTH", "HEIGHT"),
        default=(10, 10),
        help="Figure size in inches (default: 10 10).",
    )
    parser.add_argument(
        "--cmap",
        default="cmocean:ice_r",
        help="Colormap name (default: cmocean:ice_r).",
    )
    return parser.parse_args()


def load_geometries() -> gpd.GeoDataFrame:
    gdf = gpd.read_file(MUNI_SHP)
    gdf["muni_code"] = gdf["N03_007"].astype(str).str.zfill(5)
    gdf["pref_code"] = gdf["muni_code"].str[:2]
    gdf["muni_name"] = gdf["N03_004"].fillna("") + gdf["N03_005"].fillna("")
    gdf = gdf[["muni_code", "pref_code", "muni_name", "geometry"]]
    return gdf.dissolve(by="muni_code", as_index=False, aggfunc="first")


def load_census(column: str) -> pd.DataFrame:
    df = pd.read_csv(CENSUS_MUNI, dtype={"muni_code": str})
    if column not in df.columns:
        available = ", ".join(df.columns)
        raise ValueError(
            f"Column '{column}' not found in {CENSUS_MUNI}. Available: {available}"
        )
    df["muni_code"] = df["muni_code"].astype(str).str.zfill(5)
    return df[["muni_code", column]]


def load_pref_voting_rate() -> pd.DataFrame:
    df = pd.read_csv(PREF_TURNOUT, dtype={"pref_code": str})
    if "touhyou_rate" not in df.columns:
        raise ValueError(f"'touhyou_rate' not found in {PREF_TURNOUT}")
    df["pref_code"] = df["pref_code"].astype(str).str.zfill(2)
    out = df[["pref_code", "touhyou_rate"]].drop_duplicates()
    out = out.rename(columns={"touhyou_rate": "voting_rate"})
    return out


def load_party_vote_share(party_name: str) -> tuple[pd.DataFrame, float]:
    df = pd.read_csv(HIREI_MUNI, dtype={"muni_code": str})
    if "party_name" not in df.columns or "votes" not in df.columns:
        raise ValueError(f"Missing required columns in {HIREI_MUNI}")
    df["muni_code"] = df["muni_code"].astype(str).str.zfill(5)
    df["votes"] = pd.to_numeric(df["votes"], errors="coerce").fillna(0)
    df["valid_votes"] = pd.to_numeric(df.get("valid_votes"), errors="coerce")
    if "valid_votes_muni" in df.columns:
        df["valid_votes_muni"] = pd.to_numeric(df["valid_votes_muni"], errors="coerce")
    else:
        df["valid_votes_muni"] = np.nan

    # Municipality denominator:
    # prefer valid_votes_muni; then valid_votes; if missing, fallback to sum of party votes.
    muni_valid_muni = (
        df.groupby("muni_code", as_index=False)["valid_votes_muni"]
        .max()
        .rename(columns={"valid_votes_muni": "denom_valid_votes_muni"})
    )
    muni_valid = (
        df.groupby("muni_code", as_index=False)["valid_votes"]
        .max()
        .rename(columns={"valid_votes": "denom_valid_votes"})
    )
    muni_vote_sum = (
        df.groupby("muni_code", as_index=False)["votes"]
        .sum()
        .rename(columns={"votes": "denom_vote_sum"})
    )
    denom = muni_valid_muni.merge(muni_valid, on="muni_code", how="outer").merge(
        muni_vote_sum, on="muni_code", how="outer"
    )
    denom["denominator"] = denom["denom_valid_votes_muni"]
    denom["denominator"] = denom["denominator"].fillna(denom["denom_valid_votes"])
    denom["denominator"] = denom["denominator"].fillna(denom["denom_vote_sum"])
    denom["denominator"] = denom["denominator"].replace(0, np.nan)

    by_party = (
        df.groupby(["muni_code", "party_name"], as_index=False)["votes"]
        .sum()
        .rename(columns={"votes": "party_votes"})
    )
    shares = by_party.merge(
        denom[["muni_code", "denominator"]], on="muni_code", how="left"
    )
    shares["party_vote_share"] = shares["party_votes"] / shares["denominator"]
    out = shares[shares["party_name"] == party_name][
        ["muni_code", "party_vote_share"]
    ].copy()
    vmax_party = float(out["party_vote_share"].max(skipna=True))
    return out, vmax_party


def resolve_cmap(cmap_arg: str) -> str | Colormap:
    if cmap_arg not in {"cmocean:dense", "cmocean:ice_r"}:
        return cmap_arg
    try:
        import cmocean  # type: ignore

        if cmap_arg == "cmocean:ice_r":
            return cmocean.cm.ice_r
        return cmocean.cm.dense
    except ImportError:
        print("Warning: cmocean not installed. Falling back to 'viridis'.")
        return "viridis"


def get_noto_thin_bold() -> FontProperties:
    # Use Hiragino Sans bold for Japanese title text.
    fonts = font_manager.fontManager.ttflist
    for f in fonts:
        if f.name == "Hiragino Sans" and int(f.weight) >= 700:
            return FontProperties(family="Hiragino Sans", weight="bold")
    return FontProperties(family="Hiragino Sans", weight="bold")


def main() -> None:
    args = parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    plt.rcParams["font.family"] = "sans-serif"
    plt.rcParams["font.sans-serif"] = [
        "Hiragino Sans",
        "Yu Gothic",
        "Meiryo",
        "Noto Sans JP",
        "Noto Sans CJK JP",
        "DejaVu Sans",
    ]
    cmap = resolve_cmap(args.cmap)

    vmin: float | None = None
    vmax: float | None = None
    title = f"Japan Municipality Census Map: {args.column}"
    gdf = load_geometries()
    if args.column == "voting_rate":
        df = load_pref_voting_rate()
        merged = gdf.merge(df, on="pref_code", how="left")
    elif args.column == "party_vote_share":
        if not args.party:
            raise ValueError("Please set --party when using --column party_vote_share.")
        df, vmax_party = load_party_vote_share(args.party)
        merged = gdf.merge(df, on="muni_code", how="left")
        vmin = 0.0
        vmax = vmax_party
        if args.party in {"自由民主党", "自民党"}:
            title = "政党得票率(%): 自民党"
        else:
            title = f"政党得票率(%): {args.party}"
    else:
        df = load_census(args.column)
        merged = gdf.merge(df, on="muni_code", how="left")
    merged[args.column] = pd.to_numeric(merged[args.column], errors="coerce")

    matched = merged[args.column].notna().sum()
    print(f"Merged municipalities: {len(merged)}")
    print(f"Matched values for '{args.column}': {matched} / {len(merged)}")
    if matched == 0:
        raise ValueError(f"Column '{args.column}' has no plottable numeric values.")

    if vmin is None or vmax is None:
        # Clip extreme values so the map keeps contrast for most municipalities.
        valid = merged[args.column].dropna()
        vmin = float(np.nanpercentile(valid, 2))
        vmax = float(np.nanpercentile(valid, 98))
        if np.isclose(vmin, vmax):
            vmin = float(valid.min())
            vmax = float(valid.max())

    fig, ax = plt.subplots(figsize=args.figsize, facecolor="#fbfbf8")
    ax.set_facecolor("#fbfbf8")
    norm = Normalize(vmin=vmin, vmax=vmax)
    merged.plot(
        column=args.column,
        cmap=cmap,
        linewidth=0.08,
        edgecolor="#f4f4f4",
        missing_kwds={"color": "#bfbfbf", "label": "No data"},
        legend=False,
        vmin=vmin,
        vmax=vmax,
        ax=ax,
    )

    # Crop to Japan main extent to reduce empty canvas from remote outlying islands.
    if merged.crs is None or merged.crs.is_geographic:
        ax.set_xlim(122.0, 147.3)
        ax.set_ylim(24.0, 46.6)

    # Manual colorbar placement (red-box area in user mock).
    cax = fig.add_axes([0.82, 0.20, 0.020, 0.23])  # [left, bottom, width, height]
    sm = ScalarMappable(norm=norm, cmap=cmap)
    sm.set_array([])
    cb = fig.colorbar(sm, cax=cax)
    cb.ax.yaxis.set_major_formatter(PercentFormatter(xmax=1.0, decimals=0))
    cb.set_label(
        "得票率(%)", fontsize=12, fontfamily="Hiragino Sans", fontweight="normal"
    )
    for tick in cb.ax.get_yticklabels():
        tick.set_fontfamily("Helvetica")
        tick.set_fontweight("normal")
        tick.set_fontsize(10)

    ax.set_title(
        title,
        fontsize=90,
        pad=10,
        fontproperties=get_noto_thin_bold(),
    )
    ax.set_position([0.03, 0.05, 0.86, 0.88])
    ax.set_axis_off()
    fig.subplots_adjust(left=0, right=1, top=1, bottom=0)
    save_kwargs = {"bbox_inches": "tight"}
    if args.output.suffix.lower() != ".pdf":
        save_kwargs["dpi"] = 300
    fig.savefig(args.output, **save_kwargs)
    print(f"Saved: {args.output}")


if __name__ == "__main__":
    main()
