import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// Tolerância em minutos - padrão de 60 minutos
const TOLERANCE_MINUTES = 60;

/**
 * Estados lógicos das doses:
 * - PENDENTE: Antes do horário do medicamento
 * - EM_JANELA: Do horário até horário + tolerância (usuário pode agir)
 * - TOMADO: Ação explícita do usuário
 * - ESQUECIDO: Ação explícita OU expiração da janela
 */
export type DoseState = "pendente" | "em_janela" | "tomado" | "esquecido";

/**
 * Calcula o estado lógico de uma dose baseado no horário atual
 */
export const calculateDoseState = (
  horarioLembrete: string,
  statusBanco: string
): DoseState => {
  // Se já está marcado como tomado ou esquecido, manter
  if (statusBanco === "tomado") return "tomado";
  if (statusBanco === "esquecido") return "esquecido";

  const now = new Date();
  const [hora, minuto] = horarioLembrete.split(":").map(Number);
  
  // Criar datetime do horário do lembrete para HOJE
  const horarioDateTime = new Date();
  horarioDateTime.setHours(hora, minuto, 0, 0);

  // Horário limite = horário + tolerância
  const horarioLimite = new Date(horarioDateTime);
  horarioLimite.setMinutes(horarioLimite.getMinutes() + TOLERANCE_MINUTES);

  // Antes do horário = PENDENTE
  if (now < horarioDateTime) {
    return "pendente";
  }

  // Dentro da janela de ação (entre horário e horário + tolerância)
  if (now >= horarioDateTime && now <= horarioLimite) {
    return "em_janela";
  }

  // Passou da janela sem ação = ESQUECIDO (mas banco ainda diz pendente)
  // Este estado será corrigido pelo checker
  return "esquecido";
};

/**
 * Verifica se os botões de ação devem estar ativos
 */
export const canTakeAction = (doseState: DoseState): boolean => {
  return doseState === "em_janela";
};

/**
 * Verifica se pode marcar como "Tomei" (janela ativa ou pendente após horário)
 * Permite marcar como tomado mesmo após a janela (ação manual do usuário)
 */
export const canMarkAsTaken = (
  horarioLembrete: string,
  statusBanco: string
): boolean => {
  if (statusBanco === "tomado") return false;
  
  const now = new Date();
  const [hora, minuto] = horarioLembrete.split(":").map(Number);
  
  const horarioDateTime = new Date();
  horarioDateTime.setHours(hora, minuto, 0, 0);
  
  // Pode marcar como tomado se já passou do horário
  return now >= horarioDateTime;
};

/**
 * Verifica se pode marcar como "Esqueci" (apenas durante a janela)
 */
export const canMarkAsForgotten = (
  horarioLembrete: string,
  statusBanco: string
): boolean => {
  if (statusBanco === "tomado" || statusBanco === "esquecido") return false;
  
  const now = new Date();
  const [hora, minuto] = horarioLembrete.split(":").map(Number);
  
  const horarioDateTime = new Date();
  horarioDateTime.setHours(hora, minuto, 0, 0);
  
  const horarioLimite = new Date(horarioDateTime);
  horarioLimite.setMinutes(horarioLimite.getMinutes() + TOLERANCE_MINUTES);
  
  // Pode marcar como esquecido durante a janela de ação
  return now >= horarioDateTime && now <= horarioLimite;
};

/**
 * Hook para verificar e marcar doses expiradas automaticamente
 * 
 * Regra: Só marca como "esquecido" APÓS horário + tolerância de 60 minutos
 */
export const useExpiredDoseChecker = (
  userId: string | null,
  onDosesUpdated?: () => void
) => {
  const isCheckingRef = useRef(false);
  const lastCheckRef = useRef<string>("");

  /**
   * Verifica doses expiradas e marca como esquecidas
   */
  const checkExpiredDoses = useCallback(async (): Promise<number> => {
    if (!userId || isCheckingRef.current) return 0;

    try {
      isCheckingRef.current = true;
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      
      // Evitar verificações muito frequentes (máximo 1 por minuto)
      const checkKey = `${today}-${now.getMinutes()}`;
      if (lastCheckRef.current === checkKey) {
        return 0;
      }
      lastCheckRef.current = checkKey;

      console.log("[ExpiredChecker] Verificando doses expiradas...");

      // Buscar doses pendentes de hoje com horário do lembrete
      const { data: dosesPendentes, error } = await supabase
        .from("historico_doses")
        .select(`
          id,
          lembrete_id,
          status,
          lembretes!inner(
            horario,
            medicamento_id,
            medicamentos!inner(usuario_id)
          )
        `)
        .eq("status", "pendente")
        .eq("data", today)
        .eq("lembretes.medicamentos.usuario_id", userId);

      if (error) {
        console.error("[ExpiredChecker] Erro ao buscar doses:", error);
        return 0;
      }

      if (!dosesPendentes || dosesPendentes.length === 0) {
        console.log("[ExpiredChecker] Nenhuma dose pendente encontrada");
        return 0;
      }

      let dosesAtualizadas = 0;

      for (const dose of dosesPendentes) {
        const lembrete = dose.lembretes as any;
        const horarioLembrete = lembrete.horario;
        const [hora, minuto] = horarioLembrete.split(":").map(Number);

        // Criar datetime do horário do lembrete
        const horarioDateTime = new Date();
        horarioDateTime.setHours(hora, minuto, 0, 0);

        // Horário limite = horário + 60 minutos de tolerância
        const horarioLimite = new Date(horarioDateTime);
        horarioLimite.setMinutes(horarioLimite.getMinutes() + TOLERANCE_MINUTES);

        // REGRA CRÍTICA: Só marcar como esquecido APÓS a janela de tolerância
        if (now > horarioLimite) {
          console.log(
            `[ExpiredChecker] Dose ${dose.id} expirada (horário: ${horarioLembrete}, limite: ${horarioLimite.toTimeString().substring(0, 5)}, agora: ${now.toTimeString().substring(0, 5)})`
          );

          const { error: updateError } = await supabase
            .from("historico_doses")
            .update({ status: "esquecido" })
            .eq("id", dose.id);

          if (!updateError) {
            dosesAtualizadas++;
          } else {
            console.error("[ExpiredChecker] Erro ao atualizar:", updateError);
          }
        }
      }

      if (dosesAtualizadas > 0) {
        console.log(`[ExpiredChecker] ${dosesAtualizadas} doses marcadas como esquecidas`);
        onDosesUpdated?.();
      }

      return dosesAtualizadas;
    } catch (error) {
      console.error("[ExpiredChecker] Erro geral:", error);
      return 0;
    } finally {
      isCheckingRef.current = false;
    }
  }, [userId, onDosesUpdated]);

  // Verificar a cada 30 segundos
  useEffect(() => {
    if (!userId) return;

    // Verificar imediatamente ao montar
    checkExpiredDoses();

    const interval = setInterval(() => {
      checkExpiredDoses();
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [userId, checkExpiredDoses]);

  // Verificar ao retornar do background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && userId) {
        console.log("[ExpiredChecker] App voltou ao foreground");
        checkExpiredDoses();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [userId, checkExpiredDoses]);

  return {
    checkExpiredDoses,
    TOLERANCE_MINUTES,
  };
};
