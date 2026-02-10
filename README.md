# election-202602-shugiin

第51回衆議院議員選挙（令和8年2月8日執行）

Coming soon: 階層ベイズによる政党得票率予測 with PyMC

## 主要データ

| データ | 概要 | データソース |
|---|---|---|
| [比例代表 市区町村別・党派別得票](https://github.com/mu373/election-202602-shugiin/blob/main/data/processed/hirei_shikuchouson.csv) | 分析の主データ | 各都道府県選挙管理委員会 |
| [市区町村センサス特徴量](https://github.com/mu373/election-202602-shugiin/blob/main/data/processed/census_muni.csv) | 市区町村特徴量 | e-Stat（政府標準利用規約2.0 / CC BY 4.0互換） |
| [小選挙区センサス特徴量](https://github.com/mu373/election-202602-shugiin/blob/main/data/processed/census_district.csv) | 小選挙区特徴量 | [gtfs-gis.jp](https://gtfs-gis.jp/senkyoku/) （R2国勢調査 小選挙区集計） |
| [隣接行列（市区町村）](https://github.com/mu373/election-202602-shugiin/blob/main/data/processed/adj_muni.npz) | 空間隣接行列 | 国土数値情報 N03 に基づき作成 |
| [隣接行列（小選挙区）](https://github.com/mu373/election-202602-shugiin/blob/main/data/processed/adj_district.npz) | 空間隣接行列 | [gtfs-gis.jp](https://gtfs-gis.jp/senkyoku/)（小選挙区ポリゴン）に基づき作成 |
| [小選挙区・比例ブロック対応マスター](https://github.com/mu373/election-202602-shugiin/blob/main/data/master/district_master.csv) | 選挙区・比例ブロック対応 | [gtfs-gis.jp](https://gtfs-gis.jp/senkyoku/)・総務省など |
| 小選挙区/市区町村ポリゴン | 地図・空間結合用 | [gtfs-gis.jp](https://gtfs-gis.jp/senkyoku/) / 国土数値情報 N03 |

「比例代表 市区町村別・党派別得票」データは、AI agent (Claude Code/Codex) を用いて各選挙管理委員会ホームページより取得・変換したものです。

## ライセンス

- スクリプト/コード: MIT ([`LICENSE`](https://github.com/mu373/election-202602-shugiin/blob/main/LICENSE))
- データ: 特記なき場合 CC0 1.0 ([`LICENSE-DATA`](https://github.com/mu373/election-202602-shugiin/blob/main/LICENSE-DATA))
- 加工元データ: 提供元の利用条件に準拠
    - e-Stat: [政府標準利用規約2.0 / CC BY 4.0互換](https://www.e-stat.go.jp/terms-of-use)
    - gtfs-gis.jp 選挙区ポリゴン: [CC0](https://gtfs-gis.jp/senkyoku/)
    - `raw` データの一部は取得スクリプトのみの公開としています（再配布無し）
