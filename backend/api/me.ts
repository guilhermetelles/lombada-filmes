import { requireUid } from '../lib/auth.js';
import { json, route } from '../lib/http.js';

// GET /api/me: devolve o uid de quem chamou. Serve para o app conferir que o login chega ao backend.
export const GET = route(async (request) => {
  const uid = await requireUid(request);
  return json({ uid });
});
