/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useEffect, useState } from 'react';
import {
  X,
  Shield,
  Users,
  Receipt,
  Settings,
  CheckCircle2,
  XCircle,
  Crown,
  Loader2,
  Save,
  Globe,
  Scissors,
} from 'lucide-react';
import { normalizeApiBaseUrl, setDynamicApiBaseUrl, testApiHealthAtUrl } from '../utils/audio';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  BillingConfig,
  ProPackageType,
  ProUpgradeRequest,
  SalonBooking,
  SalonBookingStatus,
  SalonConfig,
  UserAccountRecord,
  UserPlan,
} from '../types';
import { SALON_SERVICES, formatSalonPrice } from '../utils/salon';

export type AdminPanelTab = 'requests' | 'users' | 'settings' | 'salon';

interface AdminPanelModalProps {
  billingConfig: BillingConfig;
  salonConfig: SalonConfig;
  initialTab?: AdminPanelTab;
  onClose: () => void;
}

function getTodayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  billingConfig,
  salonConfig,
  initialTab = 'requests',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<AdminPanelTab>(initialTab);
  const [requests, setRequests] = useState<ProUpgradeRequest[]>([]);
  const [usersList, setUsersList] = useState<UserAccountRecord[]>([]);
  const [salonBookings, setSalonBookings] = useState<SalonBooking[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Billing config form state
  const [feeAmount, setFeeAmount] = useState(billingConfig.feeAmount);
  const [monthlyFee, setMonthlyFee] = useState(billingConfig.monthlyFee || billingConfig.feeAmount);
  const [yearlyFee, setYearlyFee] = useState(billingConfig.yearlyFee || '480 BDT');
  const [paymentMethod, setPaymentMethod] = useState(billingConfig.paymentMethod);
  const [paymentAccount, setPaymentAccount] = useState(billingConfig.paymentAccount);
  const [instructions, setInstructions] = useState(billingConfig.instructions);
  const [freeDailyLimit, setFreeDailyLimit] = useState(String(billingConfig.freeDailyLimit));
  const [apiBaseUrl, setApiBaseUrl] = useState(billingConfig.apiBaseUrl || '');
  const [testingApi, setTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<'ok' | 'fail' | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Salon config form state
  const [salonName, setSalonName] = useState(salonConfig.salonName);
  const [currencySymbol, setCurrencySymbol] = useState(salonConfig.currencySymbol);
  const [haircutPrice, setHaircutPrice] = useState(String(salonConfig.haircutPrice));
  const [beardTrimPrice, setBeardTrimPrice] = useState(String(salonConfig.beardTrimPrice));
  const [shavePrice, setShavePrice] = useState(String(salonConfig.shavePrice));
  const [hairColorPrice, setHairColorPrice] = useState(String(salonConfig.hairColorPrice));
  const [facialPrice, setFacialPrice] = useState(String(salonConfig.facialPrice));
  const [comboPrice, setComboPrice] = useState(String(salonConfig.comboPrice));
  const [bookingFee, setBookingFee] = useState(String(salonConfig.bookingFee));
  const [salonAddress, setSalonAddress] = useState(salonConfig.address);
  const [salonPhone, setSalonPhone] = useState(salonConfig.phone);
  const [salonOpenHours, setSalonOpenHours] = useState(salonConfig.openHours);
  const [isBookingOpen, setIsBookingOpen] = useState(salonConfig.isBookingOpen);
  const [savingSalon, setSavingSalon] = useState(false);
  const [savedSalonBanner, setSavedSalonBanner] = useState(false);

  useEffect(() => {
    setFeeAmount(billingConfig.feeAmount);
    setMonthlyFee(billingConfig.monthlyFee || billingConfig.feeAmount);
    setYearlyFee(billingConfig.yearlyFee || '480 BDT');
    setPaymentMethod(billingConfig.paymentMethod);
    setPaymentAccount(billingConfig.paymentAccount);
    setInstructions(billingConfig.instructions);
    setFreeDailyLimit(String(billingConfig.freeDailyLimit));
    setApiBaseUrl(billingConfig.apiBaseUrl || '');
  }, [billingConfig]);

  useEffect(() => {
    setSalonName(salonConfig.salonName);
    setCurrencySymbol(salonConfig.currencySymbol);
    setHaircutPrice(String(salonConfig.haircutPrice));
    setBeardTrimPrice(String(salonConfig.beardTrimPrice));
    setShavePrice(String(salonConfig.shavePrice));
    setHairColorPrice(String(salonConfig.hairColorPrice));
    setFacialPrice(String(salonConfig.facialPrice));
    setComboPrice(String(salonConfig.comboPrice));
    setBookingFee(String(salonConfig.bookingFee));
    setSalonAddress(salonConfig.address);
    setSalonPhone(salonConfig.phone);
    setSalonOpenHours(salonConfig.openHours);
    setIsBookingOpen(salonConfig.isBookingOpen);
  }, [salonConfig]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const unsubReqs = onSnapshot(
      collection(db, 'proRequests'),
      (snapshot) => {
        const list: ProUpgradeRequest[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ProUpgradeRequest, 'id'>),
        }));
        list.sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (a.status !== 'pending' && b.status === 'pending') return 1;
          const at = a.createdAt?.toMillis?.() ?? 0;
          const bt = b.createdAt?.toMillis?.() ?? 0;
          return bt - at;
        });
        setRequests(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'proRequests');
      }
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list: UserAccountRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            displayName: data?.displayName,
            email: data?.email,
            photoURL: data?.photoURL,
            plan: data?.plan === 'pro' ? 'pro' : 'free',
            proPackageType:
              data?.proPackageType === 'yearly' || data?.proPackageType === 'monthly'
                ? data.proPackageType
                : undefined,
            proExpiresAt: data?.proExpiresAt,
            dailyCount: typeof data?.dailyCount === 'number' ? data.dailyCount : 0,
            lastUsageDate: typeof data?.lastUsageDate === 'string' ? data.lastUsageDate : getTodayUtcDate(),
            favorites: Array.isArray(data?.favorites) ? data.favorites : [],
            referralCode: typeof data?.referralCode === 'string' ? data.referralCode : undefined,
            bonusCredits: typeof data?.bonusCredits === 'number' ? data.bonusCredits : 0,
            referralCount: typeof data?.referralCount === 'number' ? data.referralCount : 0,
          };
        });
        setUsersList(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    );

    const unsubSalonBookings = onSnapshot(
      collection(db, 'salonBookings'),
      (snapshot) => {
        const list: SalonBooking[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SalonBooking, 'id'>),
        }));
        list.sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (a.status !== 'pending' && b.status === 'pending') return 1;
          const at = a.createdAt?.toMillis?.() ?? 0;
          const bt = b.createdAt?.toMillis?.() ?? 0;
          return bt - at;
        });
        setSalonBookings(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'salonBookings');
      }
    );

    return () => {
      unsubReqs();
      unsubUsers();
      unsubSalonBookings();
    };
  }, []);

  const handleApproveRequest = async (req: ProUpgradeRequest) => {
    if (busyId) return;
    setBusyId(req.id);
    const reqRef = doc(db, 'proRequests', req.id);
    const userRef = doc(db, 'users', req.uid);

    try {
      const userSnap = await getDoc(userRef);
      const batch = writeBatch(db);
      batch.update(reqRef, {
        status: 'approved',
        updatedAt: serverTimestamp(),
      });

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const pkg: ProPackageType = req.packageType === 'yearly' ? 'yearly' : 'monthly';
        const durationDays = pkg === 'yearly' ? 365 : 30;
        const userUpdate: Record<string, any> = {
          plan: 'pro',
          proPackageType: pkg,
          proExpiresAt: Timestamp.fromMillis(Date.now() + durationDays * 86_400_000),
          updatedAt: serverTimestamp(),
        };
        if (typeof userData?.dailyCount !== 'number') userUpdate.dailyCount = 0;
        if (typeof userData?.lastUsageDate !== 'string') {
          userUpdate.lastUsageDate = getTodayUtcDate();
        }
        batch.update(userRef, userUpdate);
      }

      await batch.commit();
    } catch (error: any) {
      setActionError(error?.message || 'Pro request অনুমোদন করা যায়নি।');
      handleFirestoreError(error, OperationType.UPDATE, `proRequests/${req.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectRequest = async (req: ProUpgradeRequest) => {
    if (busyId) return;
    setBusyId(req.id);
    try {
      await updateDoc(doc(db, 'proRequests', req.id), {
        status: 'rejected',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `proRequests/${req.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleSetUserPackage = async (
    target: UserAccountRecord,
    nextPlan: UserPlan,
    pkg?: ProPackageType
  ) => {
    if (busyId) return;
    setBusyId(pkg ? `${target.uid}_${pkg}` : target.uid);
    const userRef = doc(db, 'users', target.uid);

    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const existingData = userSnap.data();
        const payload: Record<string, any> = {
          plan: nextPlan,
          updatedAt: serverTimestamp(),
        };
        if (nextPlan === 'pro' && pkg) {
          const durationDays = pkg === 'yearly' ? 365 : 30;
          payload.proPackageType = pkg;
          payload.proExpiresAt = Timestamp.fromMillis(Date.now() + durationDays * 86_400_000);
        }
        if (typeof existingData?.dailyCount !== 'number') payload.dailyCount = 0;
        if (typeof existingData?.lastUsageDate !== 'string') {
          payload.lastUsageDate = getTodayUtcDate();
        }
        await updateDoc(userRef, payload);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${target.uid}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleGrantTenCredits = async (target: UserAccountRecord) => {
    if (busyId) return;
    setBusyId(`cr_${target.uid}`);
    const userRef = doc(db, 'users', target.uid);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const existingData = userSnap.data();
        const currentCredits = typeof existingData?.bonusCredits === 'number' ? existingData.bonusCredits : 0;
        const payload: Record<string, any> = {
          bonusCredits: currentCredits + 10,
          updatedAt: serverTimestamp(),
        };
        if (typeof existingData?.plan !== 'string') payload.plan = 'free';
        if (typeof existingData?.dailyCount !== 'number') payload.dailyCount = 0;
        if (typeof existingData?.lastUsageDate !== 'string') {
          payload.lastUsageDate = getTodayUtcDate();
        }
        await updateDoc(userRef, payload);
      }
    } catch (error: any) {
      setActionError(error?.message || 'বোনাস ক্রেডিট যোগ করা যায়নি।');
      handleFirestoreError(error, OperationType.UPDATE, `users/${target.uid}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleTestApiConnection = async () => {
    if (testingApi) return;
    setActionError(null);
    setApiTestResult(null);
    const cleaned = normalizeApiBaseUrl(apiBaseUrl);
    if (apiBaseUrl.trim() && !cleaned) {
      setActionError('সঠিক https:// বা http:// ব্যাকএন্ড সার্ভার URL দিন (যেমন https://srabon-go-api.onrender.com)।');
      return;
    }
    setTestingApi(true);
    try {
      const ok = await testApiHealthAtUrl(cleaned);
      setApiTestResult(ok ? 'ok' : 'fail');
    } finally {
      setTestingApi(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingConfig) return;
    setActionError(null);

    const rawApiUrl = apiBaseUrl.trim().replace(/\/+$/, '');
    const cleanApiUrl = normalizeApiBaseUrl(rawApiUrl);
    if (rawApiUrl && !cleanApiUrl) {
      setActionError('সঠিক https:// বা http:// সার্ভার URL দিন (স্পেস বা query ছাড়া, যেমন https://srabon-go-api.onrender.com)।');
      return;
    }

    setSavingConfig(true);
    setSavedBanner(false);

    const parsedLimit = Math.min(100, Math.max(1, parseInt(freeDailyLimit, 10) || 5));
    const cleanMonthlyFee = (monthlyFee.trim() || feeAmount.trim() || '50 BDT').slice(0, 40);
    const cleanYearlyFee = (yearlyFee.trim() || '480 BDT').slice(0, 40);
    const payload = {
      feeAmount: cleanMonthlyFee,
      monthlyFee: cleanMonthlyFee,
      yearlyFee: cleanYearlyFee,
      paymentMethod: (paymentMethod.trim() || 'bKash / Nagad').slice(0, 60),
      paymentAccount: paymentAccount.trim().slice(0, 80),
      instructions: (instructions.trim() || 'Send the Pro unlock fee and submit your TrxID below.').slice(0, 500),
      freeDailyLimit: parsedLimit,
      apiBaseUrl: cleanApiUrl,
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'appConfig', 'proPlan'), payload);
      setDynamicApiBaseUrl(cleanApiUrl);
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 2500);
    } catch (error: any) {
      setActionError(error?.message || 'সেটিংস সেভ করা যায়নি।');
      handleFirestoreError(error, OperationType.WRITE, 'appConfig/proPlan');
    } finally {
      setSavingConfig(false);
    }
  };

  const parsePriceInput = (val: string, fallback: number): number => {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(50000, Math.max(0, n));
  };

  const handleSaveSalonConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingSalon) return;
    setActionError(null);
    setSavingSalon(true);
    setSavedSalonBanner(false);

    const payload = {
      salonName: (salonName.trim() || 'Jagannath gents parlour and salon').slice(0, 100),
      currencySymbol: (currencySymbol.trim() || '৳').slice(0, 10),
      haircutPrice: parsePriceInput(haircutPrice, salonConfig.haircutPrice),
      beardTrimPrice: parsePriceInput(beardTrimPrice, salonConfig.beardTrimPrice),
      shavePrice: parsePriceInput(shavePrice, salonConfig.shavePrice),
      hairColorPrice: parsePriceInput(hairColorPrice, salonConfig.hairColorPrice),
      facialPrice: parsePriceInput(facialPrice, salonConfig.facialPrice),
      comboPrice: parsePriceInput(comboPrice, salonConfig.comboPrice),
      bookingFee: parsePriceInput(bookingFee, salonConfig.bookingFee),
      address: salonAddress.trim().slice(0, 200),
      phone: salonPhone.trim().slice(0, 30),
      openHours: (salonOpenHours.trim() || 'সকাল ৯:০০ টা – রাত ১০:০০ টা').slice(0, 80),
      isBookingOpen: Boolean(isBookingOpen),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'salonConfig', 'default'), payload);
      setSavedSalonBanner(true);
      setTimeout(() => setSavedSalonBanner(false), 2500);
    } catch (error: any) {
      setActionError(error?.message || 'সেলুনের প্রাইস ও সেটিংস সেভ করা যায়নি।');
      handleFirestoreError(error, OperationType.WRITE, 'salonConfig/default');
    } finally {
      setSavingSalon(false);
    }
  };

  const handleUpdateBookingStatus = async (
    bookingId: string,
    nextStatus: SalonBookingStatus
  ) => {
    if (busyId) return;
    setBusyId(`bk_${bookingId}`);
    setActionError(null);
    try {
      await updateDoc(doc(db, 'salonBookings', bookingId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error: any) {
      setActionError(error?.message || 'বুকিং স্ট্যাটাস আপডেট করা যায়নি।');
      handleFirestoreError(error, OperationType.UPDATE, `salonBookings/${bookingId}`);
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const pendingSalonCount = salonBookings.filter((b) => b.status === 'pending').length;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-panel-title"
    >
      <div
        className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Shield size={18} />
            </div>
            <div>
              <h2
                id="admin-panel-title"
                className="text-lg font-serif font-medium text-zinc-900 dark:text-white"
              >
                Srabon Go Admin Control
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Manage Pro requests, users, and payment fee settings
              </p>
            </div>
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

        {/* Tabs */}
        <div className="px-6 pt-3 border-b border-zinc-100 dark:border-zinc-800 flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'requests'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Receipt size={14} />
            <span>Pro Requests</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'users'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Users size={14} />
            <span>Users ({usersList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'settings'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Settings size={14} />
            <span>Fee & Quota Settings</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('salon')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'salon'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Scissors size={14} />
            <span>Salon &amp; Prices</span>
            {pendingSalonCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                {pendingSalonCount}
              </span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {actionError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-300 flex items-center justify-between gap-2">
              <span>{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="underline font-semibold shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}
          {activeTab === 'requests' && (
            <div className="space-y-3">
              {requests.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-10">
                  এখনও কোনো Pro আপগ্রেড রিকোয়েস্ট আসেনি।
                </p>
              ) : (
                requests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                          {req.userName || req.userEmail || req.uid}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            req.packageType === 'yearly'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                              : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                          }`}
                        >
                          {req.packageType === 'yearly' ? 'Yearly (365d)' : 'Monthly (30d)'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            req.status === 'approved'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : req.status === 'rejected'
                              ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      {req.userEmail && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                          {req.userEmail}
                        </p>
                      )}
                      <p className="text-xs text-zinc-700 dark:text-zinc-300">
                        <strong>{req.paymentMethod}</strong> • {req.amountText} • Sender:{' '}
                        <span className="font-mono">{req.senderNumber}</span> • TrxID:{' '}
                        <span className="font-mono font-semibold">{req.transactionId}</span>
                      </p>
                      {req.note && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                          "{req.note}"
                        </p>
                      )}
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleApproveRequest(req)}
                          disabled={busyId === req.id}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          {busyId === req.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                          <span>Approve Pro</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectRequest(req)}
                          disabled={busyId === req.id}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-700 hover:bg-red-100 dark:hover:bg-red-950/60 text-zinc-700 dark:text-zinc-200 hover:text-red-600 dark:hover:text-red-300 text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          <XCircle size={14} />
                          <span>Reject</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-2.5">
              {usersList.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-10">
                  এখনও কোনো ইউজার নেই।
                </p>
              ) : (
                usersList.map((u) => (
                  <div
                    key={u.uid}
                    className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                          {u.displayName || u.email || u.uid}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            u.plan === 'pro'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                          }`}
                        >
                          {u.plan === 'pro' && u.proPackageType
                            ? `${u.proPackageType} pro`
                            : u.plan}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {u.email || u.uid} • Usage ({u.lastUsageDate}): {u.dailyCount} • Credits: {u.bonusCredits ?? 0} • Refs: {u.referralCount ?? 0}
                        {u.plan === 'pro' && typeof u.proExpiresAt?.toMillis === 'function'
                          ? ` • Exp: ${new Date(u.proExpiresAt.toMillis()).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}`
                          : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleGrantTenCredits(u)}
                        disabled={busyId === `cr_${u.uid}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-semibold transition-colors disabled:opacity-50"
                        title="Add +10 Bonus Credits"
                      >
                        {busyId === `cr_${u.uid}` ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <span>+10 Cr</span>
                        )}
                      </button>
                      {u.plan === 'pro' ? (
                        <button
                          type="button"
                          onClick={() => handleSetUserPackage(u, 'free')}
                          disabled={busyId === u.uid}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                        >
                          {busyId === u.uid ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Crown size={13} />
                          )}
                          <span>Set Free</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSetUserPackage(u, 'pro', 'monthly')}
                            disabled={Boolean(busyId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 bg-indigo-600 hover:bg-indigo-500 text-white"
                          >
                            {busyId === `${u.uid}_monthly` ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Crown size={12} />
                            )}
                            <span>Monthly</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetUserPackage(u, 'pro', 'yearly')}
                            disabled={Boolean(busyId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 bg-amber-600 hover:bg-amber-500 text-white"
                          >
                            {busyId === `${u.uid}_yearly` ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Crown size={12} />
                            )}
                            <span>Yearly</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
                    Monthly প্যাকেজ ফি (৩০ দিন)
                  </label>
                  <input
                    type="text"
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(e.target.value)}
                    maxLength={40}
                    placeholder="e.g. 50 BDT"
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                    Yearly প্যাকেজ ফি (৩৬৫ দিন)
                  </label>
                  <input
                    type="text"
                    value={yearlyFee}
                    onChange={(e) => setYearlyFee(e.target.value)}
                    maxLength={40}
                    placeholder="e.g. 480 BDT"
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    ফ্রি দৈনিক লিমিট (১ - ১০০)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={freeDailyLimit}
                    onChange={(e) => setFreeDailyLimit(e.target.value)}
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    পেমেন্ট মাধ্যম (Payment Method)
                  </label>
                  <input
                    type="text"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    maxLength={60}
                    placeholder="e.g. bKash / Nagad Personal"
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                    আপনার পেমেন্ট নম্বর / অ্যাকাউন্ট
                  </label>
                  <input
                    type="text"
                    value={paymentAccount}
                    onChange={(e) => setPaymentAccount(e.target.value)}
                    maxLength={80}
                    placeholder="01XXXXXXXXX"
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                  ইউজারদের জন্য নির্দেশনা (Instructions)
                </label>
                <textarea
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  maxLength={500}
                  className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white resize-none"
                />
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/25 border border-indigo-200/80 dark:border-indigo-900/60 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  <Globe size={14} />
                  <span>Dynamic Backend API URL (GitHub Pages Bridge)</span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  GitHub Pages স্ট্যাটিক হোস্ট হলেও, এখানে আপনার লাইভ Node/Render সার্ভার URL সেভ করলে সব ইউজারের জন্য সাথে সাথে রিয়েল-টাইম Gemini ভয়েস ও AI ট্রেন্ডিং আইডিয়া ডায়নামিকভাবে চালু হয়ে যাবে (কোড রিবিল্ড ছাড়াই)।
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={apiBaseUrl}
                    onChange={(e) => {
                      setApiBaseUrl(e.target.value);
                      setApiTestResult(null);
                    }}
                    maxLength={200}
                    placeholder="https://srabon-go-api.onrender.com"
                    className="flex-1 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleTestApiConnection}
                    disabled={testingApi}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    {testingApi ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
                {apiTestResult === 'ok' && (
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    ✓ সার্ভার সফলভাবে সংযুক্ত আছে (/api/health OK)! এখন Save বাটনে চাপুন।
                  </p>
                )}
                {apiTestResult === 'fail' && (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">
                    ✕ এই URL-এ /api/health পাওয়া যায়নি। Render/Node সার্ভার চালু আছে কি না ও সঠিক URL দিয়েছেন কি না যাচাই করুন।
                  </p>
                )}
              </div>

              {savedBanner && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 size={15} />
                  <span>সেটিংস সফলভাবে সেভ হয়েছে!</span>
                </div>
              )}

              <button
                type="submit"
                disabled={savingConfig}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-indigo-600 hover:bg-zinc-800 dark:hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {savingConfig ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                <span>সেটিংস সেভ করুন</span>
              </button>
            </form>
          )}

          {activeTab === 'salon' && (
            <div className="space-y-6">
              <form onSubmit={handleSaveSalonConfig} className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                      সেলুন সার্ভিস ও বুকিং প্রাইস সেটিংস
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      এখান থেকে বুকিং ফি ও প্রতিটি হেয়ারকাট/গ্রুমিং সার্ভিসের দাম পরিবর্তন করলে সাথে সাথে সব ইউজারের পেজে আপডেট হবে।
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isBookingOpen}
                      onChange={(e) => setIsBookingOpen(e.target.checked)}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-amber-600 focus:ring-amber-500"
                    />
                    <span>অনলাইন বুকিং চালু রাখুন</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                      সেলুনের নাম (Salon Name)
                    </label>
                    <input
                      type="text"
                      value={salonName}
                      onChange={(e) => setSalonName(e.target.value)}
                      maxLength={100}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                        কারেন্সি (৳ / BDT)
                      </label>
                      <input
                        type="text"
                        value={currencySymbol}
                        onChange={(e) => setCurrencySymbol(e.target.value)}
                        maxLength={10}
                        placeholder="৳"
                        className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                        বুকিং ফি (Booking Fee)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={50000}
                        value={bookingFee}
                        onChange={(e) => setBookingFee(e.target.value)}
                        className="w-full rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 px-3 py-2 text-sm font-semibold text-zinc-900 dark:text-white tabular-nums"
                      />
                    </div>
                  </div>
                </div>

                {/* Service Prices Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                      01. {SALON_SERVICES[0].title}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50000}
                      value={haircutPrice}
                      onChange={(e) => setHaircutPrice(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                      02. {SALON_SERVICES[1].title}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50000}
                      value={beardTrimPrice}
                      onChange={(e) => setBeardTrimPrice(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                      03. {SALON_SERVICES[2].title}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50000}
                      value={shavePrice}
                      onChange={(e) => setShavePrice(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                      04. {SALON_SERVICES[3].title}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50000}
                      value={hairColorPrice}
                      onChange={(e) => setHairColorPrice(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                      05. {SALON_SERVICES[4].title}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50000}
                      value={facialPrice}
                      onChange={(e) => setFacialPrice(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                      06. {SALON_SERVICES[5].title}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50000}
                      value={comboPrice}
                      onChange={(e) => setComboPrice(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white tabular-nums"
                    />
                  </div>
                </div>

                {/* Location / Phone / Hours */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                      ঠিকানা (Address)
                    </label>
                    <input
                      type="text"
                      value={salonAddress}
                      onChange={(e) => setSalonAddress(e.target.value)}
                      maxLength={200}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                      ফোন / WhatsApp নম্বর
                    </label>
                    <input
                      type="text"
                      value={salonPhone}
                      onChange={(e) => setSalonPhone(e.target.value)}
                      maxLength={30}
                      placeholder="017XXXXXXXX"
                      className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">
                      খোলা থাকার সময় (Hours)
                    </label>
                    <input
                      type="text"
                      value={salonOpenHours}
                      onChange={(e) => setSalonOpenHours(e.target.value)}
                      maxLength={80}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>

                {savedSalonBanner && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 size={15} />
                    <span>সেলুনের নতুন প্রাইস ও তথ্য সফলভাবে সেভ হয়েছে!</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingSalon}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {savingSalon ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  <span>সেলুন প্রাইস সেভ করুন</span>
                </button>
              </form>

              {/* Salon Bookings Queue */}
              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                    কাস্টমার বুকিং তালিকা ({salonBookings.length})
                  </h4>
                </div>

                {salonBookings.length === 0 ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 py-6 text-center">
                    এখনও কোনো সেলুন বুকিং আসেনি।
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {salonBookings.map((b) => (
                      <div
                        key={b.id}
                        className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                              {b.customerName}
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                              ({b.customerPhone})
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                b.status === 'confirmed'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : b.status === 'completed'
                                  ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                                  : b.status === 'cancelled'
                                  ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {b.status}
                            </span>
                            {b.couponCode && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                                AI Coupon: {b.couponCode}
                                {typeof b.discountPercent === 'number' ? ` (-${b.discountPercent}%)` : ''}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-700 dark:text-zinc-300 tabular-nums">
                            <strong>{b.serviceTitle}</strong> · {b.bookingDate} ({b.timeSlot}) · বিল:{' '}
                            {formatSalonPrice(b.totalPrice, currencySymbol || salonConfig.currencySymbol)}
                            {typeof b.discountAmount === 'number' && b.discountAmount > 0 && (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {' '}(ছাড়: -{formatSalonPrice(b.discountAmount, currencySymbol || salonConfig.currencySymbol)})
                              </span>
                            )}
                          </p>
                          {b.notes && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                              নোট: {b.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {b.status === 'pending' && (
                            <button
                              type="button"
                              disabled={busyId === `bk_${b.id}`}
                              onClick={() => handleUpdateBookingStatus(b.id, 'confirmed')}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              Confirm
                            </button>
                          )}
                          {(b.status === 'pending' || b.status === 'confirmed') && (
                            <button
                              type="button"
                              disabled={busyId === `bk_${b.id}`}
                              onClick={() => handleUpdateBookingStatus(b.id, 'completed')}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              Complete
                            </button>
                          )}
                          {(b.status === 'pending' || b.status === 'confirmed') && (
                            <button
                              type="button"
                              disabled={busyId === `bk_${b.id}`}
                              onClick={() => handleUpdateBookingStatus(b.id, 'cancelled')}
                              className="px-3 py-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-700 hover:bg-red-100 dark:hover:bg-red-950/60 text-zinc-700 dark:text-zinc-200 hover:text-red-600 dark:hover:text-red-300 text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanelModal;
