#!/usr/bin/env python3
"""Build GeoJSON layers for municipalities, prefectures, and blocks."""

from __future__ import annotations

import argparse
from pathlib import Path

import geopandas as gpd
import pandas as pd
import shapely
from shapely.geometry.base import BaseGeometry


BASE = Path(__file__).resolve().parent.parent.parent
MUNI_GEOJSON = BASE / "data" / "raw" / "gis" / "N03_2025" / "N03-20250101.geojson"
PREF_SHP = BASE / "data" / "raw" / "gis" / "N03_2025" / "N03-20250101_prefecture.shp"
MASTER = BASE / "data" / "master" / "district_master.csv"
OUT_MUNI = BASE / "web" / "data" / "municipalities.geojson"
OUT_PREF = BASE / "web" / "data" / "prefectures.geojson"
OUT_BLOCK = BASE / "web" / "data" / "blocks.geojson"
GRID_SIZE = 0.002
MUNI_MAX_BYTES = 5 * 1024 * 1024
EQUAL_AREA_CRS = "EPSG:6933"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build GeoJSON layers for municipalities, prefectures, and blocks."
    )
    parser.add_argument(
        "--output",
        nargs="+",
        choices=("municipalities", "prefectures", "blocks"),
        default=["municipalities", "prefectures", "blocks"],
        help=(
            "Which outputs to write. "
            "Use one or more of: municipalities prefectures blocks "
            "(default: municipalities prefectures blocks)."
        ),
    )
    return parser.parse_args()


