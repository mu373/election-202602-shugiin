import { useEffect } from 'react';

interface InfoModalProps {
  open: boolean;
  onClose: () => void;
}

export function InfoModal({ open, onClose }: InfoModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div id="infoModal" className="info-modal" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="info-modal-panel" role="dialog" aria-modal="true" aria-labelledby="infoTitle">
        <div className="info-modal-header">
          <h2 id="infoTitle">データ・出典情報</h2>
          <button id="infoCloseButton" className="info-close" type="button" aria-label="閉じる" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="info-modal-content">
          <p>第51回衆議院議員選挙（令和8年2月8日執行）の比例区の得票データを可視化しています。</p>
          <p>比例代表 市区町村別・党派別得票データは、AIエージェントを用いて各都道府県選挙管理委員会サイトから取得・変換しています。</p>
          <h3>主要データ</h3>
          <ul>
            <li><a href="https://github.com/mu373/election-202602-shugiin/blob/main/data/processed/hirei_shikuchouson.csv" target="_blank" rel="noopener noreferrer">比例代表 市区町村別・党派別得票</a></li>
            <li><a href="https://github.com/mu373/election-202602-shugiin/blob/main/web/data/municipalities.geojson" target="_blank" rel="noopener noreferrer">市区町村境界</a>（<a href="https://nlftp.mlit.go.jp/ksj/" target="_blank" rel="noopener noreferrer">国土数値情報 N03 2025</a>）</li>
            <li><a href="https://github.com/mu373/election-202602-shugiin/blob/main/web/data/prefectures.geojson" target="_blank" rel="noopener noreferrer">都道府県境界</a>（<a href="https://nlftp.mlit.go.jp/ksj/" target="_blank" rel="noopener noreferrer">国土数値情報 N03 2025</a>）</li>
            <li><a href="https://github.com/mu373/election-202602-shugiin/blob/main/web/data/blocks.geojson" target="_blank" rel="noopener noreferrer">比例ブロック境界</a>（都道府県境界を集約して作成）</li>
          </ul>
          <h3>ライセンス</h3>
          <ul>
            <li>コード: MIT</li>
            <li>データ: CC0 1.0（特記なき場合）</li>
            <li>加工元データ: 提供元の利用条件に準拠</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
