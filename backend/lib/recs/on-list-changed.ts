import type { Firestore } from 'firebase-admin/firestore';

/**
 * Avisa o motor de sugestões que a lista mudou (filme entrou, saiu ou mudou de posição), para
 * reajustar o modelo e repontuar os candidatos guardados sem chamar o TMDb. Gancho da Fase 2: o
 * agente das sugestões (B4) implementa; a rota de eventos (B3b) chama. Enquanto isso, não faz nada.
 *
 * @param _db - Banco.
 * @param _listId - Lista que mudou.
 * @returns Promessa resolvida quando o reajuste terminar.
 */
async function onListChanged(_db: Firestore, _listId: string): Promise<void> {}

export { onListChanged };
