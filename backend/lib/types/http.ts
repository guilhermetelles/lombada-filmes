import type { Dependencies } from './dependencies.js';
import type { UsageRecorder } from './usage.js';

/** Dá as dependências de uma rota: as de produção, ou as de teste. */
export type GetDependencies = () => Dependencies;

/** Assinatura que a Vercel chama para cada método exportado pela rota (GET, POST…). */
export type RouteHandler = (request: Request) => Promise<Response>;

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
  | 'invite_expired'
  | 'source_unavailable'
  | 'internal';

/** Corpo de toda resposta de erro. */
export type ErrorBody = {
  error: { code: ErrorCode; message: string };
};
