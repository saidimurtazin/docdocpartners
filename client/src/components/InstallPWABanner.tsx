import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { canInstall, promptInstall, isInstalled } from "@/lib/pwa";

/**
 * Banner that suggests installing the PWA on mobile devices.
 * Shows only when the browser supports installation and the app isn't already installed.
 */
export function InstallPWABanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed or dismissed
    if (isInstalled()) return;
    if (localStorage.getItem('pwa-banner-dismissed')) return;

    // Check periodically if install prompt is available
    const interval = setInterval(() => {
      if (canInstall() && !dismissed) {
        setShowBanner(true);
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [dismissed]);

  if (!showBanner) return null;

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowBanner(false);
    localStorage.setItem('pwa-banner-dismissed', Date.now().toString());
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="bg-card border rounded-xl shadow-lg p-4 flex items-center gap-3">
        <div className="shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Установить приложение</p>
          <p className="text-xs text-muted-foreground">Быстрый доступ с рабочего стола</p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={handleInstall} className="h-8 px-3 text-xs">
            Установить
          </Button>
          <Button size="icon" variant="ghost" onClick={handleDismiss} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
