import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  Loader2, 
  Shield, 
  AlertCircle,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

/**
 * Session Management Page
 * Shows all active sessions with device info, IP, last activity
 * Allows revoking individual sessions or all except current
 */

interface SessionData {
  id: number;
  deviceInfo: string | null;
  ipAddress: string | null;
  loginMethod: string;
  lastActivityAt: Date;
  createdAt: Date;
  isRevoked: "yes" | "no";
  isCurrent?: boolean;
}

function getDeviceIcon(deviceInfo: string | null) {
  if (!deviceInfo) return <Monitor className="w-5 h-5" />;
  
  const ua = deviceInfo.toLowerCase();
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return <Smartphone className="w-5 h-5" />;
  }
  if (ua.includes("tablet") || ua.includes("ipad")) {
    return <Tablet className="w-5 h-5" />;
  }
  return <Monitor className="w-5 h-5" />;
}

function getDeviceName(deviceInfo: string | null): string {
  if (!deviceInfo) return "Неизвестное устройство";
  
  const ua = deviceInfo;
  
  // Browser detection
  let browser = "Браузер";
  if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edge")) browser = "Edge";
  
  // OS detection
  let os = "";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  
  return os ? `${browser} на ${os}` : browser;
}

function getLoginMethodBadge(method: string) {
  if (method === "telegram") {
    return <Badge variant="outline" className="gap-1">
      <Shield className="w-3 h-3" />
      Telegram
    </Badge>;
  }
  return <Badge variant="outline">{method}</Badge>;
}

export default function AgentSessions() {
  const [revokingSessionId, setRevokingSessionId] = useState<number | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const { data: sessions, isLoading, error, refetch } = trpc.agent.getSessions.useQuery() as {
    data: SessionData[] | undefined;
    isLoading: boolean;
    error: any;
    refetch: () => void;
  };
  const revokeSessionMutation = trpc.agent.revokeSession.useMutation({
    onSuccess: () => {
      refetch();
      setRevokingSessionId(null);
    },
    onError: (error: any) => {
      console.error("Failed to revoke session:", error);
      alert("Не удалось отозвать сессию. Попробуйте снова.");
      setRevokingSessionId(null);
    },
  });

  const revokeAllMutation = trpc.agent.revokeAllOtherSessions.useMutation({
    onSuccess: () => {
      refetch();
      setRevokingAll(false);
    },
    onError: (error: any) => {
      console.error("Failed to revoke all sessions:", error);
      alert("Не удалось отозвать сессии. Попробуйте снова.");
      setRevokingAll(false);
    },
  });

  const handleRevokeSession = (sessionId: number) => {
    if (confirm("Вы уверены, что хотите завершить эту сессию?")) {
      setRevokingSessionId(sessionId);
      revokeSessionMutation.mutate({ sessionId });
    }
  };

  const handleRevokeAllOthers = () => {
    if (confirm("Вы уверены, что хотите завершить все остальные сессии? Вы останетесь авторизованы только на этом устройстве.")) {
      setRevokingAll(true);
      revokeAllMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-6xl py-10">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-6xl py-10">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Не удалось загрузить список сессий. Попробуйте обновить страницу.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const activeSessions = sessions?.filter((s: SessionData) => s.isRevoked === "no") || [];
  const currentSession = activeSessions.find((s: SessionData) => s.isCurrent);
  const otherSessions = activeSessions.filter((s: SessionData) => !s.isCurrent);

  return (
    <div className="container max-w-6xl py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Управление сессиями</h1>
        <p className="text-muted-foreground">
          Просматривайте и управляйте устройствами, с которых вы вошли в систему
        </p>
      </div>

      {/* Security Info */}
      <Alert>
        <Shield className="w-4 h-4" />
        <AlertDescription>
          Если вы видите незнакомое устройство или подозрительную активность, немедленно завершите сессию и смените пароль.
        </AlertDescription>
      </Alert>

      {/* Current Session */}
      {currentSession && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Текущая сессия
            </CardTitle>
            <CardDescription>
              Это устройство, с которого вы сейчас работаете
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <div className="text-muted-foreground">
                {getDeviceIcon(currentSession.deviceInfo)}
              </div>
              <div className="flex-1 space-y-2">
                <div className="font-medium">{getDeviceName(currentSession.deviceInfo)}</div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div>IP: {currentSession.ipAddress || "Неизвестен"}</div>
                  <div>
                    Последняя активность: {formatDistanceToNow(new Date(currentSession.lastActivityAt), { 
                      addSuffix: true, 
                      locale: ru 
                    })}
                  </div>
                  <div>
                    Вход: {formatDistanceToNow(new Date(currentSession.createdAt), { 
                      addSuffix: true, 
                      locale: ru 
                    })}
                  </div>
                </div>
                <div>{getLoginMethodBadge(currentSession.loginMethod)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other Sessions */}
      {otherSessions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Другие сессии ({otherSessions.length})</CardTitle>
                <CardDescription>
                  Устройства, с которых вы входили ранее
                </CardDescription>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRevokeAllOthers}
                disabled={revokingAll}
              >
                {revokingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Завершение...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Завершить все
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Устройство</TableHead>
                  <TableHead>IP-адрес</TableHead>
                  <TableHead>Последняя активность</TableHead>
                  <TableHead>Метод входа</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {otherSessions.map((session: SessionData) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="text-muted-foreground">
                          {getDeviceIcon(session.deviceInfo)}
                        </div>
                        <div>
                          <div className="font-medium">{getDeviceName(session.deviceInfo)}</div>
                          <div className="text-sm text-muted-foreground">
                            Вход {formatDistanceToNow(new Date(session.createdAt), { 
                              addSuffix: true, 
                              locale: ru 
                            })}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {session.ipAddress || "Неизвестен"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(session.lastActivityAt), { 
                        addSuffix: true, 
                        locale: ru 
                      })}
                    </TableCell>
                    <TableCell>
                      {getLoginMethodBadge(session.loginMethod)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeSession(session.id)}
                        disabled={revokingSessionId === session.id}
                      >
                        {revokingSessionId === session.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Завершить"
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* No Other Sessions */}
      {otherSessions.length === 0 && currentSession && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Нет других активных сессий</p>
            <p className="text-sm mt-2">Вы вошли только с этого устройства</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
