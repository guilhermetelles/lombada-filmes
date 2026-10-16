// Confere que o Admin SDK lê o lombada-db de verdade, com a conta de serviço do .env da raiz.
// Uso: npm run check:firestore
process.loadEnvFile(new URL('../../.env', import.meta.url));

const { db } = await import('../lib/firestore.js');
const collections = await db().listCollections();
console.log('leitura ok; coleções:', collections.map((c) => c.id).join(', ') || '(nenhuma ainda)');
