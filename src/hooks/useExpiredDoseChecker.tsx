import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  getCurrentLocalDate, 
  calculateDoseState,
  DEFAULT_TOLERANCE_MINUTES 
} from "@/utils/doseTimeUtils";

/**
 * Hook para verificar e marcar automaticamente doses expiradas como "esquecido"
 * Executa a verificação periodicamente (a cada 60 segundos)
 */
export const useExpiredDoseChecker = (
  userId: string | null,
  onDosesUpdated?: () => void
) => {
  const isCheckingRef = useRef(false);

  /**
   * Verifica doses pendentes que passaram da janela de tolerância
   * e marca-as como "esquecido" automaticamente
   */
  const checkAndMarkExpiredDoses = useCallback(async (): Promise<number> => {
    if (isCheckingRef.current || !userId) return 0;

    try {
      isCheckingRef.current = true;
      const today = getCurrentLocalDate();

      // Buscar doses pendentes de hoje com horário do lembrete
      const { data: pendingDoses, error } = await supabase
        .from("historico_doses")
        .select(`
          id,
          lembrete_id,
          status,
          lembretes!inner (
            horario,
            medicamentos!inner (usuario_id)
          )
        `)
        .eq("data", today)
        .eq("status", "pendente")
        .eq("lembretes.medicamentos.usuario_id", userId);

      if (error) {
        console.error("[ExpiredChecker] Erro ao buscar doses:", error);
        return 0;
      }

      if (!pendingDoses || pendingDoses.length === 0) {
        return 0;
      }

      // Identificar doses que passaram da janela de tolerância
      const expiredDoseIds: string[] = [];
      
      for (const dose of pendingDoses) {
        const horario = (dose.lembretes as any)?.horario;
        if (!horario) continue;

        const state = calculateDoseState(horario, "pendente", DEFAULT_TOLERANCE_MINUTES);
        
        // Se calculou como "esquecido", significa que passou da tolerância
        if (state === "esquecido") {
          expiredDoseIds.push(dose.id);
        }
      }

      if (expiredDoseIds.length === 0) {
        return 0;
      }

      // Marcar doses expiradas como "esquecido"
      const { error: updateError } = await supabase
        .from("historico_doses")
        .update({ status: "esquecido" })
        .in("id", expiredDoseIds);

      if (updateError) {
        console.error("[ExpiredChecker] Erro ao atualizar doses:", updateError);
        return 0;
      }

      console.log(`[ExpiredChecker] ${expiredDoseIds.length} doses marcadas como esquecidas`);
      
      // Notificar que houve atualizações
      if (onDosesUpdated) {
        onDosesUpdated();
      }

      return expiredDoseIds.length;
    } catch (error) {
      console.error("[ExpiredChecker] Erro geral:", error);
      return 0;
    } finally {
      isCheckingRef.current = false;
    }
  }, [userId, onDosesUpdated]);

  // Executar verificação periodicamente (a cada 60 segundos)
  useEffect(() => {
    if (!userId) return;

    // Executar imediatamente ao montar
    checkAndMarkExpiredDoses();

    // Configurar intervalo
    const interval = setInterval(() => {
      checkAndMarkExpiredDoses();
    }, 60000); // 60 segundos

    return () => clearInterval(interval);
  }, [userId, checkAndMarkExpiredDoses]);

  // Executar ao retornar do background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && userId) {
        checkAndMarkExpiredDoses();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userId, checkAndMarkExpiredDoses]);

  return {
    checkAndMarkExpiredDoses,
  };
};
