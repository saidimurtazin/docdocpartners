import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

/**
 * Telegram Login Page
 * Displays Telegram Login Widget for agent authentication
 */

// Telegram Login Widget callback data interface
interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// Extend Window interface to include Telegram callback
declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

export default function TelegramLogin() {
  const [, setLocation] = useLocation();
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);
  const telegramLoginMutation = trpc.auth.telegramLogin.useMutation();

  useEffect(() => {
    // Define the callback function for Telegram widget
    window.onTelegramAuth = async (user: TelegramUser) => {
      console.log("Telegram auth callback received:", user);
      
      try {
        // Send auth data to backend for verification via tRPC
        const result = await telegramLoginMutation.mutateAsync(user);
        console.log("Backend auth response:", result);

        // Redirect to agent cabinet on success
        setLocation("/agent/cabinet");
      } catch (error: any) {
        console.error("Telegram login error:", error);
        const message = error.message || "Ошибка входа через Telegram. Пожалуйста, попробуйте снова.";
        alert(message);
      }
    };

    // Load Telegram widget script
    if (!scriptLoadedRef.current && widgetContainerRef.current) {
      scriptLoadedRef.current = true;

      const script = document.createElement("script");
      script.src = "https://telegram.org/js/telegram-widget.js?22";
      script.async = true;
      script.setAttribute("data-telegram-login", import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "");
      script.setAttribute("data-size", "large");
      script.setAttribute("data-onauth", "onTelegramAuth(user)");
      script.setAttribute("data-request-access", "write");

      widgetContainerRef.current.appendChild(script);
    }

    // Cleanup
    return () => {
      if (window.onTelegramAuth) {
        delete window.onTelegramAuth;
      }
    };
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-3xl">M</span>
            </div>
          </div>
          <CardTitle className="text-2xl">Вход для агентов</CardTitle>
          <CardDescription>
            Войдите через Telegram, чтобы получить доступ к личному кабинету агента
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertDescription>
              <strong>Для входа необходимо:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Иметь аккаунт Telegram</li>
                <li>Быть зарегистрированным агентом в системе DocDocPartner</li>
                <li>Связать ваш Telegram-аккаунт через бота</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="flex flex-col items-center space-y-4">
            <div ref={widgetContainerRef} className="flex justify-center min-h-[50px]">
              {/* Telegram widget will be inserted here */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Загрузка виджета Telegram...</span>
              </div>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              Еще не зарегистрированы?{" "}
              <a 
                href={`https://t.me/${import.meta.env.VITE_TELEGRAM_BOT_USERNAME || ""}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Начните в Telegram-боте
              </a>
            </p>
          </div>

          <div className="pt-4 border-t text-xs text-muted-foreground text-center">
            <p>
              Нажимая "Log in with Telegram", вы соглашаетесь с{" "}
              <a href="/terms" className="text-primary hover:underline">
                условиями использования
              </a>{" "}
              и{" "}
              <a href="/privacy" className="text-primary hover:underline">
                политикой конфиденциальности
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
