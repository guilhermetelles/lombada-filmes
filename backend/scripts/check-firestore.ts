/**
 * Confere que o Admin SDK lê o lombada-db de verdade, com a conta de serviço do .env da raiz.
 * Uso: npm run check:firestore
 */
import { getProductionDependencies } from '../lib/dependencies.js';

process.loadEnvFile(new URL('../../.env', import.meta.url));

const collections = await getProductionDependencies().db.listCollections();
const names = collections.map((collection) => collection.id).join(', ') || '(nenhuma ainda)';
console.log(`leitura ok; coleções: ${names}`);
