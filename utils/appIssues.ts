/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AppIssueRecord, AppIssueSeverity } from '../types';

export interface ReportIssueInput {
  source: string;
  message: string;
  details?: string;
  severity?: AppIssueSeverity;
}

type SessionListener = (issues: AppIssueRecord[]) => void;

const sessionIssues: AppIssueRecord[] = [];
const listeners = new Set<SessionListener>();
const recentDedupeMap = new Map<string, number>();

const DEDUPE_WINDOW_MS = 20_000;
const MAX_SESSION_ISSUES = 50;

function notifyListeners() {
  const snapshot = [...sessionIssues];
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {}
  });
}

export function subscribeSessionIssues(listener: SessionListener): () => void {
  listeners.add(listener);
  listener([...sessionIssues]);
  return () => {
    listeners.delete(listener);
  };
}

export function resolveSessionIssue(id: string) {
  let changed = false;
  for (let i = 0; i < sessionIssues.length; i++) {
    if (sessionIssues[i].id === id && sessionIssues[i].status !== 'resolved') {
      sessionIssues[i] = { ...sessionIssues[i], status: 'resolved' };
      changed = true;
    }
  }
  if (changed) notifyListeners();
}

export function deleteSessionIssue(id: string) {
  const idx = sessionIssues.findIndex((item) => item.id === id);
  if (idx !== -1) {
    sessionIssues.splice(idx, 1);
    notifyListeners();
  }
}

export function clearResolvedSessionIssues() {
  let removed = false;
  for (let i = sessionIssues.length - 1; i >= 0; i--) {
    if (sessionIssues[i].status === 'resolved') {
      sessionIssues.splice(i, 1);
      removed = true;
    }
  }
  if (removed) notifyListeners();
}

export function isBenignAudioInterrupt(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = 'name' in err && typeof (err as { name?: unknown }).name === 'string'
    ? (err as { name: string }).name.trim().toLowerCase()
    : '';
  const message = 'message' in err && typeof (err as { message?: unknown }).message === 'string'
    ? (err as { message: string }).message.trim().toLowerCase()
    : '';
  return (
    name === 'aborterror' ||
    message.includes('interrupted by a call to pause') ||
    message.includes('interrupted by a new load request') ||
    message.includes('play() request was interrupted') ||
    message.includes('request was aborted')
  );
}

export function isBenignAppIssueNoise(message?: string, name?: string): boolean {
  const safeName = (name || '').trim().toLowerCase();
  const safeMsg = (message || '').trim().toLowerCase();
  return (
    safeName === 'aborterror' ||
    safeMsg.includes('signal is aborted without reason') ||
    safeMsg.includes('aborted without reason') ||
    safeMsg.includes('the user aborted a request') ||
    safeMsg.includes('request was aborted') ||
    safeMsg.includes('interrupted by a call to pause') ||
    safeMsg.includes('play() request was interrupted') ||
    safeMsg.includes('resizeobserver') ||
    safeMsg.includes('websocket') ||
    safeMsg.includes('pending promise was never set')
  );
}

export async function reportAppIssue(input: ReportIssueInput): Promise<void> {
  const source = (input.source || 'App').trim().slice(0, 60) || 'App';
  const message = (input.message || 'Unknown application error').trim().slice(0, 500) || 'Unknown error';
  if (isBenignAppIssueNoise(message)) {
    return;
  }
  const severity: AppIssueSeverity = input.severity === 'warning' ? 'warning' : 'error';
  const rawDetails = input.details?.trim();
  const details = rawDetails ? rawDetails.slice(0, 1000) : undefined;

  const dedupeKey = `${source}::${message}`;
  const now = Date.now();
  const lastSeen = recentDedupeMap.get(dedupeKey);
  if (lastSeen && now - lastSeen < DEDUPE_WINDOW_MS) {
    return;
  }
  recentDedupeMap.set(dedupeKey, now);

  if (severity === 'warning') {
    console.warn(`[${source}]`, message, details || '');
  } else {
    console.error(`[${source}]`, message, details || '');
  }

  const currentUser = auth.currentUser;
  const sessionRecord: AppIssueRecord = {
    id: `local_${now}_${Math.random().toString(36).slice(2, 8)}`,
    uid: currentUser?.uid || 'anonymous',
    reporterEmail: currentUser?.email || undefined,
    reporterName: currentUser?.displayName || undefined,
    source,
    severity,
    message,
    details,
    status: 'unread',
    origin: 'session',
    createdAt: { toMillis: () => now },
  };

  sessionIssues.unshift(sessionRecord);
  if (sessionIssues.length > MAX_SESSION_ISSUES) {
    sessionIssues.length = MAX_SESSION_ISSUES;
  }
  notifyListeners();

  // Persist silently to Firestore /appIssues so Admin receives issues hit by any user
  if (currentUser && currentUser.emailVerified) {
    const safeUid = currentUser.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
    if (!safeUid) return;
    const payload: Record<string, any> = {
      uid: safeUid,
      source,
      severity,
      message,
      status: 'unread',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (currentUser.email) {
      payload.reporterEmail = currentUser.email.slice(0, 254);
    }
    if (currentUser.displayName) {
      payload.reporterName = currentUser.displayName.slice(0, 120);
    }
    if (details) {
      payload.details = details;
    }

    try {
      await addDoc(collection(db, 'appIssues'), payload);
    } catch {
      // Never re-throw or recurse if logging fails
    }
  }
}
