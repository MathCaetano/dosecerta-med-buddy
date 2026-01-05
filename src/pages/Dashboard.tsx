import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle, Bell, BellOff, Wifi, AlertTriangle } from "lucide-react";
import { useFeedback } from "@/contexts/FeedbackContext";
import { getDelayWarning } from "@/utils/gamification";
import { useNotifications } from "@/hooks/useNotifications";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useFCM } from "@/hooks/useFCM";
import { useDailyReset } from "@/hooks/useDailyReset";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  getDoseStatus, 
  canPerformAction, 
  logDoseStatusAudit,
  DEFAULT_TOLERANCE_MINUTES,
  type DoseStatusType,
  type DoseStatusResult
} from "@/utils/doseStatus";

interface Medicamento {
  id: string;
  nome: string;
  dosagem: string;
  observacoes: string | null;
}

interface Lembrete {
  id: string;
  horario: string;
  periodo: string;
  ativo: boolean;
  medicamento_id: string;
}

interface HistoricoDose {
  id: string;
  lembrete_id: string;
  data: string;
  status: "tomado" | "esquecido" | "pendente";
}

const Dashboard = () => {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const notifications = useNotifications();
  const fcm = useFCM();
  const { trackActionTaken } = useAnalytics();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);
  const [historico, setHistorico] = useState<HistoricoDose[]>([]);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [showFCMPrompt, setShowFCMPrompt] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // ✅ Atualizar o tempo a cada segundo para recalcular estados
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Função interna de carregamento (sem state loading para evitar flickering no reset)
  const loadDataInternal = useCallback(async () => {
    // Carregar medicamentos
    const { data: medsData } = await supabase
      .from("medicamentos")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (medsData) setMedicamentos(medsData);

    // Carregar lembretes ativos com informações do medicamento
    const { data: lemData } = await supabase
      .from("lembretes")
      .select(`
        *,
        medicamentos!inner(nome, dosagem)
      `)
      .eq("ativo", true);
    
    if (lemData) {
      setLembretes(lemData);

      // Agendar notificações se já tem permissão
      if (notifications.isInitialized) {
        const lembretesFormatados = lemData.map((l: any) => ({
          id: l.id,
          medicamento_id: l.medicamento_id,
          medicamento_nome: l.medicamentos.nome,
          dosagem: l.medicamentos.dosagem,
          horario: l.horario,
          ativo: l.ativo
        }));

        await notifications.scheduleAllForToday(lembretesFormatados);
      }
    }

    // Carregar histórico de hoje
    const today = new Date().toISOString().split("T")[0];
    const { data: histData } = await supabase
      .from("historico_doses")
      .select("*")
      .eq("data", today);
    
    if (histData) {
      setHistorico(histData as HistoricoDose[]);
    }
  }, [notifications.isInitialized]);

  // Callback para quando o reset diário completar
  const handleDailyResetComplete = useCallback(() => {
    console.log("[Dashboard] Reset diário concluído, recarregando dados...");
    loadDataInternal();
  }, [loadDataInternal]);

  // Hook de reset diário - executa automaticamente quando necessário
  useDailyReset(user?.id || null, handleDailyResetComplete);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      } else {
        loadData();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Verificar e solicitar permissão de notificações
  useEffect(() => {
    if (notifications.isSupported && notifications.permission === "default" && lembretes.length > 0) {
      // Mostrar prompt apenas se usuário tem lembretes
      setShowNotificationPrompt(true);
    }
  }, [notifications.isSupported, notifications.permission, lembretes.length]);

  // Verificar se deve solicitar FCM (após notificações básicas)
  useEffect(() => {
    if (
      fcm.isSupported && 
      !fcm.isRegistered && 
      notifications.permission === "granted" &&
      lembretes.length > 0
    ) {
      // Mostrar prompt de FCM após notificações básicas ativadas
      setShowFCMPrompt(true);
    }
  }, [fcm.isSupported, fcm.isRegistered, notifications.permission, lembretes.length]);

  const loadData = async () => {
    setLoading(true);
    await loadDataInternal();
    setLoading(false);
  };

  // Habilitar notificações
  const handleEnableNotifications = async () => {
    const result = await notifications.requestPermission();
    
    if (result === "granted") {
      feedback.success("Notificações ativadas! Você será avisado nos horários programados.");
      setShowNotificationPrompt(false);
      
      // Agendar notificações imediatamente
      if (notifications.isInitialized) {
        const { data: lemData } = await supabase
          .from("lembretes")
          .select(`
            *,
            medicamentos!inner(nome, dosagem)
          `)
          .eq("ativo", true);

        if (lemData) {
          const lembretesFormatados = lemData.map((l: any) => ({
            id: l.id,
            medicamento_id: l.medicamento_id,
            medicamento_nome: l.medicamentos.nome,
            dosagem: l.medicamentos.dosagem,
            horario: l.horario,
            ativo: l.ativo
          }));

          const scheduled = await notifications.scheduleAllForToday(lembretesFormatados);
          
          if (scheduled > 0) {
            feedback.info(`${scheduled} notificações agendadas para hoje!`);
          }
        }
      }
    } else {
      feedback.warning("Notificações bloqueadas. Você pode ativar nas configurações do navegador.");
    }
  };

  // Habilitar push notifications (FCM)
  const handleEnableFCM = async () => {
    const success = await fcm.registerFCM();
    
    if (success) {
      setShowFCMPrompt(false);
    }
  };

  /**
   * ✅ FUNÇÃO CENTRAL: Obter status calculado de uma dose
   * Usa a função getDoseStatus do módulo centralizado
   */
  const getCalculatedDoseStatus = useCallback((lembreteId: string, horario: string): DoseStatusResult => {
    const today = new Date().toISOString().split("T")[0];
    const hist = historico.find(h => h.lembrete_id === lembreteId && h.data === today);
    const savedStatus = hist?.status || null;
    
    return getDoseStatus(currentTime, horario, savedStatus, DEFAULT_TOLERANCE_MINUTES);
  }, [historico, currentTime]);

  /**
   * ✅ Marcar dose com validação centralizada
   */
  const marcarDose = async (lembreteId: string, status: "tomado" | "esquecido") => {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toTimeString().split(" ")[0];
    const lembrete = lembretes.find(l => l.id === lembreteId);
    const horarioLembrete = lembrete?.horario || "";
    
    // Buscar status atual salvo
    const existing = historico.find(h => h.lembrete_id === lembreteId && h.data === today);
    const savedStatus = existing?.status || null;
    
    // ✅ VALIDAÇÃO CENTRALIZADA: Usar função canPerformAction
    const validation = canPerformAction(horarioLembrete, status, savedStatus, DEFAULT_TOLERANCE_MINUTES);
    
    if (!validation.allowed) {
      feedback.warning(validation.reason || "Ação não permitida no momento.");
      
      // Log de auditoria
      console.log(`[AUDIT] Ação bloqueada: ${status} para ${lembreteId}`, {
        horario: horarioLembrete,
        savedStatus,
        reason: validation.reason,
        timestamp: new Date().toISOString()
      });
      
      return;
    }
    
    // Log de auditoria antes da ação
    const medicamento = medicamentos.find(m => m.id === lembrete?.medicamento_id);
    const doseStatus = getCalculatedDoseStatus(lembreteId, horarioLembrete);
    logDoseStatusAudit(lembreteId, medicamento?.nome || 'Desconhecido', doseStatus);

    if (existing) {
      const { error } = await supabase
        .from("historico_doses")
        .update({ status, horario_real: now })
        .eq("id", existing.id);

      if (error) {
        feedback.error("Erro ao atualizar dose");
      } else {
        // Rastrear ação se foi marcado como tomado
        if (status === "tomado") {
          if (medicamento && lembrete) {
            await trackActionTaken(lembrete.id, medicamento.id);
          }
          
          // Cancelar notificações para esta dose
          await notifications.cancelNotification(lembreteId);
          
          const [horaLembrete, minutoLembrete] = horarioLembrete.split(":").map(Number);
          const [horaReal, minutoReal] = now.split(":").map(Number);
          const delayMinutes = (horaReal * 60 + minutoReal) - (horaLembrete * 60 + minutoLembrete);
          const warningMsg = getDelayWarning(Math.abs(delayMinutes));
          
          feedback.success(
            delayMinutes > 30 
              ? `Dose marcada! ${warningMsg || ""}` 
              : "Dose marcada no horário! Continue assim! ✨"
          );
        } else {
          feedback.info("Dose marcada como esquecida. Próxima tente não esquecer!");
        }
        loadData();
      }
    } else {
      // ✅ Usar upsert para evitar duplicatas
      const { error } = await supabase
        .from("historico_doses")
        .upsert(
          {
            lembrete_id: lembreteId,
            data: today,
            horario_real: now,
            status,
          },
          {
            onConflict: "lembrete_id,data",
          }
        );

      if (error) {
        feedback.error("Erro ao registrar dose");
      } else {
        // Rastrear ação se foi marcado como tomado
        if (status === "tomado") {
          if (medicamento && lembrete) {
            await trackActionTaken(lembrete.id, medicamento.id);
          }
          
          // Cancelar notificações para esta dose
          await notifications.cancelNotification(lembreteId);
          
          feedback.success("Dose marcada! Você está no caminho certo! 💪");
        } else {
          feedback.warning("Dose marcada como esquecida");
        }
        loadData();
      }
    }
  };

  const getMedicamentoNome = (medicamentoId: string) => {
    const med = medicamentos.find(m => m.id === medicamentoId);
    return med ? `${med.nome} (${med.dosagem})` : "Medicamento";
  };

  /**
   * ✅ Ícone baseado no status calculado
   */
  const getStatusIcon = (status: DoseStatusType) => {
    switch (status) {
      case "tomado":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "esquecido":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case "ativo":
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      default:
        return <Clock className="h-5 w-5 text-blue-600" />;
    }
  };

  /**
   * ✅ Badge baseado no status calculado
   */
  const getStatusBadge = (status: DoseStatusType, minutesUntilActive?: number) => {
    const variants: Record<DoseStatusType, string> = {
      tomado: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      esquecido: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      ativo: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      pendente: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    };

    const labels: Record<DoseStatusType, string> = {
      tomado: "✓ Tomado",
      esquecido: "Esquecido",
      ativo: "🔔 Tome agora!",
      pendente: minutesUntilActive !== undefined && minutesUntilActive > 0 
        ? `⏰ Em ${minutesUntilActive} min` 
        : "⏰ Pendente",
    };

    return (
      <Badge className={variants[status] || variants.pendente}>
        {labels[status]}
      </Badge>
    );
  };

  /**
   * ✅ Totais calculados corretamente
   */
  const getTotaisHoje = useMemo(() => {
    const total = lembretes.length;
    let tomados = 0;
    let pendentes = 0;
    let ativos = 0;
    let esquecidos = 0;

    lembretes.forEach(l => {
      const result = getCalculatedDoseStatus(l.id, l.horario);
      switch (result.status) {
        case "tomado": tomados++; break;
        case "pendente": pendentes++; break;
        case "ativo": ativos++; break;
        case "esquecido": esquecidos++; break;
      }
    });

    return { total, tomados, pendentes, ativos, esquecidos };
  }, [lembretes, getCalculatedDoseStatus]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const { total, tomados, pendentes, ativos, esquecidos } = getTotaisHoje;

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <main className="max-w-4xl mx-auto space-y-6">
        {/* Prompt de Notificações Básicas */}
        {showNotificationPrompt && (
          <Alert className="border-primary">
            <Bell className="h-4 w-4" />
            <AlertTitle>Ative as notificações!</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span className="text-sm">
                Receba lembretes nos horários dos seus medicamentos.
              </span>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleEnableNotifications}>
                  Ativar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNotificationPrompt(false)}>
                  Agora não
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Prompt de Push Notifications (FCM) */}
        {showFCMPrompt && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
            <Wifi className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-900 dark:text-green-100">
              ✨ Notificações Push Avançadas
            </AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span className="text-sm text-green-800 dark:text-green-200">
                Ative para receber notificações <strong>mesmo com o app completamente fechado</strong>. 
                Garantia de 100% de entrega via servidor!
              </span>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleEnableFCM}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Ativar Push
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowFCMPrompt(false)}>
                  Depois
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Status das notificações */}
        {notifications.isSupported && (
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-card border rounded-lg p-3">
              <div className="flex items-center gap-2">
                {notifications.permission === "granted" ? (
                  <>
                    <Bell className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">
                      Notificações ativas
                    </span>
                  </>
                ) : (
                  <>
                    <BellOff className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Notificações desativadas
                    </span>
                  </>
                )}
              </div>
              {notifications.permission !== "granted" && (
                <Button size="sm" variant="outline" onClick={handleEnableNotifications}>
                  Ativar
                </Button>
              )}
            </div>

            {/* Status FCM */}
            {fcm.isSupported && notifications.permission === "granted" && (
              <div className="flex items-center justify-between bg-card border rounded-lg p-3">
                <div className="flex items-center gap-2">
                  {fcm.isRegistered ? (
                    <>
                      <Wifi className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">
                        Push notifications ativas
                      </span>
                    </>
                  ) : (
                    <>
                      <Wifi className="h-4 w-4 text-orange-600" />
                      <span className="text-sm text-muted-foreground">
                        Push notifications desativadas
                      </span>
                    </>
                  )}
                </div>
                {!fcm.isRegistered && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleEnableFCM}
                    className="border-green-600 text-green-600 hover:bg-green-50"
                  >
                    Ativar Push
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ✅ Resumo do dia com estados corretos */}
        <div className="bg-card border rounded-lg p-4">
          <p className="text-base text-muted-foreground">
            📅 Hoje: <strong>{total}</strong> lembretes • 
            ✅ <strong>{tomados}</strong> tomados • 
            🔔 <strong>{ativos}</strong> ativos • 
            ⏰ <strong>{pendentes}</strong> pendentes
            {esquecidos > 0 && <> • ❌ <strong>{esquecidos}</strong> esquecidos</>}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Lembretes de Hoje</CardTitle>
            <CardDescription className="text-base">
              Acompanhe seus medicamentos do dia
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lembretes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-base">
                Nenhum lembrete ativo. Adicione um medicamento para começar!
              </p>
            ) : (
              lembretes.map((lembrete) => {
                // ✅ Usar função central para calcular status
                const doseResult = getCalculatedDoseStatus(lembrete.id, lembrete.horario);
                const { status, canMarkTaken, canMarkForgotten, minutesUntilActive } = doseResult;
                
                return (
                  <div
                    key={lembrete.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-card"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {getStatusIcon(status)}
                      <div className="flex-1">
                        <p className="font-medium text-base">
                          {getMedicamentoNome(lembrete.medicamento_id)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {lembrete.horario} • {lembrete.periodo}
                        </p>
                      </div>
                      {getStatusBadge(status, minutesUntilActive)}
                    </div>
                    
                    {/* ✅ BOTÕES: Só aparecem quando status é ATIVO */}
                    {status === "ativo" && (
                      <div className="flex gap-2 ml-4">
                        {canMarkTaken && (
                          <Button
                            size="sm"
                            onClick={() => marcarDose(lembrete.id, "tomado")}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Tomei
                          </Button>
                        )}
                        {canMarkForgotten && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => marcarDose(lembrete.id, "esquecido")}
                          >
                            Esqueci
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
