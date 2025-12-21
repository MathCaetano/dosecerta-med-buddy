import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notificationScheduler } from "@/utils/notificationScheduler";

const STORAGE_KEY = "dosecerta_last_daily_reset";

/**
 * Hook para gerenciar o Reset Diário Seguro
 * 
 * Funcionalidades:
 * - Detecta mudança de dia automaticamente
 * - Cria registros pendentes para o novo dia
 * - Reagenda todas as notificações
 * - Funciona ao abrir o app e ao retornar do background
 * - Idempotente (seguro para rodar múltiplas vezes)
 */
export const useDailyReset = (
  userId: string | null,
  onResetComplete?: () => void
) => {
  const isResettingRef = useRef(false);

  /**
   * Obtém a data atual no formato YYYY-MM-DD
   */
  const getCurrentDate = useCallback((): string => {
    return new Date().toISOString().split("T")[0];
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
          medicamentos!inner(usuario_id)
        `)
        .eq("ativo", true)
        .eq("medicamentos.usuario_id", userId);

      if (lembretesError) {
        console.error("[DailyReset] Erro ao buscar lembretes:", lembretesError);
        return false;
      }

      if (!lembretes || lembretes.length === 0) {
        console.log("[DailyReset] Nenhum lembrete ativo encontrado");
        return true;
      }

      // Verificar quais já têm registro para hoje
      const lembreteIds = lembretes.map((l) => l.id);
      const { data: existingRecords } = await supabase
        .from("historico_doses")
        .select("lembrete_id")
        .eq("data", today)
        .in("lembrete_id", lembreteIds);

      const existingIds = new Set(existingRecords?.map((r) => r.lembrete_id) || []);

      // Filtrar lembretes que precisam de novo registro
      const lembretesNovos = lembretes.filter((l) => !existingIds.has(l.id));

      if (lembretesNovos.length === 0) {
        console.log("[DailyReset] Todos os lembretes já têm registro para hoje");
        return true;
      }

      // Criar registros pendentes apenas para os novos
      const novosRegistros = lembretesNovos.map((lembrete) => ({
        lembrete_id: lembrete.id,
        data: today,
        status: "pendente",
      }));

      const { error: insertError } = await supabase
        .from("historico_doses")
        .insert(novosRegistros);

      if (insertError) {
        console.error("[DailyReset] Erro ao criar registros:", insertError);
        return false;
      }

      console.log(`[DailyReset] ${novosRegistros.length} registros pendentes criados`);
      return true;
    } catch (error) {
      console.error("[DailyReset] Erro geral:", error);
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

      // Formatar e agendar
      const lembretesFormatados = lembretes.map((l: any) => ({
        id: l.id,
        medicamento_id: l.medicamento_id,
        medicamento_nome: l.medicamentos.nome,
        dosagem: l.medicamentos.dosagem,
        horario: l.horario,
        ativo: l.ativo,
      }));

      const scheduled = await notificationScheduler.scheduleAllForToday(lembretesFormatados);
      console.log(`[DailyReset] ${scheduled} notificações reagendadas`);
      
      return true;
    } catch (error) {
      console.error("[DailyReset] Erro ao reagendar:", error);
      return false;
    }
  }, [userId]);

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

    // Verificar se já foi feito reset hoje
    if (lastReset === today) {
      console.log(`[DailyReset] Reset já realizado hoje (${today})`);
      return false;
    }

    try {
      isResettingRef.current = true;
      console.log(`[DailyReset] Iniciando reset: ${lastReset || "nunca"} → ${today}`);

      // 1. Inicializar doses do dia
      const doseSuccess = await initializeDailyDoseStatus();
      if (!doseSuccess) {
        console.error("[DailyReset] Falha ao inicializar doses");
      }

      // 2. Reagendar notificações
      const notifSuccess = await rescheduleNotifications();
      if (!notifSuccess) {
        console.error("[DailyReset] Falha ao reagendar notificações");
      }

      // 3. Marcar reset como concluído
      setLastResetDate(today);
      console.log(`[DailyReset] Reset concluído com sucesso para ${today}`);

      // Notificar callback
      if (onResetComplete) {
        onResetComplete();
      }

      return true;
    } catch (error) {
      console.error("[DailyReset] Erro durante reset:", error);
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
    getLastResetDate,
  };
};
