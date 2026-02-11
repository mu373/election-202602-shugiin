#!/usr/bin/env python3
"""空間隣接行列の構築（Queen contiguity）

入力: data/raw/gis/senkyoku2022/senkyoku2022.shp（選挙区ポリゴン）
      data/raw/gis/N03_2025/N03-20250101.shp（市区町村ポリゴン）
出力: data/processed/adj_district.npz + adj_district_nodes.csv（選挙区隣接行列）
      data/processed/adj_muni.npz + adj_muni_nodes.csv（市区町村隣接行列）
      data/processed/adj_pref.npz + adj_pref_nodes.csv（都道府県隣接行列）
      data/processed/adj_block.npz + adj_block_nodes.csv（比例ブロック隣接行列）
"""

import argparse
import time
import numpy as np
import pandas as pd
import geopandas as gpd
from scipy import sparse
from libpysal.weights import Queen
from pathlib import Path

from muni_code_canonical import EXCLUDE_CODES

BASE = Path(__file__).resolve().parent.parent.parent
GIS = BASE / "data" / "raw" / "gis"
OUT = BASE / "data" / "processed"
DISTRICT_MASTER = BASE / "data" / "master" / "district_master.csv"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build Queen adjacency matrices.")
    p.add_argument(
        "--type",
        choices=["all", "district", "muni", "pref", "block"],
        default="all",
        help="Which adjacency to build (default: all)",
    )
    return p.parse_args()


def build_district_adjacency():
    """Build Queen contiguity for 289 electoral districts."""
    print("=" * 60)
    print("Electoral district adjacency (289 units)")
    print("=" * 60)

    t0 = time.time()
    shp = GIS / "senkyoku2022" / "senkyoku2022.shp"
    print(f"Reading: {shp.name}")
    gdf = gpd.read_file(shp)
    print(f"  Raw polygons: {len(gdf):,}")
    print(f"  CRS: {gdf.crs}")

    # Dissolve multipart polygons into one per district
    print("Dissolving by kucode...")
    gdf_dissolved = gdf.dissolve(by="kucode", as_index=False)
    gdf_dissolved = gdf_dissolved.sort_values("kucode").reset_index(drop=True)
    n = len(gdf_dissolved)
    print(f"  Dissolved: {n} districts")
    assert n == 289, f"Expected 289 districts, got {n}"

    # Build Queen contiguity
    print("Computing Queen contiguity...")
    w = Queen.from_dataframe(gdf_dissolved, use_index=False)
    print(f"  Neighbors: min={w.min_neighbors}, max={w.max_neighbors}, "
          f"mean={w.mean_neighbors:.1f}")

    # Check connectivity
    component_labels = w.component_labels
    n_components = len(set(component_labels))
    print(f"  Connected components: {n_components}")
    if n_components > 1:
        comp_sizes = pd.Series(component_labels).value_counts().sort_index()
        for comp_id, size in comp_sizes.items():
            districts = gdf_dissolved.loc[
                [i for i, c in enumerate(component_labels) if c == comp_id],
                "kuname"
            ].tolist()
            if size <= 10:
                print(f"    Component {comp_id} ({size}): {', '.join(districts)}")
            else:
                print(f"    Component {comp_id} ({size}): {districts[0]}...{districts[-1]}")

    # Save sparse matrix
    W_sparse = w.sparse.tocsr()
    sparse.save_npz(OUT / "adj_district.npz", W_sparse)
    print(f"  Saved: adj_district.npz ({W_sparse.nnz} nonzeros)")

    # Save node mapping
    nodes = gdf_dissolved[["kucode", "kuname"]].copy()
    nodes.index.name = "idx"
    nodes.to_csv(OUT / "adj_district_nodes.csv", encoding="utf-8")
    print(f"  Saved: adj_district_nodes.csv")

    # Spot checks
    print(f"\nSpot checks:")
    name_to_idx = {row["kuname"]: i for i, row in nodes.iterrows()}
    for name in ["東京1区", "大阪1区", "北海道1区", "沖縄1区"]:
        if name in name_to_idx:
            idx = name_to_idx[name]
            neighbors = [gdf_dissolved.loc[j, "kuname"] for j in w.neighbors[idx]]
            print(f"  {name} ({w.cardinalities[idx]} neighbors): {', '.join(neighbors)}")

    print(f"  Elapsed: {time.time() - t0:.1f}s")
    return W_sparse, nodes


