import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Loader2, Mail, User, Phone, Briefcase, MapPin, Building2, Link2, FileCheck, CheckCircle2 } from "lucide-react";
import { Link, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const TOTAL_STEPS = 8;

const ROLES = [
  { value: "Врач", label: "Врач" },
  { value: "Координатор", label: "Координатор" },
  { value: "Регистратор", label: "Регистратор" },
  { value: "Прочее", label: "Прочее" },
];

const SPECIALIZATIONS = [
  "Терапевт",
  "Хирург",
  "Кардиолог",
  "Невролог",
  "Педиатр",
  "Онколог",
  "Другая",
];

export default function Register() {
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const refFromUrl = searchParams.get("ref");

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [registrationToken, setRegistrationToken] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [customSpecialization, setCustomSpecialization] = useState("");
  const [city, setCity] = useState("");
  const [excludedClinics, setExcludedClinics] = useState<number[]>([]);
  const [referralCode, setReferralCode] = useState(refFromUrl || "");
  const [contractAccepted, setContractAccepted] = useState(false);
  const [registered, setRegistered] = useState(false);

  const requestOtp = trpc.auth.requestRegistrationOtp.useMutation();
  const verifyOtp = trpc.auth.verifyRegistrationOtp.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const clinicsQuery = trpc.public.clinics.useQuery(undefined, { enabled: step === 6 });

  // Pre-fill referral code from URL
  useEffect(() => {
    if (refFromUrl) setReferralCode(refFromUrl);
  }, [refFromUrl]);

  const handleRequestOtp = async () => {
    if (!email) return;
    try {
      await requestOtp.mutateAsync({ email: email.trim().toLowerCase() });
      setOtpSent(true);
      toast.success("Код отправлен", { description: "Проверьте вашу почту" });
    } catch (error: any) {
      toast.error("Ошибка", { description: error.message || "Не удалось отправить код" });
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    try {
      const result = await verifyOtp.mutateAsync({ email: email.trim().toLowerCase(), code: otpCode });
      setRegistrationToken(result.registrationToken);
      toast.success("Email подтверждён");
      setStep(2);
    } catch (error: any) {
      toast.error("Ошибка", { description: error.message || "Неверный или истекший код" });
    }
  };

  const handleRegister = async () => {
    try {
      const spec = specialization === "Другая" ? customSpecialization : specialization;
      await registerMutation.mutateAsync({
        registrationToken,
        fullName: fullName.trim(),
        phone: phone.trim(),
        role,
        specialization: role === "Врач" ? spec : undefined,
        city: city.trim(),
        excludedClinics: excludedClinics.length > 0 ? excludedClinics : undefined,
        referralCode: referralCode.trim() || undefined,
        contractAccepted,
      });
      setRegistered(true);
      toast.success("Регистрация прошла успешно!");
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        window.location.replace("/dashboard");
      }, 2000);
    } catch (error: any) {
      if (error.message?.includes("истёк")) {
        toast.error("Токен регистрации истёк", { description: "Начните регистрацию заново" });
        setStep(1);
        setOtpSent(false);
        setOtpCode("");
        setRegistrationToken("");
      } else {
        toast.error("Ошибка регистрации", { description: error.message || "Попробуйте позже" });
      }
    }
  };

  const canGoNext = (): boolean => {
    switch (step) {
      case 1: return !!registrationToken;
      case 2: return fullName.trim().split(/\s+/).length === 3 && /^[А-Яа-яЁё\s-]+$/.test(fullName.trim());
      case 3: return phone.replace(/[\s\-()]/g, '').length >= 11;
      case 4: return !!role && (role !== "Врач" || !!specialization && (specialization !== "Другая" || customSpecialization.trim().length >= 2));
      case 5: return city.trim().length >= 2 && /^[А-Яа-яЁё\s-]+$/.test(city.trim());
      case 6: return true; // optional
      case 7: return true; // optional
      case 8: return contractAccepted;
      default: return false;
    }
  };

  const goNext = () => {
    if (step < TOTAL_STEPS && canGoNext()) setStep(step + 1);
  };

  const goBack = () => {
    if (step > 2) setStep(step - 1); // Can't go back to step 1 (email already verified)
  };

  const stepIcons = [Mail, User, Phone, Briefcase, MapPin, Building2, Link2, FileCheck];
  const stepLabels = ["Email", "ФИО", "Телефон", "Роль", "Город", "Клиники", "Реферал", "Договор"];

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <div className="w-full max-w-md text-center">
          <Card>
            <CardContent className="pt-8 pb-8 space-y-4">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <h2 className="text-2xl font-bold">Заявка отправлена!</h2>
              <p className="text-muted-foreground">
                Ваш аккаунт будет активирован администратором. Мы уведомим вас по email.
              </p>
              <p className="text-sm text-muted-foreground">
                Перенаправляем в личный кабинет...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <Link href="/">
            <div className="inline-flex items-center gap-3 mb-3 cursor-pointer hover:opacity-80 transition-opacity">
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663256942923/xohsFKyBQyuhihyR.png"
                alt="DocPartner Logo"
                className="w-10 h-10 rounded-lg"
              />
              <div className="flex flex-col leading-tight text-left">
                <span className="font-bold text-lg">DocDoc</span>
                <span className="font-bold text-lg">Partner</span>
              </div>
            </div>
          </Link>
          <p className="text-muted-foreground text-sm">Регистрация агента</p>
        </div>

        {/* Progress */}
        {step > 1 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Шаг {step} из {TOTAL_STEPS}</span>
              <span className="text-xs text-muted-foreground">{stepLabels[step - 1]}</span>
            </div>
            <Progress value={(step / TOTAL_STEPS) * 100} className="h-1.5" />
          </div>
        )}

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              {step > 2 && (
                <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              )}
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {(() => {
                    const Icon = stepIcons[step - 1];
                    return <Icon className="w-5 h-5 text-primary" />;
                  })()}
                  {stepLabels[step - 1]}
                </CardTitle>
                <CardDescription>
                  {step === 1 && "Подтвердите email для начала регистрации"}
                  {step === 2 && "Введите ваше полное имя (кириллица)"}
                  {step === 3 && "Введите номер телефона"}
                  {step === 4 && "Укажите вашу роль"}
                  {step === 5 && "Укажите ваш город"}
                  {step === 6 && "Исключите клиники (необязательно)"}
                  {step === 7 && "Введите реферальный код (необязательно)"}
                  {step === 8 && "Проверьте данные и примите условия"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Step 1: Email + OTP */}
            {step === 1 && (
              <>
                {!otpSent ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="ivan@mail.ru"
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
                        "Получить код подтверждения"
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Код придёт на указанный email
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
                        "Подтвердить"
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
              </>
            )}

            {/* Step 2: Full Name */}
            {step === 2 && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Фамилия Имя Отчество</Label>
                <Input
                  id="fullName"
                  placeholder="Иванов Иван Иванович"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canGoNext()) goNext(); }}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Фамилия Имя Отчество (ровно 3 слова, русские буквы)</p>
              </div>
            )}

            {/* Step 3: Phone */}
            {step === 3 && (
              <div className="space-y-2">
                <Label htmlFor="phone">Номер телефона</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+79001234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canGoNext()) goNext(); }}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Международный формат с кодом страны</p>
              </div>
            )}

            {/* Step 4: Role + Specialization */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Роль</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map((r) => (
                      <Button
                        key={r.value}
                        variant={role === r.value ? "default" : "outline"}
                        onClick={() => { setRole(r.value); if (r.value !== "Врач") setSpecialization(""); }}
                        className="h-auto py-3"
                      >
                        {r.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {role === "Врач" && (
                  <div className="space-y-2">
                    <Label>Специализация</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {SPECIALIZATIONS.map((s) => (
                        <Button
                          key={s}
                          variant={specialization === s ? "default" : "outline"}
                          onClick={() => setSpecialization(s)}
                          size="sm"
                          className="h-auto py-2 text-sm"
                        >
                          {s}
                        </Button>
                      ))}
                    </div>
                    {specialization === "Другая" && (
                      <Input
                        placeholder="Ваша специализация"
                        value={customSpecialization}
                        onChange={(e) => setCustomSpecialization(e.target.value)}
                        autoFocus
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 5: City */}
            {step === 5 && (
              <div className="space-y-2">
                <Label htmlFor="city">Город</Label>
                <Input
                  id="city"
                  placeholder="Москва"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canGoNext()) goNext(); }}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Только русские буквы</p>
              </div>
            )}

            {/* Step 6: Excluded Clinics */}
            {step === 6 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Если вы не хотите, чтобы ваши пациенты направлялись в определённые клиники, отметьте их ниже.
                </p>
                {clinicsQuery.isLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : clinicsQuery.data && clinicsQuery.data.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-3">
                    {clinicsQuery.data.map((clinic: any) => (
                      <label key={clinic.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded">
                        <Checkbox
                          checked={excludedClinics.includes(clinic.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setExcludedClinics([...excludedClinics, clinic.id]);
                            } else {
                              setExcludedClinics(excludedClinics.filter(id => id !== clinic.id));
                            }
                          }}
                        />
                        <span className="text-sm">{clinic.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">Нет доступных клиник</p>
                )}
              </div>
            )}

            {/* Step 7: Referral Code */}
            {step === 7 && (
              <div className="space-y-2">
                <Label htmlFor="referralCode">Реферальный код</Label>
                <Input
                  id="referralCode"
                  placeholder="Код приглашения"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") goNext(); }}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Если вас пригласил другой агент, введите его реферальный код
                </p>
              </div>
            )}

            {/* Step 8: Contract + Summary + Submit */}
            {step === 8 && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                  <h3 className="font-semibold text-base mb-3">Ваши данные:</h3>
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                    <span className="text-muted-foreground">Email:</span>
                    <span>{email}</span>
                    <span className="text-muted-foreground">ФИО:</span>
                    <span>{fullName}</span>
                    <span className="text-muted-foreground">Телефон:</span>
                    <span>{phone}</span>
                    <span className="text-muted-foreground">Роль:</span>
                    <span>{role}{specialization ? ` — ${specialization === "Другая" ? customSpecialization : specialization}` : ""}</span>
                    <span className="text-muted-foreground">Город:</span>
                    <span>{city}</span>
                    {excludedClinics.length > 0 && (
                      <>
                        <span className="text-muted-foreground">Исключено клиник:</span>
                        <span>{excludedClinics.length}</span>
                      </>
                    )}
                    {referralCode && (
                      <>
                        <span className="text-muted-foreground">Реферал:</span>
                        <span>{referralCode}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Contract */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-medium">Условия работы:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                    <li>Комиссия: от 7% от суммы лечения</li>
                    <li>Минимальная выплата: 1 000 руб.</li>
                    <li>Срок выплаты: 3-5 рабочих дней</li>
                    <li>Самозанятые: 6% НПД (оплачиваете самостоятельно)</li>
                  </ul>
                  <label className="flex items-start gap-3 cursor-pointer pt-2">
                    <Checkbox
                      checked={contractAccepted}
                      onCheckedChange={(checked) => setContractAccepted(!!checked)}
                      className="mt-0.5"
                    />
                    <span className="text-sm">
                      Я принимаю условия{" "}
                      <a href="/contract" target="_blank" className="text-primary hover:underline">
                        договора-оферты
                      </a>{" "}
                      и даю согласие на обработку персональных данных
                    </span>
                  </label>
                </div>

                <Button
                  onClick={handleRegister}
                  disabled={!contractAccepted || registerMutation.isPending}
                  className="w-full"
                  size="lg"
                >
                  {registerMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Регистрация...</>
                  ) : (
                    "Зарегистрироваться"
                  )}
                </Button>
              </div>
            )}

            {/* Navigation buttons (steps 2-7) */}
            {step >= 2 && step <= 7 && (
              <div className="flex gap-2 pt-2">
                {step === 6 || step === 7 ? (
                  <>
                    <Button variant="outline" onClick={goNext} className="flex-1">
                      Пропустить
                    </Button>
                    <Button onClick={goNext} disabled={!canGoNext()} className="flex-1">
                      Далее <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </>
                ) : (
                  <Button onClick={goNext} disabled={!canGoNext()} className="w-full">
                    Далее <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom links */}
        <div className="text-center mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            Уже есть аккаунт?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Войти
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">
            или{" "}
            <a
              href="https://t.me/docpartnerbot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              зарегистрироваться через Telegram-бот
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
