/**
 * PWA utilities — Service Worker registration & install prompt
 */

let deferredPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Register service worker
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service Workers not supported');
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      console.log('[PWA] Service Worker registered, scope:', registration.scope);

      // Check for updates periodically (every 60 minutes)
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
    }
  });
}

/**
 * Listen for the install prompt event
 */
export function listenForInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    console.log('[PWA] Install prompt captured');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    console.log('[PWA] App installed');
  });
}

/**
 * Check if the app can be installed
 */
export function canInstall(): boolean {
  return deferredPrompt !== null;
}

/**
 * Check if the app is already installed (running in standalone mode)
 */
export function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
}

/**
 * Prompt the user to install the PWA
 */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;

  return outcome === 'accepted';
}
