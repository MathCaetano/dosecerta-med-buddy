// Service Worker para Dose Certa
// Gerencia notificações em background com Notification API nativa

const CACHE_NAME = 'dosecerta-v1';
const NOTIFICATION_TAG = 'dose-reminder';
const SUPABASE_URL = 'https://xhbbbxxveujrpegzxkkt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoYmJieHh2ZXVqcnBlZ3p4a2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNjY5ODYsImV4cCI6MjA3Nzg0Mjk4Nn0.MRJYO-2ArhwSTwY13p8RRBHSUHqryoscxy7BX-Hqwzo';

// Storage interno para notificações agendadas
let scheduledNotifications = new Map();

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

// Enviar mensagem para todos os clientes
async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(client => {
    client.postMessage(message);
  });
}

// Mostrar notificação e rastrear
async function showNotification(data) {
  console.log('[SW] Showing notification:', data);
  
  try {
    // Mostrar notificação
    await self.registration.showNotification(
      `⏰ ${data.medicamentoNome}`,
      {
        body: `Hora de tomar ${data.dosagem}`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: NOTIFICATION_TAG + '-' + data.lembreteId,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        actions: [
          { action: 'mark-taken', title: '✓ Tomei', icon: '/favicon.ico' },
          { action: 'snooze', title: '⏰ 5 min', icon: '/favicon.ico' }
        ],
        data: data,
        timestamp: Date.now()
      }
    );

    // Rastrear evento 'delivered'
    await notifyClients({
      type: 'TRACK_ANALYTICS',
      event: 'delivered',
      lembreteId: data.lembreteId,
      medicamentoId: data.medicamentoId,
      metadata: { timestamp: new Date().toISOString() }
    });

    console.log('[SW] Notification delivered:', data.lembreteId);
  } catch (error) {
    console.error('[SW] Error showing notification:', error);
  }
}

