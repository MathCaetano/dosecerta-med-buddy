export type ReminderStatus = "on_time" | "late" | "missed" | "taken";

export interface ReminderStatusInfo {
  status: ReminderStatus;
  label: string;
  color: string;
}

/**
 * Calcula o status de um lembrete baseado no horário agendado e se foi tomado
 * @param reminderTime - Horário do lembrete no formato "HH:MM:SS"
 * @param takenAt - Horário em que foi tomado (opcional)
 * @returns Status do lembrete
 */
export function getReminderStatus(
  reminderTime: string,
  takenAt?: string
): ReminderStatus {
  if (takenAt) {
    return "taken";
  }

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  
  // Criar data do lembrete
  const [hours, minutes] = reminderTime.split(":").map(Number);
  const reminderDate = new Date(today);
  reminderDate.setHours(hours, minutes, 0, 0);

  const diffMinutes = (now.getTime() - reminderDate.getTime()) / (1000 * 60);

  // on_time: ±10 minutos
  if (Math.abs(diffMinutes) <= 10) {
    return "on_time";
  }

  // late: entre 10 minutos e 2 horas após
  if (diffMinutes > 10 && diffMinutes <= 120) {
    return "late";
  }

  // missed: mais de 2 horas após
  if (diffMinutes > 120) {
    return "missed";
  }

  // Ainda não chegou a hora (futuro)
  return "on_time";
}

/**
 * Retorna informações visuais do status
 */
export function getReminderStatusInfo(status: ReminderStatus): ReminderStatusInfo {
  switch (status) {
    case "on_time":
      return {
        status: "on_time",
        label: "Dentro do horário",
        color: "bg-success/10 text-success border-success/20"
      };
    case "late":
      return {
        status: "late",
        label: "Atrasado",
        color: "bg-warning/10 text-warning border-warning/20"
      };
    case "missed":
      return {
        status: "missed",
        label: "Perdido",
        color: "bg-destructive/10 text-destructive border-destructive/20"
      };
    case "taken":
      return {
        status: "taken",
        label: "Tomado",
        color: "bg-success text-success-foreground border-success"
      };
  }
}
