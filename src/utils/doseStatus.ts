/**
 * Sistema Central de Status de Doses - DoseCerta
 * 
 * ESPECIFICAÇÃO OFICIAL:
 * 
 * Estados válidos:
 * - AGENDADO → antes da janela de ação (-30min do horário)
 * - PENDENTE → dentro da janela de ação (horário - 30min até horário + 90min)
 * - TOMADO → ação explícita do usuário (clicar "Tomei")
 * - ESQUECIDO → ação do usuário OU automático após janela expirar
 * 
 * JANELA DE AÇÃO:
 * scheduledAt - 30 minutos → scheduledAt + 90 minutos
 * 
 * REGRAS CRÍTICAS:
 * - Nunca marcar como ESQUECIDO antes do horário
 * - Botões só ficam ativos DENTRO da janela
 * - Todo horário tratado com timezone local do dispositivo
 */

export type DoseStatusType = 'agendado' | 'pendente' | 'tomado' | 'esquecido';

export interface DoseStatusResult {
  status: DoseStatusType;
  canMarkTaken: boolean;      // Pode clicar "Tomei"
  canMarkForgotten: boolean;  // Pode clicar "Esqueci"
  isInWindow: boolean;        // Está dentro da janela de ação
  minutesUntilWindow: number; // Minutos até a janela abrir (negativo = já abriu)
  minutesUntilExpired: number; // Minutos até a janela fechar (negativo = já fechou)
  debugInfo: DebugInfo;
}

export interface DebugInfo {
  now: string;
  nowISO: string;
  scheduledTime: string;
  windowStart: string;
  windowEnd: string;
  timezone: string;
  calculatedStatus: DoseStatusType;
  savedStatus: string | null;
}

// Configuração da janela de ação (em minutos)
export const WINDOW_START_OFFSET = -30;  // 30 min ANTES do horário
export const WINDOW_END_OFFSET = 90;     // 90 min APÓS o horário

// Constantes para compatibilidade (deprecated - usar WINDOW_END_OFFSET)
export const DEFAULT_TOLERANCE_MINUTES = WINDOW_END_OFFSET;

/**
 * Função central para calcular o status de uma dose
 * 
 * LÓGICA:
 * 1. Se savedStatus é "tomado" ou "esquecido" → manter
 * 2. now < scheduledAt - 30min → AGENDADO
 * 3. scheduledAt - 30min <= now <= scheduledAt + 90min → PENDENTE
 * 4. now > scheduledAt + 90min → ESQUECIDO (automático)
 * 
 * @param now - Data/hora atual (com timezone local)
 * @param scheduledTimeStr - Horário agendado no formato "HH:MM" ou "HH:MM:SS"
 * @param savedStatus - Status salvo no banco (tomado, esquecido, pendente, agendado, null)
 * @returns Status calculado com flags de ação e debug info
 */
export function getDoseStatus(
  now: Date,
  scheduledTimeStr: string,
  savedStatus: 'tomado' | 'esquecido' | 'pendente' | 'agendado' | null = null
): DoseStatusResult {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Se já está marcado como tomado pelo usuário, manter SEMPRE
  if (savedStatus === 'tomado') {
    return createResult('tomado', now, scheduledTimeStr, false, false, timezone, savedStatus);
  }
  
  // Se já está marcado como esquecido pelo usuário, manter SEMPRE
  if (savedStatus === 'esquecido') {
    return createResult('esquecido', now, scheduledTimeStr, false, false, timezone, savedStatus);
  }
  
  // Calcular baseado no tempo
  const scheduledTime = parseTimeToToday(scheduledTimeStr);
  const windowStart = new Date(scheduledTime.getTime() + WINDOW_START_OFFSET * 60 * 1000);
  const windowEnd = new Date(scheduledTime.getTime() + WINDOW_END_OFFSET * 60 * 1000);
  
  const nowMs = now.getTime();
  const windowStartMs = windowStart.getTime();
  const windowEndMs = windowEnd.getTime();
  
  // ANTES da janela de ação → AGENDADO
  // Botões desabilitados
  if (nowMs < windowStartMs) {
    return createResult('agendado', now, scheduledTimeStr, false, false, timezone, savedStatus);
  }
  
  // DENTRO da janela de ação → PENDENTE
  // Botões ATIVOS
  if (nowMs >= windowStartMs && nowMs <= windowEndMs) {
    return createResult('pendente', now, scheduledTimeStr, true, true, timezone, savedStatus);
  }
  
  // APÓS a janela de ação → ESQUECIDO (automático)
  // Botões desabilitados
  return createResult('esquecido', now, scheduledTimeStr, false, false, timezone, savedStatus);
}