def write_compact_geojson(gdf: gpd.GeoDataFrame, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(gdf.to_json(drop_id=True), encoding="utf-8")


def largest_component_index(geom: BaseGeometry | None) -> int:
    if geom is None:
        return -1
    if geom.geom_type == "Polygon":
        return 0
    if geom.geom_type != "MultiPolygon":
        return -1
    parts = list(geom.geoms)
    if not parts:
        return -1
    best_idx = 0
    best_area = -1.0
    for i, g in enumerate(parts):
        if g.area > best_area:
            best_area = g.area
            best_idx = i
    return best_idx


def largest_component(geom: BaseGeometry | None) -> BaseGeometry | None:
    if geom is None:
        return None
    if geom.geom_type == "Polygon":
        return geom
    if geom.geom_type == "MultiPolygon":
        parts = list(geom.geoms)
        if not parts:
            return None
        return max(parts, key=lambda g: g.area)
    return geom


def with_geometry_metadata(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    out = gdf.copy()
    out["main_component_index"] = out.geometry.apply(largest_component_index).astype(int)
    largest = out.geometry.apply(largest_component)

    # Precompute label anchor on the largest component.
    rep = largest.apply(lambda g: g.representative_point() if g is not None else None)
    out["label_lng"] = rep.apply(lambda p: float(p.x) if p is not None else None)
    out["label_lat"] = rep.apply(lambda p: float(p.y) if p is not None else None)

    # Precompute approximate areas in km^2 using an equal-area projection.
    if out.crs is None:
        out = out.set_crs("EPSG:4326")
        largest_gs = gpd.GeoSeries(largest, crs="EPSG:4326")
    else:
        largest_gs = gpd.GeoSeries(largest, crs=out.crs)

    out["area_km2"] = (
        out.to_crs(EQUAL_AREA_CRS).geometry.area / 1_000_000
    ).round(3)
    out["main_area_km2"] = (
        largest_gs.to_crs(EQUAL_AREA_CRS).area / 1_000_000
    ).round(3)
    return out


def build_municipalities() -> gpd.GeoDataFrame:
    gdf = gpd.read_file(MUNI_GEOJSON)
    gdf["muni_code"] = gdf["N03_007"].astype(str).str.zfill(5)
    gdf["muni_name"] = gdf["N03_004"].fillna("") + gdf["N03_005"].fillna("")
    gdf["pref_name"] = gdf["N03_001"].fillna("")
    gdf = gdf[["muni_code", "muni_name", "pref_name", "geometry"]]
    return gdf.dissolve(by="muni_code", as_index=False, aggfunc="first")


def write_municipalities(gdf: gpd.GeoDataFrame) -> None:
    simplified = gdf.copy()
    simplified["geometry"] = simplified.geometry.simplify(
        tolerance=0.001,
        preserve_topology=True,
    )
    write_compact_geojson(with_geometry_metadata(simplified), OUT_MUNI)
    size = OUT_MUNI.stat().st_size
    print(f"Saved {OUT_MUNI} with tolerance=0.001 ({size / 1024 / 1024:.2f} MB)")
    if size <= MUNI_MAX_BYTES:
        return

    simplified = gdf.copy()
    simplified["geometry"] = simplified.geometry.simplify(
        tolerance=0.002,
        preserve_topology=True,
    )
    write_compact_geojson(with_geometry_metadata(simplified), OUT_MUNI)
    size = OUT_MUNI.stat().st_size
    print(
        f"Output exceeded 5MB, rewrote with tolerance=0.002 "
        f"({size / 1024 / 1024:.2f} MB)"
    )
    if size <= MUNI_MAX_BYTES:
        return

    grid = 0.0005
    snapped = gdf.copy()
    snapped["geometry"] = shapely.set_precision(snapped.geometry.values, grid)
    snapped["geometry"] = snapped.geometry.simplify(
        tolerance=0.002,
        preserve_topology=True,
    )
    write_compact_geojson(with_geometry_metadata(snapped), OUT_MUNI)
    size = OUT_MUNI.stat().st_size
    print(
        f"Applied precision grid={grid} + tolerance=0.002 "
        f"({size / 1024 / 1024:.2f} MB)"
    )


def main() -> None:
    args = parse_args()
    outputs = set(args.output)

    if "municipalities" in outputs:
        if not MUNI_GEOJSON.exists():
            raise FileNotFoundError(f"Missing input: {MUNI_GEOJSON}")
        muni = build_municipalities()
        write_municipalities(muni)

    if "prefectures" in outputs or "blocks" in outputs:
        if not PREF_SHP.exists():
            raise FileNotFoundError(f"Missing input: {PREF_SHP}")
        if not MASTER.exists():
            raise FileNotFoundError(f"Missing input: {MASTER}")

        pref_src = gpd.read_file(PREF_SHP)
        pref_src["pref_code"] = (
            pref_src["N03_007"].astype(str).str.slice(0, 2).str.zfill(2)
        )
        pref_src["pref_name"] = pref_src["N03_001"].fillna("")
        pref_src = pref_src[["pref_code", "pref_name", "geometry"]]
        pref_src = pref_src.dissolve(by="pref_code", as_index=False, aggfunc="first")

        master = pd.read_csv(MASTER, dtype={"pref_code": str, "block_id": str})
        pref_block = (
            master[["pref_code", "block_id", "block_name"]]
            .drop_duplicates(subset=["pref_code"])
            .copy()
        )
        pref_block["pref_code"] = pref_block["pref_code"].astype(str).str.zfill(2)
        pref_block["block_id"] = pref_block["block_id"].astype(str)

        pref = pref_src.merge(pref_block, on="pref_code", how="left")
        pref = pref[["pref_code", "pref_name", "block_id", "block_name", "geometry"]]
        pref["geometry"] = shapely.set_precision(pref.geometry.values, GRID_SIZE)

        block = pref[["block_id", "block_name", "geometry"]].dissolve(
            by="block_id",
            as_index=False,
            aggfunc="first",
        )
        block = block[["block_id", "block_name", "geometry"]]
        block["geometry"] = shapely.set_precision(block.geometry.values, GRID_SIZE)

        if "prefectures" in outputs:
            write_compact_geojson(with_geometry_metadata(pref), OUT_PREF)
            print(f"Saved {OUT_PREF} ({OUT_PREF.stat().st_size / 1024:.1f} KB)")
        if "blocks" in outputs:
            write_compact_geojson(with_geometry_metadata(block), OUT_BLOCK)
            print(f"Saved {OUT_BLOCK} ({OUT_BLOCK.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
