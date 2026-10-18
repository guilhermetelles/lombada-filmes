import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import type { Messaging } from 'firebase-admin/messaging';
import type { SourceClients } from './sources.js';

/** O que o backend usa do FCM: produção passa o Messaging do Admin SDK; os testes, um falso. */
export type MessagingClient = Pick<Messaging, 'sendEachForMulticast'>;

/**
 * Tudo o que as rotas usam de fora. Produção monta uma vez (lib/dependencies.ts); os testes montam
 * com os emuladores e um fetch falso (test/support/dependencies.ts).
 */
export type Dependencies = {
  db: Firestore;
  auth: Auth;
  sources: SourceClients;
  messaging: MessagingClient;
  now: () => Date;
  cronSecret: string;
};
