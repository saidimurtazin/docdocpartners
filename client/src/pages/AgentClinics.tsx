import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Building2, Globe, Phone, Mail, MapPin, Award, Calendar, Languages, Activity, ExternalLink } from "lucide-react";
import DashboardLayoutWrapper from "@/components/DashboardLayoutWrapper";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useState } from "react";

export default function AgentClinics() {
  useRequireAuth();
  const { data: clinics, isLoading } = trpc.dashboard.clinics.useQuery();
  const [search, setSearch] = useState("");

  if (isLoading) {
    return (
      <DashboardLayoutWrapper>
        <div className="min-h-screen flex items-center justify-center bg-muted/30">
          <div className="text-center">
            <Activity className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Загрузка клиник...</p>
          </div>
        </div>
      </DashboardLayoutWrapper>
    );
  }

  const filtered = (clinics || []).filter((c: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name.toLowerCase().includes(s) ||
      c.city?.toLowerCase().includes(s) ||
      c.specializations?.toLowerCase().includes(s);
  });

  const formatCurrency = (kopecks: number) =>
    new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 0 }).format(kopecks / 100);

  return (
    <DashboardLayoutWrapper>
      <div className="min-h-screen bg-muted/30">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-white py-12">
          <div className="container">
            <h1 className="text-4xl font-bold mb-2">Клиники-партнеры</h1>
            <p className="text-primary-foreground/80">Направляйте пациентов в проверенные клиники и зарабатывайте</p>
          </div>
        </div>

        <div className="container py-8">
          {/* Search */}
          <div className="mb-6">
            <Input
              placeholder="Поиск по названию, городу, специализации..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>

          {/* Clinics Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {filtered.map((clinic: any) => (
              <Card key={clinic.id} className="overflow-hidden border-2 hover:border-primary/50 transition-all hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-xl">{clinic.name}</CardTitle>
                    <Badge className="bg-green-600 whitespace-nowrap">
                      {clinic.commissionRate}% комиссия
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Type and ownership */}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm">
                      {clinic.type || "Клиника"} {clinic.ownership ? `• ${clinic.ownership}` : ""}
                    </span>
                  </div>

                  {/* Location */}
                  {(clinic.city || clinic.address) && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">
                        {clinic.city}{clinic.address ? `, ${clinic.address}` : ""}
                      </span>
                    </div>
                  )}

                  {/* Specializations */}
                  {clinic.specializations && (
                    <div className="flex flex-wrap gap-1.5">
                      {clinic.specializations.split(",").map((spec: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {spec.trim()}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Certifications */}
                  {clinic.certifications && (
                    <div className="flex items-start gap-2">
                      <Award className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                      <div className="text-sm">
                        <div className="font-medium">Сертификаты</div>
                        <div className="text-muted-foreground">{clinic.certifications}</div>
                      </div>
                    </div>
                  )}

                  {/* Founded year */}
                  {clinic.foundedYear && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm">На рынке с {clinic.foundedYear}</span>
                    </div>
                  )}

                  {/* Languages */}
                  {clinic.languages && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Languages className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm">{clinic.languages}</span>
                    </div>
                  )}

                  {/* Description */}
                  {clinic.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{clinic.description}</p>
                  )}

                  {/* Key info */}
                  <div className="flex items-center gap-4 pt-2 border-t">
                    {clinic.averageCheck > 0 && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Средний чек: </span>
                        <span className="font-semibold">{formatCurrency(clinic.averageCheck)}</span>
                      </div>
                    )}
                  </div>

                  {/* Contacts */}
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
                    {clinic.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" /> {clinic.phone}
                      </span>
                    )}
                    {clinic.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" /> {clinic.email}
                      </span>
                    )}
                    {clinic.website && (
                      <a
                        href={clinic.website.startsWith("http") ? clinic.website : `https://${clinic.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <Globe className="w-3.5 h-3.5" /> {clinic.website}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {filtered.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                {search ? "Ничего не найдено" : "Пока нет клиник-партнеров"}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayoutWrapper>
  );
}
