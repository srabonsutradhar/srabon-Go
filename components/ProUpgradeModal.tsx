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
  Gift,
  Share2,
  Users,
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
import { reportAppIssue } from '../utils/appIssues';
import {
  BillingConfig,
  PaymentMethod,
  ProUpgradeRequest,
  UserPlan,
} from '../types';
import { claimReferralCode, normalizeReferralCode } from '../utils/referral';

interface ProUpgradeModalProps {
  user: User;
  userPlan: UserPlan;
  usedToday: number;
  billingConfig: BillingConfig;
  isAdmin: boolean;
  referralCode: string;
  bonusCredits: number;
  referralCount: number;
  alreadyClaimedReferral: boolean;
  onReferralClaimed: () => void;
  initialTab?: 'refer' | 'pro';
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
  referralCode,
  bonusCredits,
  referralCount,
  alreadyClaimedReferral,
  onReferralClaimed,
  initialTab = 'refer',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'refer' | 'pro'>(initialTab);
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

  // Referral UI state
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [claimingRef, setClaimingRef] = useState(false);
  const [refMessage, setRefMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const referralLink =
    typeof window !== 'undefined' && referralCode
      ? `${window.location.origin}${window.location.pathname}?ref=${referralCode}`
      : '';

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

  const handleCopyReferralLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyReferralCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareReferral = async () => {
    if (!referralLink) return;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'Srabon Go — AI Voice Studio',
          text: `Srabon Go ব্যবহার করে দেখুন! আমার রেফার কোড (${referralCode}) দিয়ে সাইন-ইন করুন:`,
          url: referralLink,
        });
        return;
      } catch {}
    }
    handleCopyReferralLink();
  };

  const handleClaimFriendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (claimingRef) return;
    const cleaned = normalizeReferralCode(friendCodeInput);
    if (cleaned.length < 6) {
      setRefMessage({
        type: 'error',
        text: 'অনুগ্রহ করে সঠিক ৬-১৬ অক্ষরের রেফার কোড লিখুন।',
      });
      return;
    }

    setClaimingRef(true);
    setRefMessage(null);
    try {
      const result = await claimReferralCode(user.uid, cleaned);
      if (result.status === 'claimed') {
        setFriendCodeInput('');
        onReferralClaimed();
        setRefMessage({
          type: 'success',
          text: 'রেফার কোড সফলভাবে যুক্ত হয়েছে! আপনার বন্ধু ১০টি বোনাস ক্রেডিট পেয়েছেন।',
        });
      } else if (result.status === 'already_claimed') {
        onReferralClaimed();
        setRefMessage({
          type: 'error',
          text: 'আপনি ইতিমধ্যেই একটি রেফার কোড ব্যবহার করেছেন।',
        });
      } else if (result.status === 'self_referral') {
        setRefMessage({
          type: 'error',
          text: 'আপনি নিজের রেফার কোড নিজে ব্যবহার করতে পারবেন না।',
        });
      } else {
        setRefMessage({
          type: 'error',
          text: 'এই রেফার কোডটি সঠিক নয় বা খুঁজে পাওয়া যায়নি।',
        });
      }
    } catch (err: any) {
      const msg = err?.message || 'রেফার কোড যাচাই করতে সমস্যা হয়েছে।';
      reportAppIssue({ source: 'ProUpgrade:Referral', severity: 'error', message: msg });
      if (isAdmin) {
        setRefMessage({
          type: 'error',
          text: msg,
        });
      }
    } finally {
      setClaimingRef(false);
    }
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
      const msg = err?.message || 'Request submission failed.';
      reportAppIssue({ source: 'ProUpgrade:Payment', severity: 'error', message: msg });
      if (isAdmin) setSubmitError(msg);
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
        <div className="p-6 sm:p-8 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                {activeTab === 'refer' ? <Gift size={13} /> : <Crown size={13} />}
                <span>
                  {activeTab === 'refer'
                    ? 'Refer Friends • +10 Credits Each'
                    : 'Srabon Go Pro Access'}
                </span>
              </div>
              <h2
                id="pro-upgrade-title"
                className="text-2xl font-serif font-medium text-zinc-900 dark:text-white"
              >
                {activeTab === 'refer'
                  ? 'বন্ধুদের রেফার করে ১০ ক্রেডিট করে নিন'
                  : userPlan === 'pro' || isAdmin
                  ? 'আপনার Pro অ্যাক্সেস সক্রিয় আছে'
                  : 'আনলিমিটেড ভয়েস স্টুডিও আনলক করুন'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {userPlan === 'pro' || isAdmin
                  ? `আপনি আনলিমিটেড অ্যাক্সেস পাচ্ছেন। বোনাস ক্রেডিট: ${bonusCredits}`
                  : `আজকের ফ্রি ব্যবহার: ${usedToday} / ${billingConfig.freeDailyLimit} বার • বোনাস ক্রেডিট: ${bonusCredits} টি`}
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

          {/* Mode Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setActiveTab('refer')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'refer'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Gift size={14} />
              <span>Refer & Earn (+10 Cr)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pro')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'pro'
                  ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Crown size={14} />
              <span>Unlock Pro</span>
            </button>
          </div>

          {/* TAB 1: REFER & EARN */}
          {activeTab === 'refer' && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    <Sparkles size={12} />
                    <span>মোট বোনাস ক্রেডিট</span>
                  </div>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                    {bonusCredits} <span className="text-xs font-medium text-zinc-500">Credits</span>
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/60">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <Users size={12} />
                    <span>সফল রেফার</span>
                  </div>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
                    {referralCount} <span className="text-xs font-medium text-zinc-500">Friends</span>
                  </p>
                </div>
              </div>

              {/* Share Link Box */}
              <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 space-y-3">
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  আপনার নিচের রেফার লিংক বা কোড বন্ধুদের মাঝে শেয়ার করুন। প্রতিটি নতুন বন্ধু এই লিংকে ঢুকে গুগল লগইন করলেই আপনি সাথে সাথে{' '}
                  <strong className="text-indigo-600 dark:text-indigo-400">১০টি করে ফ্রি ক্রেডিট</strong> পাবেন! দৈনিক ফ্রি লিমিট শেষ হলে এই ক্রেডিটগুলো স্বয়ংক্রিয়ভাবে ব্যবহার হবে।
                </p>

                {/* Referral Code */}
                <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 block">
                      আপনার রেফার কোড
                    </span>
                    <span className="text-sm font-mono font-bold tracking-wider text-zinc-900 dark:text-white">
                      {referralCode || 'Generating...'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyReferralCode}
                    disabled={!referralCode}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {copiedCode ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                  </button>
                </div>

                {/* Referral Link */}
                <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 block">
                      আপনার রেফার লিংক
                    </span>
                    <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate block">
                      {referralLink || 'Loading...'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyReferralLink}
                      disabled={!referralLink}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      {copiedLink ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleShareReferral}
                      disabled={!referralLink}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                    >
                      <Share2 size={13} />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Claim a friend's code */}
              {!alreadyClaimedReferral && (
                <form
                  onSubmit={handleClaimFriendCode}
                  className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/80 space-y-2.5"
                >
                  <label
                    htmlFor="friend-ref-code"
                    className="block text-xs font-semibold text-zinc-700 dark:text-zinc-200"
                  >
                    কোনো বন্ধুর রেফার কোড থাকলে এখানে দিন (একবার ব্যবহারযোগ্য)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="friend-ref-code"
                      type="text"
                      value={friendCodeInput}
                      onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase())}
                      maxLength={16}
                      placeholder="e.g. SRB7K9M2Q4"
                      className="flex-1 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm font-mono uppercase text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                    />
                    <button
                      type="submit"
                      disabled={claimingRef || !friendCodeInput.trim()}
                      className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-indigo-600 hover:bg-zinc-800 dark:hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {claimingRef ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
                    </button>
                  </div>
                  {refMessage && (
                    <p
                      className={`text-xs ${
                        refMessage.type === 'success'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-500 dark:text-red-400'
                      }`}
                    >
                      {refMessage.text}
                    </p>
                  )}
                </form>
              )}
            </div>
          )}

          {/* TAB 2: UNLOCK PRO */}
          {activeTab === 'pro' && (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProUpgradeModal;
