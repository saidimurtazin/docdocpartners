import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Search, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import DashboardLayoutWrapper from "@/components/DashboardLayoutWrapper";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CreateReferralDialog from "@/components/CreateReferralDialog";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useSearch } from "wouter";
import { referralStatusLabels, referralStatusColors, formatCurrency, formatDateRu } from "@/lib/referral-utils";

export default function AgentReferrals() {
  useRequireAuth();
  const { data: referrals, isLoading, refetch } = trpc.dashboard.referrals.useQuery();
  const { data: clinicsList } = trpc.dashboard.clinics.useQuery();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Read clinicId from URL params (from AgentClinics "Направить пациента" button)
  const search = useSearch();
  const params = new URLSearchParams(search);
  const preselectedClinicId = params.get("clinicId") ? Number(params.get("clinicId")) : undefined;

  // Auto-open dialog when clinicId is in URL
  useEffect(() => {
    if (preselectedClinicId) {
      setDialogOpen(true);
    }
  }, [preselectedClinicId]);

  if (isLoading) {
    return (
      <DashboardLayoutWrapper>
        <div className="min-h-screen flex items-center justify-center bg-muted/30">
          <div className="text-center">
            <Users className="w-12 h-12 animate-pulse text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Загрузка рекомендаций...</p>
          </div>
        </div>
      </DashboardLayoutWrapper>
    );
  }

  // Filter referrals
  const filteredReferrals = referrals?.filter((ref: any) => {
    const matchesSearch = ref.patientFullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (ref.patientPhone && ref.patientPhone.includes(searchTerm));
    const matchesStatus = statusFilter === "all" || ref.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  return (
    <DashboardLayoutWrapper>
      <div className="min-h-screen bg-muted/30">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-white py-12">
          <div className="container">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2">Мои рекомендации</h1>
                <p className="text-primary-foreground/80">Все пациенты, которых вы направили</p>
              </div>
              <Button
                variant="secondary"
                size="lg"
                className="gap-2"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="w-5 h-5" />
                Добавить рекомендацию
              </Button>
            </div>
          </div>
        </div>

        {/* Shared Create Referral Dialog */}
        <CreateReferralDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={() => refetch()}
          initialClinicId={preselectedClinicId}
        />

        <div className="container py-8 max-w-7xl">
          {/* Filters */}
          <Card className="border-2 mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по имени или телефону..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Status Filter — shadcn Select */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Все статусы" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    {Object.entries(referralStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Referrals List */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle>
                Всего рекомендаций: {filteredReferrals.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredReferrals.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {searchTerm || statusFilter !== "all"
                      ? "Рекомендации не найдены"
                      : "Пока нет рекомендаций"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {searchTerm || statusFilter !== "all"
                      ? "Попробуйте изменить фильтры"
                      : "Нажмите \u00abДобавить рекомендацию\u00bb чтобы направить пациента"}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredReferrals.map((referral: any) => (
                    <div
                      key={referral.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors gap-4"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-lg mb-1">
                          {referral.patientFullName}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {referral.patientPhone && <div>Tel: {referral.patientPhone}</div>}
                          {referral.patientBirthdate && <div>Д.р.: {referral.patientBirthdate}</div>}
                          <div>Создано: {formatDateRu(referral.createdAt)}</div>
                          {referral.targetClinicIds ? (
                            <div>
                              Клиники:{" "}
                              {(() => {
                                try {
                                  const ids = JSON.parse(referral.targetClinicIds) as number[];
                                  return ids.map(id => clinicsList?.find((c: any) => c.id === id)?.name || `#${id}`).join(", ");
                                } catch { return referral.clinic || "\u2014"; }
                              })()}
                            </div>
                          ) : referral.clinic ? (
                            <div>Клиника: {referral.clinic}</div>
                          ) : (
                            <div className="text-amber-600">Клиника: любая</div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${
                            referralStatusColors[referral.status] || "bg-gray-100 text-gray-800 border-gray-200"
                          }`}
                        >
                          {referralStatusLabels[referral.status] || referral.status}
                        </span>
                        {referral.commissionAmount > 0 && (
                          <div className="text-sm font-semibold text-primary">
                            {formatCurrency(referral.commissionAmount)}
                          </div>
                        )}
                        {referral.notes && (
                          <div className="text-xs text-muted-foreground max-w-xs text-right">
                            {referral.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayoutWrapper>
  );
}
