// Service Worker para Dose Certa
// Gerencia notificações em background e offline

const CACHE_NAME = 'dosecerta-v1';
const NOTIFICATION_TAG = 'dose-reminder';

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

// Ativar Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(self.clients.claim());
});

// Processar notificações agendadas
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event.action);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  const lembreteId = data.lembreteId;
  const medicamentoNome = data.medicamentoNome;
  
  // Ações da notificação
  if (event.action === 'mark-taken') {
    // Marcar como tomado
    event.waitUntil(
      fetch('/api/mark-dose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lembreteId,
          status: 'tomado',
          timestamp: new Date().toISOString()
        })
      })
      .then(() => {
        // Mostrar confirmação
        self.registration.showNotification('✅ Dose confirmada!', {
          body: `${medicamentoNome} marcado como tomado`,
          tag: 'dose-confirmed',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          requireInteraction: false,
          silent: true
        });
      })
      .catch(err => console.error('[SW] Erro ao marcar dose:', err))
    );
  } else if (event.action === 'snooze') {
    // Lembrar em 5 minutos
    event.waitUntil(
      scheduleNotification(data, 5 * 60 * 1000) // 5 minutos
    );
  } else {
    // Abrir app
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  }
});

// Agendar notificação
function scheduleNotification(data, delay) {
  return new Promise((resolve) => {
    setTimeout(() => {
      self.registration.showNotification(
        `⏰ ${data.medicamentoNome}`,
        {
          body: `Hora de tomar ${data.dosagem}`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: NOTIFICATION_TAG + '-' + data.lembreteId,
          requireInteraction: true,
          actions: [
            { action: 'mark-taken', title: '✓ Tomei' },
            { action: 'snooze', title: '⏰ 5 min' }
          ],
          data: data
        }
      );
      resolve();
    }, delay);
  });
}

// Receber mensagens do cliente
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { notification, delay } = event.data;
    scheduleNotification(notification, delay);
  }
  
  if (event.data.type === 'CANCEL_NOTIFICATION') {
    const { lembreteId } = event.data;
    // Cancelar notificação específica
    self.registration.getNotifications({ tag: NOTIFICATION_TAG + '-' + lembreteId })
      .then(notifications => {
        notifications.forEach(n => n.close());
      });
  }
});
