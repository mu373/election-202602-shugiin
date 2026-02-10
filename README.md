# election-202602-shugiin

第51回衆議院議員選挙（令和8年2月8日執行）

## 主要データ

| データ | 概要 | データソース | パス |
|---|---|---|---|
| 比例代表 市区町村別・党派別得票 | 得票データ | 各都道府県選挙管理委員会（47都道府県） | `data/processed/hirei_shikuchouson.csv` |
| 市区町村センサス特徴量 | 社会経済指標の整形済みテーブル | e-Stat（国勢調査/統計でみる市区町村のすがた） | `data/processed/census_muni.csv` |
| 小選挙区センサス特徴量 | 小選挙区単位の整形済みテーブル | gtfs-gis.jp（R2国勢調査 小選挙区集計） | `data/processed/census_district.csv` |
| 隣接行列（市区町村） | 空間分析用の隣接行列 | 国土数値情報 N03（市区町村ポリゴン） | `data/processed/adj_muni.npz` |
| 隣接行列（小選挙区） | 空間分析用の隣接行列 | gtfs-gis.jp（小選挙区ポリゴン） | `data/processed/adj_district.npz` |
| 小選挙区ポリゴン | 地図表示・空間結合に使う境界データ | gtfs-gis.jp | `data/raw/gis/senkyoku2022/` |
| 市区町村ポリゴン | 地図表示・空間結合に使う境界データ | 国土数値情報 N03（国交省） | `data/raw/gis/N03_2025/` |
| 小選挙区・比例ブロック対応マスター | 選挙区コード + 都道府県 + 比例ブロック対応表 | 小選挙区一覧（gtfs-gis.jp）+ 都道府県→比例ブロック定義 | `data/master/district_master.csv` |

`raw` データの所在・内訳は `data/DATA_MANIFEST.md` を参照してください。
