/**
 * Utilitários para gerenciamento de horários e estados de doses
 * Garante consistência de timezone e lógica de janela de ação
 */

// Tolerância padrão em minutos (60 minutos)
export const DEFAULT_TOLERANCE_MINUTES = 60;

/**
 * Estados lógicos de uma dose
 */
export type DoseState = "pendente" | "em_janela" | "tomado" | "esquecido";

/**
 * Obtém a data atual no formato YYYY-MM-DD usando timezone local
 */
export function getCurrentLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Obtém o horário atual no formato HH:MM:SS usando timezone local
 */
export function getCurrentLocalTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Converte um horário (HH:MM ou HH:MM:SS) para minutos desde meia-noite
 */
export function timeToMinutes(time: string): number {
  const parts = time.split(":").map(Number);
  return parts[0] * 60 + parts[1];
}

/**
 * Cria um Date para hoje no horário especificado (timezone local)
 */
export function getTodayAtTime(time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Calcula o estado lógico de uma dose baseado no horário atual
 * 
 * @param scheduledTime - Horário agendado (HH:MM ou HH:MM:SS)
 * @param dbStatus - Status salvo no banco de dados
 * @param toleranceMinutes - Janela de tolerância em minutos
 * @returns O estado lógico atual da dose
 */
export function calculateDoseState(
  scheduledTime: string,
  dbStatus: "tomado" | "esquecido" | "pendente",
  toleranceMinutes: number = DEFAULT_TOLERANCE_MINUTES
): DoseState {
  // Se já foi marcado pelo usuário, retornar o status salvo
  if (dbStatus === "tomado") {
    return "tomado";
  }
  
  if (dbStatus === "esquecido") {
    // Verificar se foi esquecido por ação do usuário ou expiração
    return "esquecido";
  }

  const now = new Date();
  const scheduledDate = getTodayAtTime(scheduledTime);
  const toleranceMs = toleranceMinutes * 60 * 1000;
  const expirationDate = new Date(scheduledDate.getTime() + toleranceMs);

  // Antes do horário agendado = PENDENTE
  if (now < scheduledDate) {
    return "pendente";
  }

  // Dentro da janela de tolerância = EM_JANELA (pode tomar ação)
  if (now >= scheduledDate && now <= expirationDate) {
    return "em_janela";
  }

  // Passou da janela de tolerância sem ação = ESQUECIDO
  return "esquecido";
}

/**
 * Verifica se o usuário pode tomar ação (Tomei/Esqueci)
 * Retorna true se estiver na janela de ação ou for um status pendente
 */
export function canTakeAction(
  scheduledTime: string,
  dbStatus: "tomado" | "esquecido" | "pendente",
  toleranceMinutes: number = DEFAULT_TOLERANCE_MINUTES
): boolean {
  const state = calculateDoseState(scheduledTime, dbStatus, toleranceMinutes);
  // Pode agir apenas se estiver na janela de ação
  return state === "em_janela";
}

/**
 * Calcula quantos minutos faltam até o horário agendado
 * Retorna negativo se já passou
 */
export function getMinutesUntilScheduled(scheduledTime: string): number {
  const now = new Date();
  const scheduledDate = getTodayAtTime(scheduledTime);
  return Math.round((scheduledDate.getTime() - now.getTime()) / (60 * 1000));
}

/**
 * Calcula quantos minutos restam na janela de tolerância
 * Retorna 0 se ainda não começou ou já expirou
 */
export function getRemainingToleranceMinutes(
  scheduledTime: string,
  toleranceMinutes: number = DEFAULT_TOLERANCE_MINUTES
): number {
  const now = new Date();
  const scheduledDate = getTodayAtTime(scheduledTime);
  const expirationDate = new Date(scheduledDate.getTime() + toleranceMinutes * 60 * 1000);

  // Ainda não chegou o horário
  if (now < scheduledDate) {
    return toleranceMinutes;
  }

  // Já expirou
  if (now > expirationDate) {
    return 0;
  }

  // Dentro da janela - calcular restante
  return Math.round((expirationDate.getTime() - now.getTime()) / (60 * 1000));
}

/**
 * Formata o tempo restante para exibição amigável
 */
export function formatTimeRemaining(minutes: number): string {
  if (minutes <= 0) return "expirado";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}
