/**
 * Preenche lists/{listId}.memberProfiles das listas que já existem com o nome e a foto de cada
 * membro no Google (Firebase Auth), com a conta de serviço do .env da raiz. Idempotente: só grava o
 * que falta ou mudou. Rodar depois de publicar as regras que aceitam memberProfiles.
 * Uso: npm run migrate:member-profiles -- [--dry-run]
 */
import { getProductionDependencies } from '../lib/dependencies.js';
import { migrateMemberProfiles } from '../lib/lists/migrate-member-profiles.js';

process.loadEnvFile(new URL('../../.env', import.meta.url));

const dryRun = process.argv.includes('--dry-run');
const report = await migrateMemberProfiles(getProductionDependencies(), { dryRun });

for (const { listId, uid, profile } of report.changes) {
  const photo = profile.photoUrl ? 'com foto' : 'sem foto';
  console.log(`lista ${listId}: ${uid} → "${profile.name}" (${photo})`);
}
const action = dryRun ? 'a gravar (--dry-run, nada gravado)' : `gravados: ${report.written}`;
console.log(`${report.lists} listas lidas; ${report.changes.length} perfis faltando ou diferentes; ${action}`);
