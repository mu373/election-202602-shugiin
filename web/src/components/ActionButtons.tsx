interface ActionButtonsProps {
  onInfoOpen: () => void;
}

export function ActionButtons({ onInfoOpen }: ActionButtonsProps) {
  const shareOnX = () => {
    const panelTitle = '第51回衆院選 比例区得票マップ';
    const url = new URL(window.location.href);
    const shareUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(panelTitle)}&url=${encodeURIComponent(url.toString())}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="top-actions">
      <button
        id="shareXButton"
        className="action-button x-share-button"
        type="button"
        aria-label="X で共有"
        title="X で共有"
        onClick={shareOnX}
      >
        <i className="fa-brands fa-x-twitter" aria-hidden="true" />
      </button>

      <a
        className="action-button"
        href="https://github.com/mu373/election-202602-shugiin"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub リポジトリを開く"
        title="GitHub"
      >
        <i className="fa-brands fa-github" aria-hidden="true" />
      </a>

      <button
        id="infoButton"
        className="action-button info-button"
        type="button"
        aria-label="データ・出典情報を表示"
        aria-haspopup="dialog"
        aria-expanded="false"
        title="データ・出典"
        onClick={onInfoOpen}
      >
        <i className="fa-solid fa-info" aria-hidden="true" />
      </button>
    </div>
  );
}
