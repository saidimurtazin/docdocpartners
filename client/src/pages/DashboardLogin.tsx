import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, Shield, TrendingUp, Mail, Key, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

declare global {
  interface Window {
    TelegramLoginWidget?: {
      dataOnauth: (user: any) => void;
    };
  }
}

export default function DashboardLogin() {
  const [, setLocation] = useLocation();
  const [loginMethod, setLoginMethod] = useState<"telegram" | "email">("telegram");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");

  const requestOtpMutation = trpc.auth.requestOtp.useMutation();
  const verifyOtpMutation = trpc.auth.verifyOtp.useMutation();

  useEffect(() => {
    if (loginMethod !== "telegram") return;

    // Load Telegram Login Widget script
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "");
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.async = true;

    const container = document.getElementById("telegram-login-container");
    if (container) {
      container.innerHTML = ""; // Clear previous widget
      container.appendChild(script);
    }

    // Define global callback
    (window as any).onTelegramAuth = async (user: any) => {
      try {
        // Send auth data to backend
        const response = await fetch("/api/telegram-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(user),
          credentials: "include",
        });

        if (response.ok) {
          // Redirect to dashboard
          setLocation("/dashboard");
        } else {
          alert("Ошибка авторизации. Убедитесь что вы зарегистрированы в боте.");
        }
      } catch (error) {
        console.error("Login error:", error);
        alert("Ошибка подключения к серверу");
      }
    };

    return () => {
      delete (window as any).onTelegramAuth;
    };
  }, [setLocation, loginMethod]);

  const handleRequestOtp = async () => {
    setError("");
    try {
      await requestOtpMutation.mutateAsync({ email });
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || "Ошибка отправки кода");
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    try {
      await verifyOtpMutation.mutateAsync({ email, code: otpCode });
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err.message || "Неверный код");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663256942923/xohsFKyBQyuhihyR.png"
              alt="DocDocPartner Logo"
              className="w-16 h-16 rounded-xl shadow-lg"
            />
          </div>
          <h1 className="text-3xl font-bold">DocDocPartner</h1>
          <p className="text-muted-foreground mt-2">Личный кабинет агента</p>
        </div>

        {/* Login Method Selector */}
        <div className="flex gap-2 p-1 bg-muted rounded-lg">
          <Button
            variant={loginMethod === "telegram" ? "default" : "ghost"}
            className="flex-1"
            onClick={() => setLoginMethod("telegram")}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Telegram
          </Button>
          <Button
            variant={loginMethod === "email" ? "default" : "ghost"}
            className="flex-1"
            onClick={() => setLoginMethod("email")}
          >
            <Mail className="w-4 h-4 mr-2" />
            Email
          </Button>
        </div>

        {/* Login Card */}
        <Card className="border-2 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Вход в систему</CardTitle>
            <CardDescription>
              {loginMethod === "telegram"
                ? "Войдите через Telegram, чтобы получить доступ к личному кабинету"
                : "Получите код подтверждения на email"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loginMethod === "telegram" ? (
              <>
                {/* Telegram Login Widget */}
                <div
                  id="telegram-login-container"
                  className="flex justify-center"
                ></div>
              </>
            ) : (
              <>
                {/* Email/OTP Login Form */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={otpSent}
                    />
                  </div>

                  {!otpSent ? (
                    <Button
                      className="w-full"
                      onClick={handleRequestOtp}
                      disabled={!email || requestOtpMutation.isPending}
                    >
                      {requestOtpMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Отправка...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4 mr-2" />
                          Получить код
                        </>
                      )}
                    </Button>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="otp">Код из Telegram</Label>
                        <Input
                          id="otp"
                          type="text"
                          placeholder="123456"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          maxLength={6}
                        />
                        <p className="text-xs text-muted-foreground">
                          Код отправлен вам в Telegram-бот. Проверьте сообщения.
                        </p>
                      </div>

                      <Button
                        className="w-full"
                        onClick={handleVerifyOtp}
                        disabled={!otpCode || verifyOtpMutation.isPending}
                      >
                        {verifyOtpMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Проверка...
                          </>
                        ) : (
                          <>
                            <Key className="w-4 h-4 mr-2" />
                            Войти
                          </>
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => {
                          setOtpSent(false);
                          setOtpCode("");
                          setError("");
                        }}
                      >
                        Изменить email
                      </Button>
                    </>
                  )}

                  {error && (
                    <div className="text-sm text-destructive text-center bg-destructive/10 p-2 rounded">
                      {error}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Features */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Статистика и аналитика</h4>
                  <p className="text-xs text-muted-foreground">
                    Отслеживайте заработок и рекомендации в реальном времени
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Управление рекомендациями</h4>
                  <p className="text-xs text-muted-foreground">
                    Просматривайте статусы всех направленных пациентов
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Безопасные выплаты</h4>
                  <p className="text-xs text-muted-foreground">
                    Запрашивайте выплаты и отслеживайте их статус
                  </p>
                </div>
              </div>
            </div>

            {/* Help */}
            <div className="text-center text-sm text-muted-foreground pt-4 border-t">
              Еще не зарегистрированы?{" "}
              <a
                href={`https://t.me/${import.meta.env.VITE_TELEGRAM_BOT_USERNAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                Начните в Telegram-боте
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
