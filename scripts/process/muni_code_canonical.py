#!/usr/bin/env python3
"""muni_code 正規化の共通定義

census_muni.csv・hirei_shikuchouson.csv・adj_muni_nodes.csv の三方一致に必要な
除外コード、政令市親コード、浜松旧区→新区マッピングを一元管理する。
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parent.parent.parent

# adj_muni_nodes から除外するコード（所属未定地＋北方領土）
EXCLUDE_CODES = {
    # 所属未定地
    "12000", "13000", "23000", "30000", "40000", "46000", "47000",
    # 北方領土
    "01695", "01696", "01697", "01698", "01699", "01700",
}

# 政令指定都市の親コード（区の合計行）— census で除外する
SEIREI_PARENT_CODES = {
    "01100", "04100", "11100", "12100", "13100",
    "14100", "14130", "14150", "15100",
    "22100", "22130", "23100", "26100",
    "27100", "27140", "28100",
    "33100", "34100", "40100", "40130", "43100",
}

# 浜松旧区→新区（2024年1月再編）
# 旧北区(22135)は三方原地区→中央区、残り→浜名区に分割
# 按分比は 2023年10月住基人口からの推計値（約39:61）
#   中央区全体608,145 - 旧中区〜南区合計572,525 ≈ 35,620 → 北区の38.4%
#   浜名区全体155,996 - 旧浜北区98,779 ≈ 57,217 → 北区の61.6%
HAMAMATSU_OLD_CODES = {"22131", "22132", "22133", "22134", "22135", "22136", "22137"}

HAMAMATSU_NEW_WARDS = {
    "22138": {  # 中央区 ← 中区+東区+北区三方原地区
        "name": "中央区",
        "full": ["22131", "22132"],
        "partial": {"22135": 0.384},
    },
    "22139": {  # 浜名区 ← 西区+南区+浜北区+北区残部
        "name": "浜名区",
        "full": ["22133", "22134", "22136"],
        "partial": {"22135": 0.616},
    },
    "22140": {  # 天竜区 ← 天竜区（変更なし）
        "name": "天竜区",
        "full": ["22137"],
        "partial": {},
    },
}


def load_canonical_codes() -> set[str]:
    """adj_muni_nodes から除外コードを引いた基準コード集合（1892件）を返す。

    adj_muni_nodes.csv が未生成の場合は FileNotFoundError を送出する。
    """
    path = BASE / "data" / "processed" / "adj_muni_nodes.csv"
    df = pd.read_csv(path, dtype={"muni_code": str})
    codes = set(df["muni_code"])
    return codes - EXCLUDE_CODES
