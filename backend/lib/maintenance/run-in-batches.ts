/**
 * Roda uma tarefa para cada item, poucos de cada vez, para não abrir pedidos demais às fontes ao
 * mesmo tempo.
 *
 * @param items - Itens a processar.
 * @param size - Quantos ao mesmo tempo.
 * @param task - Tarefa de um item; deve tratar as próprias falhas.
 */
async function runInBatches<T>(items: T[], size: number, task: (item: T) => Promise<void>): Promise<void> {
  for (let start = 0; start < items.length; start += size) {
    await Promise.all(items.slice(start, start + size).map(task));
  }
}

export { runInBatches };
