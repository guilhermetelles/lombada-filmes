/**
 * Tira as chaves com valor undefined de um objeto e dos objetos simples dentro dele, porque o
 * Firestore recusa campos undefined. Datas, Timestamps e outras classes ficam como estão.
 *
 * @param value - Objeto a gravar.
 * @returns Cópia sem as chaves undefined (arrays têm os itens limpos do mesmo jeito).
 */
function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => withoutUndefined(item)) as T;
  if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) result[key] = withoutUndefined(item);
  }
  return result as T;
}

export { withoutUndefined };
