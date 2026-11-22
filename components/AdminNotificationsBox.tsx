/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';
import { deleteDoc, doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { AppIssueRecord } from '../types';
import {
  clearResolvedSessionIssues,
  deleteSessionIssue,
  resolveSessionIssue,
} from '../utils/appIssues';
import { AppLanguage, localizeDateTime, useLanguage } from '../utils/i18n';

interface AdminNotificationsBoxProps {
  issues: AppIssueRecord[];
  onClose: () => void;
}

function formatIssueTime(createdAt: any, lang: AppLanguage): string {
  const ms =
    typeof createdAt?.toMillis === 'function'
      ? createdAt.toMillis()
      : typeof createdAt === 'number'
      ? createdAt
      : null;
  if (!ms) return lang === 'bn' ? 'এইমাত্র' : 'Just now';
  return localizeDateTime(ms, lang) || (lang === 'bn' ? 'সাম্প্রতিক' : 'Recent');
}

const AdminNotificationsBox: React.FC<AdminNotificationsBoxProps> = ({
  issues,
  onClose,
}) => {
  const { lang, bi } = useLanguage();
  const [filterTab, setFilterTab] = useState<'unread' | 'all'>('unread');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const unreadIssues = issues.filter((i) => i.status === 'unread');
  const displayedIssues = filterTab === 'unread' ? unreadIssues : issues;

  const handleMarkResolved = async (issue: AppIssueRecord) => {
    if (busyId) return;
    if (issue.origin === 'session') {
      resolveSessionIssue(issue.id);
      return;
    }
    setBusyId(issue.id);
    try {
      await updateDoc(doc(db, 'appIssues', issue.id), {
        status: 'resolved',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to mark issue resolved:', err);
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteIssue = async (issue: AppIssueRecord) => {
    if (busyId) return;
    if (issue.origin === 'session') {
      deleteSessionIssue(issue.id);
      return;
    }
    setBusyId(issue.id);
    try {
      await deleteDoc(doc(db, 'appIssues', issue.id));
    } catch (err) {
      console.error('Failed to delete issue:', err);
    } finally {
      setBusyId(null);
    }
  };

  const handleResolveAll = async () => {
    if (bulkBusy || unreadIssues.length === 0) return;
    setBulkBusy(true);
    try {
      const batch = writeBatch(db);
      let firestoreCount = 0;
      for (const issue of unreadIssues) {
        if (issue.origin === 'session') {
          resolveSessionIssue(issue.id);
        } else {
          batch.update(doc(db, 'appIssues', issue.id), {
            status: 'resolved',
            updatedAt: serverTimestamp(),
          });
          firestoreCount++;
        }
      }
      if (firestoreCount > 0) {
        await batch.commit();
      }
    } catch (err) {
      console.error('Failed to resolve all issues:', err);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleClearResolved = async () => {
    const resolvedItems = issues.filter((i) => i.status === 'resolved');
    if (bulkBusy || resolvedItems.length === 0) return;
    setBulkBusy(true);
    try {
      clearResolvedSessionIssues();
      const firestoreResolved = resolvedItems.filter((i) => i.origin !== 'session');
      if (firestoreResolved.length > 0) {
        const batch = writeBatch(db);
        for (const item of firestoreResolved) {
          batch.delete(doc(db, 'appIssues', item.id));
        }
        await batch.commit();
      }
    } catch (err) {
      console.error('Failed to clear resolved issues:', err);
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-notifications-title"
    >
      <div
        className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl max-h-[88vh] flex flex-col bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Bell size={18} />
            </div>
            <div>
              <h2
                id="admin-notifications-title"
                className="text-lg font-serif font-medium text-zinc-900 dark:text-white"
              >
                {bi('অ্যাডমিন সমস্যা নোটিফিকেশন বক্স', 'Admin Issue Notification Box')}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {bi(
                  'সাধারণ ইউজাররা কোনো সমস্যা দেখবে না—সব সমস্যা শুধু এখানে অ্যাডমিনের কাছে আসবে',
                  'Regular users never see system errors—all issues arrive privately here for the admin'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
            aria-label={bi('নোটিফিকেশন বক্স বন্ধ করুন', 'Close notification box')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Sub-bar Filter & Bulk Actions */}
        <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterTab('unread')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                filterTab === 'unread'
                  ? 'bg-zinc-900 dark:bg-indigo-600 text-white'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {bi(`অপঠিত (${unreadIssues.length})`, `Unread (${unreadIssues.length})`)}
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                filterTab === 'all'
                  ? 'bg-zinc-900 dark:bg-indigo-600 text-white'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {bi(`সবগুলো (${issues.length})`, `All (${issues.length})`)}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {unreadIssues.length > 0 && (
              <button
                type="button"
                disabled={bulkBusy}
                onClick={handleResolveAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <CheckCheck size={13} />
                <span>{bi('সবগুলো সমাধান চিহ্নিত করুন', 'Mark All Resolved')}</span>
              </button>
            )}
            {issues.some((i) => i.status === 'resolved') && (
              <button
                type="button"
                disabled={bulkBusy}
                onClick={handleClearResolved}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Trash2 size={13} />
                <span>{bi('সমাধান হওয়া মুছুন', 'Clear Resolved')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {displayedIssues.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 size={22} />
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                {filterTab === 'unread'
                  ? bi('এই মুহূর্তে কোনো নতুন সমস্যা বা এরর নেই', 'No new issues or errors right now')
                  : bi('কোনো নোটিফিকেশন জমা নেই', 'No notifications recorded')}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                {bi(
                  'কোনো ইউজার সার্ভার, API Key, 429 রেট-লিমিট বা ডেটাবেস সমস্যার মুখোমুখি হলে সেটি সাথে সাথে এই বক্সে চলে আসবে।',
                  'Whenever any user encounters a server, API key, 429 rate-limit, or database issue, it appears here immediately.'
                )}
              </p>
            </div>
          ) : (
            displayedIssues.map((issue) => (
              <div
                key={issue.id}
                className={`p-4 rounded-2xl border transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                  issue.status === 'unread'
                    ? issue.severity === 'warning'
                      ? 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200 dark:border-amber-900/70'
                      : 'bg-rose-50/70 dark:bg-rose-950/25 border-rose-200 dark:border-rose-900/70'
                    : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200/80 dark:border-zinc-800 opacity-75'
                }`}
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span
                      className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider ${
                        issue.severity === 'warning'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      <AlertTriangle size={13} />
                      <span>{issue.source}</span>
                    </span>
                    <span className="text-zinc-400">·</span>
                    <span className="text-zinc-500 dark:text-zinc-400 tabular-nums">
                      {formatIssueTime(issue.createdAt, lang)}
                    </span>
                    {issue.reporterEmail && (
                      <>
                        <span className="text-zinc-400">·</span>
                        <span className="text-zinc-600 dark:text-zinc-300 truncate">
                          {issue.reporterEmail}
                        </span>
                      </>
                    )}
                    {issue.status === 'resolved' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                        {bi('সমাধান হয়েছে', 'Resolved')}
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-medium text-zinc-900 dark:text-white leading-snug break-words">
                    {issue.message}
                  </p>

                  {issue.details && (
                    <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-white/70 dark:bg-zinc-900/70 border border-zinc-200/70 dark:border-zinc-700/70 rounded-xl px-3 py-2 break-all">
                      {issue.details}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {issue.status === 'unread' && (
                    <button
                      type="button"
                      disabled={busyId === issue.id}
                      onClick={() => handleMarkResolved(issue)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors disabled:opacity-50"
                    >
                      {busyId === issue.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={13} />
                      )}
                      <span>{bi('সমাধান হয়েছে', 'Resolved')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === issue.id}
                    onClick={() => handleDeleteIssue(issue)}
                    className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                    title={bi('নোটিফিকেশন মুছুন', 'Delete notification')}
                    aria-label={bi('নোটিফিকেশন মুছুন', 'Delete notification')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminNotificationsBox;
