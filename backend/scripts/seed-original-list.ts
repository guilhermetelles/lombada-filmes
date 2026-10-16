// Carga única da lista original (passo 6 do plano). Roda na sua máquina, com a conta de serviço
// do .env da raiz, e pode rodar de novo sem duplicar se for interrompida no meio.
// Não rode de novo depois que o app estiver em uso: entradas apagadas pelo app voltariam.
// Uso: npm run seed:original-list            (grava no lombada-db)
//      npm run seed:original-list:emulator   (ensaio no emulador, com as APIs reais)
import { getProductionDependencies } from '../lib/dependencies.js';
import { SeedEnvSchema } from '../lib/schemas/seed.js';
import { checkAgainstExport } from '../lib/seed/check-against-export.js';
import { readOriginalEntries, readOriginalListInfo } from '../lib/seed/read-mock-list.js';
import { seedOriginalList } from '../lib/seed/seed-original-list.js';
import { UsageMeter } from '../lib/usage/usage-meter.js';

process.loadEnvFile(new URL('../../.env', import.meta.url));

const mockHtml = new URL('../../mock/index.html', import.meta.url);
const catalog = new URL('../../mock/data/real.json', import.meta.url);
const letterboxdExport = new URL('../../data/competicao-de-filmes-terriveis.csv', import.meta.url);
const { OWNER_UID } = SeedEnvSchema.parse(process.env);
const entries = readOriginalEntries(mockHtml.pathname, catalog.pathname);
const listInfo = readOriginalListInfo(mockHtml.pathname);
checkAgainstExport(entries, letterboxdExport.pathname);

const target = process.env.FIRESTORE_EMULATOR_HOST ? `emulador (${process.env.FIRESTORE_EMULATOR_HOST})` : 'lombada-db';
console.log(`Carregando "${listInfo.name}" com ${entries.length} filmes em ${target}…`);

const dependencies = getProductionDependencies();
const usage = new UsageMeter();
try {
  const summary = await seedOriginalList({
    dependencies,
    usage,
    ownerUid: OWNER_UID,
    listInfo,
    entries,
    onProgress: (message) => console.log(`  ${message}`),
  });
  const code = `${summary.inviteCode.slice(0, 3)}-${summary.inviteCode.slice(3)}`;
  console.log(`\nLista ${summary.listId}: ${summary.listCreated ? 'criada' : 'já existia'}.`);
  console.log(`Entradas: ${summary.entriesCreated} criadas, ${summary.entriesKept} já existiam.`);
  console.log(`Código de convite: ${code} (vale até ${summary.inviteExpiresAt.toLocaleString('pt-BR')}).`);
} finally {
  await usage.save(dependencies.db, dependencies.now());
}
