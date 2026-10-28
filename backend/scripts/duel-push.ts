/**
 * Avisa agora os membros de uma lista do duelo de hoje, fora da notificação diária (não conta como a
 * notificação do dia). Abre o duelo se ninguém abriu ainda. Usa a conta de serviço do .env da raiz.
 * Uso: npm run duel-push -- <listId>
 */
import { getProductionDependencies } from '../lib/dependencies.js';
import { announceDuel } from '../lib/duel/announce-duel.js';

process.loadEnvFile(new URL('../../.env', import.meta.url));

const listId = process.argv[2];
if (!listId) {
  console.error('uso: npm run duel-push -- <listId>');
  process.exit(1);
}

const { duel, pushed, skipped } = await announceDuel(getProductionDependencies(), listId);
console.log(`duelo de ${duel.day}: ${duel.entryIdA} x ${duel.entryIdB} (${duel.status})`);
console.log(`${pushed.length} pessoas avisadas; ${skipped.length} de fora (duelo desligado ou sem aparelho)`);
