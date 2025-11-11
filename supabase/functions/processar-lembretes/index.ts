import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Iniciando processamento de lembretes...')

    // 1. Criar histórico pendente para lembretes ativos que ainda não têm registro hoje
    const hoje = new Date().toISOString().split('T')[0]
    
    const { data: lembretesAtivos, error: lembretesError } = await supabase
      .from('lembretes')
      .select('id, medicamento_id, horario')
      .eq('ativo', true)

    if (lembretesError) {
      console.error('Erro ao buscar lembretes:', lembretesError)
      throw lembretesError
    }

    console.log(`Encontrados ${lembretesAtivos?.length || 0} lembretes ativos`)

    // Para cada lembrete ativo, garantir que existe um registro de histórico para hoje
    for (const lembrete of lembretesAtivos || []) {
      const { error: insertError } = await supabase
        .from('historico_doses')
        .insert({
          lembrete_id: lembrete.id,
          data: hoje,
          status: 'pendente'
        })
        .select()

      // Se der erro de duplicate key, ignorar (já existe)
      if (insertError && !insertError.message.includes('duplicate key')) {
        console.error(`Erro ao criar histórico para lembrete ${lembrete.id}:`, insertError)
      }
    }

    // 2. Marcar como esquecido doses pendentes cujo horário passou há mais de 30 minutos
    const agora = new Date()
    const horaAtual = agora.toTimeString().split(' ')[0].substring(0, 5) // HH:MM

    const { data: dosesPendentes, error: pendentesError } = await supabase
      .from('historico_doses')
      .select(`
        id,
        lembrete_id,
        lembretes!inner(horario)
      `)
      .eq('status', 'pendente')
      .eq('data', hoje)

    if (pendentesError) {
      console.error('Erro ao buscar doses pendentes:', pendentesError)
      throw pendentesError
    }

    console.log(`Encontradas ${dosesPendentes?.length || 0} doses pendentes`)

    let marcadasEsquecidas = 0
    for (const dose of dosesPendentes || []) {
      const lembrete = dose.lembretes as any
      const horarioLembrete = lembrete.horario
      const [hora, minuto] = horarioLembrete.split(':').map(Number)
      const horarioLimite = new Date(agora)
      horarioLimite.setHours(hora, minuto + 30, 0, 0)

      if (agora > horarioLimite) {
        const { error: updateError } = await supabase
          .from('historico_doses')
          .update({ status: 'esquecido' })
          .eq('id', dose.id)

        if (updateError) {
          console.error(`Erro ao marcar dose ${dose.id} como esquecida:`, updateError)
        } else {
          marcadasEsquecidas++
        }
      }
    }

    console.log(`${marcadasEsquecidas} doses marcadas como esquecidas`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Lembretes processados com sucesso',
        lembretesAtivos: lembretesAtivos?.length || 0,
        dosesEsquecidas: marcadasEsquecidas
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro ao processar lembretes:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
