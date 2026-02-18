import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Users, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type LoginMode = "select" | "admin" | "agent";

export default function Login() {
  const [mode, setMode] = useState<LoginMode>("select");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const requestOtp = trpc.auth.requestOtp.useMutation();
  const verifyOtp = trpc.auth.verifyOtp.useMutation();

  const handleRequestOtp = async () => {
    try {
      await requestOtp.mutateAsync({ email });
      setOtpSent(true);
      toast.success("Код отправлен", {
        description: "Проверьте вашу почту для получения кода",
      });
    } catch (error: any) {
      if (error.message?.includes("not found") || error.message?.includes("не найден")) {
        toast.error("Пользователь не найден", {
          description: "Зарегистрируйтесь на сайте или через Telegram-бот",
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

  // OTP form — shared between admin and agent
  const renderOtpForm = (title: string, description: string) => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={resetForm}>
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
                onKeyDown={(e) => { if (e.key === "Enter" && email) handleRequestOtp(); }}
                autoFocus
              />
            </div>
            <Button
              onClick={handleRequestOtp}
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
              Код придёт на ваш email
            </p>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="otp">Код подтверждения</Label>
              <Input
                id="otp"
                type="text"
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
                onClick={() => setMode("agent")}
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

        {mode === "admin" && renderOtpForm("Вход администратора", "Введите email для получения кода")}
        {mode === "agent" && renderOtpForm("Вход агента", "Введите email, указанный при регистрации")}
      </div>
    </div>
  );
}
