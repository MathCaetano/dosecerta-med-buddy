/**
 * Cliente de Analytics para receber eventos do Service Worker
 * e enviá-los para o Supabase
 */

import { supabase } from '@/integrations/supabase/client';

// Configurar listener para mensagens do Service Worker
export const initAnalyticsListener = () => {
  if (!('serviceWorker' in navigator)) return;

  // Escutar mensagens do Service Worker
  navigator.serviceWorker.addEventListener('message', async (event) => {
    if (event.data.type === 'TRACK_ANALYTICS') {
      const { event: eventType, lembreteId, medicamentoId, metadata } = event.data;
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.warn('[Analytics] Usuário não autenticado, pulando');
          return;
        }

        await supabase.from('notification_analytics').insert({
          usuario_id: user.id,
          evento_tipo: eventType,
          lembrete_id: lembreteId || null,
          medicamento_id: medicamentoId || null,
          timestamp: metadata?.timestamp || new Date().toISOString(),
          metadata: metadata || null,
        });

        console.log(`[Analytics] ${eventType} registrado:`, lembreteId);
      } catch (error) {
        console.error('[Analytics] Error tracking from SW:', error);
      }
    }
  });

  // Também escutar mensagens diretas da janela
  window.addEventListener('message', async (event) => {
    // Verificar se é mensagem interna
    if (event.source !== window) return;
    
    if (event.data.type === 'TRACK_ANALYTICS') {
      const { event: eventType, lembreteId, medicamentoId, metadata } = event.data;
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.warn('[Analytics] Usuário não autenticado, pulando');
          return;
        }

        await supabase.from('notification_analytics').insert({
          usuario_id: user.id,
          evento_tipo: eventType,
          lembrete_id: lembreteId || null,
          medicamento_id: medicamentoId || null,
          timestamp: metadata?.timestamp || new Date().toISOString(),
          metadata: metadata || null,
        });

        console.log(`[Analytics] ${eventType} registrado:`, lembreteId);
      } catch (error) {
        console.error('[Analytics] Error tracking from Window:', error);
      }
    }
  });

  console.log('[Analytics] Listener inicializado (SW + Window)');
};
