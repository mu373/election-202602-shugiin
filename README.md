# election-202602-shugiin

第51回衆議院議員選挙（令和8年2月8日執行）

## 主要データ

| データ | 概要 | データソース |
|---|---|---|
| [比例代表 市区町村別・党派別得票](https://github.com/mu373/election-202602-shugiin/blob/main/data/processed/hirei_shikuchouson.csv) | 得票データ | 各都道府県選挙管理委員会（47都道府県） |
| [市区町村センサス特徴量](https://github.com/mu373/election-202602-shugiin/blob/main/data/processed/census_muni.csv) | 社会経済指標の整形済みテーブル | e-Stat（国勢調査/統計でみる市区町村のすがた） |
| [小選挙区センサス特徴量](https://github.com/mu373/election-202602-shugiin/blob/main/data/processed/census_district.csv) | 小選挙区単位の整形済みテーブル | gtfs-gis.jp（R2国勢調査 小選挙区集計） |
| [隣接行列（市区町村）](https://github.com/mu373/election-202602-shugiin/blob/main/data/processed/adj_muni.npz) | 空間分析用の隣接行列 | 国土数値情報 N03（市区町村ポリゴン） |
| [隣接行列（小選挙区）](https://github.com/mu373/election-202602-shugiin/blob/main/data/processed/adj_district.npz) | 空間分析用の隣接行列 | gtfs-gis.jp（小選挙区ポリゴン） |
| 小選挙区ポリゴン | 地図表示・空間結合に使う境界データ | gtfs-gis.jp（`.gitignore` のため GitHub 未収録） |
| 市区町村ポリゴン | 地図表示・空間結合に使う境界データ | 国土数値情報 N03（国交省, `.gitignore` のため GitHub 未収録） |
| [小選挙区・比例ブロック対応マスター](https://github.com/mu373/election-202602-shugiin/blob/main/data/master/district_master.csv) | 選挙区コード + 都道府県 + 比例ブロック対応表 | 小選挙区一覧（gtfs-gis.jp）+ 都道府県→比例ブロック定義 |

「比例代表 市区町村別・党派別得票」データは、AI agent (Claude Code/Codex) を用いて各選挙管理委員会ホームページより取得・変換したものです。