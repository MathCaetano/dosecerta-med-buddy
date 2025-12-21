import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notificationScheduler } from "@/utils/notificationScheduler";

const STORAGE_KEY = "dosecerta_last_daily_reset";

// ============================================
// LOGS DE AUDITORIA (internos, não visíveis ao usuário)
// ============================================
interface AuditLog {
  timestamp: string;
  lembreteId?: string;
  action: string;
  stateBefore?: string;
  stateAfter?: string;
  reason?: string;
}

const auditLogs: AuditLog[] = [];

function logAudit(log: Omit<AuditLog, "timestamp">) {
  const entry: AuditLog = {
    ...log,
    timestamp: new Date().toISOString(),
  };
  auditLogs.push(entry);
  
  // Manter apenas últimos 100 logs
  if (auditLogs.length > 100) {
    auditLogs.shift();
  }
  
  console.log(`[AUDIT] ${log.action}`, log);
}

export function getAuditLogs(): AuditLog[] {
  return [...auditLogs];
}

/**
 * Hook para gerenciar o Reset Diário Seguro
 * 
 * Funcionalidades:
 * - Detecta mudança de dia automaticamente
 * - Cria registros pendentes para o novo dia (sem duplicatas)
 * - Reagenda todas as notificações
 * - Funciona ao abrir o app e ao retornar do background
 * - Idempotente (seguro para rodar múltiplas vezes)
 * - Inclui sistema de auditoria interna
 */
