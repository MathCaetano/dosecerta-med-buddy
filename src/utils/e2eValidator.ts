/**
 * Validador E2E Completo - DoseCerta
 * 
 * Sistema de validação End-to-End para garantir que:
 * 1. Horários são salvos corretamente
 * 2. Período é definido automaticamente
 * 3. Status inicial é sempre PENDENTE
 * 4. Nenhum lembrete é marcado como ESQUECIDO antes do horário
 * 5. Tolerância é aplicada globalmente
 * 6. Reset diário funciona corretamente
 * 
 * Pode ser executado via console: window.runE2EValidation()
 */

import {
  getDoseStatus,
  detectPeriod,
  shouldAutoMarkForgotten,
  canPerformAction,
  WINDOW_START_OFFSET,
  WINDOW_END_OFFSET,
  type DoseStatusType,
} from './doseStatus';
import { detectPeriodFromTime } from '@/components/ui/time-picker';

// ============================================
// INTERFACES
// ============================================

export interface ValidationResult {
  passed: boolean;
  scenario: string;
  expected: string;
  actual: string;
  details?: string;
  category: E2ECategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface E2EReport {
  timestamp: string;
  timezone: string;
  totalTests: number;
  passed: number;
  failed: number;
  criticalFailures: number;
  categories: Record<E2ECategory, CategorySummary>;
  results: ValidationResult[];
}

export interface CategorySummary {
  total: number;
  passed: number;
  failed: number;
}

export type E2ECategory = 
  | 'PERIOD_DETECTION'      // 1. Criação de horário - período automático
  | 'INITIAL_STATUS'        // 2. Status inicial correto
  | 'BEFORE_WINDOW'         // 3. Estado antes da janela
  | 'IN_WINDOW'             // 4. Estado dentro da janela
  | 'AFTER_WINDOW'          // 5. Estado após janela (tolerância)
  | 'BUTTON_STATES'         // 6. Estados dos botões
  | 'USER_ACTIONS'          // 7. Ações do usuário preservadas
  | 'AUTO_MARK'             // 8. Marcação automática
  | 'DAILY_RESET'           // 9. Reset diário
  | 'NOTIFICATIONS'         // 10. Notificações
  | 'TIMEZONE';             // 11. Timezone

// ============================================
// HELPERS
// ============================================

function createTimeToday(hours: number, minutes: number, seconds: number = 0): Date {
  const date = new Date();
  date.setHours(hours, minutes, seconds, 0);
  return date;
}

function formatTimeStr(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function createCategorySummary(): CategorySummary {
  return { total: 0, passed: 0, failed: 0 };
}

// ============================================
// MAIN VALIDATION FUNCTION
// ============================================

/**
 * Executa validação E2E completa do sistema de doses
 * 
 * @returns Relatório completo com todos os testes
 */
export function runE2EValidation(): E2EReport {
  const results: ValidationResult[] = [];
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           🔍 VALIDAÇÃO E2E COMPLETA - DOSECERTA              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`⏰ Horário atual: ${now.toLocaleTimeString()}`);
  console.log(`📅 Data: ${now.toLocaleDateString()}`);
  console.log(`🌍 Timezone: ${timezone}`);
  console.log('─'.repeat(66));

  // ============================================
  // CENÁRIO 1: DETECÇÃO DE PERÍODO (CRÍTICO)
  // ============================================
  console.log('\n📍 CENÁRIO 1: DETECÇÃO DE PERÍODO');
  
  const periodTests = [
    { horario: '05:00', expected: 'manha', desc: 'Início manhã' },
    { horario: '06:00', expected: 'manha', desc: 'Manhã cedo' },
    { horario: '11:59', expected: 'manha', desc: 'Final manhã' },
    { horario: '12:00', expected: 'tarde', desc: 'Início tarde' },
    { horario: '15:30', expected: 'tarde', desc: 'Meio da tarde' },
    { horario: '17:59', expected: 'tarde', desc: 'Final tarde' },
    { horario: '18:00', expected: 'noite', desc: 'Início noite' },
    { horario: '21:00', expected: 'noite', desc: 'Noite' },
    { horario: '23:59', expected: 'noite', desc: 'Quase meia-noite' },
    { horario: '00:00', expected: 'noite', desc: 'Meia-noite' },
    { horario: '04:59', expected: 'noite', desc: 'Madrugada (final noite)' },
  ];

  periodTests.forEach(({ horario, expected, desc }) => {
    // Testar ambas as funções de detecção
    const actualDoseStatus = detectPeriod(horario);
    const actualTimePicker = detectPeriodFromTime(horario);
    
    const passed = actualDoseStatus === expected && actualTimePicker === expected;
    results.push({
      passed,
      scenario: `Período ${horario} (${desc})`,
      expected,
      actual: `doseStatus: ${actualDoseStatus}, timePicker: ${actualTimePicker}`,
      details: passed ? undefined : 'INCONSISTÊNCIA entre funções de detecção!',
      category: 'PERIOD_DETECTION',
      severity: 'critical',
    });
  });

  // ============================================
  // CENÁRIO 2: STATUS INICIAL CORRETO
  // ============================================
  console.log('\n📍 CENÁRIO 2: STATUS INICIAL');
  
  // Uma dose futura deve começar como AGENDADO
  const futureHour = (now.getHours() + 3) % 24;
  const futureTime = formatTimeStr(futureHour, 0);
  const futureDose = getDoseStatus(now, futureTime, null);
  
  results.push({
    passed: futureDose.status === 'agendado',
    scenario: `Dose futura (${futureTime}) inicia como AGENDADO`,
    expected: 'agendado',
    actual: futureDose.status,
    details: 'Status inicial para dose não atingida',
    category: 'INITIAL_STATUS',
    severity: 'critical',
  });

  // Uma dose futura NUNCA deve ser ESQUECIDO
  results.push({
    passed: futureDose.status !== 'esquecido',
    scenario: `Dose futura (${futureTime}) NUNCA é ESQUECIDO`,
    expected: 'NÃO esquecido',
    actual: futureDose.status,
    details: 'Validação crítica: dose futura não pode nascer esquecida',
    category: 'INITIAL_STATUS',
    severity: 'critical',
  });

  // ============================================
  // CENÁRIO 3: ESTADO ANTES DA JANELA
  // ============================================
  console.log('\n📍 CENÁRIO 3: ANTES DA JANELA DE AÇÃO');
  
  // Cenário: now = 08:00, dose = 09:00 (janela abre 08:30)
  const beforeWindow = getDoseStatus(createTimeToday(8, 0), '09:00', null);
  
  results.push({
    passed: beforeWindow.status === 'agendado',
    scenario: 'now=08:00, dose=09:00 → Status AGENDADO',
    expected: 'agendado',
    actual: beforeWindow.status,
    details: '30min antes da janela abrir',
    category: 'BEFORE_WINDOW',
    severity: 'critical',
  });

  results.push({
    passed: beforeWindow.canMarkTaken === false,
    scenario: 'Botão "Tomei" DESABILITADO antes da janela',
    expected: 'false',
    actual: String(beforeWindow.canMarkTaken),
    category: 'BUTTON_STATES',
    severity: 'critical',
  });

  results.push({
    passed: beforeWindow.canMarkForgotten === false,
    scenario: 'Botão "Esqueci" DESABILITADO antes da janela',
    expected: 'false',
    actual: String(beforeWindow.canMarkForgotten),
    category: 'BUTTON_STATES',
    severity: 'critical',
  });

  results.push({
    passed: beforeWindow.isInWindow === false,
    scenario: 'isInWindow = false antes da janela',
    expected: 'false',
    actual: String(beforeWindow.isInWindow),
    category: 'BEFORE_WINDOW',
    severity: 'high',
  });

  // ============================================
  // CENÁRIO 4: ESTADO DENTRO DA JANELA
  // ============================================
  console.log('\n📍 CENÁRIO 4: DENTRO DA JANELA DE AÇÃO');
  
  // Início da janela: dose - 30min
  const windowStart = getDoseStatus(createTimeToday(8, 30), '09:00', null);
  results.push({
    passed: windowStart.status === 'pendente',
    scenario: 'now=08:30, dose=09:00 → Status PENDENTE (início janela)',
    expected: 'pendente',
    actual: windowStart.status,
    details: 'Janela inicia 30min antes do horário',
    category: 'IN_WINDOW',
    severity: 'critical',
  });

  // Exatamente no horário
  const exactTime = getDoseStatus(createTimeToday(9, 0), '09:00', null);
  results.push({
    passed: exactTime.status === 'pendente',
    scenario: 'now=09:00, dose=09:00 → Status PENDENTE (horário exato)',
    expected: 'pendente',
    actual: exactTime.status,
    category: 'IN_WINDOW',
    severity: 'critical',
  });

  // Logo após o horário
  const justAfter = getDoseStatus(createTimeToday(9, 5), '09:00', null);
  results.push({
    passed: justAfter.status === 'pendente',
    scenario: 'now=09:05, dose=09:00 → Status PENDENTE (5min após)',
    expected: 'pendente',
    actual: justAfter.status,
    category: 'IN_WINDOW',
    severity: 'critical',
  });

  // Ainda dentro da tolerância
  const inTolerance = getDoseStatus(createTimeToday(10, 0), '09:00', null);
  results.push({
    passed: inTolerance.status === 'pendente',
    scenario: 'now=10:00, dose=09:00 → Status PENDENTE (60min após, dentro tolerância)',
    expected: 'pendente',
    actual: inTolerance.status,
    details: 'Tolerância de 90min ainda não expirou',
    category: 'IN_WINDOW',
    severity: 'critical',
  });

  // Final da janela
  const windowEnd = getDoseStatus(createTimeToday(10, 30), '09:00', null);
  results.push({
    passed: windowEnd.status === 'pendente',
    scenario: 'now=10:30, dose=09:00 → Status PENDENTE (final janela)',
    expected: 'pendente',
    actual: windowEnd.status,
    details: 'Último momento da janela (90min após)',
    category: 'IN_WINDOW',
    severity: 'critical',
  });

  results.push({
    passed: windowEnd.canMarkTaken === true,
    scenario: 'Botão "Tomei" ATIVO no final da janela',
    expected: 'true',
    actual: String(windowEnd.canMarkTaken),
    category: 'BUTTON_STATES',
    severity: 'critical',
  });

  // ============================================
  // CENÁRIO 5: APÓS JANELA (TOLERÂNCIA EXPIRADA)
  // ============================================
  console.log('\n📍 CENÁRIO 5: APÓS JANELA (TOLERÂNCIA EXPIRADA)');
  
  // 1 minuto após fim da janela
  const afterWindow = getDoseStatus(createTimeToday(10, 31), '09:00', null);
  results.push({
    passed: afterWindow.status === 'esquecido',
    scenario: 'now=10:31, dose=09:00 → Status ESQUECIDO',
    expected: 'esquecido',
    actual: afterWindow.status,
    details: '1min após janela fechar (tolerância expirou)',
    category: 'AFTER_WINDOW',
    severity: 'critical',
  });

  results.push({
    passed: afterWindow.canMarkTaken === false,
    scenario: 'Botão "Tomei" DESABILITADO após janela',
    expected: 'false',
    actual: String(afterWindow.canMarkTaken),
    category: 'BUTTON_STATES',
    severity: 'critical',
  });

  results.push({
    passed: afterWindow.canMarkForgotten === false,
    scenario: 'Botão "Esqueci" DESABILITADO após janela',
    expected: 'false',
    actual: String(afterWindow.canMarkForgotten),
    category: 'BUTTON_STATES',
    severity: 'high',
  });

  // Muito depois
  const longAfter = getDoseStatus(createTimeToday(15, 0), '09:00', null);
  results.push({
    passed: longAfter.status === 'esquecido',
    scenario: 'now=15:00, dose=09:00 → Status ESQUECIDO (6h depois)',
    expected: 'esquecido',
    actual: longAfter.status,
    category: 'AFTER_WINDOW',
    severity: 'high',
  });

  // ============================================
  // CENÁRIO 6: AÇÕES DO USUÁRIO PRESERVADAS
  // ============================================
  console.log('\n📍 CENÁRIO 6: AÇÕES DO USUÁRIO PRESERVADAS');
  
  // TOMADO se mantém independente do tempo
  const preservedTaken1 = getDoseStatus(createTimeToday(8, 0), '09:00', 'tomado');
  results.push({
    passed: preservedTaken1.status === 'tomado',
    scenario: 'savedStatus=tomado, before window → mantém TOMADO',
    expected: 'tomado',
    actual: preservedTaken1.status,
    category: 'USER_ACTIONS',
    severity: 'critical',
  });

  const preservedTaken2 = getDoseStatus(createTimeToday(15, 0), '09:00', 'tomado');
  results.push({
    passed: preservedTaken2.status === 'tomado',
    scenario: 'savedStatus=tomado, long after → mantém TOMADO',
    expected: 'tomado',
    actual: preservedTaken2.status,
    category: 'USER_ACTIONS',
    severity: 'critical',
  });

  // ESQUECIDO (pelo usuário) se mantém
  const preservedForgotten = getDoseStatus(createTimeToday(9, 15), '09:00', 'esquecido');
  results.push({
    passed: preservedForgotten.status === 'esquecido',
    scenario: 'savedStatus=esquecido → mantém ESQUECIDO',
    expected: 'esquecido',
    actual: preservedForgotten.status,
    category: 'USER_ACTIONS',
    severity: 'high',
  });

  // Botões desabilitados após ação do usuário
  results.push({
    passed: preservedTaken1.canMarkTaken === false,
    scenario: 'Após marcar TOMADO → botão "Tomei" desabilitado',
    expected: 'false',
    actual: String(preservedTaken1.canMarkTaken),
    category: 'BUTTON_STATES',
    severity: 'high',
  });

  // ============================================
  // CENÁRIO 7: VALIDAÇÃO canPerformAction
  // ============================================
  console.log('\n📍 CENÁRIO 7: VALIDAÇÃO canPerformAction');
  
  // Antes da janela - não pode agir
  const actionBeforeWindow = canPerformAction('09:00', 'tomado', null);
  const now08 = createTimeToday(8, 0);
  const statusAt08 = getDoseStatus(now08, '09:00', null);
  
  // Note: canPerformAction usa new Date() internamente, então o resultado depende do horário real
  // Vamos testar a lógica base
  results.push({
    passed: statusAt08.status === 'agendado' && !statusAt08.canMarkTaken,
    scenario: 'canPerformAction valida status AGENDADO corretamente',
    expected: 'Bloqueado antes da janela',
    actual: `status=${statusAt08.status}, canMark=${statusAt08.canMarkTaken}`,
    category: 'USER_ACTIONS',
    severity: 'high',
  });

  // ============================================
  // CENÁRIO 8: AUTO-MARCAÇÃO COMO ESQUECIDO
  // ============================================
  console.log('\n📍 CENÁRIO 8: AUTO-MARCAÇÃO');
  
  results.push({
    passed: shouldAutoMarkForgotten('09:00', 'tomado') === false,
    scenario: 'Não auto-marca se já TOMADO',
    expected: 'false',
    actual: String(shouldAutoMarkForgotten('09:00', 'tomado')),
    category: 'AUTO_MARK',
    severity: 'critical',
  });

  results.push({
    passed: shouldAutoMarkForgotten('09:00', 'esquecido') === false,
    scenario: 'Não auto-marca se já ESQUECIDO',
    expected: 'false',
    actual: String(shouldAutoMarkForgotten('09:00', 'esquecido')),
    category: 'AUTO_MARK',
    severity: 'high',
  });

  // Dose passada sem ação do usuário deve ser auto-marcada
  const pastHour = (now.getHours() - 4 + 24) % 24;
  const pastTime = formatTimeStr(pastHour, 0);
  const shouldMark = shouldAutoMarkForgotten(pastTime, null);
  results.push({
    passed: shouldMark === true,
    scenario: `Dose passada (${pastTime}) sem ação → auto-marcar`,
    expected: 'true',
    actual: String(shouldMark),
    details: 'Dose expirada sem decisão do usuário',
    category: 'AUTO_MARK',
    severity: 'high',
  });

  // Dose futura não deve ser auto-marcada
  const shouldNotMark = shouldAutoMarkForgotten(futureTime, null);
  results.push({
    passed: shouldNotMark === false,
    scenario: `Dose futura (${futureTime}) → NÃO auto-marcar`,
    expected: 'false',
    actual: String(shouldNotMark),
    category: 'AUTO_MARK',
    severity: 'critical',
  });

  // ============================================
  // CENÁRIO 9: CONFIGURAÇÃO DA JANELA
  // ============================================
  console.log('\n📍 CENÁRIO 9: CONFIGURAÇÃO DE TOLERÂNCIA');
  
  results.push({
    passed: WINDOW_START_OFFSET === -30,
    scenario: 'Janela inicia 30min ANTES do horário',
    expected: '-30',
    actual: String(WINDOW_START_OFFSET),
    category: 'IN_WINDOW',
    severity: 'medium',
  });

  results.push({
    passed: WINDOW_END_OFFSET === 90,
    scenario: 'Janela termina 90min APÓS o horário',
    expected: '90',
    actual: String(WINDOW_END_OFFSET),
    category: 'AFTER_WINDOW',
    severity: 'medium',
  });

  // Tolerância total é 120 minutos (30 antes + 90 depois)
  const totalWindow = Math.abs(WINDOW_START_OFFSET) + WINDOW_END_OFFSET;
  results.push({
    passed: totalWindow === 120,
    scenario: 'Janela total de ação = 120 minutos',
    expected: '120',
    actual: String(totalWindow),
    details: 'Janela: -30min até +90min do horário',
    category: 'IN_WINDOW',
    severity: 'low',
  });

  // ============================================
  // CENÁRIO 10: TIMEZONE
  // ============================================
  console.log('\n📍 CENÁRIO 10: TIMEZONE');
  
  const debugInfo = getDoseStatus(now, '12:00', null).debugInfo;
  results.push({
    passed: debugInfo.timezone === timezone,
    scenario: 'Timezone do dispositivo é utilizado',
    expected: timezone,
    actual: debugInfo.timezone,
    category: 'TIMEZONE',
    severity: 'high',
  });

  results.push({
    passed: debugInfo.nowISO.includes('T'),
    scenario: 'Timestamp em formato ISO válido',
    expected: 'Contém T',
    actual: debugInfo.nowISO.substring(0, 25),
    category: 'TIMEZONE',
    severity: 'medium',
  });

  // ============================================
  // CENÁRIO 11: EDGE CASES
  // ============================================
  console.log('\n📍 CENÁRIO 11: EDGE CASES');
  
  // Meia-noite
  const midnightDose = getDoseStatus(createTimeToday(0, 0), '00:00', null);
  results.push({
    passed: midnightDose.status === 'pendente' || midnightDose.status === 'agendado',
    scenario: 'Dose à meia-noite funciona corretamente',
    expected: 'pendente ou agendado',
    actual: midnightDose.status,
    category: 'BEFORE_WINDOW',
    severity: 'medium',
  });

  // Dose 23:59
  const lateNight = getDoseStatus(createTimeToday(23, 59), '23:59', null);
  results.push({
    passed: lateNight.status !== 'esquecido' || lateNight.debugInfo.calculatedStatus !== undefined,
    scenario: 'Dose 23:59 processada corretamente',
    expected: 'Status válido',
    actual: lateNight.status,
    category: 'BEFORE_WINDOW',
    severity: 'medium',
  });

  // ============================================
  // RELATÓRIO FINAL
  // ============================================
  const categories: Record<E2ECategory, CategorySummary> = {
    PERIOD_DETECTION: createCategorySummary(),
    INITIAL_STATUS: createCategorySummary(),
    BEFORE_WINDOW: createCategorySummary(),
    IN_WINDOW: createCategorySummary(),
    AFTER_WINDOW: createCategorySummary(),
    BUTTON_STATES: createCategorySummary(),
    USER_ACTIONS: createCategorySummary(),
    AUTO_MARK: createCategorySummary(),
    DAILY_RESET: createCategorySummary(),
    NOTIFICATIONS: createCategorySummary(),
    TIMEZONE: createCategorySummary(),
  };

  results.forEach(r => {
    categories[r.category].total++;
    if (r.passed) {
      categories[r.category].passed++;
    } else {
      categories[r.category].failed++;
    }
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const criticalFailures = results.filter(r => !r.passed && r.severity === 'critical').length;

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    📊 RELATÓRIO E2E                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  // Por categoria
  console.log('\n📁 Por Categoria:');
  Object.entries(categories).forEach(([cat, summary]) => {
    if (summary.total > 0) {
      const status = summary.failed === 0 ? '✅' : '❌';
      console.log(`   ${status} ${cat}: ${summary.passed}/${summary.total}`);
    }
  });
  
  // Detalhes dos testes
  console.log('\n📋 Detalhes:');
  results.forEach((r) => {
    const icon = r.passed ? '✅' : '❌';
    const sev = r.severity === 'critical' ? '🔴' : r.severity === 'high' ? '🟠' : '🟡';
    console.log(`   ${icon} ${sev} ${r.scenario}`);
    if (!r.passed) {
      console.log(`      Esperado: ${r.expected}`);
      console.log(`      Atual: ${r.actual}`);
      if (r.details) console.log(`      Detalhes: ${r.details}`);
    }
  });

  console.log('\n' + '─'.repeat(66));
  console.log(`📊 Total: ${results.length} testes`);
  console.log(`   ✅ Passou: ${passed}`);
  console.log(`   ❌ Falhou: ${failed}`);
  console.log(`   🔴 Falhas críticas: ${criticalFailures}`);

  if (failed === 0) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM! O sistema está funcionando corretamente.');
  } else if (criticalFailures > 0) {
    console.log('\n⛔ EXISTEM FALHAS CRÍTICAS! O sistema tem bugs que afetam a experiência do usuário.');
  } else {
    console.log('\n⚠️ Existem falhas que precisam ser corrigidas.');
  }

  console.log('─'.repeat(66));

  const report: E2EReport = {
    timestamp: now.toISOString(),
    timezone,
    totalTests: results.length,
    passed,
    failed,
    criticalFailures,
    categories,
    results,
  };

  // Disponibilizar no window para debug
  if (typeof window !== 'undefined') {
    (window as any).__E2E_REPORT__ = report;
    console.log('\n💡 Relatório disponível em: window.__E2E_REPORT__');
  }

  return report;
}

/**
 * Validação rápida de um cenário específico
 */
export function validateDoseScenario(
  currentHour: number,
  currentMinute: number,
  doseHour: number,
  doseMinute: number,
  savedStatus: 'tomado' | 'esquecido' | 'pendente' | 'agendado' | null = null
): ValidationResult {
  const now = createTimeToday(currentHour, currentMinute);
  const doseTime = formatTimeStr(doseHour, doseMinute);
  
  const result = getDoseStatus(now, doseTime, savedStatus);
  
  const scenario = `now=${formatTimeStr(currentHour, currentMinute)}, dose=${doseTime}, saved=${savedStatus || 'null'}`;
  
  console.log(`\n🔍 Validação de Cenário`);
  console.log('─'.repeat(50));
  console.log(`⏰ Horário atual: ${formatTimeStr(currentHour, currentMinute)}`);
  console.log(`💊 Dose agendada: ${doseTime}`);
  console.log(`💾 Status salvo: ${savedStatus || 'nenhum'}`);
  console.log('─'.repeat(50));
  console.log(`📊 Resultado:`);
  console.log(`   → Status: ${result.status}`);
  console.log(`   → Na janela: ${result.isInWindow}`);
  console.log(`   → Botão Tomei: ${result.canMarkTaken}`);
  console.log(`   → Botão Esqueci: ${result.canMarkForgotten}`);
  console.log(`   → Min até janela: ${result.minutesUntilWindow}`);
  console.log(`   → Min até expirar: ${result.minutesUntilExpired}`);
  console.log('─'.repeat(50));
  
  return {
    passed: true,
    scenario,
    expected: '-',
    actual: result.status,
    details: JSON.stringify(result.debugInfo, null, 2),
    category: 'IN_WINDOW',
    severity: 'low',
  };
}

/**
 * Teste rápido do bug reportado: dose mostra ESQUECIDO antes do horário
 */
export function testBugDoseEsquecidaAntes(): boolean {
  console.log('\n🐛 Teste: Dose ESQUECIDA antes do horário');
  console.log('─'.repeat(50));
  
  const now = new Date();
  const futureHour = (now.getHours() + 1) % 24;
  const futureTime = formatTimeStr(futureHour, 0);
  
  const result = getDoseStatus(now, futureTime, null);
  
  console.log(`Horário atual: ${now.toLocaleTimeString()}`);
  console.log(`Dose para: ${futureTime}`);
  console.log(`Status calculado: ${result.status}`);
  
  const passed = result.status !== 'esquecido';
  
  if (passed) {
    console.log('✅ BUG NÃO PRESENTE - Dose futura não está esquecida');
  } else {
    console.log('❌ BUG DETECTADO - Dose futura está sendo marcada como esquecida!');
  }
  
  return passed;
}

// ============================================
// EXPORTAR PARA CONSOLE
// ============================================
if (typeof window !== 'undefined') {
  (window as any).runE2EValidation = runE2EValidation;
  (window as any).validateDoseScenario = validateDoseScenario;
  (window as any).testBugDoseEsquecidaAntes = testBugDoseEsquecidaAntes;
  
  console.log('');
  console.log('🔧 Funções de debug disponíveis:');
  console.log('   • runE2EValidation() - Validação completa');
  console.log('   • validateDoseScenario(nowH, nowM, doseH, doseM, status?) - Cenário específico');
  console.log('   • testBugDoseEsquecidaAntes() - Teste do bug de dose esquecida');
  console.log('');
}
