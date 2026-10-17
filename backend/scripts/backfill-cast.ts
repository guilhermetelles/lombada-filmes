/**
 * Recarga única do elenco (passo 9 do plano): grava `cast` nos filmes e `acted` nas pessoas que
 * foram guardados antes dele. Roda na sua máquina, com a conta de serviço do .env da raiz.
 * Uso: npm run backfill:cast:dry-run   (lê o lombada-db e busca no TMDb, sem gravar nada)
 *      npm run backfill:cast           (grava no lombada-db; pode rodar de novo sem repetir trabalho)
 */
import { getProductionDependencies } from '../lib/dependencies.js';
import { backfillCast } from '../lib/maintenance/backfill-cast.js';
import { UsageMeter } from '../lib/usage/usage-meter.js';

process.loadEnvFile(new URL('../../.env', import.meta.url));

const dryRun = process.argv.includes('--dry-run');
const target = process.env.FIRESTORE_EMULATOR_HOST ? `emulador (${process.env.FIRESTORE_EMULATOR_HOST})` : 'lombada-db';
console.log(`${dryRun ? 'Ensaio da recarga' : 'Recarga'} do elenco em ${target}…`);

const dependencies = getProductionDependencies();
const usage = new UsageMeter();
try {
  const report = await backfillCast({
    dependencies,
    usage,
    dryRun,
    onProgress: (message) => console.log(`  ${message}`),
  });
  console.log(
    `\nFilmes: ${report.movies.missing} sem elenco, ${report.movies.updated} gravados, ${report.movies.failed} falharam.`,
  );
  console.log(
    `Pessoas: ${report.people.missing} sem filmes atuados, ${report.people.updated} gravadas, ${report.people.failed} falharam.`,
  );
  if (dryRun) console.log('Ensaio: nada foi gravado.');
} finally {
  await usage.save(dependencies.db, dependencies.now());
}