export const useDailyReset = (
  userId: string | null,
  onResetComplete?: () => void
) => {
  const isResettingRef = useRef(false);
  const lastCheckRef = useRef<string | null>(null);

  /**
   * Obtém a data atual no formato YYYY-MM-DD (timezone local)
   */
  const getCurrentDate = useCallback((): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  /**
   * Obtém o horário atual no formato HH:MM:SS
   */
  const getCurrentTime = useCallback((): string => {
    return new Date().toTimeString().split(" ")[0];
  }, []);

  /**
   * Verifica a última data de reset armazenada
   */
  const getLastResetDate = useCallback((): string | null => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }, []);

  /**
   * Salva a data do último reset
   */
  const setLastResetDate = useCallback((date: string): void => {
    try {
      localStorage.setItem(STORAGE_KEY, date);
    } catch (error) {
      console.error("[DailyReset] Erro ao salvar data:", error);
    }
  }, []);

  /**
   * Inicializa os registros de doses pendentes para hoje
   * Usa UPSERT para evitar duplicatas (com constraint UNIQUE)
   */
  const initializeDailyDoseStatus = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;

    try {
      const today = getCurrentDate();
      console.log(`[DailyReset] Inicializando doses para ${today}`);

      // Buscar todos os lembretes ativos do usuário
      const { data: lembretes, error: lembretesError } = await supabase
        .from("lembretes")
        .select(`
          id,
          horario,
          medicamento_id,
          medicamentos!inner(usuario_id, nome)
        `)
        .eq("ativo", true)
        .eq("medicamentos.usuario_id", userId);

      if (lembretesError) {
        console.error("[DailyReset] Erro ao buscar lembretes:", lembretesError);
        logAudit({
          action: "FETCH_LEMBRETES_ERROR",
          reason: lembretesError.message,
        });
        return false;
      }

      if (!lembretes || lembretes.length === 0) {
        console.log("[DailyReset] Nenhum lembrete ativo encontrado");
        return true;
      }

      // ✅ USAR UPSERT para evitar duplicatas
      // O constraint UNIQUE (lembrete_id, data) garante que não haverá duplicatas
      for (const lembrete of lembretes) {
        const { error: upsertError } = await supabase
          .from("historico_doses")
          .upsert(
            {
              lembrete_id: lembrete.id,
              data: today,
              status: "pendente",
            },
            {
              onConflict: "lembrete_id,data",
              ignoreDuplicates: true, // Não atualizar se já existe
            }
          );

        if (upsertError) {
          // Ignorar erro de duplicata (já existe) - é esperado
          if (!upsertError.message.includes("duplicate") && 
              !upsertError.message.includes("unique")) {
            console.error(`[DailyReset] Erro ao criar registro para ${lembrete.id}:`, upsertError);
            logAudit({
              lembreteId: lembrete.id,
              action: "CREATE_DOSE_ERROR",
              reason: upsertError.message,
            });
          }
        } else {
          logAudit({
            lembreteId: lembrete.id,
            action: "DOSE_INITIALIZED",
            stateAfter: "pendente",
          });
        }
      }

      console.log(`[DailyReset] ${lembretes.length} lembretes processados`);
      return true;
    } catch (error) {
      console.error("[DailyReset] Erro geral:", error);
      logAudit({
        action: "GENERAL_ERROR",
        reason: String(error),
      });
      return false;
    }
  }, [userId, getCurrentDate]);

  /**
   * Reagenda todas as notificações para o dia atual
   */
  const rescheduleNotifications = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;

    try {
      console.log("[DailyReset] Reagendando notificações...");

      // Limpar notificações antigas
      notificationScheduler.clearAll();

      // Buscar lembretes ativos com dados do medicamento
      const { data: lembretes, error } = await supabase
        .from("lembretes")
        .select(`
          id,
          horario,
          medicamento_id,
          ativo,
          medicamentos!inner(nome, dosagem, usuario_id)
        `)
        .eq("ativo", true)
        .eq("medicamentos.usuario_id", userId);

      if (error) {
        console.error("[DailyReset] Erro ao buscar lembretes:", error);
        return false;
      }

      if (!lembretes || lembretes.length === 0) {
        console.log("[DailyReset] Nenhum lembrete para agendar");
        return true;
      }

      // ✅ Verificar quais lembretes já foram tomados hoje
      const today = getCurrentDate();
      const { data: historicoHoje } = await supabase
        .from("historico_doses")
        .select("lembrete_id, status")
        .eq("data", today)
        .in("lembrete_id", lembretes.map(l => l.id));

      const statusMap = new Map(
        historicoHoje?.map(h => [h.lembrete_id, h.status]) || []
      );

      // Formatar e agendar apenas pendentes
      const lembretesParaAgendar = lembretes.filter((l: any) => {
        const status = statusMap.get(l.id);
        // Só agendar se ainda está pendente
        return status !== "tomado" && status !== "esquecido";
      });

      const lembretesFormatados = lembretesParaAgendar.map((l: any) => ({
        id: l.id,
        medicamento_id: l.medicamento_id,
        medicamento_nome: l.medicamentos.nome,
        dosagem: l.medicamentos.dosagem,
        horario: l.horario,
        ativo: l.ativo,
      }));

      const scheduled = await notificationScheduler.scheduleAllForToday(lembretesFormatados);
      
      logAudit({
        action: "NOTIFICATIONS_RESCHEDULED",
        reason: `${scheduled} de ${lembretes.length} agendadas`,
      });
      
      console.log(`[DailyReset] ${scheduled} notificações reagendadas`);
      
      return true;
    } catch (error) {
      console.error("[DailyReset] Erro ao reagendar:", error);
      return false;
    }
  }, [userId, getCurrentDate]);

  /**
   * ✅ VALIDAÇÃO DE TEMPO: Verifica se um lembrete pode ser marcado como "esquecido"
   * Só permite marcar como esquecido se o horário + tolerância já passou
   */
  const validateTimeForStatus = useCallback((
    lembreteHorario: string,
    novoStatus: string,
    toleranciaMinutos: number = 30
  ): { valido: boolean; motivo?: string } => {
    const now = new Date();
    const [hours, minutes] = lembreteHorario.split(":").map(Number);
    
    const horarioLembrete = new Date();
    horarioLembrete.setHours(hours, minutes, 0, 0);
    
    const horarioComTolerancia = new Date(horarioLembrete.getTime() + toleranciaMinutos * 60 * 1000);

    // Para marcar como "esquecido", o horário + tolerância deve ter passado
    if (novoStatus === "esquecido" && now < horarioComTolerancia) {
      return {
        valido: false,
        motivo: `Ainda não passou o horário com tolerância (${horarioComTolerancia.toTimeString().split(" ")[0]})`
      };
    }

    // Para marcar como "tomado", deve estar dentro da janela válida ou já ter passado
    if (novoStatus === "tomado") {
      // Permite marcar como tomado a qualquer momento após o horário - tolerância
      const horarioMenosTolerancia = new Date(horarioLembrete.getTime() - toleranciaMinutos * 60 * 1000);
      if (now < horarioMenosTolerancia) {
        return {
          valido: false,
          motivo: `Ainda muito cedo para marcar (aguarde até ${horarioMenosTolerancia.toTimeString().split(" ")[0]})`
        };
      }
    }

    return { valido: true };
  }, []);

  /**
   * Função central de reset diário (idempotente)
   */
  const performDailyResetIfNeeded = useCallback(async (): Promise<boolean> => {
    // Evitar execuções simultâneas
    if (isResettingRef.current) {
      console.log("[DailyReset] Reset já em andamento, ignorando");
      return false;
    }

    if (!userId) {
      console.log("[DailyReset] Usuário não autenticado, ignorando");
      return false;
    }

    const today = getCurrentDate();
    const lastReset = getLastResetDate();

    // ✅ Verificar se já foi verificado recentemente (debounce de 5 segundos)
    const now = Date.now();
    if (lastCheckRef.current === today) {
      // Já verificamos hoje e executamos, não precisa verificar novamente
      // a menos que o lastReset não seja hoje
      if (lastReset === today) {
        console.log(`[DailyReset] Reset já realizado hoje (${today})`);
        return false;
      }
    }

    lastCheckRef.current = today;

    // Verificar se já foi feito reset hoje
    if (lastReset === today) {
      console.log(`[DailyReset] Reset já realizado hoje (${today})`);
      return false;
    }

    try {
      isResettingRef.current = true;
      console.log(`[DailyReset] Iniciando reset: ${lastReset || "nunca"} → ${today}`);
      
      logAudit({
        action: "DAILY_RESET_START",
        stateBefore: lastReset || "never",
        stateAfter: today,
      });

      // 1. Inicializar doses do dia (com upsert)
      const doseSuccess = await initializeDailyDoseStatus();
      if (!doseSuccess) {
        console.error("[DailyReset] Falha ao inicializar doses");
        logAudit({
          action: "INIT_DOSES_FAILED",
          reason: "initializeDailyDoseStatus retornou false",
        });
      }

      // 2. Reagendar notificações
      const notifSuccess = await rescheduleNotifications();
      if (!notifSuccess) {
        console.error("[DailyReset] Falha ao reagendar notificações");
        logAudit({
          action: "RESCHEDULE_FAILED",
          reason: "rescheduleNotifications retornou false",
        });
      }

      // 3. Marcar reset como concluído
      setLastResetDate(today);
      
      logAudit({
        action: "DAILY_RESET_COMPLETE",
        stateAfter: today,
      });
      
      console.log(`[DailyReset] Reset concluído com sucesso para ${today}`);

      // Notificar callback
      if (onResetComplete) {
        onResetComplete();
      }

      return true;
    } catch (error) {
      console.error("[DailyReset] Erro durante reset:", error);
      logAudit({
        action: "DAILY_RESET_ERROR",
        reason: String(error),
      });
      return false;
    } finally {
      isResettingRef.current = false;
    }
  }, [
    userId,
    getCurrentDate,
    getLastResetDate,
    setLastResetDate,
    initializeDailyDoseStatus,
    rescheduleNotifications,
    onResetComplete,
  ]);

  /**
   * Executar reset ao montar o componente
   */
  useEffect(() => {
    if (userId) {
      performDailyResetIfNeeded();
    }
  }, [userId, performDailyResetIfNeeded]);

  /**
   * Executar reset ao retornar do background (visibilitychange)
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && userId) {
        console.log("[DailyReset] App voltou ao foreground, verificando reset...");
        performDailyResetIfNeeded();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userId, performDailyResetIfNeeded]);

  /**
   * Verificar periodicamente (a cada 60 segundos) se passou meia-noite
   * Isso garante que se o app ficar aberto durante a virada do dia,
   * o reset será executado
   */
  useEffect(() => {
    if (!userId) return;

    const checkInterval = setInterval(() => {
      const today = getCurrentDate();
      const lastReset = getLastResetDate();
      
      if (lastReset !== today) {
        console.log("[DailyReset] Meia-noite detectada via timer, executando reset...");
        performDailyResetIfNeeded();
      }
    }, 60000); // Verificar a cada 60 segundos

    return () => clearInterval(checkInterval);
  }, [userId, getCurrentDate, getLastResetDate, performDailyResetIfNeeded]);

  return {
    performDailyResetIfNeeded,
    getCurrentDate,
    getCurrentTime,
    getLastResetDate,
    validateTimeForStatus,
    getAuditLogs,
  };
};