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
import { db, reportFirestoreError, OperationType } from '../firebase';
import { reportAppIssue } from '../utils/appIssues';
import { STUDIO_TIER_LIMITS } from '../utils/studioTiers';
import {
  BillingConfig,
  PaymentMethod,
  ProPackageType,
  ProUpgradeRequest,
  UserPlan,
} from '../types';
import { claimReferralCode, normalizeReferralCode } from '../utils/referral';
import {
  useLanguage,
  copyTextSafely,
  localizeDate,
  localizeUpgradeStatus,
} from '../utils/i18n';

interface ProUpgradeModalProps {
  user: User;
  userPlan: UserPlan;
  proPackageType?: ProPackageType | null;
  proExpiresAtMs?: number | null;
  usedToday: number;
  billingConfig: BillingConfig;
  isAdmin: boolean;
  referralCode: string;
  bonusCredits: number;
  referralCount: number;
  alreadyClaimedReferral: boolean;
  onReferralClaimed: () => void;
  initialTab?: 'refer' | 'pro';
  initialPackage?: ProPackageType;
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
  proPackageType = null,
  proExpiresAtMs = null,
  usedToday,
  billingConfig,
  isAdmin,
  referralCode,
  bonusCredits,
  referralCount,
  alreadyClaimedReferral,
  onReferralClaimed,
  initialTab = 'refer',
  initialPackage = 'monthly',
  onClose,
}) => {
  const { lang, bi } = useLanguage();
  const monthlyPrice = billingConfig.monthlyFee || billingConfig.feeAmount || '50 BDT';
  const yearlyPrice = billingConfig.yearlyFee || '480 BDT';
  const [activeTab, setActiveTab] = useState<'refer' | 'pro'>(initialTab);
  const [selectedPackage, setSelectedPackage] = useState<ProPackageType>(initialPackage);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bKash');
  const [senderNumber, setSenderNumber] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [amountText, setAmountText] = useState(
    initialPackage === 'yearly' ? yearlyPrice : monthlyPrice
  );
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
    setSelectedPackage(initialPackage);
  }, [initialPackage]);

  useEffect(() => {
    setAmountText(selectedPackage === 'yearly' ? yearlyPrice : monthlyPrice);
  }, [selectedPackage, monthlyPrice, yearlyPrice]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!user.emailVerified) {
      setMyRequests([]);
      return;
    }
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
        reportFirestoreError(error, OperationType.LIST, 'proRequests');
      }
    );
    return () => unsubscribe();
  }, [user.uid, user.emailVerified]);

  const handleCopyAccount = async () => {
    if (!billingConfig.paymentAccount) return;
    if (await copyTextSafely(billingConfig.paymentAccount)) {
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    }
  };

  const handleCopyReferralLink = async () => {
    if (!referralLink) return;
    if (await copyTextSafely(referralLink)) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyReferralCode = async () => {
    if (!referralCode) return;
    if (await copyTextSafely(referralCode)) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleShareReferral = async () => {
    if (!referralLink) return;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: bi('শ্রাবণ গো — এআই ভয়েস স্টুডিও', 'Srabon Go — AI Voice Studio'),
          text: bi(
            `Srabon Go ব্যবহার করে দেখুন! আমার রেফার কোড (${referralCode}) দিয়ে সাইন-ইন করুন:`,
            `Try Srabon Go! Sign in with my referral code (${referralCode}):`
          ),
          url: referralLink,
        });
        return;
      } catch {}
    }
    await handleCopyReferralLink();
  };

  const handleClaimFriendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (claimingRef) return;
    const cleaned = normalizeReferralCode(friendCodeInput);
    if (cleaned.length < 6) {
      setRefMessage({
        type: 'error',
        text: bi(
          'অনুগ্রহ করে সঠিক ৬-১৬ অক্ষরের রেফার কোড লিখুন।',
          'Please enter a valid 6–16 character referral code.'
        ),
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
          text: bi(
            'রেফার কোড সফলভাবে যুক্ত হয়েছে! আপনার বন্ধু ১০টি বোনাস ক্রেডিট পেয়েছেন।',
            'Referral code applied! Your friend has received 10 bonus credits.'
          ),
        });
      } else if (result.status === 'already_claimed') {
        onReferralClaimed();
        setRefMessage({
          type: 'error',
          text: bi(
            'আপনি ইতিমধ্যেই একটি রেফার কোড ব্যবহার করেছেন।',
            'You have already claimed a referral code.'
          ),
        });
      } else if (result.status === 'self_referral') {
        setRefMessage({
          type: 'error',
          text: bi(
            'আপনি নিজের রেফার কোড নিজে ব্যবহার করতে পারবেন না।',
            'You cannot use your own referral code.'
          ),
        });
      } else {
        setRefMessage({
          type: 'error',
          text: bi(
            'এই রেফার কোডটি সঠিক নয় বা খুঁজে পাওয়া যায়নি।',
            'This referral code is invalid or could not be found.'
          ),
        });
      }
    } catch (err: any) {
      const msg =
        err?.message ||
        bi(
          'রেফার কোড যাচাই করতে সমস্যা হয়েছে।',
          'Could not verify the referral code.'
        );
      reportAppIssue({ source: 'ProUpgrade:Referral', severity: 'error', message: msg });
      setRefMessage({
        type: 'error',
        text: isAdmin
          ? msg
          : bi(
              'রেফার কোড যাচাই করতে সমস্যা হয়েছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।',
              'Could not verify referral code. Please try again later.'
            ),
      });
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
      setSubmitError(
        bi(
          'অনুগ্রহ করে আপনার পেমেন্ট নম্বরটি সঠিকভাবে লিখুন (কমপক্ষে ৪ অক্ষর)।',
          'Please enter your payment sender number properly (at least 4 characters).'
        )
      );
      return;
    }
    if (cleanTrx.length < 3) {
      setSubmitError(
        bi(
          'অনুগ্রহ করে আপনার Transaction ID / রেফারেন্স লিখুন।',
          'Please enter your Transaction ID / reference.'
        )
      );
      return;
    }
    if (!cleanAmount) {
      setSubmitError(
        bi('অনুগ্রহ করে পাঠানো টাকার পরিমাণ লিখুন।', 'Please enter the amount paid.')
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    const requestId = generateRequestId(user.uid);
    const reqPath = `proRequests/${requestId}`;
    const payload: Record<string, any> = {
      uid: user.uid.slice(0, 128),
      packageType: selectedPackage,
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
      if (isAdmin) setSubmitError(msg);
      else
        setSubmitError(
          bi(
            'রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
            'Failed to submit request. Please try again in a moment.'
          )
        );
      reportFirestoreError(err, OperationType.CREATE, reqPath);
    } finally {
      setSubmitting(false);
    }
  };

  const hasPending = myRequests.some((r) => r.status === 'pending');
  const canSubmitProUpgrade = !isAdmin && (userPlan === 'free' || proPackageType !== 'yearly');

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

      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-slide-up">
        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                {activeTab === 'refer' ? <Gift size={13} /> : <Crown size={13} />}
                <span>
                  {activeTab === 'refer'
                    ? bi('বন্ধুদের রেফার করুন • প্রতি জনে +১০ ক্রেডিট', 'Refer Friends • +10 Credits Each')
                    : bi('শ্রাবণ গো প্রো অ্যাক্সেস', 'Srabon Go Pro Access')}
                </span>
              </div>
              <h2
                id="pro-upgrade-title"
                className="text-2xl font-serif font-medium text-zinc-900 dark:text-white"
              >
                {activeTab === 'refer'
                  ? bi('বন্ধুদের রেফার করে ১০ ক্রেডিট করে নিন', 'Refer Friends & Earn 10 Credits Each')
                  : userPlan === 'pro' || isAdmin
                  ? bi('আপনার Pro অ্যাক্সেস সক্রিয় আছে', 'Your Pro Access is Active')
                  : bi('আনলিমিটেড ভয়েস স্টুডিও আনলক করুন', 'Unlock Unlimited Voice Studio')}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {userPlan === 'pro' || isAdmin
                  ? bi(
                      `আপনি আনলিমিটেড অ্যাক্সেস পাচ্ছেন। বোনাস ক্রেডিট: ${bonusCredits}`,
                      `You have unlimited access. Bonus credits: ${bonusCredits}`
                    )
                  : bi(
                      `আজকের ফ্রি ব্যবহার: ${usedToday} / ${billingConfig.freeDailyLimit} বার • বোনাস ক্রেডিট: ${bonusCredits} টি`,
                      `Free usage today: ${usedToday} / ${billingConfig.freeDailyLimit} • Bonus credits: ${bonusCredits}`
                    )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              aria-label={bi('বন্ধ করুন', 'Close')}
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
              <span>{bi('রেফার ও আর্ন (+১০ ক্রেডিট)', 'Refer & Earn (+10 Cr)')}</span>
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
              <span>{bi('Pro আনলক করুন', 'Unlock Pro')}</span>
            </button>
          </div>

          {/* TAB 1: REFER & EARN */}
          {activeTab === 'refer' && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    <Sparkles size={13} />
                    <span>{bi('মোট বোনাস ক্রেডিট', 'Total Bonus Credits')}</span>
                  </div>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1.5 tabular-nums">
                    {bonusCredits}{' '}
                    <span className="text-xs font-medium text-zinc-500">
                      {bi('ক্রেডিট', 'Credits')}
                    </span>
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/60">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <Users size={13} />
                    <span>{bi('সফল রেফার', 'Successful Referrals')}</span>
                  </div>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1 tabular-nums">
                    {referralCount}{' '}
                    <span className="text-xs font-medium text-zinc-500">
                      {bi('জন বন্ধু', 'Friends')}
                    </span>
                  </p>
                </div>
              </div>

              {/* Share Link Box */}
              <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 space-y-3">
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {bi(
                    <>
                      আপনার নিচের রেফার লিংক বা কোড বন্ধুদের মাঝে শেয়ার করুন। প্রতিটি নতুন বন্ধু এই লিংকে ঢুকে গুগল লগইন করলেই আপনি সাথে সাথে{' '}
                      <strong className="text-indigo-600 dark:text-indigo-400">১০টি করে ফ্রি ক্রেডিট</strong> পাবেন! দৈনিক ফ্রি লিমিট শেষ হলে এই ক্রেডিটগুলো স্বয়ংক্রিয়ভাবে ব্যবহার হবে।
                    </>,
                    <>
                      Share your referral link or code below with friends. Whenever a new friend signs in via your link, you immediately receive{' '}
                      <strong className="text-indigo-600 dark:text-indigo-400">10 free credits</strong>! These credits are used automatically after your daily free quota runs out.
                    </>
                  )}
                </p>

                {/* Referral Code */}
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                  <div className="space-y-0.5">
                    <span className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                      {bi('আপনার রেফার কোড', 'Your Referral Code')}
                    </span>
                    <span className="text-sm sm:text-base font-mono font-bold tracking-wider text-zinc-900 dark:text-white">
                      {referralCode || bi('তৈরি হচ্ছে...', 'Generating...')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyReferralCode}
                    disabled={!referralCode}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {copiedCode ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    <span>{copiedCode ? bi('কপি হয়েছে', 'Copied') : bi('কোড কপি', 'Copy Code')}</span>
                  </button>
                </div>

                {/* Referral Link */}
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <span className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                      {bi('আপনার রেফার লিংক', 'Your Referral Link')}
                    </span>
                    <span className="text-xs sm:text-sm font-mono text-zinc-700 dark:text-zinc-300 truncate block">
                      {referralLink || bi('লোড হচ্ছে...', 'Loading...')}
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
                      <span>{copiedLink ? bi('কপি হয়েছে', 'Copied') : bi('কপি', 'Copy')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleShareReferral}
                      disabled={!referralLink}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                    >
                      <Share2 size={13} />
                      <span>{bi('শেয়ার', 'Share')}</span>
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
                    {bi(
                      'কোনো বন্ধুর রেফার কোড থাকলে এখানে দিন (একবার ব্যবহারযোগ্য)',
                      'Have a friend’s referral code? Enter it here (one-time use)'
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="friend-ref-code"
                      type="text"
                      value={friendCodeInput}
                      onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase())}
                      maxLength={16}
                      placeholder={bi('যেমন: SRB7K9M2Q4', 'e.g. SRB7K9M2Q4')}
                      className="flex-1 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm font-mono uppercase text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                    />
                    <button
                      type="submit"
                      disabled={claimingRef || !friendCodeInput.trim()}
                      className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-indigo-600 hover:bg-zinc-800 dark:hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                    >
                      {claimingRef ? <Loader2 size={14} className="animate-spin" /> : bi('প্রয়োগ', 'Apply')}
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
                      {isAdmin
                        ? bi(
                            'Admin অ্যাকাউন্ট (আনলিমিটেড · ইয়ারলি স্টুডিও প্রো সুবিধা)',
                            'Admin Account (Unlimited · Yearly Studio Pro Perks)'
                          )
                        : proPackageType === 'yearly'
                        ? bi(
                            'Yearly Pro প্যাকেজ সক্রিয় (৩৬৫ দিন · সব প্রিমিয়াম সুবিধা)',
                            'Yearly Pro Package Active (365 Days · All Premium Perks)'
                          )
                        : bi('Monthly Pro প্যাকেজ সক্রিয় (৩০ দিন)', 'Monthly Pro Package Active (30 Days)')}
                    </p>
                    <p className="opacity-85">
                      {isAdmin || proPackageType === 'yearly'
                        ? bi(
                            'সর্বোচ্চ ৫,০০০ অক্ষর, প্লেব্যাক স্পিড, লাউড অ্যালার্ম বুস্ট, ৮টি ভয়েস স্টাইল ও ২৫টি স্ক্রিপ্ট সেভ চালু আছে',
                            '5,000 max characters, playback speed, loud alarm boost, 8 voice styles & 25 saved scripts enabled'
                          )
                        : bi(
                            'আপনি চাইলে নিচ থেকে Yearly প্যাকেজে আপগ্রেড করে ২× স্ক্রিপ্ট, স্পিড, বুস্ট ও প্রো স্টাইল চালু করতে পারেন',
                            'Upgrade to Yearly below to unlock 2× script length, speed, boost & pro styles'
                          )}
                      {proExpiresAtMs && proExpiresAtMs > Date.now() && !isAdmin
                        ? bi(
                            ` • মেয়াদ শেষ: ${localizeDate(proExpiresAtMs, lang)}`,
                            ` • Expires: ${localizeDate(proExpiresAtMs, lang)}`
                          )
                        : '.'}
                    </p>
                  </div>
                </div>
              )}

              {canSubmitProUpgrade && (
                <div className="space-y-3">
                  {/* Monthly / Yearly Package Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedPackage('monthly')}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 ${
                        selectedPackage === 'monthly'
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/40'
                          : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            {bi('মান্থলি', 'Monthly')}
                          </span>
                          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                            {bi('৩০ দিন মেয়াদ', '30 Days Validity')}
                          </span>
                        </div>
                        <p className="text-xl font-bold text-zinc-900 dark:text-white mt-1 tabular-nums">
                          {monthlyPrice}
                        </p>
                      </div>
                      <ul className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        <li>
                          • {STUDIO_TIER_LIMITS.monthly.maxScriptChars.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}{' '}
                          {bi('অক্ষর / স্ক্রিপ্ট', 'chars / script')}
                        </li>
                        <li>• {bi('৪টি স্ট্যান্ডার্ড ভয়েস স্টাইল', '4 standard voice styles')}</li>
                        <li>
                          • {STUDIO_TIER_LIMITS.monthly.maxSavedScripts}
                          {bi('টি কাস্টম স্ক্রিপ্ট সেভ', ' saved custom scripts')}
                        </li>
                        <li className="text-zinc-500 dark:text-zinc-400">
                          • {bi('সাধারণ স্পিড ও ফিক্সড ১.২স লুপ', 'Standard 1.0x speed & fixed 1.2s loop')}
                        </li>
                      </ul>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPackage('yearly')}
                      className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 ${
                        selectedPackage === 'yearly'
                          ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-500 ring-1 ring-amber-500/40'
                          : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                            {bi('ইয়ারলি (সেরা অফার)', 'Yearly (Best Value)')}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500 text-zinc-950">
                            {bi('৩৬৫ দিন', '365 Days')}
                          </span>
                        </div>
                        <p className="text-xl font-bold text-zinc-900 dark:text-white mt-1 tabular-nums">
                          {yearlyPrice}
                        </p>
                      </div>
                      <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-200 leading-relaxed">
                        <li>
                          •{' '}
                          <strong>
                            {STUDIO_TIER_LIMITS.yearly.maxScriptChars.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}{' '}
                            {bi('অক্ষর', 'chars')}
                          </strong>{' '}
                          {bi('/ স্ক্রিপ্ট (২× বড়)', '/ script (2× larger)')}
                        </li>
                        <li>
                          •{' '}
                          <strong>{bi('+৪টি এক্সক্লুসিভ স্টুডিও স্টাইল', '+4 exclusive studio styles')}</strong>{' '}
                          {bi('(মোট ৮টি)', '(8 total)')}
                        </li>
                        <li>
                          • <strong>{STUDIO_TIER_LIMITS.yearly.maxSavedScripts}{bi('টি', '')}</strong>{' '}
                          {bi('কাস্টম স্ক্রিপ্ট লাইব্রেরি', 'saved scripts library')}
                        </li>
                        <li>
                          •{' '}
                          <strong>
                            {bi(
                              'স্পিড (0.85x–1.25x), +৪০% বুস্ট ও কাস্টম লুপ',
                              'Speed (0.85x–1.25x), +40% boost & custom loop'
                            )}
                          </strong>
                        </li>
                      </ul>
                    </button>
                  </div>

                  <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 space-y-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          {selectedPackage === 'yearly'
                            ? bi('Yearly প্যাকেজ ফি (৩৬৫ দিন)', 'Yearly Package Fee (365 Days)')
                            : bi('Monthly প্যাকেজ ফি (৩০ দিন)', 'Monthly Package Fee (30 Days)')}
                        </p>
                        <p className="text-xl font-bold text-zinc-900 dark:text-white">
                          {selectedPackage === 'yearly' ? yearlyPrice : monthlyPrice}
                        </p>
                      </div>
                      <div className="text-right space-y-0.5">
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          {bi('পেমেন্ট মাধ্যম', 'Payment Method')}
                        </p>
                        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                          {billingConfig.paymentMethod}
                        </p>
                      </div>
                    </div>

                    {billingConfig.paymentAccount ? (
                      <div className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                        <div className="min-w-0 space-y-0.5">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 block">
                            {bi('পেমেন্ট নম্বর / অ্যাকাউন্ট', 'Payment Number / Account')}
                          </span>
                          <span className="text-sm sm:text-base font-mono font-semibold text-zinc-900 dark:text-white break-all">
                            {billingConfig.paymentAccount}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyAccount}
                          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        >
                          {copiedAccount ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                          <span>{copiedAccount ? bi('কপি হয়েছে', 'Copied') : bi('কপি', 'Copy')}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                        {bi(
                          'অ্যাডমিন এখনও পেমেন্ট নম্বর সেট করেননি। অ্যাডমিন প্যানেল থেকে পেমেন্ট নম্বর সেট করার পর এখানে দেখাবে।',
                          'Admin has not configured a payment number yet. Once set from the Admin Panel, it will appear here.'
                        )}
                      </div>
                    )}

                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      {lang === 'en' &&
                      billingConfig.instructions ===
                        'উপরের নম্বরে সেন্ড মানি / পেমেন্ট করে নিচের ফর্মে আপনার Transaction ID (TrxID) জমা দিন।'
                        ? 'Send Money / Pay to the account above and submit your Transaction ID (TrxID) in the form below.'
                        : billingConfig.instructions}
                    </p>
                  </div>
                </div>
              )}

              {canSubmitProUpgrade && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Sparkles size={15} className="text-indigo-500" />
                    <span>{bi('পেমেন্টের তথ্য জমা দিন', 'Submit Payment Details')}</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
                        {bi('পেমেন্ট মেথড', 'Payment Method')}
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m === 'Bank / Other' ? bi('ব্যাংক / অন্যান্য', 'Bank / Other') : m}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
                        {bi('পাঠানো টাকার পরিমাণ', 'Amount Sent')}
                      </label>
                      <input
                        type="text"
                        value={amountText}
                        onChange={(e) => setAmountText(e.target.value)}
                        maxLength={40}
                        placeholder={bi('যেমন: 50 BDT', 'e.g. 50 BDT')}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
                        {bi('যে নম্বর থেকে পাঠিয়েছেন', 'Sender Account / Number')}
                      </label>
                      <input
                        type="text"
                        value={senderNumber}
                        onChange={(e) => setSenderNumber(e.target.value)}
                        maxLength={30}
                        placeholder="01XXXXXXXXX"
                        className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
                        {bi('ট্রানজেকশন আইডি (TrxID)', 'Transaction ID (TrxID)')}
                      </label>
                      <input
                        type="text"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        maxLength={64}
                        placeholder={bi('যেমন: BGD9X2K10', 'e.g. BGD9X2K10')}
                        className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-1.5">
                      {bi('নোট (ঐচ্ছিক)', 'Note (Optional)')}
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={300}
                      placeholder={bi('অতিরিক্ত কোনো তথ্য থাকলে লিখুন...', 'Any additional notes...')}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
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
                      <span>
                        {bi(
                          'আপনার রিকোয়েস্ট জমা হয়েছে! অ্যাডমিন যাচাই করে অনুমোদন দিলেই Pro চালু হয়ে যাবে।',
                          'Your request has been submitted! Pro access activates once the admin verifies and approves it.'
                        )}
                      </span>
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
                        ? bi('একটি রিকোয়েস্ট পেন্ডিং রয়েছে...', 'A request is pending...')
                        : submitting
                        ? bi('জমা হচ্ছে...', 'Submitting...')
                        : bi('Pro আনলক রিকোয়েস্ট পাঠান', 'Submit Pro Unlock Request')}
                    </span>
                  </button>
                </form>
              )}

              {myRequests.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {bi('আপনার রিকোয়েস্টের অবস্থা', 'Your Request Status')}
                  </p>
                  <div className="space-y-2.5">
                    {myRequests.map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/70 text-xs sm:text-sm"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-medium text-zinc-900 dark:text-white truncate">
                            {req.packageType === 'yearly'
                              ? bi('Yearly (৩৬৫ দিন)', 'Yearly (365 Days)')
                              : bi('Monthly (৩০ দিন)', 'Monthly (30 Days)')}{' '}
                            • {req.paymentMethod} • TrxID: {req.transactionId}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {req.amountText} • {req.senderNumber}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                            req.status === 'approved'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : req.status === 'rejected'
                              ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {req.status === 'approved' ? (
                            <CheckCircle2 size={13} />
                          ) : req.status === 'rejected' ? (
                            <XCircle size={13} />
                          ) : (
                            <Clock size={13} />
                          )}
                          <span>{localizeUpgradeStatus(req.status, lang)}</span>
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
