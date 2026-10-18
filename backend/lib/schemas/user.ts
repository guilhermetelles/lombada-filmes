import * as z from 'zod';
import type { UserDoc } from '../types/user.js';
import { firestoreDate } from './firestore.js';

/** users/{uid}, validado ao ler (só os campos que o backend usa). */
export const UserDocSchema: z.ZodType<UserDoc> = z.object({
  feedSeenAt: z.record(z.string(), firestoreDate).optional(),
});
