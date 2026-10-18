import { getProductionDependencies } from '../lib/dependencies.js';
import { dispatchRoute } from '../lib/http/dispatch-route.js';
import type { HttpMethod, RouteHandler, RouterEntry } from '../lib/types/http.js';
import { discoverRoute } from './_discover.js';
import { enrichCronRoute } from './cron/_enrich.js';
import { notify09CronRoute } from './cron/_notify-09.js';
import { notify12CronRoute } from './cron/_notify-12.js';
import { notify19CronRoute } from './cron/_notify-19.js';
import { notify21CronRoute } from './cron/_notify-21.js';
import { quizAndMonthCronRoute } from './cron/_quiz-and-month.js';
import { recsCronRoute } from './cron/_recs.js';
import { listEventsRoute } from './lists/[listId]/_events.js';
import { addToQueueRoute } from './lists/[listId]/queue/_add.js';
import { removeFromQueueRoute } from './lists/[listId]/queue/_remove.js';
import { answerQuizRoute } from './lists/[listId]/quiz/_answer.js';
import { registerDeviceRoute, unregisterDeviceRoute } from './me/_devices.js';
import { getNotifyPrefsRoute, putNotifyPrefsRoute } from './me/_notify.js';
import { notifyTestRoute } from './me/_notify-test.js';
import { interpretRoute } from './search/_interpret.js';

/**
 * Rotas da versão 0.3, servidas por esta função só: o plano Hobby da Vercel aceita até 12 funções
 * por implantação, e cada arquivo de api/ sem `_` no começo vira uma. Os rewrites do vercel.json
 * trazem cada caminho público para cá; os módulos `_*.ts` definem as rotas (os testes chamam direto).
 */
export const ROUTES: RouterEntry[] = [
  {
    name: 'me-devices',
    path: /^\/api\/me\/devices$/,
    methods: { POST: registerDeviceRoute, DELETE: unregisterDeviceRoute },
  },
  { name: 'me-notify', path: /^\/api\/me\/notify$/, methods: { GET: getNotifyPrefsRoute, PUT: putNotifyPrefsRoute } },
  { name: 'me-notify-test', path: /^\/api\/me\/notify-test$/, methods: { POST: notifyTestRoute } },
  { name: 'discover', path: /^\/api\/discover$/, methods: { GET: discoverRoute } },
  { name: 'search-interpret', path: /^\/api\/search\/interpret$/, methods: { POST: interpretRoute } },
  { name: 'queue-add', path: /^\/api\/lists\/[^/]+\/queue$/, methods: { POST: addToQueueRoute } },
  { name: 'queue-remove', path: /^\/api\/lists\/[^/]+\/queue\/[^/]+$/, methods: { DELETE: removeFromQueueRoute } },
  { name: 'list-events', path: /^\/api\/lists\/[^/]+\/events$/, methods: { POST: listEventsRoute } },
  { name: 'quiz-answer', path: /^\/api\/lists\/[^/]+\/quiz\/[^/]+\/answer$/, methods: { POST: answerQuizRoute } },
  { name: 'cron-enrich', path: /^\/api\/cron\/enrich$/, methods: { GET: enrichCronRoute } },
  { name: 'cron-recs', path: /^\/api\/cron\/recs$/, methods: { GET: recsCronRoute } },
  { name: 'cron-quiz-and-month', path: /^\/api\/cron\/quiz-and-month$/, methods: { GET: quizAndMonthCronRoute } },
  { name: 'cron-notify-09', path: /^\/api\/cron\/notify-09$/, methods: { GET: notify09CronRoute } },
  { name: 'cron-notify-12', path: /^\/api\/cron\/notify-12$/, methods: { GET: notify12CronRoute } },
  { name: 'cron-notify-19', path: /^\/api\/cron\/notify-19$/, methods: { GET: notify19CronRoute } },
  { name: 'cron-notify-21', path: /^\/api\/cron\/notify-21$/, methods: { GET: notify21CronRoute } },
];

/**
 * Cria o handler de um método, que escolhe a rota da tabela com as dependências de produção.
 *
 * @param method - Método HTTP.
 * @returns Handler que a Vercel chama.
 */
function handlerFor(method: HttpMethod): RouteHandler {
  return (request) => dispatchRoute(ROUTES, method, request, getProductionDependencies);
}

/** Handler que a Vercel chama nos GET reescritos para /api/router. */
export const GET = handlerFor('GET');

/** Handler que a Vercel chama nos POST reescritos para /api/router. */
export const POST = handlerFor('POST');

/** Handler que a Vercel chama nos PUT reescritos para /api/router. */
export const PUT = handlerFor('PUT');

/** Handler que a Vercel chama nos DELETE reescritos para /api/router. */
export const DELETE = handlerFor('DELETE');
