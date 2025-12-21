/**
 * Lógica Temporal de Doses
 * 
 * Define estados baseados no horário local do dispositivo:
 * - PENDENTE: Antes do horário do medicamento
 * - EM_JANELA: Do horário até horário + tolerância (usuário pode agir)
 * - EXPIRADO: Após a janela de tolerância sem ação
 * 
 * Regras:
 * - Tolerância padrão: 60 minutos
 * - Sempre usar data + hora completas
 * - Sempre usar timezone local do dispositivo
 */

// Tolerância em minutos (pode ser configurável no futuro)
const TOLERANCE_MINUTES = 60;

export type DoseTimeState = "pendente" | "em_janela" | "expirado";

export interface DoseState {
  timeState: DoseTimeState;
  canTakeAction: boolean;
  shouldAutoMarkForgotten: boolean;
  minutesUntilDose: number;
  minutesSinceDose: number;
  isBeforeTime: boolean;
  isInWindow: boolean;
  isExpired: boolean;
}

/**
 * Calcula o estado temporal de uma dose baseado no horário atual
 * 
 * @param horario - Horário do lembrete no formato "HH:MM" ou "HH:MM:SS"
 * @param toleranceMinutes - Tolerância em minutos (padrão: 60)
 * @returns Estado completo da dose
 */
export function calculateDoseState(
  horario: string,
  toleranceMinutes: number = TOLERANCE_MINUTES
): DoseState {
  const now = new Date();
  
  // Parsear o horário do lembrete
  const [hours, minutes] = horario.split(":").map(Number);
  
  // Criar data/hora do lembrete para HOJE usando timezone local
  const doseTime = new Date();
  doseTime.setHours(hours, minutes, 0, 0);
  
  // Calcular horário de expiração (horário + tolerância)
  const expirationTime = new Date(doseTime.getTime() + toleranceMinutes * 60 * 1000);
  
  // Calcular diferenças em minutos
  const diffFromDose = (now.getTime() - doseTime.getTime()) / (1000 * 60);
  const diffFromExpiration = (now.getTime() - expirationTime.getTime()) / (1000 * 60);
  
  // Determinar estado
  const isBeforeTime = now < doseTime;
  const isInWindow = now >= doseTime && now <= expirationTime;
  const isExpired = now > expirationTime;
  
  let timeState: DoseTimeState;
  if (isBeforeTime) {
    timeState = "pendente";
  } else if (isInWindow) {
    timeState = "em_janela";
  } else {
    timeState = "expirado";
  }
  
  return {
    timeState,
    canTakeAction: isInWindow, // Só pode agir durante a janela
    shouldAutoMarkForgotten: isExpired, // Marcar como esquecido se expirou
    minutesUntilDose: isBeforeTime ? Math.round(-diffFromDose) : 0,
    minutesSinceDose: !isBeforeTime ? Math.round(diffFromDose) : 0,
    isBeforeTime,
    isInWindow,
    isExpired,
  };
}

/**
 * Verifica se um lembrete deve ter botões de ação habilitados
 * 
 * @param horario - Horário do lembrete
 * @param currentStatus - Status atual no banco ("pendente" | "tomado" | "esquecido")
 * @returns Se os botões devem estar habilitados
 */
export function shouldEnableActionButtons(
  horario: string,
  currentStatus: string
): boolean {
  // Se já foi marcado como tomado ou esquecido, não mostrar botões
  if (currentStatus === "tomado" || currentStatus === "esquecido") {
    return false;
  }
  
  const state = calculateDoseState(horario);
  
  // Só habilitar botões durante a janela de ação
  return state.isInWindow;
}

/**
 * Obtém o status de exibição para a UI
 * Considera tanto o status do banco quanto o estado temporal
 * 
 * @param horario - Horário do lembrete
 * @param dbStatus - Status armazenado no banco
 * @returns Status para exibição e informações adicionais
 */
export function getDisplayStatus(
  horario: string,
  dbStatus: string
): {
  displayStatus: string;
  showButtons: boolean;
  statusMessage: string;
  badgeVariant: "pendente" | "tomado" | "esquecido" | "aguardando";
} {
  // Se já foi marcado pelo usuário, respeitar
  if (dbStatus === "tomado") {
    return {
      displayStatus: "tomado",
      showButtons: false,
      statusMessage: "Dose tomada",
      badgeVariant: "tomado",
    };
  }
  
  if (dbStatus === "esquecido") {
    return {
      displayStatus: "esquecido",
      showButtons: false,
      statusMessage: "Dose esquecida",
      badgeVariant: "esquecido",
    };
  }
  
  // Status pendente - verificar estado temporal
  const state = calculateDoseState(horario);
  
  if (state.isBeforeTime) {
    // Antes do horário - aguardando
    const hours = Math.floor(state.minutesUntilDose / 60);
    const mins = state.minutesUntilDose % 60;
    const timeStr = hours > 0 
      ? `${hours}h ${mins}min` 
      : `${mins}min`;
    
    return {
      displayStatus: "aguardando",
      showButtons: false,
      statusMessage: `Em ${timeStr}`,
      badgeVariant: "aguardando",
    };
  }
  
  if (state.isInWindow) {
    // Na janela de ação
    const remainingMinutes = TOLERANCE_MINUTES - state.minutesSinceDose;
    
    return {
      displayStatus: "em_janela",
      showButtons: true,
      statusMessage: `Faltam ${remainingMinutes}min para registrar`,
      badgeVariant: "pendente",
    };
  }
  
  // Expirou sem ação
  return {
    displayStatus: "expirado",
    showButtons: false,
    statusMessage: "Tempo esgotado",
    badgeVariant: "esquecido",
  };
}

/**
 * Verifica se uma dose expirada deve ser marcada como esquecida no banco
 * Usado pelo sistema de auto-marcação
 * 
 * @param horario - Horário do lembrete
 * @param dbStatus - Status atual no banco
 * @returns Se deve marcar como esquecida
 */
export function shouldAutoMarkAsForgotten(
  horario: string,
  dbStatus: string
): boolean {
  // Só marcar automaticamente se ainda está pendente no banco
  if (dbStatus !== "pendente") {
    return false;
  }
  
  const state = calculateDoseState(horario);
  return state.isExpired;
}

/**
 * Retorna a tolerância configurada em minutos
 */
export function getToleranceMinutes(): number {
  return TOLERANCE_MINUTES;
}
