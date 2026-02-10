#!/bin/bash
# =============================================================================
# 全データダウンロードスクリプト（センサス・GIS・選挙速報）
#
# 入力: なし（URLからダウンロード）
# 出力: data/raw/census/   — 国勢調査・住宅土地統計
#       data/raw/gis/      — 選挙区ポリゴン・行政区域
#       data/raw/election/yukensha/ — 都道府県別有権者数・投票率
#
# 依存: curl, unzip, python3
# 使い方: bash scripts/download/download_all.sh
# =============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RAW="${ROOT}/data/raw"

mkdir -p "${RAW}/census" "${RAW}/gis" "${RAW}/election/yukensha"

# ---------------------------------------------------------------------------
# ユーティリティ
# ---------------------------------------------------------------------------
download() {
    local url="$1" dest="$2" desc="$3"
    if [ -f "$dest" ]; then
        echo "  [SKIP] $(basename "$dest")"
        return 0
    fi
    echo "  [DOWN] ${desc}"
    curl -fSL --retry 3 --retry-delay 5 -o "$dest" "$url"
}

# ---------------------------------------------------------------------------
# 4-C. GIS データ
# ---------------------------------------------------------------------------
echo ""
echo "================================================================"
echo " G1: 小選挙区ポリゴン (2022年改訂) — gtfs-gis.jp"
echo "================================================================"
download \
    "https://gtfs-gis.jp/senkyoku2022/senkyoku2022.zip" \
    "${RAW}/gis/senkyoku2022.zip" \
    "senkyoku2022.zip (Shapefile, ~120 MB)"

if [ ! -d "${RAW}/gis/senkyoku2022" ]; then
    echo "  [UNZIP] senkyoku2022.zip"
    unzip -qo "${RAW}/gis/senkyoku2022.zip" -d "${RAW}/gis/senkyoku2022"
fi

echo ""
echo "================================================================"
echo " G2: 市区町村ポリゴン (2025年版) — 国土数値情報 N03"
echo "================================================================"
download \
    "https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2025/N03-20250101_GML.zip" \
    "${RAW}/gis/N03-20250101_GML.zip" \
    "N03-20250101_GML.zip (Shapefile+GeoJSON, ~600 MB)"

if [ ! -d "${RAW}/gis/N03_2025" ]; then
    echo "  [UNZIP] N03-20250101_GML.zip"
    unzip -qo "${RAW}/gis/N03-20250101_GML.zip" -d "${RAW}/gis/N03_2025"
fi

echo ""
echo "================================================================"
echo " G3: 小選挙区リスト (市区町村対応) — gtfs-gis.jp"
echo "================================================================"
download \
    "https://gtfs-gis.jp/senkyoku2022/senkyoku_ichiran.xlsx" \
    "${RAW}/gis/senkyoku_ichiran.xlsx" \
    "senkyoku_ichiran.xlsx"

# ---------------------------------------------------------------------------
# 4-A. 選挙データ（第51回速報）
# ---------------------------------------------------------------------------
echo ""
echo "================================================================"
echo " E4b: 都道府県別有権者数・投票率 — 総務省 第51回速報"
echo "================================================================"
DIR_YUKENSHA="${RAW}/election/yukensha"

download \
    "https://www.soumu.go.jp/main_content/001055051.xlsx" \
    "${DIR_YUKENSHA}/todofuken_yukensha_touhyoritsu.xlsx" \
    "都道府県別有権者数、投票者数、投票率（比例代表）"

# ---------------------------------------------------------------------------
# 4-B. センサスデータ
# ---------------------------------------------------------------------------

# --- C1: 国勢調査 選挙区集計 (gtfs-gis.jp) --------------------------------
echo ""
echo "================================================================"
echo " C1: R2国勢調査 小選挙区集計 (18表) — gtfs-gis.jp"
echo "================================================================"
download \
    "https://gtfs-gis.jp/senkyoku2022/senkyoku2022_toukei.zip" \
    "${RAW}/census/senkyoku2022_toukei.zip" \
    "senkyoku2022_toukei.zip (~700 KB)"

download \
    "https://gtfs-gis.jp/senkyoku2022/senkyoku_data_file_ichiran.xlsx" \
    "${RAW}/census/senkyoku_data_file_ichiran.xlsx" \
    "senkyoku_data_file_ichiran.xlsx (データ項目一覧)"

if [ ! -d "${RAW}/census/senkyoku2022_toukei" ]; then
    echo "  [UNZIP] senkyoku2022_toukei.zip (Shift-JIS filenames → Python)"
    python3 -c "
import zipfile, os
src = '${RAW}/census/senkyoku2022_toukei.zip'
dst = '${RAW}/census/senkyoku2022_toukei'
os.makedirs(dst, exist_ok=True)
with zipfile.ZipFile(src, 'r') as z:
    for info in z.infolist():
        try:
            name = info.filename.encode('cp437').decode('shift_jis')
        except Exception:
            name = info.filename
        path = os.path.join(dst, name)
        with open(path, 'wb') as f:
            f.write(z.read(info.filename))
        print(f'    {name}')
