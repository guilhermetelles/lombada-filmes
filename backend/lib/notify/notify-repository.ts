import { createHash } from 'node:crypto';
import type {
  CollectionReference,
  DocumentReference,
  Firestore,
  FirestoreDataConverter,
} from 'firebase-admin/firestore';
import { withoutUndefined } from '../firestore/without-undefined.js';
import { DeviceTokenSchema, NotifyLogSchema, NotifyStateSchema } from '../schemas/notify.js';
import type { DeviceToken, NotifyLog, NotifyState } from '../types/notify.js';

/** Valida ao ler. */
const deviceTokenConverter: FirestoreDataConverter<DeviceToken> = {
  toFirestore: (device) => device,
  fromFirestore: (snapshot) => DeviceTokenSchema.parse(snapshot.data()),
};

/** Valida ao ler (sem prefs gravadas, vale o padrão); ao gravar, tira os campos ausentes. */
const notifyStateConverter: FirestoreDataConverter<NotifyState> = {
  toFirestore: (state) => withoutUndefined(state),
  fromFirestore: (snapshot) => NotifyStateSchema.parse(snapshot.data()),
};

/** Valida ao ler. */
const notifyLogConverter: FirestoreDataConverter<NotifyLog> = {
  toFirestore: (log) => log,
  fromFirestore: (snapshot) => NotifyLogSchema.parse(snapshot.data()),
};

/**
 * Id do documento de um token do FCM: o SHA-256 do token, que tem tamanho fixo e caracteres
 * aceitos em id do Firestore.
 *
 * @param token - Token do FCM.
 * @returns O SHA-256 em hexadecimal.
 */
export function deviceTokenId(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Coleção devices/{uid}/tokens: os aparelhos de uma pessoa.
 *
 * @param db - Firestore.
 * @param uid - Dona dos aparelhos.
 * @returns A coleção tipada.
 */
export function deviceTokensCollection(db: Firestore, uid: string): CollectionReference<DeviceToken> {
  return db.collection('devices').doc(uid).collection('tokens').withConverter(deviceTokenConverter);
}

/**
 * Documento devices/{uid}/tokens/{sha256 do token}.
 *
 * @param db - Firestore.
 * @param uid - Dona do aparelho.
 * @param token - Token do FCM.
 * @returns A referência tipada.
 */
export function deviceTokenDocument(db: Firestore, uid: string, token: string): DocumentReference<DeviceToken> {
  return deviceTokensCollection(db, uid).doc(deviceTokenId(token));
}

/**
 * Documento notifyState/{uid}: preferências e limites de envio.
 *
 * @param db - Firestore.
 * @param uid - Pessoa.
 * @returns A referência tipada.
 */
export function notifyStateDocument(db: Firestore, uid: string): DocumentReference<NotifyState> {
  return db.collection('notifyState').doc(uid).withConverter(notifyStateConverter);
}

/**
 * Coleção notifyState/, para as rotinas notify-* consultarem quem escolheu o horário.
 *
 * @param db - Firestore.
 * @returns A coleção tipada.
 */
export function notifyStateCollection(db: Firestore): CollectionReference<NotifyState> {
  return db.collection('notifyState').withConverter(notifyStateConverter);
}

/**
 * Documento notifyLog/{uid}_{dia}: a notificação diária que já saiu (criado com createIfAbsent).
 *
 * @param db - Firestore.
 * @param uid - Pessoa.
 * @param day - Dia de Brasília, AAAA-MM-DD.
 * @returns A referência tipada.
 */
export function notifyLogDocument(db: Firestore, uid: string, day: string): DocumentReference<NotifyLog> {
  return db.collection('notifyLog').doc(`${uid}_${day}`).withConverter(notifyLogConverter);
}
