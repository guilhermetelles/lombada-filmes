import type { BechdelClient, BechdelIndexEntry } from '../types/sources.js';
import type { UsageRecorder } from '../types/usage.js';

/** Devolve o índice do site, baixado no máximo uma vez. */
type BechdelIndexLoader = () => Promise<BechdelIndexEntry[]>;

/**
 * Cria um carregador que baixa o índice do site só na primeira vez que for chamado e devolve o
 * mesmo resultado nas seguintes. Se o download falhar, as chamadas seguintes recebem a mesma falha,
 * sem novo pedido: o índice é baixado no máximo uma vez por pedido ou execução da rotina.
 *
 * @param client - Cliente do site.
 * @param usage - Medidor de consumo (o download conta como um pedido ao `bechdel`).
 * @returns O carregador.
 */
function createBechdelIndexLoader(client: BechdelClient, usage: UsageRecorder): BechdelIndexLoader {
  let index: Promise<BechdelIndexEntry[]> | undefined;
  return () => {
    index ??= usage.track('bechdel', () => client.getIndex());
    return index;
  };
}

export { type BechdelIndexLoader, createBechdelIndexLoader };