"
fi

# --- C3: 国勢調査 市区町村集計 (e-Stat) ------------------------------------
echo ""
echo "================================================================"
echo " C3: R2国勢調査 市区町村集計 — e-Stat"
echo "================================================================"
ESTAT="https://www.e-stat.go.jp/stat-search/file-download"
DIR_C3="${RAW}/census/r2_kokusei_2020"
mkdir -p "$DIR_C3"

estat_download() {
    local stat_inf_id="$1" file_kind="$2" dest="$3" desc="$4"
    if [ -f "$dest" ]; then
        echo "  [SKIP] $(basename "$dest")"
        return 0
    fi
    echo "  [DOWN] ${desc}"
    curl -fSL --retry 3 --retry-delay 5 -o "$dest" \
        "${ESTAT}?statInfId=${stat_inf_id}&fileKind=${file_kind}"
}

estat_download "000032143614" "0" \
    "$DIR_C3/shikuchoson_main_results.xlsx" \
    "都道府県・市区町村別の主な結果"

estat_download "000032201217" "0" \
    "$DIR_C3/education_11_2_gakureki.xlsx" \
    "Table 11-2: 最終卒業学校の種類別人口 (大卒以上率)"

estat_download "000032142552" "0" \
    "$DIR_C3/housing_type_19_4.xlsx" \
    "Table 19-4: 住宅の建て方別一般世帯数 (共同住宅率)"

estat_download "000032214142" "0" \
    "$DIR_C3/commuting_1_2_employed.xlsx" \
    "Table 1-2: 従業地・通学地別就業者数 (他県通勤率)"

# --- C3-alt: 統計でみる市区町村のすがた 2024 --------------------------------
echo ""
echo "================================================================"
echo " C3-alt: 統計でみる市区町村のすがた 2024 — e-Stat"
echo "================================================================"
DIR_SUGATA="${RAW}/census/shikuchoson_sugata_2024"
mkdir -p "$DIR_SUGATA"

estat_download "000040186220" "2" "$DIR_SUGATA/00_riyousha_tebiki.pdf" \
    "利用者のために (PDF)"
estat_download "000040186221" "0" "$DIR_SUGATA/A_jinkou_setai.xls" \
    "A: 人口・世帯"
estat_download "000040186222" "0" "$DIR_SUGATA/B_shizen_kankyo.xls" \
    "B: 自然環境"
estat_download "000040186223" "0" "$DIR_SUGATA/C_keizai_kiban.xls" \
    "C: 経済基盤"
estat_download "000040186224" "0" "$DIR_SUGATA/D_gyousei_kiban.xls" \
    "D: 行政基盤"
estat_download "000040186225" "0" "$DIR_SUGATA/E_kyouiku.xls" \
    "E: 教育"
estat_download "000040186226" "0" "$DIR_SUGATA/F_roudou.xls" \
    "F: 労働"
estat_download "000040186227" "0" "$DIR_SUGATA/G_bunka_sports.xls" \
    "G: 文化・スポーツ"
estat_download "000040186228" "0" "$DIR_SUGATA/H_kyojuu.xls" \
    "H: 居住"
estat_download "000040186229" "0" "$DIR_SUGATA/I_kenkou_iryo.xls" \
    "I: 健康・医療"
estat_download "000040186230" "0" "$DIR_SUGATA/J_fukushi_shakaihoshou.xls" \
    "J: 福祉・社会保障"

# --- C4: 住宅・土地統計調査 2018 (e-Stat) -----------------------------------
echo ""
echo "================================================================"
echo " C4: H30住宅・土地統計調査 — e-Stat"
echo "================================================================"
DIR_C4="${RAW}/census/housing_survey_2018"
mkdir -p "$DIR_C4"

estat_download "000031865741" "0" \
    "$DIR_C4/table41_2_income_tenure.xlsx" \
    "Table 41-2: 年間収入階級×住宅所有別世帯数"

estat_download "000031865744" "0" \
    "$DIR_C4/table42_3_family_income.xlsx" \
    "Table 42-3: 家族類型×年間収入階級×住宅所有別世帯数"

estat_download "000031865703" "0" \
    "$DIR_C4/table44_3_employment_income.xlsx" \
    "Table 44-3: 従業上の地位×年間収入階級別世帯数"

# ---------------------------------------------------------------------------
# 完了
# ---------------------------------------------------------------------------
echo ""
echo "================================================================"
echo " ダウンロード完了"
echo "================================================================"
echo ""
echo "保存先: ${RAW}"
echo ""
echo "ファイル一覧:"
echo "  Election:"
du -h "${RAW}/election"/* 2>/dev/null | awk '{print "    " $2 " (" $1 ")"}'
echo ""
echo "  GIS:"
find "${RAW}/gis" -maxdepth 1 -type f -o -type d -maxdepth 2 | sort | head -20
echo ""
echo "  Census:"
du -sh "${RAW}/census"/*/ 2>/dev/null || true
echo ""
echo "合計サイズ:"
du -sh "${RAW}"
