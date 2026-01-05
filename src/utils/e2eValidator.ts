/**
 * Validador E2E em Runtime - DoseCerta
 * 
 * Use este módulo para executar validações em tempo real
 * e detectar bugs antes de afetar o usuário.
 * 
 * Pode ser chamado via console: window.runE2EValidation()
 */

import {
  getDoseStatus,
  detectPeriod,
  shouldAutoMarkForgotten,
  WINDOW_START_OFFSET,
  WINDOW_END_OFFSET,
} from './doseStatus';

export interface ValidationResult {
  passed: boolean;
  scenario: string;
  expected: string;
  actual: string;
  details?: string;
}

export interface E2EReport {
  timestamp: string;
  timezone: string;
  totalTests: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
}

/**
 * Cria uma data com horário específico para hoje
 */
function createTimeToday(hours: number, minutes: number): Date {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Executa todas as validações E2E
 */
export function runE2EValidation(): E2EReport {
  const results: ValidationResult[] = [];
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  console.log('🔍 Iniciando validação E2E DoseCerta...');
  console.log(`⏰ Horário atual: ${now.toLocaleTimeString()}`);
  console.log(`🌍 Timezone: ${timezone}`);
  console.log('─'.repeat(50));

  // ============================================
  // CENÁRIO 1: Classificação de Período
  // ============================================
  const periodTests = [
    { horario: '06:00', expected: 'manha' },
    { horario: '11:59', expected: 'manha' },
    { horario: '12:00', expected: 'tarde' },
    { horario: '17:59', expected: 'tarde' },
    { horario: '18:00', expected: 'noite' },
    { horario: '04:59', expected: 'noite' },
  ];

  periodTests.forEach(({ horario, expected }) => {
    const actual = detectPeriod(horario);
    results.push({
      passed: actual === expected,
      scenario: `Período de ${horario}`,
      expected,
      actual,
    });
  });

  // ============================================
  // CENÁRIO 2: Status antes da janela = AGENDADO
  // ============================================
  const beforeWindow = getDoseStatus(createTimeToday(8, 0), '09:00', null);
  results.push({
    passed: beforeWindow.status === 'agendado',
    scenario: 'now=08:00, dose=09:00 → AGENDADO',
    expected: 'agendado',
    actual: beforeWindow.status,
    details: 'Antes da janela (janela abre 08:30)',
  });

  results.push({
    passed: beforeWindow.canMarkTaken === false,
    scenario: 'Botão "Tomei" desabilitado antes da janela',
    expected: 'false',
    actual: String(beforeWindow.canMarkTaken),
  });

  // ============================================
  // CENÁRIO 3: Status dentro da janela = PENDENTE
  // ============================================
  const inWindow = getDoseStatus(createTimeToday(9, 5), '09:00', null);
  results.push({
    passed: inWindow.status === 'pendente',
    scenario: 'now=09:05, dose=09:00 → PENDENTE',
    expected: 'pendente',
    actual: inWindow.status,
    details: 'Dentro da janela de ação',
  });

  results.push({
    passed: inWindow.canMarkTaken === true,
    scenario: 'Botão "Tomei" ATIVO dentro da janela',
    expected: 'true',
    actual: String(inWindow.canMarkTaken),
  });

  results.push({
    passed: inWindow.canMarkForgotten === true,
    scenario: 'Botão "Esqueci" ATIVO dentro da janela',
    expected: 'true',
    actual: String(inWindow.canMarkForgotten),
  });

  // ============================================
  // CENÁRIO 4: Status após janela = ESQUECIDO
  // ============================================
  const afterWindow = getDoseStatus(createTimeToday(10, 31), '09:00', null);
  results.push({
    passed: afterWindow.status === 'esquecido',
    scenario: 'now=10:31, dose=09:00 → ESQUECIDO',
    expected: 'esquecido',
    actual: afterWindow.status,
    details: 'Após janela (janela fecha 10:30)',
  });

  results.push({
    passed: afterWindow.canMarkTaken === false,
    scenario: 'Botão "Tomei" desabilitado após janela',
    expected: 'false',
    actual: String(afterWindow.canMarkTaken),
  });

  // ============================================
  // CENÁRIO 5: Estado preservado
  // ============================================
  const preservedTaken = getDoseStatus(createTimeToday(14, 0), '09:00', 'tomado');
  results.push({
    passed: preservedTaken.status === 'tomado',
    scenario: 'savedStatus=tomado → mantém TOMADO',
    expected: 'tomado',
    actual: preservedTaken.status,
    details: 'Estado do usuário preservado',
  });

  const preservedForgotten = getDoseStatus(createTimeToday(9, 15), '09:00', 'esquecido');
  results.push({
    passed: preservedForgotten.status === 'esquecido',
    scenario: 'savedStatus=esquecido → mantém ESQUECIDO',
    expected: 'esquecido',
    actual: preservedForgotten.status,
  });

  // ============================================
  // CENÁRIO 6: Configuração da janela
  // ============================================
  results.push({
    passed: WINDOW_START_OFFSET === -30,
    scenario: 'Janela inicia 30min ANTES',
    expected: '-30',
    actual: String(WINDOW_START_OFFSET),
  });

  results.push({
    passed: WINDOW_END_OFFSET === 90,
    scenario: 'Janela termina 90min APÓS',
    expected: '90',
    actual: String(WINDOW_END_OFFSET),
  });

  // ============================================
  // CENÁRIO 7: Auto-marcação
  // ============================================
  results.push({
    passed: shouldAutoMarkForgotten('09:00', 'tomado') === false,
    scenario: 'Não auto-marca se já TOMADO',
    expected: 'false',
    actual: String(shouldAutoMarkForgotten('09:00', 'tomado')),
  });

  results.push({
    passed: shouldAutoMarkForgotten('09:00', 'esquecido') === false,
    scenario: 'Não auto-marca se já ESQUECIDO',
    expected: 'false',
    actual: String(shouldAutoMarkForgotten('09:00', 'esquecido')),
  });

  // ============================================
  // CENÁRIO 8: Dose futura nunca é esquecida
  // ============================================
  const futureHour = (now.getHours() + 5) % 24;
  const futureTime = `${String(futureHour).padStart(2, '0')}:00`;
  const futureDose = getDoseStatus(now, futureTime, null);
  
  results.push({
    passed: futureDose.status !== 'esquecido',
    scenario: `Dose futura (${futureTime}) não é ESQUECIDA`,
    expected: 'agendado ou pendente',
    actual: futureDose.status,
    details: 'Dose futura nunca nasce esquecida',
  });

  // ============================================
  // RELATÓRIO FINAL
  // ============================================
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n📊 RELATÓRIO E2E');
  console.log('─'.repeat(50));
  
  results.forEach((r, i) => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.scenario}`);
    if (!r.passed) {
      console.log(`   Esperado: ${r.expected}`);
      console.log(`   Atual: ${r.actual}`);
      if (r.details) console.log(`   Detalhes: ${r.details}`);
    }
  });

  console.log('─'.repeat(50));
  console.log(`Total: ${results.length} | ✅ ${passed} | ❌ ${failed}`);

  if (failed === 0) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM!');
  } else {
    console.log('\n⚠️ EXISTEM FALHAS QUE PRECISAM SER CORRIGIDAS!');
  }

  const report: E2EReport = {
    timestamp: now.toISOString(),
    timezone,
    totalTests: results.length,
    passed,
    failed,
    results,
  };

  // Disponibilizar no window para debug
  if (typeof window !== 'undefined') {
    (window as any).__E2E_REPORT__ = report;
  }

  return report;
}

/**
 * Validação rápida de um único cenário de dose
 */
export function validateDoseScenario(
  currentHour: number,
  currentMinute: number,
  doseHour: number,
  doseMinute: number,
  savedStatus: 'tomado' | 'esquecido' | 'pendente' | 'agendado' | null = null
): ValidationResult {
  const now = createTimeToday(currentHour, currentMinute);
  const doseTime = `${String(doseHour).padStart(2, '0')}:${String(doseMinute).padStart(2, '0')}`;
  
  const result = getDoseStatus(now, doseTime, savedStatus);
  
  const scenario = `now=${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}, ` +
    `dose=${doseTime}, saved=${savedStatus || 'null'}`;
  
  console.log(`🔍 ${scenario}`);
  console.log(`   → Status: ${result.status}`);
  console.log(`   → Botão Tomei: ${result.canMarkTaken}`);
  console.log(`   → Botão Esqueci: ${result.canMarkForgotten}`);
  console.log(`   → Na janela: ${result.isInWindow}`);
  
  return {
    passed: true,
    scenario,
    expected: '-',
    actual: result.status,
    details: JSON.stringify(result.debugInfo),
  };
}

// Expor funções globalmente para debug via console
if (typeof window !== 'undefined') {
  (window as any).runE2EValidation = runE2EValidation;
  (window as any).validateDoseScenario = validateDoseScenario;
  console.log('🔧 Debug disponível: runE2EValidation(), validateDoseScenario(h, m, dH, dM)');
}
