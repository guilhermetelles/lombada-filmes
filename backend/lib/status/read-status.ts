import { type DocumentSnapshot, FieldPath, Timestamp } from 'firebase-admin/firestore';
import { addDays } from '../daily/day-math.js';
import { ForbiddenError } from '../errors/app-errors.js';
import { listsOfMember } from '../lists/list-repository.js';
import { logger } from '../logging/logger.js';
import { JOB_NAMES, JobHealthSchema } from '../schemas/jobs.js';
import {
  GEMINI_PURPOSES,
  GeminiModelsUsageSchema,
  GeminiPurposeUsageSchema,
  GeminiSkipReasonSchema,
  SOURCE_NAMES,
  SourceUsageSchema,
} from '../schemas/usage.js';
import { GEMINI_MODELS } from '../sources/gemini/gemini-models.js';
import type { Dependencies } from '../types/dependencies.js';
import type { SourceName } from '../types/sources.js';
import type {
  GeminiPurposeUsage,
  GeminiRestingModel,
  JobStatusItem,
  SourceUsage,
  StatusResponse,
  UsageDayStatus,
} from '../types/status.js';
import type { GeminiPurpose } from '../types/usage.js';
import { usageDay } from '../usage/usage-day.js';
import { GEMINI_QUOTA_DOC } from '../usage/usage-meter.js';

/** Quantos dias de consumo a rota devolve. */
export const STATUS_USAGE_DAYS = 7;

/** Explicação da cota do Gemini para a tela de status. */
export const GEMINI_DAILY_LIMIT_NOTE =
  'No plano grátis do Gemini, cada modelo Flash aceita cerca de 20 pedidos por dia. Quando a cota de um ' +
  'modelo acaba (resposta 429) ou ele está fora do ar (503 ou sem responder no tempo), o backend passa para ' +
  'o próximo da lista e pula esse modelo até a cota voltar, ou por 5 minutos.';

/**
 * Monta o status do backend para quem é membro de alguma lista: a saúde de cada rotina
 * (jobs/{nome}, só as que já gravaram), o consumo das fontes e de cada modelo do Gemini nos últimos
 * 7 dias (usage/{dia}, do mais recente para o mais antigo; dia sem consumo vem vazio), os modelos do
 * Gemini em uso, na ordem de preferência, e os que estão sendo pulados agora (quotas/gemini).
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
  const [jobs, usage, quotas] = await Promise.all([
    db.getAll(...JOB_NAMES.map((name) => db.doc(`jobs/${name}`))),
    db.getAll(...days.map((day) => db.doc(`usage/${day}`))),
    db.doc(GEMINI_QUOTA_DOC).get(),
  ]);
  return {
    jobs: jobs.flatMap(toJobStatus),
    usage: usage.map((snapshot, index) => toUsageDay(days[index] ?? snapshot.id, snapshot)),
    gemini: {
      interpret: [...GEMINI_MODELS.interpret],
      text: [...GEMINI_MODELS.text],
      resting: toResting(quotas, now()),
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
  const geminiPurposes: Partial<Record<GeminiPurpose, GeminiPurposeUsage>> = {};
  for (const purpose of GEMINI_PURPOSES) {
    const value: unknown = snapshot.get(`geminiPurposes.${purpose}`);
    if (typeof value === 'object' && value !== null) geminiPurposes[purpose] = GeminiPurposeUsageSchema.parse(value);
  }
  return { day, sources, geminiModels, geminiPurposes };
}

/**
 * Lê em quotas/gemini os modelos ainda no prazo, do que volta antes para o que volta depois.
 *
 * @param snapshot - quotas/gemini (pode não existir).
 * @param now - Agora; prazos que já passaram ficam de fora.
 * @returns Os modelos pulados, com o prazo e o motivo.
 */
function toResting(snapshot: DocumentSnapshot, now: Date): GeminiRestingModel[] {
  const skipUntil: unknown = snapshot.get('skipUntil');
  if (typeof skipUntil !== 'object' || skipUntil === null) return [];
  return Object.entries(skipUntil)
    .flatMap(([model, until]) =>
      until instanceof Timestamp && until.toDate() > now ? [{ model, until: until.toDate() }] : [],
    )
    .sort((a, b) => a.until.getTime() - b.until.getTime())
    .map(({ model, until }) => ({
      model,
      until: until.toISOString(),
      reason: GeminiSkipReasonSchema.parse(snapshot.get(new FieldPath('skipReason', model))),
    }));
}

export { readStatus };
