import type { DailyNotifyReport } from '../daily/run-daily-notify.js';
import type { QuizAndMonthReport } from '../quiz/run-quiz-and-month.js';
import type { RecsReport } from '../recs/run-recs.js';
import type { EnrichReport } from '../types/enrich.js';
import type { JobOutcome } from '../types/jobs.js';
import type { MaintenanceReport } from '../types/maintenance.js';

/** Resumo, em português, do relatório de cada rotina para jobs/{nome}. */

/**
 * Resume a rotina enrich.
 *
 * @param report - Relatório da execução.
 * @returns Situação, frase e avisos.
 */
export function describeEnrich(report: EnrichReport): JobOutcome {
  const failed = report.providers.failed + report.movies.failed + report.people.failed;
  const warnings: string[] = [];
  if (failed > 0) warnings.push(`${failed} itens não atualizados (detalhes no log)`);
  if (!report.finished) warnings.push('parou pelo tempo ou pela cota da OMDb; continua na próxima execução');
  return {
    status: failed > 0 || !report.finished ? 'partial' : 'ok',
    summary: `Onde assistir: ${report.providers.updated}; filmes: ${report.movies.updated}; pessoas: ${report.people.updated}.`,
    warnings,
  };
}

/**
 * Resume a rotina recs. Lista cujos motivos caíram para a reserva por falha do Gemini vira aviso
 * ("motivos das sugestões pela reserva: <causa>") e deixa a execução como parcial.
 *
 * @param report - Relatório da execução.
 * @returns Situação, frase e avisos.
 */
export function describeRecs(report: RecsReport): JobOutcome {
  const written = report.lists.filter((list) => list.status === 'written').length;
  const fallbacks = report.lists.flatMap((list) => (list.reasonsFallback ? [list.reasonsFallback] : []));
  const warnings = [
    ...fallbacks.map((cause) => `motivos das sugestões pela reserva: ${cause}`),
    ...report.failed.map((listId) => `falha ao calcular as sugestões da lista ${listId}`),
    ...(report.skipped.length > 0 ? [`${report.skipped.length} listas ficaram para a próxima execução`] : []),
  ];
  const partial = fallbacks.length > 0 || report.failed.length > 0 || report.skipped.length > 0;
  return {
    status: partial ? 'partial' : 'ok',
    summary: `Sugestões de ${written} ${written === 1 ? 'lista' : 'listas'}; ${report.tmdbCalls} pedidos ao TMDb.`,
    warnings,
  };
}

/**
 * Resume a rotina quiz-and-month.
 *
 * @param report - Relatório da execução.
 * @returns Situação, frase e avisos.
 */
export function describeQuizAndMonth(report: QuizAndMonthReport): JobOutcome {
  const { created, existing, withoutData } = report.quizzes;
  const closed = report.months.reduce((sum, month) => sum + month.closed, 0);
  const retros = report.months.reduce((sum, month) => sum + month.retros, 0);
  const warnings: string[] = [];
  if (report.failed > 0) warnings.push(`${report.failed} listas com erro (detalhes no log)`);
  if (report.skipped > 0) warnings.push(`${report.skipped} listas ficaram para depois por falta de tempo`);
  return {
    status: report.failed > 0 || report.skipped > 0 ? 'partial' : 'ok',
    summary: `Quiz: ${created} novos, ${existing} já existiam, ${withoutData} sem dados; placares fechados: ${closed}; retrospectivas: ${retros}.`,
    warnings,
  };
}

/**
 * Resume a rotina daily (manutenção).
 *
 * @param report - Relatório da execução.
 * @returns Situação, frase e avisos.
 */
export function describeDaily(report: MaintenanceReport): JobOutcome {
  const { movies, bechdel, deleted } = report;
  const warnings: string[] = [];
  if (movies.failed > 0) warnings.push(`${movies.failed} filmes com notas não atualizadas`);
  if (bechdel.failed > 0) warnings.push(`${bechdel.failed} filmes sem Teste de Bechdel atualizado (site com falha)`);
  return {
    status: movies.failed > 0 || bechdel.failed > 0 ? 'partial' : 'ok',
    summary:
      `Notas: ${movies.refreshed}; Bechdel: ${bechdel.updated + bechdel.matched}; convites apagados: ${report.invitesDeleted}; ` +
      `limpeza: ${deleted.feed} itens da Atividade, ${deleted.notifyLog} registros de aviso, ${deleted.rateLimits} limites.`,
    warnings,
  };
}

/**
 * Resume uma rotina notify-*.
 *
 * @param report - Relatório da execução.
 * @returns Situação, frase e avisos.
 */
export function describeNotify(report: DailyNotifyReport): JobOutcome {
  const warnings: string[] = [];
  if (report.failed > 0) warnings.push(`${report.failed} pessoas sem aviso por erro (detalhes no log)`);
  if (report.unfinished > 0) warnings.push(`${report.unfinished} pessoas ficaram sem aviso por falta de tempo`);
  const reminded = report.quizReminded > 0 ? `, ${report.quizReminded} lembretes do quiz` : '';
  return {
    status: report.failed > 0 || report.unfinished > 0 ? 'partial' : 'ok',
    summary: `${report.people} pessoas: ${report.sent} assuntos do dia, ${report.quizSent} perguntas do quiz${reminded}.`,
    warnings,
  };
}
