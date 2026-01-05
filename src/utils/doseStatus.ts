/**
 * Sistema Central de Status de Doses
 * 
 * Estados válidos:
 * - PENDENTE → antes do horário
 * - ATIVO → dentro da janela de tolerância (horário até horário + tolerância)
 * - TOMADO → ação explícita do usuário
 * - ESQUECIDO → após tolerância expirar
 * 
 * CRÍTICO: A lógica de tempo usa APENAS o timezone local do dispositivo
 */

export type DoseStatusType = 'pendente' | 'ativo' | 'tomado' | 'esquecido';

export interface DoseStatusResult {
  status: DoseStatusType;
  canMarkTaken: boolean;      // Pode clicar "Tomei"
  canMarkForgotten: boolean;  // Pode clicar "Esqueci"
  minutesUntilActive: number; // Minutos até ficar ativo (negativo se já passou)
  minutesUntilExpired: number; // Minutos até expirar tolerância
  debugInfo: {
    now: string;
    scheduledTime: string;
    toleranceEnd: string;
    calculatedStatus: DoseStatusType;
  };
}

// Tolerância padrão configurável (60 minutos conforme especificação)
export const DEFAULT_TOLERANCE_MINUTES = 60;

/**
 * Função central para calcular o status de uma dose
 * 
 * @param now - Data/hora atual
 * @param scheduledTimeStr - Horário agendado no formato "HH:MM" ou "HH:MM:SS"
 * @param savedStatus - Status salvo no banco (tomado, esquecido, pendente)
 * @param toleranceMinutes - Janela de tolerância em minutos (default: 60)
 * @returns Status calculado com flags de ação
 */
export function getDoseStatus(
  now: Date,
  scheduledTimeStr: string,
  savedStatus: 'tomado' | 'esquecido' | 'pendente' | null = null,
  toleranceMinutes: number = DEFAULT_TOLERANCE_MINUTES
): DoseStatusResult {
  // Se já está marcado como tomado ou esquecido pelo usuário, manter
  if (savedStatus === 'tomado') {
    return createResult('tomado', now, scheduledTimeStr, toleranceMinutes, false, false);
  }
  
  if (savedStatus === 'esquecido') {
    return createResult('esquecido', now, scheduledTimeStr, toleranceMinutes, false, false);
  }
  
  // Calcular baseado no tempo
  const scheduledTime = parseTimeToToday(scheduledTimeStr);
  const toleranceEnd = new Date(scheduledTime.getTime() + toleranceMinutes * 60 * 1000);
  
  const nowMs = now.getTime();
  const scheduledMs = scheduledTime.getTime();
  const toleranceEndMs = toleranceEnd.getTime();
  
  // ANTES do horário agendado → PENDENTE
  if (nowMs < scheduledMs) {
    return createResult('pendente', now, scheduledTimeStr, toleranceMinutes, false, false);
  }
  
  // DENTRO da janela de tolerância → ATIVO
  if (nowMs >= scheduledMs && nowMs <= toleranceEndMs) {
    return createResult('ativo', now, scheduledTimeStr, toleranceMinutes, true, true);
  }
  
  // APÓS a tolerância → ESQUECIDO (automático)
  return createResult('esquecido', now, scheduledTimeStr, toleranceMinutes, false, false);
}

/**
 * Criar resultado com informações de debug
 */
function createResult(
  status: DoseStatusType,
  now: Date,
  scheduledTimeStr: string,
  toleranceMinutes: number,
  canMarkTaken: boolean,
  canMarkForgotten: boolean
): DoseStatusResult {
  const scheduledTime = parseTimeToToday(scheduledTimeStr);
  const toleranceEnd = new Date(scheduledTime.getTime() + toleranceMinutes * 60 * 1000);
  
  const minutesUntilActive = Math.round((scheduledTime.getTime() - now.getTime()) / 60000);
  const minutesUntilExpired = Math.round((toleranceEnd.getTime() - now.getTime()) / 60000);
  
  return {
    status,
    canMarkTaken,
    canMarkForgotten,
    minutesUntilActive,
    minutesUntilExpired,
    debugInfo: {
      now: formatTime(now),
      scheduledTime: formatTime(scheduledTime),
      toleranceEnd: formatTime(toleranceEnd),
      calculatedStatus: status,
    }
  };
}