def build_muni_adjacency():
    """Build Queen contiguity for municipalities."""
    print()
    print("=" * 60)
    print("Municipality adjacency")
    print("=" * 60)

    t0 = time.time()
    shp = GIS / "N03_2025" / "N03-20250101.shp"
    print(f"Reading: {shp.name} (this may take a minute...)")
    gdf = gpd.read_file(shp)
    print(f"  Raw polygons: {len(gdf):,}")
    print(f"  CRS: {gdf.crs}")

    # N03_007 = 5-digit municipality code (without check digit)
    # Build display name: pref + city/ward name
    gdf["muni_code"] = gdf["N03_007"]
    gdf["muni_name"] = (
        gdf["N03_004"].fillna("") + gdf["N03_005"].fillna("")
    )
    gdf["pref_name"] = gdf["N03_001"].fillna("")

    # Dissolve by muni_code
    print("Dissolving by muni_code...")
    gdf_dissolved = gdf.dissolve(by="muni_code", as_index=False, aggfunc="first")
    gdf_dissolved = gdf_dissolved.sort_values("muni_code").reset_index(drop=True)
    n_raw = len(gdf_dissolved)
    print(f"  Dissolved: {n_raw} municipalities")

    # Remove excluded codes (所属未定地 + 北方領土)
    gdf_dissolved = gdf_dissolved[~gdf_dissolved["muni_code"].isin(EXCLUDE_CODES)].copy()
    gdf_dissolved = gdf_dissolved.reset_index(drop=True)
    n = len(gdf_dissolved)
    print(f"  After excluding {n_raw - n} codes: {n} municipalities")

    # Build Queen contiguity
    print("Computing Queen contiguity (this may take a moment)...")
    w = Queen.from_dataframe(gdf_dissolved, use_index=False)
    print(f"  Neighbors: min={w.min_neighbors}, max={w.max_neighbors}, "
          f"mean={w.mean_neighbors:.1f}")

    # Check connectivity
    component_labels = w.component_labels
    n_components = len(set(component_labels))
    print(f"  Connected components: {n_components}")
    if n_components > 1:
        comp_sizes = pd.Series(component_labels).value_counts()
        mainland = comp_sizes.max()
        islands = n_components - 1
        print(f"    Mainland component: {mainland} municipalities")
        print(f"    Island components: {islands}")
        # Show isolated nodes (no neighbors)
        isolated = [i for i in range(n) if w.cardinalities[i] == 0]
        if isolated:
            names = [gdf_dissolved.loc[i, "muni_name"] for i in isolated[:10]]
            print(f"    Isolated ({len(isolated)}): {', '.join(names)}"
                  + ("..." if len(isolated) > 10 else ""))

    # Save sparse matrix
    W_sparse = w.sparse.tocsr()
    sparse.save_npz(OUT / "adj_muni.npz", W_sparse)
    print(f"  Saved: adj_muni.npz ({W_sparse.nnz} nonzeros)")

    # Save node mapping
    nodes = gdf_dissolved[["muni_code", "muni_name", "pref_name"]].copy()
    nodes.index.name = "idx"
    nodes.to_csv(OUT / "adj_muni_nodes.csv", encoding="utf-8")
    print(f"  Saved: adj_muni_nodes.csv")

    # Spot checks
    print(f"\nSpot checks:")
    name_to_idx = {}
    for i, row in nodes.iterrows():
        name_to_idx[row["pref_name"] + row["muni_name"]] = i
    for name in ["東京都千代田区", "大阪府大阪市北区", "北海道札幌市中央区"]:
        if name in name_to_idx:
            idx = name_to_idx[name]
            n_neighbors = w.cardinalities[idx]
            neighbor_names = [
                gdf_dissolved.loc[j, "muni_name"] for j in list(w.neighbors[idx])[:8]
            ]
            suffix = "..." if n_neighbors > 8 else ""
            print(f"  {name} ({n_neighbors} neighbors): {', '.join(neighbor_names)}{suffix}")

    print(f"  Elapsed: {time.time() - t0:.1f}s")
    return W_sparse, nodes


def _load_muni_polygons():
    """Load and dissolve municipality polygons with canonical exclusions applied."""
    shp = GIS / "N03_2025" / "N03-20250101.shp"
    gdf = gpd.read_file(shp)
    gdf["muni_code"] = gdf["N03_007"]
    gdf["pref_code"] = gdf["muni_code"].astype(str).str[:2]
    gdf["muni_name"] = gdf["N03_004"].fillna("") + gdf["N03_005"].fillna("")
    gdf["pref_name"] = gdf["N03_001"].fillna("")

    gdf_dissolved = gdf.dissolve(by="muni_code", as_index=False, aggfunc="first")
    gdf_dissolved = gdf_dissolved.sort_values("muni_code").reset_index(drop=True)
    gdf_dissolved = gdf_dissolved[~gdf_dissolved["muni_code"].isin(EXCLUDE_CODES)].copy()
    gdf_dissolved = gdf_dissolved.reset_index(drop=True)
    return gdf_dissolved


