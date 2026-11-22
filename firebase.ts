/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  UserCredential,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

let inFlightGoogleSignIn: Promise<UserCredential> | null = null;

export function signInWithGoogle(): Promise<UserCredential> {
  if (inFlightGoogleSignIn) {
    return inFlightGoogleSignIn;
  }

  const signInPromise = signInWithPopup(
    auth,
    googleProvider,
    browserPopupRedirectResolver
  ).finally(() => {
    if (inFlightGoogleSignIn === signInPromise) {
      inFlightGoogleSignIn = null;
    }
  });

  inFlightGoogleSignIn = signInPromise;
  return signInPromise;
}

export async function signOutUser() {
  inFlightGoogleSignIn = null;
  return await signOut(auth);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function reportFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errCode = typeof (error as any)?.code === 'string' ? (error as any).code : '';
  const message = error instanceof Error ? error.message : String(error);
  const currentUser = auth.currentUser;

  const errInfo: FirestoreErrorInfo = {
    error: message,
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };

  // Ignore expected teardown race when user just signed out
  if (!currentUser && (errCode === 'permission-denied' || message.toLowerCase().includes('missing or insufficient permissions'))) {
    return errInfo;
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(
        new CustomEvent('srabon:app-issue', {
          detail: {
            source: `Firestore:${operationType}`,
            severity: 'error',
            message: errInfo.error || 'Firestore operation failed',
            details: `Path: ${path || 'unknown'} | User: ${errInfo.authInfo.email || errInfo.authInfo.userId || 'anonymous'}`,
          },
        })
      );
    } catch {}
  }
  return errInfo;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo = reportFirestoreError(error, operationType, path);
  throw new Error(JSON.stringify(errInfo));
}
