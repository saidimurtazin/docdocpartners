import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Users, ArrowLeft, Loader2, Mail, Send } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type LoginMode = "select" | "admin" | "agent-channel" | "agent-email" | "agent-telegram";

export default function Login() {
  const [mode, setMode] = useState<LoginMode>("select");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const requestOtp = trpc.auth.requestOtp.useMutation();
  const verifyOtp = trpc.auth.verifyOtp.useMutation();

  const handleRequestOtp = async (channel: "email" | "telegram" = "email") => {
    try {
      await requestOtp.mutateAsync({ email, channel });
      setOtpSent(true);
      toast.success("Код отправлен", {
        description: channel === "telegram"
          ? "Проверьте Telegram для получения кода"
          : "Проверьте вашу почту для получения кода",
      });
    } catch (error: any) {
      if (error.message?.includes("not found") || error.message?.includes("не найден")) {
        toast.error("Пользователь не найден", {
          description: "Зарегистрируйтесь на сайте или через Telegram-бот",
        });
      } else if (error.message?.includes("Telegram не привязан")) {
        toast.error("Telegram не привязан", {
          description: "К вашему аккаунту не привязан Telegram. Используйте вход через Email.",
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
      const result = await verifyOtp.mutateAsync({ email, code: otpCode });
      const redirectPath = result?.role === "admin" ? "/admin" : "/dashboard";
      window.location.replace(redirectPath);
    } catch (error: any) {
      toast.error("Ошибка", {
        description: error.message || "Неверный или истекший код",
      });
    }
  };

  const resetForm = () => {
    setMode("select");
    setEmail("");
    setOtpCode("");
    setOtpSent(false);
  };

  const goToChannelSelect = () => {
    setMode("agent-channel");
    setEmail("");
    setOtpCode("");
    setOtpSent(false);
  };

  const currentChannel = mode === "agent-telegram" ? "telegram" : "email";

  // OTP form — shared between admin, agent-email, agent-telegram
  const renderOtpForm = (title: string, description: string, channel: "email" | "telegram") => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={mode === "admin" ? resetForm : goToChannelSelect}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!otpSent ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && email) handleRequestOtp(channel); }}
                autoFocus
              />
            </div>
            <Button
              onClick={() => handleRequestOtp(channel)}
              disabled={!email || requestOtp.isPending}
              className="w-full"
            >
              {requestOtp.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Отправка...</>
              ) : (
                "Получить код"
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              {channel === "telegram"
                ? "Код придёт в Telegram"
                : "Код придёт на ваш email"}
            </p>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="otp">Код подтверждения</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => { if (e.key === "Enter" && otpCode.length === 6) handleVerifyOtp(); }}
                maxLength={6}
                autoFocus
              />
            </div>
            <Button
              onClick={handleVerifyOtp}
              disabled={otpCode.length !== 6 || verifyOtp.isPending}
              className="w-full"
            >
              {verifyOtp.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Проверка...</>
              ) : (
                "Войти"
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setOtpSent(false); setOtpCode(""); }}
              className="w-full"
            >
              Отправить код повторно
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <div className="inline-flex items-center gap-3 mb-4 cursor-pointer hover:opacity-80 transition-opacity">
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663256942923/xohsFKyBQyuhihyR.png"
                alt="DocPartner Logo"
                className="w-12 h-12 rounded-lg"
              />
              <div className="flex flex-col leading-tight text-left">
                <span className="font-bold text-xl">DocDoc</span>
                <span className="font-bold text-xl">Partner</span>
              </div>
            </div>
          </Link>
          <p className="text-muted-foreground">Партнерская программа для врачей</p>
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
                  <div className="font-semibold text-lg">Администратор</div>
                  <div className="text-sm text-muted-foreground">Доступ к админ-панели</div>
                </div>
              </Button>

              <Button
                onClick={() => setMode("agent-channel")}
                variant="outline"
                className="w-full h-auto py-6 flex-col gap-3"
              >
                <Users className="w-8 h-8 text-primary" />
                <div>
                  <div className="font-semibold text-lg">Агент</div>
                  <div className="text-sm text-muted-foreground">Личный кабинет агента</div>
                </div>
              </Button>

              <div className="text-center pt-4 space-y-1">
                <p className="text-sm text-muted-foreground">
                  Ещё не зарегистрированы?{" "}
                  <Link
                    href="/register"
                    className="text-primary hover:underline font-medium"
                  >
                    Зарегистрироваться
                  </Link>
                </p>
                <p className="text-xs text-muted-foreground">
                  или{" "}
                  <a
                    href="https://t.me/docpartnerbot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary/70 hover:underline"
                  >
                    через Telegram-бот
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {mode === "agent-channel" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={resetForm}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                  <CardTitle>Вход агента</CardTitle>
                  <CardDescription>Выберите способ получения кода</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => setMode("agent-telegram")}
                variant="outline"
                className="w-full h-auto py-5 flex-row gap-4 justify-start"
              >
                <Send className="w-6 h-6 text-[#229ED9] shrink-0" />
                <div className="text-left">
                  <div className="font-semibold">Через Telegram</div>
                  <div className="text-xs text-muted-foreground">Код придёт в Telegram</div>
                </div>
              </Button>

              <Button
                onClick={() => setMode("agent-email")}
                variant="outline"
                className="w-full h-auto py-5 flex-row gap-4 justify-start"
              >
                <Mail className="w-6 h-6 text-primary shrink-0" />
                <div className="text-left">
                  <div className="font-semibold">Через Email</div>
                  <div className="text-xs text-muted-foreground">Код придёт на почту</div>
                </div>
              </Button>
            </CardContent>
          </Card>
        )}

        {mode === "admin" && renderOtpForm("Вход администратора", "Введите email для получения кода", "email")}
        {mode === "agent-email" && renderOtpForm("Вход агента", "Введите email, указанный при регистрации", "email")}
        {mode === "agent-telegram" && renderOtpForm("Вход агента", "Введите email, код придёт в Telegram", "telegram")}
      </div>
    </div>
  );
}
