/** O consumo é agrupado por dia no fuso de São Paulo; o id de usage/{dia} é yyyy-mm-dd. */
const SAO_PAULO_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });

/**
 * Diz em que dia (no fuso de São Paulo) um momento cai, no formato do id de usage/{dia}.
 *
 * @param date - Momento a converter.
 * @returns O dia como yyyy-mm-dd.
 */
function usageDay(date: Date): string {
  return SAO_PAULO_DATE.format(date);
}

export { usageDay };
