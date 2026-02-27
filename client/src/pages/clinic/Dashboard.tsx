import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Users, CheckCircle, TrendingUp, Banknote } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import ClinicLayoutWrapper from "@/components/ClinicLayoutWrapper";

const STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  in_progress: "В работе",
  contacted: "Связались",
  scheduled: "Записан",
  visited: "Пролечен",
  duplicate: "Дубликат",
  no_answer: "Нет ответа",
  cancelled: "Отменён",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  new: "outline",
  in_progress: "secondary",
  contacted: "secondary",
  scheduled: "default",
  visited: "default",
  duplicate: "destructive",
  no_answer: "destructive",
  cancelled: "destructive",
};

function formatAmount(kopecks: number): string {
  return new Intl.NumberFormat("ru-RU").format(kopecks / 100) + " \u20BD";
}

export default function ClinicDashboard() {
  const { data: stats, isLoading: statsLoading } = trpc.clinic.stats.useQuery();
  const { data: recentReferrals, isLoading: referralsLoading, refetch } = trpc.clinic.referrals.useQuery({
    page: 1,
    perPage: 20,
  });

  const isLoading = statsLoading || referralsLoading;

  return (
    <ClinicLayoutWrapper>
      <div className="container py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Дашборд</h1>
          <p className="text-muted-foreground mt-1">
            {stats?.clinicName ? `Клиника: ${stats.clinicName}` : "Обзор направлений"}
          </p>
        </div>

        {/* Stats cards */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Всего направлений</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.total || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Пролечено</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.treated || 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Конверсия</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.conversionRate || 0}%</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Сумма лечения</CardTitle>
                  <Banknote className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatAmount(stats?.totalTreatmentAmount || 0)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Recent referrals */}
            <Card>
              <CardHeader>
                <CardTitle>Последние направления</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ФИО пациента</TableHead>
                        <TableHead>Дата рождения</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Дата направления</TableHead>
                        <TableHead>Сумма лечения</TableHead>
                        <TableHead>Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentReferrals?.items?.map((r: any) => {
                        const isBookedElsewhere = r.clinicStatus === "booked_elsewhere";
                        return (
                          <TableRow key={r.id} className={isBookedElsewhere ? "opacity-60" : ""}>
                            <TableCell className="font-medium">{r.patientFullName}</TableCell>
                            <TableCell>{r.patientBirthdate || "—"}</TableCell>
                            <TableCell>
                              {isBookedElsewhere ? (
                                <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">
                                  Записался в другую клинику
                                </Badge>
                              ) : (
                                <Badge variant={STATUS_VARIANTS[r.status] || "outline"}>
                                  {STATUS_LABELS[r.status] || r.status}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {r.createdAt ? format(new Date(r.createdAt), "dd.MM.yyyy", { locale: ru }) : "—"}
                            </TableCell>
                            <TableCell>
                              {r.treatmentAmount ? formatAmount(r.treatmentAmount) : "—"}
                            </TableCell>
                            <TableCell>
                              {r.bookedClinicId && !isBookedElsewhere && (
                                <span className="text-xs text-green-600">Записан к вам</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(!recentReferrals?.items || recentReferrals.items.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Нет направлений
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </ClinicLayoutWrapper>
  );
}
