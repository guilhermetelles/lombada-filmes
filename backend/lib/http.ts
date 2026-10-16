// Erro com status HTTP: as rotas lançam, `route` transforma em resposta JSON.
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

// Envolve um handler: HttpError vira { error } com o status dele; qualquer outra falha vira 500
// sem detalhes para o app (o detalhe fica no log da Vercel).
export function route(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      return await handler(request);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: 'erro interno' }, 500);
    }
  };
}
