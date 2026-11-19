/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import {
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

const PENDING_REF_STORAGE_KEY = 'srabon_pending_ref';
const REFERRAL_CODE_RE = /^[A-Z0-9]{6,16}$/;

export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

export function isValidReferralCodeFormat(code: string): boolean {
  return REFERRAL_CODE_RE.test(code);
}

/**
 * Generates a deterministic uppercase alphanumeric referral code for a user UID
 * (e.g. "SRB7K9M2Q4"), guaranteed 10 characters matching ^[A-Z0-9]{6,16}$.
 */
export function buildReferralCode(uid: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < uid.length; i++) {
    const ch = uid.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ch, 0x85ebca6b) >>> 0;
  }
  const part1 = h1.toString(36).toUpperCase().padStart(4, '0').slice(0, 4);
  const part2 = h2.toString(36).toUpperCase().padStart(4, '0').slice(0, 4);
  return `SRB${part1}${part2}`.slice(0, 10);
}

export function capturePendingReferralFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('ref');
    if (raw) {
      const code = normalizeReferralCode(raw);
      if (isValidReferralCodeFormat(code)) {
        localStorage.setItem(PENDING_REF_STORAGE_KEY, code);
        params.delete('ref');
        const nextSearch = params.toString();
        const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', nextUrl);
        return code;
      }
    }
    const stored = localStorage.getItem(PENDING_REF_STORAGE_KEY);
    if (stored && isValidReferralCodeFormat(stored)) {
      return stored;
    }
  } catch {}
  return null;
}

export function clearPendingReferral(): void {
  try {
    localStorage.removeItem(PENDING_REF_STORAGE_KEY);
  } catch {}
}

export async function ensureReferralCodeRegistered(uid: string, code: string): Promise<void> {
  const codePath = `referralCodes/${code}`;
  const codeRef = doc(db, 'referralCodes', code);
  try {
    const snap = await getDoc(codeRef);
    if (!snap.exists()) {
      await setDoc(codeRef, {
        code,
        uid: uid.slice(0, 128),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, codePath);
  }
}

export async function hasUserClaimedReferral(uid: string): Promise<boolean> {
  const refPath = `referrals/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'referrals', uid));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, refPath);
    return false;
  }
}

export type ClaimReferralResult =
  | { status: 'claimed'; code: string }
  | { status: 'already_claimed' }
  | { status: 'self_referral' }
  | { status: 'invalid_code' };

export async function claimReferralCode(
  userUid: string,
  rawCode: string
): Promise<ClaimReferralResult> {
  const code = normalizeReferralCode(rawCode);
  if (!isValidReferralCodeFormat(code)) {
    return { status: 'invalid_code' };
  }

  const claimRef = doc(db, 'referrals', userUid);
  const existingClaim = await getDoc(claimRef);
  if (existingClaim.exists()) {
    clearPendingReferral();
    return { status: 'already_claimed' };
  }

  const codeSnap = await getDoc(doc(db, 'referralCodes', code));
  if (!codeSnap.exists()) {
    return { status: 'invalid_code' };
  }

  const referrerUid = codeSnap.data()?.uid;
  if (typeof referrerUid !== 'string' || !referrerUid) {
    return { status: 'invalid_code' };
  }
  if (referrerUid === userUid) {
    clearPendingReferral();
    return { status: 'self_referral' };
  }

  const batch = writeBatch(db);
  batch.set(claimRef, {
    referredUid: userUid.slice(0, 128),
    referrerUid: referrerUid.slice(0, 128),
    referralCode: code,
    rewardCredits: 10,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, 'users', referrerUid), {
    bonusCredits: increment(10),
    referralCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    clearPendingReferral();
    return { status: 'claimed', code };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `referrals/${userUid}`);
    throw error;
  }
}
