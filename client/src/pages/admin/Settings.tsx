import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Settings as SettingsIcon, Plus, Trash2, Save, Percent, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";
import AdminLayoutWrapper from "@/components/AdminLayoutWrapper";

interface Tier {
  minMonthlyRevenue: number; // в копейках
  commissionRate: number;    // в процентах
}

export default function AdminSettings() {
  const { user } = useAuth();
  const { data: tiers, isLoading, refetch } = trpc.admin.settings.getCommissionTiers.useQuery();
  const saveTiers = trpc.admin.settings.setCommissionTiers.useMutation();

  const [editTiers, setEditTiers] = useState<{ minRub: string; rate: string }[]>([]);
  const [saved, setSaved] = useState(false);

  // Инициализировать из данных
  useEffect(() => {
    if (tiers && tiers.length > 0) {
      setEditTiers(tiers.map((t: Tier) => ({
        minRub: String(t.minMonthlyRevenue / 100), // копейки → рубли
        rate: String(t.commissionRate),
      })));
    } else if (tiers && tiers.length === 0) {
      // Если тиров нет, показать дефолтные
      setEditTiers([
        { minRub: "0", rate: "7" },
        { minRub: "1000000", rate: "10" },
      ]);
    }
  }, [tiers]);

  const addTier = () => {
    setEditTiers([...editTiers, { minRub: "", rate: "" }]);
  };

  const removeTier = (idx: number) => {
    setEditTiers(editTiers.filter((_, i) => i !== idx));
  };

  const updateTier = (idx: number, field: "minRub" | "rate", value: string) => {
    const updated = [...editTiers];
    updated[idx] = { ...updated[idx], [field]: value };
    setEditTiers(updated);
    setSaved(false);
  };

  const handleSave = async () => {
    const tiersData = editTiers
      .filter(t => t.minRub !== "" && t.rate !== "")
      .map(t => ({
        minMonthlyRevenue: Math.round(parseFloat(t.minRub) * 100), // рубли → копейки
        commissionRate: parseFloat(t.rate),
      }))
      .sort((a, b) => a.minMonthlyRevenue - b.minMonthlyRevenue);

    try {
      await saveTiers.mutateAsync({ tiers: tiersData });
      setSaved(true);
      await refetch();
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert(`Ошибка: ${e.message}`);
    }
  };

  if (!user || user.role !== "admin") return null;

  return (
    <AdminLayoutWrapper>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-primary" />
            Настройки
          </h1>
          <p className="text-muted-foreground mt-1">Глобальные параметры системы</p>
        </div>

        {/* Commission Tiers Card */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-primary" />
              Тарифы комиссии агентов
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Ставка комиссии определяется суммой лечения всех рекомендаций агента за месяц.
              При достижении порога — ставка применяется ко ВСЕМ рекомендациям этого месяца.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-muted-foreground">Загрузка...</p>
            ) : (
              <>
                {/* Tier rows */}
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-3 text-xs font-semibold text-muted-foreground uppercase">
                    <div className="col-span-5">Порог (сумма лечения за месяц)</div>
                    <div className="col-span-4">Ставка комиссии</div>
                    <div className="col-span-3"></div>
                  </div>

                  {editTiers.map((tier, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-5 relative">
                        <Input
                          type="number"
                          value={tier.minRub}
                          onChange={(e) => updateTier(idx, "minRub", e.target.value)}
                          placeholder="0"
                          min="0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₽</span>
                      </div>
                      <div className="col-span-4 relative">
                        <Input
                          type="number"
                          value={tier.rate}
                          onChange={(e) => updateTier(idx, "rate", e.target.value)}
                          placeholder="7"
                          min="0"
                          max="100"
                          step="0.5"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                      <div className="col-span-3 flex gap-2">
                        {editTiers.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTier(idx)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2 border-t">
                  <Button variant="outline" onClick={addTier} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить тир
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saveTiers.isPending}
                    size="sm"
                    className="bg-primary"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saveTiers.isPending ? "Сохранение..." : "Сохранить"}
                  </Button>
                  {saved && (
                    <span className="text-sm text-green-600 font-medium">✓ Сохранено</span>
                  )}
                </div>

                {/* Example */}
                <div className="bg-muted/50 rounded-lg p-4 mt-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Пример расчёта
                  </h4>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>При тирах: 0₽ → 7%, 1 000 000₽ → 10%</p>
                    <p>• Апрель: агент привёл пациентов на 900 000₽ → 7% → комиссия 63 000₽</p>
                    <p>• Май: агент привёл на 1 100 000₽ → 10% → комиссия 110 000₽</p>
                    <p>• Итого к выводу: 173 000₽</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayoutWrapper>
  );
}
