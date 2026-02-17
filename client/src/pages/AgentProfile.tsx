import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, CreditCard, Save, CheckCircle2, Edit, Smartphone, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";
import DashboardLayoutWrapper from "@/components/DashboardLayoutWrapper";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function AgentProfile() {
  useRequireAuth();
  const { data: profile, isLoading, refetch } = trpc.dashboard.profile.useQuery();
  const updateProfile = trpc.dashboard.updateProfile.useMutation();
  const updatePersonalInfo = trpc.dashboard.updatePersonalInfo.useMutation();

  // Personal info state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [role, setRole] = useState("");
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);

  // Payment details state
  const [inn, setInn] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"card" | "sbp" | "bank_account">("card");
  const [cardNumber, setCardNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankBik, setBankBik] = useState("");
  const [isSelfEmployed, setIsSelfEmployed] = useState<"yes" | "no" | "unknown">("unknown");

  // Initialize form when profile loads
  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || "");
      setEmail(profile.email || "");
      setPhone(profile.phone || "");
      setCity(profile.city || "");
      setSpecialization(profile.specialization || "");
      setRole(profile.role || "");
      setInn(profile.inn || "");
      setPayoutMethod(profile.payoutMethod || "card");
      setCardNumber(profile.cardNumber || "");
      setBankName(profile.bankName || "");
      setBankAccount(profile.bankAccount || "");
      setBankBik(profile.bankBik || "");
      setIsSelfEmployed(profile.isSelfEmployed || "unknown");
    }
  }, [profile]);

  const handleSavePersonalInfo = async () => {
    try {
      await updatePersonalInfo.mutateAsync({
        fullName,
        email,
        phone,
        city,
        specialization,
        role,
      });
      await refetch();
      setIsEditingPersonal(false);
      alert("✅ Личные данные успешно обновлены!");
    } catch (error) {
      alert("❌ Ошибка сохранения. Попробуйте еще раз.");
    }
  };

  const handleSavePaymentDetails = async () => {
    // Client-side MIR card validation
    if (payoutMethod === "card" && cardNumber) {
      const digits = cardNumber.replace(/\D/g, "");
      if (digits.length < 13 || digits.length > 19) {
        alert("❌ Номер карты должен содержать 13-19 цифр");
        return;
      }
      const prefix = parseInt(digits.substring(0, 4), 10);
      if (prefix < 2200 || prefix > 2204) {
        alert("❌ Принимаются только карты МИР (номер начинается с 2200-2204).\nVisa и Mastercard не поддерживаются.");
        return;
      }
    }

    try {
      await updateProfile.mutateAsync({
        inn,
        payoutMethod,
        cardNumber: payoutMethod === "card" ? cardNumber : undefined,
        bankName: payoutMethod === "bank_account" ? bankName : undefined,
        bankAccount: payoutMethod === "bank_account" ? bankAccount : undefined,
        bankBik: payoutMethod === "bank_account" ? bankBik : undefined,
        isSelfEmployed,
      });
      await refetch();
      alert("✅ Реквизиты успешно сохранены!");
    } catch (error: any) {
      const msg = error?.message || "Ошибка сохранения. Попробуйте еще раз.";
      alert(`❌ ${msg}`);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayoutWrapper>
        <div className="min-h-screen flex items-center justify-center bg-muted/30">
          <div className="text-center">
            <User className="w-12 h-12 animate-pulse text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Загрузка профиля...</p>
          </div>
        </div>
      </DashboardLayoutWrapper>
    );
  }

  return (
    <DashboardLayoutWrapper>
      <div className="min-h-screen bg-muted/30">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-white py-12">
          <div className="container">
            <h1 className="text-4xl font-bold mb-2">Профиль и реквизиты</h1>
            <p className="text-primary-foreground/80">Управление вашими данными и платежными реквизитами</p>
          </div>
        </div>

        <div className="container py-8 max-w-4xl">
          {/* Personal Info Card */}
          <Card className="border-2 mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Личная информация
              </CardTitle>
              {!isEditingPersonal && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingPersonal(true)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Редактировать
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditingPersonal ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fullName">ФИО</Label>
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Иванов Иван Иванович"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ivanov@example.com"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Телефон</Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+79991234567"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="role">Роль</Label>
                      <Input
                        id="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        placeholder="Врач, координатор, администратор"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">Город</Label>
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Москва"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="specialization">Специализация</Label>
                      <Input
                        id="specialization"
                        value={specialization}
                        onChange={(e) => setSpecialization(e.target.value)}
                        placeholder="Терапевт, хирург, кардиолог"
                        className="mt-2"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-4">
                    <Button
                      onClick={handleSavePersonalInfo}
                      disabled={updatePersonalInfo.isPending}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {updatePersonalInfo.isPending ? (
                        <>
                          <Save className="w-4 h-4 mr-2 animate-spin" />
                          Сохранение...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Сохранить изменения
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditingPersonal(false);
                        // Reset to original values
                        if (profile) {
                          setFullName(profile.fullName || "");
                          setEmail(profile.email || "");
                          setPhone(profile.phone || "");
                          setCity(profile.city || "");
                          setSpecialization(profile.specialization || "");
                          setRole(profile.role || "");
                        }
                      }}
                    >
                      Отмена
                    </Button>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">ФИО</Label>
                    <p className="font-semibold">{fullName || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-semibold">{email || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Телефон</Label>
                    <p className="font-semibold">{phone || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Роль</Label>
                    <p className="font-semibold">{role || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Город</Label>
                    <p className="font-semibold">{city || "—"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Специализация</Label>
                    <p className="font-semibold">{specialization || "—"}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Details Card */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                Платежные реквизиты
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Self-employed Status */}
              <div>
                <Label htmlFor="selfEmployed">Статус самозанятого</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsSelfEmployed("yes")}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      isSelfEmployed === "yes"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-border hover:border-green-300"
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Да, самозанятый</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSelfEmployed("no")}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      isSelfEmployed === "no"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="font-medium">Нет, не самозанятый</span>
                  </button>
                </div>

                {/* Benefit box for self-employed */}
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 mb-2">Почему стоит стать самозанятым?</h4>
                  <ul className="text-sm space-y-1 text-green-700">
                    <li>&#x2022; Вознаграждение <b>10%</b> вместо 7%</li>
                    <li>&#x2022; Налог всего <b>6%</b> (платится автоматически)</li>
                    <li>&#x2022; Регистрация за <b>10 минут</b> в приложении</li>
                    <li>&#x2022; Никакой отчётности — всё делает приложение</li>
                  </ul>
                  {isSelfEmployed !== "yes" && (
                    <a
                      href="https://lknpd.nalog.ru/auth/login"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Стать самозанятым (Мой Налог)
                    </a>
                  )}
                </div>
              </div>

              {/* INN */}
              <div>
                <Label htmlFor="inn">ИНН</Label>
                <Input
                  id="inn"
                  value={inn}
                  onChange={(e) => setInn(e.target.value)}
                  placeholder="123456789012"
                  maxLength={12}
                  className="mt-2"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  12 цифр для физических лиц
                </p>
              </div>

              {/* Payout Method Selector */}
              <div>
                <Label>Способ получения выплат</Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setPayoutMethod("card")}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      payoutMethod === "card"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span className="font-medium">На карту</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutMethod("sbp")}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                      payoutMethod === "sbp"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Smartphone className="w-5 h-5" />
                    <span className="font-medium">По СБП</span>
                  </button>
                </div>
              </div>

              {/* Card Number (shown when card selected) */}
              {payoutMethod === "card" && (
                <div>
                  <Label htmlFor="cardNumber">Номер карты</Label>
                  <Input
                    id="cardNumber"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ""))}
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
                    className="mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Только карты МИР (номер начинается с 2200-2204)
                  </p>
                </div>
              )}

              {/* SBP info (shown when SBP selected) */}
              {payoutMethod === "sbp" && (
                <div className="bg-muted/50 border border-border rounded-lg p-4">
                  <Label className="text-muted-foreground">Телефон для СБП</Label>
                  <p className="font-semibold text-lg mt-1">{phone || "Не указан"}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Выплаты по СБП приходят на номер телефона из вашего профиля
                  </p>
                </div>
              )}

              {/* Bank details (legacy, shown when bank_account selected) */}
              {payoutMethod === "bank_account" && (
                <>
                  <div>
                    <Label htmlFor="bankName">Название банка</Label>
                    <Input
                      id="bankName"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="Сбербанк"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bankAccount">Номер счета</Label>
                    <Input
                      id="bankAccount"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      placeholder="40817810099910004312"
                      maxLength={20}
                      className="mt-2"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      20 цифр расчетного счета
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="bankBik">БИК банка</Label>
                    <Input
                      id="bankBik"
                      value={bankBik}
                      onChange={(e) => setBankBik(e.target.value)}
                      placeholder="044525225"
                      maxLength={9}
                      className="mt-2"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      9 цифр банковского идентификационного кода
                    </p>
                  </div>
                </>
              )}

              {/* Save Button */}
              <div className="flex items-center gap-3 pt-4">
                <Button
                  onClick={handleSavePaymentDetails}
                  disabled={updateProfile.isPending}
                  className="bg-primary hover:bg-primary/90"
                >
                  {updateProfile.isPending ? (
                    <>
                      <Save className="w-4 h-4 mr-2 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Сохранить реквизиты
                    </>
                  )}
                </Button>
                {updateProfile.isSuccess && (
                  <span className="text-sm text-primary font-medium">
                    ✓ Сохранено
                  </span>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mt-6">
                <h4 className="font-semibold text-primary mb-2">💡 Важная информация</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Реквизиты нужны для выплаты вознаграждения</li>
                  <li>• Выплаты на карту и по СБП обрабатываются автоматически</li>
                  <li>• Для СБП используется номер телефона из профиля</li>
                  <li>• Минимальная сумма для вывода — 1 000 ₽</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayoutWrapper>
  );
}
