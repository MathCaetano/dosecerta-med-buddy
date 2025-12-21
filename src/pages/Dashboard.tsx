import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertCircle, Bell, BellOff, Wifi, Timer } from "lucide-react";
import { useFeedback } from "@/contexts/FeedbackContext";
import { getDelayWarning } from "@/utils/gamification";
import { useNotifications } from "@/hooks/useNotifications";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useFCM } from "@/hooks/useFCM";
import { useDailyReset } from "@/hooks/useDailyReset";
import { useExpiredDoseChecker } from "@/hooks/useExpiredDoseChecker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  calculateDoseState, 
  canTakeAction, 
  getCurrentLocalDate,
  getCurrentLocalTime,
  getRemainingToleranceMinutes,
  formatTimeRemaining,
  getMinutesUntilScheduled,
  DoseState,
  DEFAULT_TOLERANCE_MINUTES
} from "@/utils/doseTimeUtils";

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

    // Carregar histórico de hoje usando timezone local
    const today = getCurrentLocalDate();
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

  // Hook para verificar doses expiradas e marcá-las como esquecidas
  useExpiredDoseChecker(user?.id || null, loadDataInternal);

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

  // Atualizar currentTime a cada 30 segundos para recalcular estados
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // Atualiza a cada 30 segundos

    return () => clearInterval(interval);
  }, []);

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

  const marcarDose = async (lembreteId: string, status: "tomado" | "esquecido") => {
    const today = getCurrentLocalDate();
    const now = getCurrentLocalTime();
    const lembrete = lembretes.find(l => l.id === lembreteId);
    const horarioLembrete = lembrete?.horario || "";
    
    // Verificar se já existe registro para hoje
    const existing = historico.find(h => h.lembrete_id === lembreteId && h.data === today);

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
          const medicamento = medicamentos.find(m => m.id === lembrete?.medicamento_id);
          if (medicamento && lembrete) {
            await trackActionTaken(lembrete.id, medicamento.id);
          }
          
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
      const { error } = await supabase
        .from("historico_doses")
        .insert({
          lembrete_id: lembreteId,
          data: today,
          horario_real: now,
          status,
        });

      if (error) {
        feedback.error("Erro ao registrar dose");
      } else {
        // Rastrear ação se foi marcado como tomado
        if (status === "tomado") {
          const medicamento = medicamentos.find(m => m.id === lembrete?.medicamento_id);
          if (medicamento && lembrete) {
            await trackActionTaken(lembrete.id, medicamento.id);
          }
          feedback.success("Dose marcada! Você está no caminho certo! 💪");
        } else {
          feedback.warning("Dose marcada como esquecida");
        }
        loadData();
      }
    }
  };

  /**
   * Obtém o status do banco e calcula o estado lógico real
   * considerando horário atual e janela de tolerância
   */
  const getLembreteStatus = (lembreteId: string, horario: string): DoseState => {
    const today = getCurrentLocalDate();
    const hist = historico.find(h => h.lembrete_id === lembreteId && h.data === today);
    const dbStatus = (hist?.status as "tomado" | "esquecido" | "pendente") || "pendente";
    
    // Calcular estado real baseado no horário
    return calculateDoseState(horario, dbStatus, DEFAULT_TOLERANCE_MINUTES);
  };

  const getMedicamentoNome = (medicamentoId: string) => {
    const med = medicamentos.find(m => m.id === medicamentoId);
    return med ? `${med.nome} (${med.dosagem})` : "Medicamento";
  };

  const getStatusIcon = (status: DoseState) => {
    switch (status) {
      case "tomado":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "esquecido":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case "em_janela":
        return <Timer className="h-5 w-5 text-orange-600" />;
      default:
        return <Clock className="h-5 w-5 text-blue-600" />;
    }
  };

  const getStatusBadge = (status: DoseState, horario: string) => {
    const variants: Record<string, string> = {
      tomado: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      esquecido: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      pendente: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      em_janela: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    };

    const getLabel = () => {
      switch (status) {
        case "tomado":
          return "✓ Tomado";
        case "esquecido":
          return "Esquecido";
        case "em_janela":
          const remaining = getRemainingToleranceMinutes(horario);
          return `⏳ ${formatTimeRemaining(remaining)} restantes`;
        case "pendente":
          const minutesUntil = getMinutesUntilScheduled(horario);
          if (minutesUntil > 0) {
            return `⏰ em ${formatTimeRemaining(minutesUntil)}`;
          }
          return "⏰ Pendente";
        default:
          return "⏰ Pendente";
      }
    };

    return (
      <Badge className={variants[status] || variants.pendente}>
        {getLabel()}
      </Badge>
    );
  };

  const getTotaisHoje = () => {
    const total = lembretes.length;
    const tomados = lembretes.filter(l => getLembreteStatus(l.id, l.horario) === "tomado").length;
    const pendentesOuJanela = lembretes.filter(l => {
      const status = getLembreteStatus(l.id, l.horario);
      return status === "pendente" || status === "em_janela";
    }).length;
    return { total, tomados, pendentes: pendentesOuJanela };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-lg text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const { total, tomados, pendentes } = getTotaisHoje();

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

        <div className="bg-card border rounded-lg p-4">
          <p className="text-base text-muted-foreground">
            📅 Hoje: <strong>{total}</strong> lembretes totais • ✅ <strong>{tomados}</strong> tomados • ⏰ <strong>{pendentes}</strong> pendentes
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
                const status = getLembreteStatus(lembrete.id, lembrete.horario);
                const canAct = status === "em_janela";
                const isPending = status === "pendente";
                const isDecided = status === "tomado" || status === "esquecido";
                
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
                      {getStatusBadge(status, lembrete.horario)}
                    </div>
                    
                    {/* Botões ativos apenas na janela de ação */}
                    {canAct && (
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          onClick={() => marcarDose(lembrete.id, "tomado")}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Tomei
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => marcarDose(lembrete.id, "esquecido")}
                        >
                          Esqueci
                        </Button>
                      </div>
                    )}
                    
                    {/* Botões desabilitados antes do horário */}
                    {isPending && (
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          disabled
                          className="bg-gray-400 cursor-not-allowed opacity-50"
                        >
                          Tomei
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="cursor-not-allowed opacity-50"
                        >
                          Esqueci
                        </Button>
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
