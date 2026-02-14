import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Users, ArrowLeft, Loader2, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

type LoginMode = "select" | "admin" | "agent";

export default function Login() {
  const [mode, setMode] = useState<LoginMode>("select");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [, setLocation] = useLocation();
  const [isVerifying, setIsVerifying] = useState(false);

  const { user, logout } = useAuth();
  const requestOtp = trpc.auth.requestOtp.useMutation();
  const verifyOtp = trpc.auth.verifyOtp.useMutation(); // For admin login

  const handleLogout = async () => {
    await logout();
    toast.success("Вы вышли из системы");
    window.location.reload();
  };

  const handleRequestOtp = async () => {
    try {
      await requestOtp.mutateAsync({ email });
      setOtpSent(true);
      toast.success("Код отправлен", {
        description: "Проверьте Telegram для получения кода",
      });
    } catch (error: any) {
      if (error.message.includes("not found")) {
        toast.error("Агент не найден", {
          description: "Вам нужно сначала зарегистрироваться через Telegram-бот",
        });
      } else {
        toast.error("Ошибка", {
          description: error.message || "Не удалось отправить код",
        });
      }
    }
  };

  const handleVerifyOtp = async () => {
    try {
      setIsVerifying(true);
      const response = await fetch("/api/agent/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otpCode }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Неверный код");
      }

      const { token } = await response.json();
      localStorage.setItem("agent_token", token);
      
      toast.success("Вход выполнен", {
        description: "Перенаправление в личный кабинет...",
      });
      setTimeout(() => setLocation("/dashboard"), 1000);
    } catch (error: any) {
      toast.error("Ошибка", {
        description: error.message || "Неверный код",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleAdminLogin = () => {
    // Redirect to Manus OAuth for admin login
    window.location.href = getLoginUrl();
  };

  const handleAdminVerifyOtp = async () => {
    try {
      await verifyOtp.mutateAsync({ email, code: otpCode });
      toast.success("Вход выполнен", {
        description: "Перенаправление в админ-панель...",
      });
      setTimeout(() => setLocation("/admin"), 1000);
    } catch (error: any) {
      toast.error("Ошибка", {
        description: error.message || "Неверный код",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center gap-3 mb-4 cursor-pointer hover:opacity-80 transition-opacity">
              <img 
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663256942923/xohsFKyBQyuhihyR.png" 
                alt="DocDocPartner Logo" 
                className="w-12 h-12 rounded-lg"
              />
              <div className="flex flex-col leading-tight text-left">
                <span className="font-bold text-xl">DocDoc</span>
                <span className="font-bold text-xl">Partner</span>
              </div>
            </div>
          </Link>
          <p className="text-muted-foreground">Партнерская программа для врачей</p>
          {user && (
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="mt-4"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Выйти из {user.role === "admin" ? "админа" : "аккаунта"}
            </Button>
          )}
        </div>

        {mode === "select" && (
          <Card>
            <CardHeader>
              <CardTitle>Выберите способ входа</CardTitle>
              <CardDescription>Войдите как администратор или агент</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => setMode("admin")}
                variant="outline"
                className="w-full h-auto py-6 flex-col gap-3"
              >
                <Shield className="w-8 h-8 text-primary" />
                <div>
                  <div className="font-semibold text-lg">Войти как администратор</div>
                  <div className="text-sm text-muted-foreground">Доступ к админ-панели</div>
                </div>
              </Button>

              <Button
                onClick={() => setMode("agent")}
                variant="outline"
                className="w-full h-auto py-6 flex-col gap-3"
              >
                <Users className="w-8 h-8 text-primary" />
                <div>
                  <div className="font-semibold text-lg">Войти как агент</div>
                  <div className="text-sm text-muted-foreground">Личный кабинет агента</div>
                </div>
              </Button>

              <div className="text-center pt-4">
                <p className="text-sm text-muted-foreground">
                  Еще не зарегистрированы?{" "}
                  <a
                    href="https://t.me/docpartnerbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    Начните в Telegram-боте
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {mode === "admin" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setMode("select");
                    setEmail("");
                    setOtpCode("");
                    setOtpSent(false);
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <CardTitle>Вход администратора</CardTitle>
                  <CardDescription>Введите email для получения кода</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!otpSent ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@docdocpartner.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <Button
                    onClick={handleRequestOtp}
                    disabled={!email || requestOtp.isPending}
                    className="w-full"
                  >
                    {requestOtp.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Отправка...
                      </>
                    ) : (
                      "Получить код"
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Код придёт в Telegram-бот
                  </p>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="admin-otp">Код из Telegram</Label>
                    <Input
                      id="admin-otp"
                      type="text"
                      placeholder="000000"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      maxLength={6}
                      autoFocus
                    />
                  </div>
                  <Button
                    onClick={handleAdminVerifyOtp}
                    disabled={!otpCode || verifyOtp.isPending}
                    className="w-full"
                  >
                    {verifyOtp.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Проверка...
                      </>
                    ) : (
                      "Войти"
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode("");
                    }}
                    className="w-full"
                  >
                    Назад
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {mode === "agent" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setMode("select");
                    setEmail("");
                    setOtpCode("");
                    setOtpSent(false);
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <CardTitle>Вход агента</CardTitle>
                  <CardDescription>Введите email для получения кода</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!otpSent ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="agent-email">Email</Label>
                    <Input
                      id="agent-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <Button
                    onClick={handleRequestOtp}
                    disabled={!email || requestOtp.isPending}
                    className="w-full"
                  >
                    {requestOtp.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Получить код
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="agent-otp">Код из Telegram</Label>
                    <Input
                      id="agent-otp"
                      type="text"
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      maxLength={6}
                      autoFocus
                    />
                    <p className="text-sm text-muted-foreground">
                      Код отправлен в Telegram на {email}
                    </p>
                  </div>
                  <Button
                    onClick={handleVerifyOtp}
                    disabled={!otpCode || isVerifying}
                    className="w-full"
                  >
                    {isVerifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Войти
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setOtpSent(false)}
                    className="w-full"
                  >
                    Изменить email
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