/**
 * Criar resultado com informações de debug completas
 */
function createResult(
  status: DoseStatusType,
  now: Date,
  scheduledTimeStr: string,
  canMarkTaken: boolean,
  canMarkForgotten: boolean,
  timezone: string,
  savedStatus: string | null
): DoseStatusResult {
  const scheduledTime = parseTimeToToday(scheduledTimeStr);
  const windowStart = new Date(scheduledTime.getTime() + WINDOW_START_OFFSET * 60 * 1000);
  const windowEnd = new Date(scheduledTime.getTime() + WINDOW_END_OFFSET * 60 * 1000);
  
  const minutesUntilWindow = Math.round((windowStart.getTime() - now.getTime()) / 60000);
  const minutesUntilExpired = Math.round((windowEnd.getTime() - now.getTime()) / 60000);
  const isInWindow = now >= windowStart && now <= windowEnd;
  
  return {
    status,
    canMarkTaken,
    canMarkForgotten,
    isInWindow,
    minutesUntilWindow,
    minutesUntilExpired,
    debugInfo: {
      now: formatTime(now),
      nowISO: now.toISOString(),
      scheduledTime: formatTime(scheduledTime),
      windowStart: formatTime(windowStart),
      windowEnd: formatTime(windowEnd),
      timezone,
      calculatedStatus: status,
      savedStatus,
    }
  };
}

/**
 * Converter string "HH:MM" ou "HH:MM:SS" para Date de hoje (timezone local)
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
 * 
 * REGRAS:
 * - Não pode mudar se já está tomado/esquecido
 * - Só pode marcar se estiver dentro da janela de ação
 */
export function canPerformAction(
  scheduledTimeStr: string,
  action: 'tomado' | 'esquecido',
  savedStatus: 'tomado' | 'esquecido' | 'pendente' | 'agendado' | null
): { allowed: boolean; reason?: string } {
  const now = new Date();
  const result = getDoseStatus(now, scheduledTimeStr, savedStatus);
  
  // Não pode mudar se já está finalizado
  if (savedStatus === 'tomado') {
    return { allowed: false, reason: 'Esta dose já foi marcada como tomada.' };
  }
  
  if (savedStatus === 'esquecido') {
    return { allowed: false, reason: 'Esta dose já foi marcada como esquecida.' };
  }
  
  // Verificar janela de ação
  if (!result.isInWindow) {
    if (result.status === 'agendado') {
      return { 
        allowed: false, 
        reason: `Aguarde! A janela de ação abre às ${result.debugInfo.windowStart.slice(0, 5)}` 
      };
    }
    if (result.status === 'esquecido') {
      return { 
        allowed: false, 
        reason: 'O horário de tolerância já expirou.' 
      };
    }
  }
  
  // Dentro da janela, pode realizar a ação
  if (action === 'tomado' && result.canMarkTaken) {
    return { allowed: true };
  }
  
  if (action === 'esquecido' && result.canMarkForgotten) {
    return { allowed: true };
  }
  
  return { allowed: false, reason: 'Ação não permitida no momento.' };
}

/**
 * Log de debug estruturado para auditoria
 */
