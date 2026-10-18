/**
 * Dispara uma vez o evento "Início de uso do app" numa lista: 10 perguntas extras do quiz, cada uma
 * de um tipo, que valem pontos no placar do mês, e um aviso a cada integrante. Usa a conta de
 * serviço e as chaves do .env da raiz. Rodar de novo não troca as perguntas nem avisa de novo.
 * Uso: npm run launch-event -- <listId>
 */
import { getProductionDependencies } from '../lib/dependencies.js';
import { createLaunchEvent } from '../lib/quiz/create-launch-event.js';
import { UsageMeter } from '../lib/usage/usage-meter.js';

process.loadEnvFile(new URL('../../.env', import.meta.url));

const listId = process.argv[2];
if (!listId) {
  console.error('uso: npm run launch-event -- <listId>');
  process.exit(1);
}

const report = await createLaunchEvent(getProductionDependencies(), new UsageMeter(), listId);
for (const { id, type } of report.created) console.log(`${id}: ${type}`);
console.log(
  `${report.created.length} perguntas criadas, ${report.existing} já existiam; ${report.pushed} pessoas avisadas`,
);
