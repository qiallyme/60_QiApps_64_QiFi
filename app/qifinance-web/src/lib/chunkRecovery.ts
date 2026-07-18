import React from 'react';

const CHUNK_RECOVERY_KEY = 'qifi_chunk_recovery_attempted';

export function isDynamicImportError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\d]+ failed|ChunkLoadError/i.test(message);
}

async function clearQiFiShellCaches(): Promise<void> {
  if (!('caches' in window)) return;
  const cacheNames = await window.caches.keys();
  await Promise.all(
    cacheNames
      .filter((name) => name.startsWith('qifi-shell-'))
      .map((name) => window.caches.delete(name)),
  );
}

export async function reloadLatestQiFiVersion(): Promise<void> {
  try {
    sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
    await clearQiFiShellCaches();
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch (error) {
    console.warn('QiFi could not fully refresh its offline cache before reloading:', error);
  } finally {
    const route = window.location.hash;
    window.location.replace(`/?app-refresh=${Date.now()}${route}`);
  }
}

export function lazyWithChunkRecovery<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      const module = await importer();
      sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
      return module;
    } catch (error) {
      if (isDynamicImportError(error) && sessionStorage.getItem(CHUNK_RECOVERY_KEY) !== 'true') {
        sessionStorage.setItem(CHUNK_RECOVERY_KEY, 'true');
        await reloadLatestQiFiVersion();
        return new Promise<never>(() => undefined);
      }
      throw error;
    }
  });
}
