import { Timestamp } from 'firebase-admin/firestore';
import * as z from 'zod';

/** No banco as datas são Timestamp; no código, Date (o Admin SDK converte Date ao gravar). */
export const firestoreDate = z.union([z.instanceof(Timestamp).transform((timestamp) => timestamp.toDate()), z.date()]);
