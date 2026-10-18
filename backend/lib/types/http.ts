import type { Dependencies } from './dependencies.js';
import type { UsageRecorder } from './usage.js';

/** Dá as dependências de uma rota: as de produção, ou as de teste. */
export type GetDependencies = () => Dependencies;

/** Assinatura que a Vercel chama para cada método exportado pela rota (GET, POST…). */
export type RouteHandler = (request: Request) => Promise<Response>;

/** Rota pronta para receber as dependências: o que authenticatedRoute e cronRoute devolvem. */
export type RouteFactory = (getDependencies: GetDependencies) => RouteHandler;

/** Métodos HTTP que as rotas usam. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Uma rota servida pela função única api/router.ts: o caminho público (casado pelo pathname) e o
 * nome que o rewrite do vercel.json passa em `?route=`.
 */
export type RouterEntry = {
  name: string;
  path: RegExp;
  methods: Partial<Record<HttpMethod, RouteFactory>>;
};

/** O que uma rota autenticada recebe além do pedido. */
export type RouteContext = {
  request: Request;
  uid: string;
  dependencies: Dependencies;
  usage: UsageRecorder;
};

/** O que uma rota do Vercel Cron recebe (não há pessoa logada). */
export type CronContext = {
  dependencies: Dependencies;
  usage: UsageRecorder;
};

/** Códigos de erro que o app pode receber. */
export type ErrorCode =
  | 'invalid_input'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'already_answered'
  | 'not_today'
  | 'invite_expired'
  | 'rate_limited'
  | 'source_unavailable'
  | 'not_implemented'
  | 'internal';

/** Corpo de toda resposta de erro. */
export type ErrorBody = {
  error: { code: ErrorCode; message: string };
};
