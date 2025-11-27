import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  lembreteId: string
  medicamentoNome: string
  dosagem: string
  horario: string
  medicamentoId: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY')!
    
    if (!fcmServerKey) {
      throw new Error('FCM_SERVER_KEY não configurada')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { notification } = await req.json() as { notification: NotificationPayload }

    console.log('[FCM] Enviando notificação:', notification)

    // Buscar lembrete para pegar usuario_id
    const { data: lembrete } = await supabase
      .from('lembretes')
      .select('medicamento_id, medicamentos!inner(usuario_id)')
      .eq('id', notification.lembreteId)
      .single()

    if (!lembrete) {
      console.warn('[FCM] Lembrete não encontrado:', notification.lembreteId)
      return new Response(
        JSON.stringify({ error: 'Lembrete não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    const usuarioId = (lembrete.medicamentos as any).usuario_id

    // Buscar todos os tokens FCM do usuário
    const { data: tokens } = await supabase
      .from('fcm_tokens')
      .select('token')
      .eq('usuario_id', usuarioId)

    if (!tokens || tokens.length === 0) {
      console.warn('[FCM] Nenhum token encontrado para usuário:', usuarioId)
      return new Response(
        JSON.stringify({ error: 'Nenhum token FCM registrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    console.log(`[FCM] Enviando para ${tokens.length} dispositivo(s)`)

    // Enviar notificação via FCM para cada token
    const results = await Promise.allSettled(
      tokens.map(async ({ token }) => {
        const fcmPayload = {
          to: token,
          notification: {
            title: `⏰ ${notification.medicamentoNome}`,
            body: `Hora de tomar ${notification.dosagem}`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: `dose-reminder-${notification.lembreteId}`,
            requireInteraction: true,
            data: {
              lembreteId: notification.lembreteId,
              medicamentoId: notification.medicamentoId,
              medicamentoNome: notification.medicamentoNome,
              dosagem: notification.dosagem,
              horario: notification.horario
            }
          },
          data: {
            lembreteId: notification.lembreteId,
            medicamentoId: notification.medicamentoId,
            medicamentoNome: notification.medicamentoNome,
            dosagem: notification.dosagem,
            horario: notification.horario,
            click_action: '/dashboard',
            type: 'medication_reminder'
          },
          priority: 'high',
          time_to_live: 3600 // 1 hora
        }

        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Authorization': `key=${fcmServerKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(fcmPayload)
        })

        const result = await response.json()
        
        if (!response.ok) {
          console.error('[FCM] Erro ao enviar:', result)
          
          // Se token inválido, remover do banco
          if (result.error === 'InvalidRegistration' || result.error === 'NotRegistered') {
            await supabase
              .from('fcm_tokens')
              .delete()
              .eq('token', token)
            console.log('[FCM] Token inválido removido:', token)
          }
          
          throw new Error(result.error || 'Erro ao enviar notificação')
        }

        console.log('[FCM] Notificação enviada com sucesso:', result)
        return result
      })
    )

    // Contar sucessos e falhas
    const successCount = results.filter(r => r.status === 'fulfilled').length
    const failureCount = results.filter(r => r.status === 'rejected').length

    // Registrar analytics de entrega
    await supabase.from('notification_analytics').insert({
      usuario_id: usuarioId,
      evento_tipo: 'delivered',
      lembrete_id: notification.lembreteId,
      medicamento_id: notification.medicamentoId,
      timestamp: new Date().toISOString(),
      metadata: {
        success_count: successCount,
        failure_count: failureCount,
        via: 'fcm',
        horario: notification.horario
      }
    })

    console.log(`[FCM] Enviado: ${successCount} sucesso, ${failureCount} falha`)

    return new Response(
      JSON.stringify({ 
        success: true,
        sent: successCount,
        failed: failureCount,
        total: tokens.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[FCM] Erro:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
