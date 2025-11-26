/**
 * Sistema de Agendamento de Notificações
 * Gerencia notificações locais com Service Worker
 */

interface ScheduledNotification {
  lembreteId: string;
  medicamentoNome: string;
  dosagem: string;
  horario: string;
  timestamp: number;
}

class NotificationScheduler {
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map();

  /**
   * Inicializar Service Worker
   */
  async initialize(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker não suportado neste navegador');
      return false;
    }

    if (!('Notification' in window)) {
      console.warn('Notificações não suportadas neste navegador');
      return false;
    }

    try {
      // Registrar Service Worker
      this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registrado com sucesso');

      // Solicitar permissão de notificação
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }

      return Notification.permission === 'granted';
    } catch (error) {
      console.error('Erro ao registrar Service Worker:', error);
      return false;
    }
  }

  /**
   * Verificar se notificações estão habilitadas
   */
  isEnabled(): boolean {
    return (
      'Notification' in window &&
      Notification.permission === 'granted' &&
      this.serviceWorkerRegistration !== null
    );
  }

  /**
   * Solicitar permissão de notificações
   */
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  /**
   * Agendar notificação para horário específico
   */
  async scheduleNotification(
    lembreteId: string,
    medicamentoNome: string,
    dosagem: string,
    horario: string,
    medicamentoId?: string
  ): Promise<boolean> {
    if (!this.isEnabled()) {
      console.warn('Notificações não estão habilitadas');
      return false;
    }

    try {
      // Calcular delay até o horário
      const now = new Date();
      const [hours, minutes] = horario.split(':').map(Number);
      
      const targetTime = new Date();
      targetTime.setHours(hours, minutes, 0, 0);

      // Se o horário já passou hoje, agendar para amanhã
      if (targetTime <= now) {
        targetTime.setDate(targetTime.getDate() + 1);
      }

      const delay = targetTime.getTime() - now.getTime();

      // Armazenar notificação agendada
      const notification: ScheduledNotification = {
        lembreteId,
        medicamentoNome,
        dosagem,
        horario,
        timestamp: targetTime.getTime()
      };

      this.scheduledNotifications.set(lembreteId, notification);

      // Salvar no localStorage para persistência
      this.saveToStorage();

      // Enviar para Service Worker
      if (this.serviceWorkerRegistration?.active) {
        this.serviceWorkerRegistration.active.postMessage({
          type: 'SCHEDULE_NOTIFICATION',
          notification: {
            lembreteId,
            medicamentoNome,
            dosagem,
            horario,
            medicamentoId
          },
          delay
        });
      }

      console.log(`Notificação agendada para ${horario} (${delay}ms)`);
      
      // Rastrear agendamento via postMessage para background
      if (medicamentoId && this.serviceWorkerRegistration?.active) {
        this.serviceWorkerRegistration.active.postMessage({
          type: 'TRACK_ANALYTICS',
          event: 'scheduled',
          lembreteId,
          medicamentoId,
          metadata: { horario }
        });
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao agendar notificação:', error);
      return false;
    }
  }

  /**
   * Cancelar notificação específica
   */
  async cancelNotification(lembreteId: string): Promise<void> {
    this.scheduledNotifications.delete(lembreteId);
    this.saveToStorage();

    if (this.serviceWorkerRegistration?.active) {
      this.serviceWorkerRegistration.active.postMessage({
        type: 'CANCEL_NOTIFICATION',
        lembreteId
      });
    }

    console.log(`Notificação ${lembreteId} cancelada`);
  }

  /**
   * Cancelar todas as notificações de um medicamento
   */
  async cancelMedicationNotifications(medicamentoId: string): Promise<void> {
    const toCancel: string[] = [];
    
    this.scheduledNotifications.forEach((notification, lembreteId) => {
      if (lembreteId.includes(medicamentoId)) {
        toCancel.push(lembreteId);
      }
    });

    for (const lembreteId of toCancel) {
      await this.cancelNotification(lembreteId);
    }
  }

  /**
   * Agendar todas as notificações do dia
   */
  async scheduleAllForToday(lembretes: Array<{
    id: string;
    medicamento_id: string;
    medicamento_nome: string;
    dosagem: string;
    horario: string;
    ativo: boolean;
  }>): Promise<number> {
    let scheduled = 0;

    for (const lembrete of lembretes) {
      if (!lembrete.ativo) continue;

      const success = await this.scheduleNotification(
        lembrete.id,
        lembrete.medicamento_nome,
        lembrete.dosagem,
        lembrete.horario
      );

      if (success) scheduled++;
    }

    console.log(`${scheduled} notificações agendadas para hoje`);
    return scheduled;
  }

  /**
   * Reagendar notificação para daqui X minutos
   */
  async snoozeNotification(
    lembreteId: string,
    medicamentoNome: string,
    dosagem: string,
    minutes: number = 5
  ): Promise<boolean> {
    if (!this.isEnabled()) return false;

    const now = new Date();
    const targetTime = new Date(now.getTime() + minutes * 60 * 1000);
    const horario = `${targetTime.getHours().toString().padStart(2, '0')}:${targetTime.getMinutes().toString().padStart(2, '0')}`;

    return this.scheduleNotification(
      `${lembreteId}-snooze`,
      medicamentoNome,
      dosagem,
      horario
    );
  }

  /**
   * Obter notificações agendadas
   */
  getScheduledNotifications(): ScheduledNotification[] {
    return Array.from(this.scheduledNotifications.values());
  }

  /**
   * Salvar no localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Array.from(this.scheduledNotifications.entries());
      localStorage.setItem('scheduled_notifications', JSON.stringify(data));
    } catch (error) {
      console.error('Erro ao salvar notificações:', error);
    }
  }

  /**
   * Carregar do localStorage
   */
  loadFromStorage(): void {
    try {
      const data = localStorage.getItem('scheduled_notifications');
      if (data) {
        const entries = JSON.parse(data);
        this.scheduledNotifications = new Map(entries);
        console.log(`${entries.length} notificações carregadas do storage`);
      }
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    }
  }

  /**
   * Limpar notificações expiradas
   */
  cleanExpired(): void {
    const now = Date.now();
    let removed = 0;

    this.scheduledNotifications.forEach((notification, lembreteId) => {
      if (notification.timestamp < now) {
        this.scheduledNotifications.delete(lembreteId);
        removed++;
      }
    });

    if (removed > 0) {
      this.saveToStorage();
      console.log(`${removed} notificações expiradas removidas`);
    }
  }
}

// Exportar instância única
export const notificationScheduler = new NotificationScheduler();
