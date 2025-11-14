import { useEffect, useCallback } from "react";
import { useNotifications } from "./useNotifications";

interface Reminder {
  id: string;
  horario: string;
  medicamento_id: string;
  medicamentoNome: string;
}

export const useReminderNotifications = (reminders: Reminder[]) => {
  const { permission, requestPermission, sendNotification, isSupported } = useNotifications();

  // Solicitar permissão quando o componente montar
  useEffect(() => {
    if (isSupported && permission === "default") {
      requestPermission();
    }
  }, [isSupported, permission, requestPermission]);

  // Função para verificar e enviar notificações
  const checkAndNotify = useCallback(() => {
    if (permission !== "granted" || !reminders.length) return;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    reminders.forEach((reminder) => {
      const [hours, minutes] = reminder.horario.split(":").map(Number);
      const reminderTime = hours * 60 + minutes;
      const diffMinutes = currentTime - reminderTime;

      // Notificação no horário exato (±1 minuto)
      if (Math.abs(diffMinutes) <= 1) {
        sendNotification(`Hora de tomar ${reminder.medicamentoNome}`, {
          body: "Toque para confirmar que tomou sua dose.",
          tag: `reminder-${reminder.id}`,
          requireInteraction: true,
        });
      }

      // Segunda notificação após 10 minutos
      if (diffMinutes >= 10 && diffMinutes <= 11) {
        sendNotification(`Lembrete: ${reminder.medicamentoNome}`, {
          body: "Você ainda não confirmou sua dose.",
          tag: `reminder-late-${reminder.id}`,
          requireInteraction: true,
        });
      }

      // Terceira notificação após 1 hora
      if (diffMinutes >= 60 && diffMinutes <= 61) {
        sendNotification(`Último aviso: ${reminder.medicamentoNome}`, {
          body: "Sua dose ainda está pendente.",
          tag: `reminder-final-${reminder.id}`,
          requireInteraction: true,
        });
      }
    });
  }, [reminders, permission, sendNotification]);

  // Verificar a cada minuto
  useEffect(() => {
    checkAndNotify(); // Verificar imediatamente
    const interval = setInterval(checkAndNotify, 60000); // A cada 1 minuto

    return () => clearInterval(interval);
  }, [checkAndNotify]);

  return { permission, requestPermission };
};
