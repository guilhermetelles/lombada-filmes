import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { addDays } from '../daily/day-math.js';
import { ForbiddenError } from '../errors/app-errors.js';
import { listsOfMember } from '../lists/list-repository.js';
import { logger } from '../logging/logger.js';
import { JOB_NAMES, JobHealthSchema } from '../schemas/jobs.js';
import { GeminiModelsUsageSchema, SOURCE_NAMES, SourceUsageSchema } from '../schemas/usage.js';
import { GEMINI_MODELS } from '../sources/gemini/gemini-models.js';
import type { Dependencies } from '../types/dependencies.js';
import type { SourceName } from '../types/sources.js';
import type { JobStatusItem, SourceUsage, StatusResponse, UsageDayStatus } from '../types/status.js';
import { usageDay } from '../usage/usage-day.js';

/** Quantos dias de consumo a rota devolve. */
export const STATUS_USAGE_DAYS = 7;

/** Explicação da cota do Gemini para a tela de status. */
export const GEMINI_DAILY_LIMIT_NOTE =
  'No plano grátis do Gemini, cada modelo Flash aceita cerca de 20 pedidos por dia. Quando a cota de um ' +
  'modelo acaba (resposta 429), o backend passa para o próximo da lista, e a cota volta no dia seguinte.';

/**
 * Monta o status do backend para quem é membro de alguma lista: a saúde de cada rotina
 * (jobs/{nome}, só as que já gravaram), o consumo das fontes e de cada modelo do Gemini nos últimos
 * 7 dias (usage/{dia}, do mais recente para o mais antigo; dia sem consumo vem vazio) e os modelos do
 * Gemini em uso, na ordem de preferência.
 *
 * @param dependencies - Banco e relógio.
 * @param uid - Quem pede.
 * @returns O status.
 * @throws {ForbiddenError} Se a pessoa não for membro de nenhuma lista.
 */
async function readStatus({ db, now }: Pick<Dependencies, 'db' | 'now'>, uid: string): Promise<StatusResponse> {
  if ((await listsOfMember(db, uid).limit(1).get()).empty) {
    throw new ForbiddenError('o status é só para quem participa de uma lista');
  }
  const today = usageDay(now());
  const days = Array.from({ length: STATUS_USAGE_DAYS }, (_, back) => addDays(today, -back));
  const [jobs, usage] = await Promise.all([
    db.getAll(...JOB_NAMES.map((name) => db.doc(`jobs/${name}`))),
    db.getAll(...days.map((day) => db.doc(`usage/${day}`))),
  ]);
  return {
    jobs: jobs.flatMap(toJobStatus),
    usage: usage.map((snapshot, index) => toUsageDay(days[index] ?? snapshot.id, snapshot)),
    gemini: {
      interpret: [...GEMINI_MODELS.interpret],
      text: [...GEMINI_MODELS.text],
      dailyLimitNote: GEMINI_DAILY_LIMIT_NOTE,
    },
  };
}

/**
 * Converte jobs/{nome} na saúde da rotina. Documento ausente ou sem os campos de saúde (como o
 * cursor antigo de jobs/enrich) fica de fora.
 *
 * @param snapshot - Documento lido.
 * @returns A saúde, numa lista de 0 ou 1 item.
 */
function toJobStatus(snapshot: DocumentSnapshot): JobStatusItem[] {
  if (!snapshot.exists) return [];
  const parsed = JobHealthSchema.safeParse(snapshot.data());
  const name = JOB_NAMES.find((job) => job === snapshot.id);
  if (!parsed.success || !name) {
    logger.warn('jobs fora do formato, fora do status', { job: snapshot.id });
    return [];
  }
  const { lastRunAt, durationMs, status, summary, warnings } = parsed.data;
  return [{ name, lastRunAt: lastRunAt.toISOString(), durationMs, status, summary, warnings }];
}

/**
 * Converte usage/{dia} no consumo do dia: pedidos e erros de cada fonte presente e os contadores
 * de cada modelo do Gemini.
 *
 * @param day - Dia AAAA-MM-DD.
 * @param snapshot - Documento lido (pode não existir).
 * @returns O consumo do dia.
 */
function toUsageDay(day: string, snapshot: DocumentSnapshot): UsageDayStatus {
  const sources: Partial<Record<SourceName, SourceUsage>> = {};
  for (const source of SOURCE_NAMES) {
    const value: unknown = snapshot.get(source);
    if (typeof value === 'object' && value !== null) sources[source] = SourceUsageSchema.parse(value);
  }
  const geminiModels = GeminiModelsUsageSchema.parse(snapshot.get('geminiModels') ?? {});
  return { day, sources, geminiModels };
}

export { readStatus };
