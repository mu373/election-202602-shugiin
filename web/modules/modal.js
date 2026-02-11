import { infoModal, infoButton, infoCloseButton } from "./dom.js";

export function isInfoModalOpen() {
  return Boolean(infoModal && !infoModal.hidden);
}

export function setInfoModalOpen(open) {
  if (!infoModal || !infoButton) return;
  infoModal.hidden = !open;
  infoButton.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) {
    infoCloseButton?.focus();
  } else {
    infoButton.focus();
  }
}

export function initInfoModalControls() {
  if (!infoButton || !infoModal) return;
  infoButton.addEventListener("click", () => {
    setInfoModalOpen(true);
  });
  infoCloseButton?.addEventListener("click", () => {
    setInfoModalOpen(false);
  });
  infoModal.addEventListener("click", (event) => {
    if (event.target === infoModal) {
      setInfoModalOpen(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isInfoModalOpen()) {
      setInfoModalOpen(false);
    }
  });
}