/**
 * Converter string "HH:MM" ou "HH:MM:SS" para Date de hoje
 */
function parseTimeToToday(timeStr: string): Date {
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  const seconds = parts[2] || 0;
  
  const date = new Date();
  date.setHours(hours, minutes, seconds, 0);
  return date;
}

/**
 * Formatar Date para string legível "HH:MM:SS"
 */
function formatTime(date: Date): string {
  return date.toTimeString().split(' ')[0];
}

/**
 * Verificar se uma ação é permitida no momento
 * Usado para validação no momento de clicar no botão
 */
export function canPerformAction(
  scheduledTimeStr: string,
  action: 'tomado' | 'esquecido',
  savedStatus: 'tomado' | 'esquecido' | 'pendente' | null,
  toleranceMinutes: number = DEFAULT_TOLERANCE_MINUTES
): { allowed: boolean; reason?: string } {
  const now = new Date();
  const result = getDoseStatus(now, scheduledTimeStr, savedStatus, toleranceMinutes);
  
  // Não pode mudar se já está finalizado
  if (savedStatus === 'tomado') {
    return { allowed: false, reason: 'Esta dose já foi marcada como tomada.' };
  }
  
  if (savedStatus === 'esquecido') {
    return { allowed: false, reason: 'Esta dose já foi marcada como esquecida.' };
  }
  
  if (action === 'tomado') {
    if (!result.canMarkTaken) {
      if (result.status === 'pendente') {
        return { 
          allowed: false, 
          reason: `Aguarde até ${result.debugInfo.scheduledTime.slice(0, 5)} para marcar como tomado.` 
        };
      }
      if (result.status === 'esquecido') {
        return { 
          allowed: false, 
          reason: 'O horário de tolerância já expirou.' 
        };
      }
    }
    return { allowed: true };
  }
  
  if (action === 'esquecido') {
    if (!result.canMarkForgotten) {
      if (result.status === 'pendente') {
        return { 
          allowed: false, 
          reason: `Ainda não chegou o horário do medicamento. Aguarde até ${result.debugInfo.scheduledTime.slice(0, 5)}.` 
        };
      }
    }
    return { allowed: true };
  }
  
  return { allowed: false, reason: 'Ação desconhecida.' };
}

/**
 * Log de debug para auditoria
 */
export function logDoseStatusAudit(
  lembreteId: string,
  medicamentoNome: string,
  result: DoseStatusResult
): void {
  console.log(`[DOSE_AUDIT] ${medicamentoNome}`, {
    lembreteId,
    ...result.debugInfo,
    canMarkTaken: result.canMarkTaken,
    canMarkForgotten: result.canMarkForgotten,
    minutesUntilActive: result.minutesUntilActive,
    minutesUntilExpired: result.minutesUntilExpired,
  });
}

/**
 * Obter label amigável para o status
 */
export function getStatusLabel(status: DoseStatusType): string {
  const labels: Record<DoseStatusType, string> = {
    pendente: '⏰ Pendente',
    ativo: '🔔 Ativo',
    tomado: '✓ Tomado',
    esquecido: 'Esquecido',
  };
  return labels[status] || status;
}

/**
 * Verificar se deve marcar automaticamente como esquecido
 * Usado no reset diário e verificações periódicas
 */
export function shouldAutoMarkForgotten(
  scheduledTimeStr: string,
  savedStatus: 'tomado' | 'esquecido' | 'pendente' | null,
  toleranceMinutes: number = DEFAULT_TOLERANCE_MINUTES
): boolean {
  if (savedStatus === 'tomado' || savedStatus === 'esquecido') {
    return false;
  }
  
  const now = new Date();
  const result = getDoseStatus(now, scheduledTimeStr, savedStatus, toleranceMinutes);
  
  // Só marca como esquecido se passou da tolerância
  return result.status === 'esquecido' && savedStatus === 'pendente';
}
