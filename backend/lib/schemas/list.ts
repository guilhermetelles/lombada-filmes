import * as z from 'zod';
import type { Invite, List, MemberProfile, MemberProfiles } from '../types/list.js';
import { firestoreDate } from './firestore.js';

/** Nome e foto de um membro, em lists/{listId}.memberProfiles.{uid}. */
export const MemberProfileSchema: z.ZodType<MemberProfile> = z.object({
  name: z.string(),
  photoUrl: z.string().nullable(),
});

/** lists/{listId}.memberProfiles, por uid. */
export const MemberProfilesSchema: z.ZodType<MemberProfiles> = z.record(z.string(), MemberProfileSchema);

/** lists/{listId}, validado ao ler. */
export const ListSchema: z.ZodType<List> = z.object({
  name: z.string(),
  description: z.string(),
  ownerUid: z.string(),
  memberUids: z.array(z.string()),
  source: z.object({ letterboxdUrl: z.string(), importedAt: firestoreDate }).optional(),
  memberProfiles: MemberProfilesSchema.optional(),
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
