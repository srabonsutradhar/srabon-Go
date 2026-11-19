/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useEffect, useState } from 'react';
import {
  X,
  Crown,
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  Loader2,
  Copy,
  Check,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  BillingConfig,
  PaymentMethod,
  ProUpgradeRequest,
  UserPlan,
} from '../types';

interface ProUpgradeModalProps {
  user: User;
  userPlan: UserPlan;
  usedToday: number;
  billingConfig: BillingConfig;
  isAdmin: boolean;
  onClose: () => void;
}

const PAYMENT_METHODS: PaymentMethod[] = ['bKash', 'Nagad', 'Rocket', 'Bank / Other'];

function generateRequestId(uid: string): string {
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'user';
  const rand = Math.random().toString(36).slice(2, 10);
  return `${safeUid}_${Date.now()}_${rand}`.slice(0, 128);
}

const ProUpgradeModal: React.FC<ProUpgradeModalProps> = ({
  user,
  userPlan,
  usedToday,
  billingConfig,
  isAdmin,
  onClose,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bKash');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [amountText, setAmountText] = useState(billingConfig.feeAmount || '50 BDT');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [myRequests, setMyRequests] = useState<ProUpgradeRequest[]>([]);

  useEffect(() => {
    setAmountText(billingConfig.feeAmount || '50 BDT');
  }, [billingConfig.feeAmount]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const reqQuery = query(
      collection(db, 'proRequests'),
      where('uid', '==', user.uid)
    );
    const unsubscribe = onSnapshot(
      reqQuery,
      (snapshot) => {
        const items: ProUpgradeRequest[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ProUpgradeRequest, 'id'>),
        }));
        items.sort((a, b) => {
          const at = a.createdAt?.toMillis?.() ?? 0;
          const bt = b.createdAt?.toMillis?.() ?? 0;
          return bt - at;
        });
        setMyRequests(items.slice(0, 5));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'proRequests');
      }
    );
    return () => unsubscribe();
  }, [user.uid]);

  const handleCopyAccount = () => {
    if (!billingConfig.paymentAccount) return;
    navigator.clipboard.writeText(billingConfig.paymentAccount);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const cleanSender = senderNumber.trim().slice(0, 30);
    const cleanTrx = transactionId.trim().slice(0, 64);
    const cleanAmount = amountText.trim().slice(0, 40);
    const cleanNote = note.trim().slice(0, 300);

    if (cleanSender.length < 4) {
      setSubmitError('অনুগ্রহ করে আপনার পেমেন্ট নম্বরটি সঠিকভাবে লিখুন (কমপক্ষে ৪ অক্ষর)।');
      return;
    }
    if (cleanTrx.length < 3) {
      setSubmitError('অনুগ্রহ করে আপনার Transaction ID / রেফারেন্স লিখুন।');
      return;
    }
    if (!cleanAmount) {
      setSubmitError('অনুগ্রহ করে পাঠানো টাকার পরিমাণ লিখুন।');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    const requestId = generateRequestId(user.uid);
    const reqPath = `proRequests/${requestId}`;
    const payload: Record<string, any> = {
      uid: user.uid.slice(0, 128),
      paymentMethod,
      senderNumber: cleanSender,
      transactionId: cleanTrx,
      amountText: cleanAmount,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (user.email) payload.userEmail = user.email.slice(0, 254);
    if (user.displayName) payload.userName = user.displayName.slice(0, 120);
    if (cleanNote) payload.note = cleanNote;

    try {
      await setDoc(doc(db, 'proRequests', requestId), payload);
      setSenderNumber('');
      setTransactionId('');
      setNote('');
      setSubmitSuccess(true);
    } catch (err: any) {
      setSubmitError(err?.message || 'Request submission failed.');
      handleFirestoreError(err, OperationType.CREATE, reqPath);
    } finally {
      setSubmitting(false);
    }
  };

  const hasPending = myRequests.some((r) => r.status === 'pending');

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-upgrade-title"
    >
      <div
        className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-slide-up">
        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold">
                <Crown size={13} />
                <span>Srabon Go Pro Access</span>
              </div>
              <h2
                id="pro-upgrade-title"
                className="text-2xl font-serif font-medium text-zinc-900 dark:text-white"
              >
                {userPlan === 'pro' || isAdmin
                  ? 'আপনার Pro অ্যাক্সেস সক্রিয় আছে'
                  : 'আনলিমিটেড ভয়েস স্টুডিও আনলক করুন'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {userPlan === 'pro' || isAdmin
                  ? 'আপনি আনলিমিটেড Voice Studio এবং AI Casting ব্যবহার করতে পারবেন।'
                  : `ফ্রি প্ল্যানে আজকের ব্যবহার: ${usedToday} / ${billingConfig.freeDailyLimit} বার। Pro নিলে আনলিমিটেড ব্যবহার করতে পারবেন।`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Active Pro State */}
          {(userPlan === 'pro' || isAdmin) && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 size={20} className="shrink-0" />
              <div className="text-xs space-y-0.5">
                <p className="font-semibold">
                  {isAdmin ? 'Admin Account (Unlimited)' : 'Pro Plan Active'}
                </p>
                <p className="opacity-80">
                  সব ভয়েস স্টুডিও ও AI ফিচার কোনো দৈনিক সীমা ছাড়াই চালু রয়েছে।
                </p>
              </div>
            </div>
          )}

          {/* Fee & Payment Info Card */}
          {userPlan === 'free' && !isAdmin && (
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Pro আনলক ফি
                  </p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-white">
                    {billingConfig.feeAmount}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    পেমেন্ট মাধ্যম
                  </p>
                  <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                    {billingConfig.paymentMethod}
                  </p>
                </div>
              </div>

              {billingConfig.paymentAccount ? (
                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                  <div className="min-w-0">
                    <span className="text-[11px] text-zinc-400 block">পেমেন্ট নম্বর / অ্যাকাউন্ট</span>
                    <span className="text-sm font-mono font-semibold text-zinc-900 dark:text-white break-all">
                      {billingConfig.paymentAccount}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAccount}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {copiedAccount ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    <span>{copiedAccount ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                  অ্যাডমিন এখনও পেমেন্ট নম্বর সেট করেননি। অ্যাডমিন প্যানেল থেকে পেমেন্ট নম্বর সেট করার পর এখানে দেখাবে।
                </div>
              )}

              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {billingConfig.instructions}
              </p>
            </div>
          )}

          {/* Submit Request Form */}
          {userPlan === 'free' && !isAdmin && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Sparkles size={15} className="text-indigo-500" />
                <span>পেমেন্টের তথ্য জমা দিন</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    পেমেন্ট মেথড
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    পাঠানো টাকার পরিমাণ
                  </label>
                  <input
                    type="text"
                    value={amountText}
                    onChange={(e) => setAmountText(e.target.value)}
                    maxLength={40}
                    placeholder="e.g. 50 BDT"
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    যে নম্বর থেকে পাঠিয়েছেন
                  </label>
                  <input
                    type="text"
                    value={senderNumber}
                    onChange={(e) => setSenderNumber(e.target.value)}
                    maxLength={30}
                    placeholder="01XXXXXXXXX"
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    Transaction ID (TrxID)
                  </label>
                  <input
                    type="text"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    maxLength={64}
                    placeholder="e.g. BGD9X2K10"
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={300}
                  placeholder="অতিরিক্ত কোনো তথ্য থাকলে লিখুন..."
                  className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                />
              </div>

              {submitError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-300">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {submitSuccess && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                  <span>আপনার রিকোয়েস্ট জমা হয়েছে! অ্যাডমিন যাচাই করে অনুমোদন দিলেই Pro চালু হয়ে যাবে।</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || hasPending}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-zinc-900 dark:bg-indigo-600 hover:bg-zinc-800 dark:hover:bg-indigo-500 text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                <span>
                  {hasPending
                    ? 'একটি রিকোয়েস্ট পেন্ডিং রয়েছে...'
                    : submitting
                    ? 'জমা হচ্ছে...'
                    : 'Pro আনলক রিকোয়েস্ট পাঠান'}
                </span>
              </button>
            </form>
          )}

          {/* User's Recent Requests */}
          {myRequests.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                আপনার রিকোয়েস্টের অবস্থা
              </p>
              <div className="space-y-2">
                {myRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/70 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900 dark:text-white truncate">
                        {req.paymentMethod} • TrxID: {req.transactionId}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {req.amountText} • {req.senderNumber}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        req.status === 'approved'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : req.status === 'rejected'
                          ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {req.status === 'approved' ? (
                        <CheckCircle2 size={12} />
                      ) : req.status === 'rejected' ? (
                        <XCircle size={12} />
                      ) : (
                        <Clock size={12} />
                      )}
                      <span className="capitalize">{req.status}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProUpgradeModal;