def build_pref_adjacency():
    """Build Queen contiguity for 47 prefectures from municipality polygons."""
    print()
    print("=" * 60)
    print("Prefecture adjacency")
    print("=" * 60)

    t0 = time.time()
    print("Loading municipality polygons...")
    gdf_muni = _load_muni_polygons()

    print("Dissolving by pref_code...")
    gdf_pref = gdf_muni.dissolve(by="pref_code", as_index=False, aggfunc="first")
    gdf_pref = gdf_pref.sort_values("pref_code").reset_index(drop=True)

    # Keep only prefectures present in district_master (01-47)
    pref_master = pd.read_csv(DISTRICT_MASTER, dtype={"pref_code": str})[["pref_code"]].drop_duplicates()
    pref_master["pref_code"] = pref_master["pref_code"].str.zfill(2)
    gdf_pref = gdf_pref.merge(pref_master, on="pref_code", how="inner")
    gdf_pref = gdf_pref.sort_values("pref_code").reset_index(drop=True)

    n = len(gdf_pref)
    print(f"  Prefectures: {n}")
    assert n == 47, f"Expected 47 prefectures, got {n}"

    print("Computing Queen contiguity...")
    w = Queen.from_dataframe(gdf_pref, use_index=False)
    print(f"  Neighbors: min={w.min_neighbors}, max={w.max_neighbors}, mean={w.mean_neighbors:.1f}")

    W_sparse = w.sparse.tocsr()
    sparse.save_npz(OUT / "adj_pref.npz", W_sparse)
    print(f"  Saved: adj_pref.npz ({W_sparse.nnz} nonzeros)")

    nodes = gdf_pref[["pref_code", "pref_name"]].copy()
    nodes.index.name = "idx"
    nodes.to_csv(OUT / "adj_pref_nodes.csv", encoding="utf-8")
    print("  Saved: adj_pref_nodes.csv")
    print(f"  Elapsed: {time.time() - t0:.1f}s")
    return W_sparse, nodes


def build_block_adjacency():
    """Build Queen contiguity for 11 PR blocks via prefecture-to-block dissolve."""
    print()
    print("=" * 60)
    print("Block adjacency")
    print("=" * 60)

    t0 = time.time()
    print("Loading municipality polygons...")
    gdf_muni = _load_muni_polygons()

    print("Dissolving to prefectures...")
    gdf_pref = gdf_muni.dissolve(by="pref_code", as_index=False, aggfunc="first")
    gdf_pref = gdf_pref.sort_values("pref_code").reset_index(drop=True)

    pref_block = pd.read_csv(DISTRICT_MASTER, dtype={"pref_code": str})[
        ["pref_code", "block_id", "block_name"]
    ].drop_duplicates()
    pref_block["pref_code"] = pref_block["pref_code"].str.zfill(2)

    gdf_pref = gdf_pref.merge(pref_block, on="pref_code", how="inner")
    if gdf_pref["block_id"].isna().any():
        raise ValueError("Missing block_id for some prefectures in block adjacency build")

    print("Dissolving by block_id...")
    gdf_block = gdf_pref.dissolve(by="block_id", as_index=False, aggfunc="first")
    gdf_block = gdf_block.sort_values("block_id").reset_index(drop=True)

    n = len(gdf_block)
    print(f"  Blocks: {n}")
    assert n == 11, f"Expected 11 blocks, got {n}"

    print("Computing Queen contiguity...")
    w = Queen.from_dataframe(gdf_block, use_index=False)
    print(f"  Neighbors: min={w.min_neighbors}, max={w.max_neighbors}, mean={w.mean_neighbors:.1f}")

    W_sparse = w.sparse.tocsr()
    sparse.save_npz(OUT / "adj_block.npz", W_sparse)
    print(f"  Saved: adj_block.npz ({W_sparse.nnz} nonzeros)")

    nodes = gdf_block[["block_id", "block_name"]].copy()
    nodes.index.name = "idx"
    nodes.to_csv(OUT / "adj_block_nodes.csv", encoding="utf-8")
    print("  Saved: adj_block_nodes.csv")
    print(f"  Elapsed: {time.time() - t0:.1f}s")
    return W_sparse, nodes


def main():
    args = parse_args()
    OUT.mkdir(parents=True, exist_ok=True)

    target = args.type
    if target in {"all", "district"}:
        build_district_adjacency()
    if target in {"all", "muni"}:
        build_muni_adjacency()
    if target in {"all", "pref"}:
        build_pref_adjacency()
    if target in {"all", "block"}:
        build_block_adjacency()

    print()
    print("=" * 60)
    print("Done")
    print("=" * 60)


if __name__ == "__main__":
    main()
