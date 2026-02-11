import { GITHUB_RAW_BASE, LOCAL_DATA_BASE } from '../lib/constants';

/** Returns the configured data source mode from the VITE_DATA_SOURCE_MODE env var. */
export function getConfiguredDataSourceMode(): 'local' | 'remote' | null {
  const mode = import.meta.env.VITE_DATA_SOURCE_MODE as string | undefined;
  if (mode === 'local' || mode === 'remote') return mode;
  return null;
}

/** Returns an ordered list of URLs to try when loading a data file (remote first, local fallback). */
export function getDataUrlOrder(fileName: string): string[] {
  const localUrl = `${LOCAL_DATA_BASE}/${fileName}`;
  const remoteUrl = `${GITHUB_RAW_BASE}/${fileName}`;
  const mode = getConfiguredDataSourceMode() || 'remote';
  return mode === 'local' ? [localUrl] : [remoteUrl, localUrl];
}

/** Loads a JSON data file, trying each URL in order and falling back on failure. */
export async function loadDataWithFallback(fileName: string): Promise<unknown> {
  const urls = getDataUrlOrder(fileName);
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'unknown error';
  throw new Error(`Failed to load ${fileName}: ${message}`);
}
