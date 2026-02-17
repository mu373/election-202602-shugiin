import ja from "../locales/ja.js";
import en from "../locales/en.js";

const STORAGE_KEY = "election-map-lang";
const MESSAGES = { ja, en };
const listeners = new Set();

let currentLocale = "ja";
let namesData = null;

function normalizeLocale(locale) {
  if (!locale) return null;
  const value = String(locale).toLowerCase();
  if (value.startsWith("ja")) return "ja";
  if (value.startsWith("en")) return "en";
  return null;
}

function readStorageLocale() {
  try {
    return normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
  } catch (_err) {
    return null;
  }
}

function writeStorageLocale(locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch (_err) {
    // Ignore storage errors.
  }
}

export function t(key, ...args) {
  const value = MESSAGES[currentLocale]?.[key] ?? MESSAGES.ja?.[key];
  if (typeof value === "function") return value(...args);
  return value ?? key;
}

export function getLocale() {
  return currentLocale;
}

export async function loadNames(locale) {
  locale = locale || currentLocale;
  const res = await fetch(`./data/names_${locale}.json`);
  namesData = res.ok ? await res.json() : { muni: {}, pref: {}, block: {} };
}

export function getMuniShort(code) {
  return namesData?.muni?.[code]?.short || "";
}

export function getMuniFull(code) {
  return namesData?.muni?.[code]?.full || "";
}

export function getPrefName(code) {
  return namesData?.pref?.[code] || "";
}

export function getBlockName(id) {
  return namesData?.block?.[id] || "";
}

export function setLocale(locale) {
  const nextLocale = normalizeLocale(locale) || "ja";
  const changed = nextLocale !== currentLocale;
  currentLocale = nextLocale;
  document.documentElement.lang = nextLocale;
  writeStorageLocale(nextLocale);
  if (!changed) return;
  for (const fn of listeners) {
    try {
      fn(nextLocale);
    } catch (err) {
      console.error(err);
    }
  }
}

export function initLocale() {
  const params = new URLSearchParams(window.location.search);
  const urlLocale = normalizeLocale(params.get("lang"));
  const storageLocale = readStorageLocale();
  const browserLocale = normalizeLocale(navigator.language || navigator.languages?.[0]);
  setLocale(urlLocale || storageLocale || browserLocale || "ja");
  return currentLocale;
}

export function onLocaleChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function translateStaticHtml(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    el.textContent = String(t(key));
  });

  root.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    if (!key) return;
    el.innerHTML = String(t(key));
  });

  root.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (!key) return;
    el.setAttribute("title", String(t(key)));
  });

  root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria-label");
    if (!key) return;
    el.setAttribute("aria-label", String(t(key)));
  });
}

export function getPartyName(code) {
  if (!code) return "";
  const localized = MESSAGES[currentLocale]?.partyNames?.[code];
  if (localized) return localized;
  return MESSAGES.ja?.partyNames?.[code] || code;
}

export function getPartyShortName(code) {
  if (!code) return "";
  const short = MESSAGES[currentLocale]?.partyShortNames?.[code];
  if (short) return short;
  return getPartyName(code);
}