// Processar cliques em notificações
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event.action, event.notification.data);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  const lembreteId = data.lembreteId;
  const medicamentoId = data.medicamentoId;
  const medicamentoNome = data.medicamentoNome;
  
  // Rastrear clique
  event.waitUntil(
    notifyClients({
      type: 'TRACK_ANALYTICS',
      event: 'clicked',
      lembreteId: lembreteId,
      medicamentoId: medicamentoId,
      metadata: { 
        action: event.action || 'open',
        timestamp: new Date().toISOString()
      }
    })
  );
  
  // Processar ação
  if (event.action === 'mark-taken') {
    // Marcar como tomado
    event.waitUntil(
      (async () => {
        try {
          const hoje = new Date().toISOString().split('T')[0];
          const agora = new Date().toTimeString().split(' ')[0];

          // Buscar histórico existente
          const histResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/historico_doses?lembrete_id=eq.${lembreteId}&data=eq.${hoje}`,
            {
              headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );

          const historico = await histResponse.json();

          if (historico && historico.length > 0) {
            // Atualizar existente
            await fetch(
              `${SUPABASE_URL}/rest/v1/historico_doses?id=eq.${historico[0].id}`,
              {
                method: 'PATCH',
                headers: {
                  'apikey': SUPABASE_ANON_KEY,
                  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                  status: 'tomado',
                  horario_real: agora
                })
              }
            );
          } else {
            // Criar novo
            await fetch(
              `${SUPABASE_URL}/rest/v1/historico_doses`,
              {
                method: 'POST',
                headers: {
                  'apikey': SUPABASE_ANON_KEY,
                  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                  lembrete_id: lembreteId,
                  data: hoje,
                  horario_real: agora,
                  status: 'tomado'
                })
              }
            );
          }

          // Rastrear ação tomada
          await notifyClients({
            type: 'TRACK_ANALYTICS',
            event: 'action_taken',
            lembreteId: lembreteId,
            medicamentoId: medicamentoId,
            metadata: { 
              action: 'mark-taken',
              timestamp: new Date().toISOString()
            }
          });

          // Mostrar confirmação
          await self.registration.showNotification('✅ Dose confirmada!', {
            body: `${medicamentoNome} marcado como tomado`,
            tag: 'dose-confirmed',
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            requireInteraction: false,
            silent: true
          });

          console.log('[SW] Dose marked as taken:', lembreteId);
        } catch (error) {
          console.error('[SW] Error marking dose:', error);
          
          // Mostrar erro
          await self.registration.showNotification('❌ Erro', {
            body: 'Não foi possível marcar a dose. Abra o app.',
            tag: 'dose-error',
            icon: '/favicon.ico',
            requireInteraction: false
          });
        }
      })()
    );
  } else if (event.action === 'snooze') {
    // Lembrar em 5 minutos
    event.waitUntil(
      (async () => {
        // Rastrear soneca
        await notifyClients({
          type: 'TRACK_ANALYTICS',
          event: 'action_snoozed',
          lembreteId: lembreteId,
          medicamentoId: medicamentoId,
          metadata: { 
            action: 'snooze',
            minutes: 5,
            timestamp: new Date().toISOString()
          }
        });

        // Agendar nova notificação após 5 minutos
        const snoozeTime = Date.now() + (5 * 60 * 1000);
        scheduledNotifications.set(`${lembreteId}-snooze`, {
          ...data,
          scheduledTime: snoozeTime
        });

        setTimeout(() => {
          showNotification({
            ...data,
            lembreteId: `${lembreteId}-snooze`
          });
        }, 5 * 60 * 1000);

        // Mostrar confirmação
        await self.registration.showNotification('⏰ Lembrete adiado', {
          body: 'Vou te lembrar em 5 minutos',
          tag: 'dose-snoozed',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          requireInteraction: false,
          silent: true
        });

        console.log('[SW] Notification snoozed for 5 minutes');
      })()
    );
  } else {
    // Abrir app no dashboard
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  }
});

// Processar notificações fechadas
self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};
  
  // Rastrear dismissal
  notifyClients({
    type: 'TRACK_ANALYTICS',
    event: 'dismissed',
    lembreteId: data.lembreteId,
    medicamentoId: data.medicamentoId,
    metadata: { timestamp: new Date().toISOString() }
  });
  
  console.log('[SW] Notification dismissed:', data.lembreteId);
});

// Receber mensagens do cliente
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { notification, delay } = event.data;
    const scheduledTime = Date.now() + delay;
    
    // Armazenar notificação agendada
    scheduledNotifications.set(notification.lembreteId, {
      ...notification,
      scheduledTime: scheduledTime
    });
    
    // Agendar notificação
    setTimeout(() => {
      // Verificar se ainda está agendada (pode ter sido cancelada)
      if (scheduledNotifications.has(notification.lembreteId)) {
        showNotification(notification);
        scheduledNotifications.delete(notification.lembreteId);
      }
    }, delay);
    
    console.log('[SW] Notification scheduled for', new Date(scheduledTime).toLocaleString());
  }
  
  if (event.data.type === 'CANCEL_NOTIFICATION') {
    const { lembreteId } = event.data;
    
    // Remover do mapa de agendadas
    scheduledNotifications.delete(lembreteId);
    
    // Fechar notificações visíveis
    self.registration.getNotifications({ tag: NOTIFICATION_TAG + '-' + lembreteId })
      .then(notifications => {
        notifications.forEach(n => n.close());
        console.log('[SW] Notification cancelled:', lembreteId);
      });
  }

  if (event.data.type === 'GET_SCHEDULED') {
    // Retornar notificações agendadas
    event.ports[0].postMessage({
      scheduled: Array.from(scheduledNotifications.entries())
    });
  }

  if (event.data.type === 'TRACK_ANALYTICS') {
    // Repassar evento de analytics para cliente
    notifyClients({
      type: 'TRACK_ANALYTICS',
      event: event.data.event,
      lembreteId: event.data.lembreteId,
      medicamentoId: event.data.medicamentoId,
      metadata: event.data.metadata
    });
  }
});
