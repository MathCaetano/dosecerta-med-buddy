import { useEffect, useState, useCallback } from "react";
import { notificationScheduler } from "@/utils/notificationScheduler";

/**
 * Hook para gerenciar notificações
 * Versão melhorada com suporte a agendamento
 */
export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  // Inicializar ao montar
  useEffect(() => {
    const init = async () => {
      if ("Notification" in window) {
        setIsSupported(true);
        setPermission(Notification.permission);
        
        // Inicializar scheduler se já tem permissão
        if (Notification.permission === "granted") {
          const success = await notificationScheduler.initialize();
          setIsInitialized(success);
          
          if (success) {
            // Carregar notificações salvas
            notificationScheduler.loadFromStorage();
            // Limpar expiradas
            notificationScheduler.cleanExpired();
          }
        }
      }
    };

    init();
  }, []);

  // ✅ Verificar permissões periodicamente
  useEffect(() => {
    if (!("Notification" in window)) return;

    const checkPermissions = () => {
      const currentPermission = Notification.permission;
      if (currentPermission !== permission) {
        console.log(`[Notifications] Permissão mudou: ${permission} → ${currentPermission}`);
        setPermission(currentPermission);
        
        // Se foi concedida, re-inicializar
        if (currentPermission === "granted" && !isInitialized) {
          notificationScheduler.initialize().then(success => {
            setIsInitialized(success);
            if (success) {
              notificationScheduler.loadFromStorage();
            }
          });
        }
        
        // Se foi revogada, limpar
        if (currentPermission === "denied" && isInitialized) {
          setIsInitialized(false);
        }
      }
    };

    // Verificar a cada 5 segundos
    const interval = setInterval(checkPermissions, 5000);
    
    return () => clearInterval(interval);
  }, [permission, isInitialized]);

  // Solicitar permissão e inicializar
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      return "denied";
    }

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === "granted") {
      const success = await notificationScheduler.initialize();
      setIsInitialized(success);
      return result;
    }

    return result;
  }, []);

  // Enviar notificação instantânea (legado)
  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (permission === "granted") {
      new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        ...options,
      });
    }
  }, [permission]);

  // Agendar notificação para horário específico
  const scheduleNotification = useCallback(
    async (
      lembreteId: string,
      medicamentoNome: string,
      dosagem: string,
      horario: string,
      medicamentoId?: string
    ) => {
      if (!isInitialized) {
        console.warn("Scheduler não inicializado");
        return false;
      }

      return notificationScheduler.scheduleNotification(
        lembreteId,
        medicamentoNome,
        dosagem,
        horario,
        medicamentoId
      );
    },
    [isInitialized]
  );

  // Cancelar notificação
  const cancelNotification = useCallback(async (lembreteId: string) => {
    return notificationScheduler.cancelNotification(lembreteId);
  }, []);

  // Cancelar todas de um medicamento
  const cancelMedicationNotifications = useCallback(async (medicamentoId: string) => {
    return notificationScheduler.cancelMedicationNotifications(medicamentoId);
  }, []);

  // Agendar todas do dia
  const scheduleAllForToday = useCallback(
    async (lembretes: any[]) => {
      if (!isInitialized) {
        console.warn("Scheduler não inicializado");
        return 0;
      }

      return notificationScheduler.scheduleAllForToday(lembretes);
    },
    [isInitialized]
  );

  // Soneca - reagendar para daqui X minutos
  const snoozeNotification = useCallback(
    async (
      lembreteId: string,
      medicamentoNome: string,
      dosagem: string,
      minutes: number = 5
    ) => {
      return notificationScheduler.snoozeNotification(
        lembreteId,
        medicamentoNome,
        dosagem,
        minutes
      );
    },
    []
  );

  // Obter notificações agendadas
  const getScheduledNotifications = useCallback(() => {
    return notificationScheduler.getScheduledNotifications();
  }, []);

  return {
    permission,
    isSupported,
    isInitialized,
    requestPermission,
    sendNotification,
    scheduleNotification,
    cancelNotification,
    cancelMedicationNotifications,
    scheduleAllForToday,
    snoozeNotification,
    getScheduledNotifications,
  };
};
