/**
 * Cliente de Analytics para receber eventos do Service Worker
 * e enviá-los para o Supabase
 */

import { supabase } from '@/integrations/supabase/client';

// Configurar listener para mensagens do Service Worker
export const initAnalyticsListener = () => {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', async (event) => {
    if (event.data.type === 'TRACK_ANALYTICS') {
      const { event: eventType, lembreteId, medicamentoId, metadata } = event.data;
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('notification_analytics').insert({
          usuario_id: user.id,
          evento_tipo: eventType,
          lembrete_id: lembreteId,
          medicamento_id: medicamentoId,
          metadata: metadata || {},
        });

        console.log(`Analytics tracked: ${eventType}`);
      } catch (error) {
        console.error('Error tracking analytics from SW:', error);
      }
    }
  });
};
