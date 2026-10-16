import * as z from 'zod';
import type { Invite, List } from '../types/list.js';
import { firestoreDate } from './firestore.js';

/** lists/{listId}, validado ao ler. */
export const ListSchema: z.ZodType<List> = z.object({
  name: z.string(),
  description: z.string(),
  ownerUid: z.string(),
  memberUids: z.array(z.string()),
  source: z.object({ letterboxdUrl: z.string(), importedAt: firestoreDate }).optional(),
  createdAt: firestoreDate,
  updatedAt: firestoreDate,
});

/** invites/{code}, validado ao ler. */
export const InviteSchema: z.ZodType<Invite> = z.object({
  listId: z.string(),
  createdBy: z.string(),
  expiresAt: firestoreDate,
  usedBy: z.array(z.string()),
});
