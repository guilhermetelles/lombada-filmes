import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { SourceClients } from './sources.js';

/**
 * Tudo o que as rotas usam de fora. Produção monta uma vez (lib/dependencies.ts); os testes montam
 * com os emuladores e um fetch falso (test/support/dependencies.ts).
 */
export type Dependencies = {
  db: Firestore;
  auth: Auth;
  sources: SourceClients;
  now: () => Date;
};