export function logDoseStatusAudit(
  lembreteId: string,
  medicamentoNome: string,
  result: DoseStatusResult,
  action?: string
): void {
  const logData = {
    timestamp: new Date().toISOString(),
    lembreteId,
    medicamento: medicamentoNome,
    action: action || 'STATUS_CHECK',
    ...result.debugInfo,
    isInWindow: result.isInWindow,
    canMarkTaken: result.canMarkTaken,
    canMarkForgotten: result.canMarkForgotten,
    minutesUntilWindow: result.minutesUntilWindow,
    minutesUntilExpired: result.minutesUntilExpired,
  };
  
  console.log(`[DOSE_AUDIT] ${medicamentoNome}`, logData);
}

/**
 * Obter label amigável para o status
 */
export function getStatusLabel(status: DoseStatusType): string {
  const labels: Record<DoseStatusType, string> = {
    agendado: '📅 Agendado',
    pendente: '🔔 Tome agora',
    tomado: '✅ Tomado',
    esquecido: '❌ Esquecido',
  };
  return labels[status] || status;
}

/**
 * Obter cor/estilo para o status
 */
export function getStatusStyle(status: DoseStatusType): {
  bgClass: string;
  textClass: string;
  iconColor: string;
} {
  const styles: Record<DoseStatusType, { bgClass: string; textClass: string; iconColor: string }> = {
    agendado: {
      bgClass: 'bg-blue-100 dark:bg-blue-900/30',
      textClass: 'text-blue-800 dark:text-blue-200',
      iconColor: 'text-blue-600',
    },
    pendente: {
      bgClass: 'bg-orange-100 dark:bg-orange-900/30',
      textClass: 'text-orange-800 dark:text-orange-200',
      iconColor: 'text-orange-600',
    },
    tomado: {
      bgClass: 'bg-green-100 dark:bg-green-900/30',
      textClass: 'text-green-800 dark:text-green-200',
      iconColor: 'text-green-600',
    },
    esquecido: {
      bgClass: 'bg-red-100 dark:bg-red-900/30',
      textClass: 'text-red-800 dark:text-red-200',
      iconColor: 'text-red-600',
    },
  };
  return styles[status] || styles.agendado;
}

/**
 * Verificar se deve marcar automaticamente como esquecido
 * Usado no reset diário e verificações periódicas
 * 
 * REGRA: Só marca se:
 * 1. Status atual é pendente/agendado (não foi decidido pelo usuário)
 * 2. A janela de ação já expirou (now > scheduledAt + 90min)
 */
export function shouldAutoMarkForgotten(
  scheduledTimeStr: string,
  savedStatus: 'tomado' | 'esquecido' | 'pendente' | 'agendado' | null
): boolean {
  // Se já foi decidido pelo usuário, não alterar
  if (savedStatus === 'tomado' || savedStatus === 'esquecido') {
    return false;
  }
  
  const now = new Date();
  const result = getDoseStatus(now, scheduledTimeStr, savedStatus);
  
  // Só marca como esquecido se passou da janela
  return result.status === 'esquecido' && (savedStatus === 'pendente' || savedStatus === 'agendado' || savedStatus === null);
}

/**
 * Criar timestamp completo com timezone para armazenamento
 * Usado ao salvar novas doses
 */
export function createScheduledTimestamp(horario: string, data?: Date): string {
  const date = data || new Date();
  const [hours, minutes, seconds = 0] = horario.split(':').map(Number);
  
  date.setHours(hours, minutes, seconds, 0);
  
  // Retorna ISO com offset de timezone
  return date.toISOString();
}

/**
 * Detectar período do dia automaticamente
 */
export function detectPeriod(horario: string): 'manha' | 'tarde' | 'noite' {
  const [hours] = horario.split(':').map(Number);
  
  if (hours >= 5 && hours < 12) return 'manha';
  if (hours >= 12 && hours < 18) return 'tarde';
  return 'noite';
}

/**
 * Formatar minutos restantes para exibição
 */
export function formatTimeRemaining(minutes: number): string {
  if (minutes <= 0) return '';
  
  if (minutes < 60) {
    return `em ${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (mins === 0) {
    return `em ${hours}h`;
  }
  
  return `em ${hours}h ${mins}min`;
}
