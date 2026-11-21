/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { VOICE_DATA } from './constants';
import Carousel3D from './components/Carousel3D';
import GridView from './components/GridView';
import FilterBar from './components/FilterBar';
import VoiceFinder from './components/VoiceFinder';
import AiResultCard from './components/AiResultCard';
import TtsStudio from './components/TtsStudio';
import TrendingIdeas from './components/TrendingIdeas';
import HomePage from './components/HomePage';
import SalonBookingPage from './components/SalonBookingPage';
import GoogleLoginGate from './components/GoogleLoginGate';
import ProUpgradeModal from './components/ProUpgradeModal';
import AdminPanelModal, { AdminPanelTab } from './components/AdminPanelModal';
import AdminNotificationsBox from './components/AdminNotificationsBox';
import ChatHubModal from './components/ChatHubModal';
import SiteLegalModal, { LegalTab } from './components/SiteLegalModal';
import { AppIssueRecord, AppViewMode, FilterState, AiRecommendation, BillingConfig, ProPackageType, SalonConfig, UserPlan } from './types';
import { Info, Heart, Loader2, Bell, AlertTriangle, X, MessageSquare } from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { auth, db, signOutUser, handleFirestoreError, OperationType } from './firebase';
import { initGoogleAdsTag } from './utils/googleAds';
import { setDynamicApiBaseUrl } from './utils/audio';
import { isBenignAppIssueNoise, reportAppIssue, subscribeSessionIssues } from './utils/appIssues';
import { DEFAULT_SALON_CONFIG, sanitizeSalonConfig } from './utils/salon';
import {
  buildReferralCode,
  capturePendingReferralFromUrl,
  claimReferralCode,
  clearPendingReferral,
  ensureReferralCodeRegistered,
  hasUserClaimedReferral,
} from './utils/referral';

const ADMIN_EMAIL = 'srabon10010@gmail.com';

const DEFAULT_BILLING_CONFIG: BillingConfig = {
  feeAmount: '50 BDT',
  monthlyFee: '50 BDT',
  yearlyFee: '480 BDT',
  paymentMethod: 'bKash / Nagad',
  paymentAccount: '',
  instructions:
    'উপরের নম্বরে নির্বাচিত প্যাকেজ অনুযায়ী ফি পাঠিয়ে নিচের ফর্মে আপনার নম্বর ও Transaction ID (TrxID) জমা দিন। অ্যাডমিন যাচাই করেই প্যাকেজ চালু করে দেবেন।',
  freeDailyLimit: 5,
  apiBaseUrl: '',
};

function getTodayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const FAVORITES_STORAGE_KEY = 'gemini-voice-favorites';

function sanitizeFavorites(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item === 'string') {
      const trimmed = item.trim().slice(0, 64);
      if (trimmed.length >= 1 && !seen.has(trimmed)) {
        seen.add(trimmed);
        out.push(trimmed);
      }
    }
    if (out.length >= 50) break;
  }
  return out;
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiRecommendation | null>(null);
  const [isAiCardVisible, setIsAiCardVisible] = useState(false);
  const [showVoiceFinder, setShowVoiceFinder] = useState(false);
  const [viewMode, setViewMode] = useState<AppViewMode>('home');
  const [studioVoiceName, setStudioVoiceName] = useState<string>('Kore');
  const [studioDraft, setStudioDraft] = useState<{ text: string; style: string; revision: number } | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [userPlan, setUserPlan] = useState<UserPlan>('free');
  const [proPackageType, setProPackageType] = useState<ProPackageType | null>(null);
  const [proExpiresAtMs, setProExpiresAtMs] = useState<number | null>(null);
  const [dailyCount, setDailyCount] = useState<number>(0);
  const [lastUsageDate, setLastUsageDate] = useState<string>(getTodayUtcDate());
  const [billingConfig, setBillingConfig] = useState<BillingConfig>(DEFAULT_BILLING_CONFIG);
  const [salonConfig, setSalonConfig] = useState<SalonConfig>(DEFAULT_SALON_CONFIG);
  const [showProModal, setShowProModal] = useState(false);
  const [proModalTab, setProModalTab] = useState<'refer' | 'pro'>('refer');
  const [proSelectedPackage, setProSelectedPackage] = useState<ProPackageType>('monthly');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState<AdminPanelTab>('requests');
  const [showAdminNotifications, setShowAdminNotifications] = useState(false);
  const [showChatHub, setShowChatHub] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [floatingNoticeHidden, setFloatingNoticeHidden] = useState(false);
  const [sessionIssues, setSessionIssues] = useState<AppIssueRecord[]>([]);
  const [firestoreIssues, setFirestoreIssues] = useState<AppIssueRecord[]>([]);
  const cleanedObsoleteIssueIdsRef = useRef<Set<string>>(new Set());
  const [referralCode, setReferralCode] = useState<string>('');
  const [bonusCredits, setBonusCredits] = useState<number>(0);
  const [referralCount, setReferralCount] = useState<number>(0);
  const [alreadyClaimedReferral, setAlreadyClaimedReferral] = useState<boolean>(false);
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem('srabon_theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  });

  const isAdmin = Boolean(
    user?.emailVerified && user?.email?.toLowerCase() === ADMIN_EMAIL
  );
  const isProSubscriptionActive =
    userPlan === 'pro' && (!proExpiresAtMs || proExpiresAtMs > Date.now());
  const effectiveUserPlan: UserPlan = isProSubscriptionActive ? 'pro' : 'free';
  const todayStr = getTodayUtcDate();
  const effectiveUsedToday = lastUsageDate === todayStr ? dailyCount : 0;
  
  // Carousel state
  const [activeIndex, setActiveIndex] = useState(0);

  const [filters, setFilters] = useState<FilterState>({
    gender: 'All',
    pitch: 'All',
    search: '',
  });

  // Firebase Auth listener + capture pending ?ref= before login
  useEffect(() => {
    initGoogleAdsTag();
    capturePendingReferralFromUrl();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Global silent error/issue collector -> sends all app problems exclusively to Admin Notification Box
  useEffect(() => {
    const unsubSession = subscribeSessionIssues(setSessionIssues);

    const onCustomIssue = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (!detail || typeof detail.message !== 'string') return;
      reportAppIssue({
        source: typeof detail.source === 'string' ? detail.source : 'App',
        severity: detail.severity === 'warning' ? 'warning' : 'error',
        message: detail.message,
        details: typeof detail.details === 'string' ? detail.details : undefined,
      });
    };

    const extractReasonInfo = (reason: unknown): { message: string; name: string } => {
      const name = typeof (reason as any)?.name === 'string' ? (reason as any).name : '';
      const rawMsg =
        reason instanceof Error
          ? reason.message
          : typeof (reason as any)?.message === 'string'
          ? (reason as any).message
          : typeof reason === 'string'
          ? reason
          : reason != null
          ? String(reason)
          : '';
      return {
        name,
        message: rawMsg.trim() || 'Unhandled promise rejection',
      };
    };

    const onWindowError = (event: ErrorEvent) => {
      const errName = typeof (event?.error as any)?.name === 'string' ? (event.error as any).name : '';
      const message = event?.message || event?.error?.message || 'Unexpected runtime error';
      if (isBenignAppIssueNoise(message, errName)) {
        return;
      }
      reportAppIssue({
        source: 'Runtime',
        severity: 'error',
        message,
        details: event?.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const { message, name } = extractReasonInfo(event?.reason);
      if (isBenignAppIssueNoise(message, name)) {
        event.preventDefault();
        return;
      }
      reportAppIssue({
        source: 'AsyncTask',
        severity: 'error',
        message,
      });
    };

    window.addEventListener('srabon:app-issue', onCustomIssue);
    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      unsubSession();
      window.removeEventListener('srabon:app-issue', onCustomIssue);
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  // Admin-only real-time listener for Firestore /appIssues notification box
  useEffect(() => {
    if (!authReady || !user || !isAdmin) {
      setFirestoreIssues([]);
      return;
    }

    const unsubIssues = onSnapshot(
      collection(db, 'appIssues'),
      (snapshot) => {
        const items: AppIssueRecord[] = [];
        for (const d of snapshot.docs) {
          const data = d.data() as Omit<AppIssueRecord, 'id'>;
          if (isBenignAppIssueNoise(data?.message)) {
            if (!cleanedObsoleteIssueIdsRef.current.has(d.id)) {
              cleanedObsoleteIssueIdsRef.current.add(d.id);
              deleteDoc(doc(db, 'appIssues', d.id)).catch(() => {});
            }
            continue;
          }
          items.push({
            id: d.id,
            ...data,
            origin: 'firestore',
          });
        }
        setFirestoreIssues(items);
      },
      (err) => {
        console.error('Failed to subscribe to appIssues:', err);
      }
    );

    return () => unsubIssues();
  }, [authReady, user, isAdmin]);

  // Real-time unread count listener for Global Chat Hub (admin feedback threads)
  useEffect(() => {
    if (!authReady || !user) {
      setUnreadChatCount(0);
      return;
    }

    const safeUid = user.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
    if (!safeUid) return;

    const threadsQuery = isAdmin
      ? collection(db, 'adminFeedbackThreads')
      : query(collection(db, 'adminFeedbackThreads'), where('uid', '==', safeUid));

    const unsubChat = onSnapshot(
      threadsQuery,
      (snapshot) => {
        let unread = 0;
        snapshot.forEach((d) => {
          const data = d.data();
          if (isAdmin ? data?.unreadByAdmin : data?.unreadByUser) {
            unread += 1;
          }
        });
        setUnreadChatCount(unread);
      },
      (error) => {
        reportAppIssue({
          source: 'ChatHub:UnreadSync',
          severity: 'warning',
          message: error?.message || 'Failed to sync unread chat count',
        });
      }
    );

    return () => unsubChat();
  }, [authReady, user, isAdmin]);

  // Firestore user preferences & favorites sync (only when authenticated)
  useEffect(() => {
    if (!authReady || !user) return;

    const userStorageKey = `${FAVORITES_STORAGE_KEY}:${user.uid}`;
    try {
      const saved = localStorage.getItem(userStorageKey);
      if (saved) {
        setFavorites(sanitizeFavorites(JSON.parse(saved)));
      }
    } catch {}

    const userPath = `users/${user.uid}`;
    const userRef = doc(db, 'users', user.uid);
    let initializedDoc = false;
    let isMigratingSchema = false;
    let registeredCodeForUid = false;
    let checkedClaimForUid = false;

    const handleReferralLifecycle = async (myCode: string) => {
      if (!registeredCodeForUid) {
        registeredCodeForUid = true;
        await ensureReferralCodeRegistered(user.uid, myCode);
      }
      if (!checkedClaimForUid) {
        checkedClaimForUid = true;
        const claimed = await hasUserClaimedReferral(user.uid);
        setAlreadyClaimedReferral(claimed);
        if (!claimed) {
          const pendingCode = capturePendingReferralFromUrl();
          if (pendingCode && pendingCode !== myCode) {
            const res = await claimReferralCode(user.uid, pendingCode);
            if (res.status === 'claimed' || res.status === 'already_claimed') {
              setAlreadyClaimedReferral(true);
            } else if (res.status === 'invalid_code') {
              clearPendingReferral();
            }
          }
        }
      }
    };

    const unsubscribe = onSnapshot(
      userRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const safeFavorites = sanitizeFavorites(data?.favorites);
          const safePlan: UserPlan = data?.plan === 'pro' ? 'pro' : 'free';
          const safeDailyCount =
            typeof data?.dailyCount === 'number' && Number.isInteger(data.dailyCount) && data.dailyCount >= 0
              ? data.dailyCount
              : 0;
          const safeLastUsageDate =
            typeof data?.lastUsageDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.lastUsageDate)
              ? data.lastUsageDate
              : getTodayUtcDate();

          setFavorites(safeFavorites);
          setUserPlan(safePlan);
          setProPackageType(
            data?.proPackageType === 'yearly' || data?.proPackageType === 'monthly'
              ? data.proPackageType
              : null
          );
          const expiresMs =
            typeof data?.proExpiresAt?.toMillis === 'function'
              ? data.proExpiresAt.toMillis()
              : null;
          setProExpiresAtMs(expiresMs);
          setDailyCount(safeDailyCount);
          setLastUsageDate(safeLastUsageDate);

          const currentBonus =
            typeof data?.bonusCredits === 'number' && Number.isInteger(data.bonusCredits) && data.bonusCredits >= 0
              ? data.bonusCredits
              : 0;
          setBonusCredits(currentBonus);
          setReferralCount(typeof data?.referralCount === 'number' ? data.referralCount : 0);

          const code =
            typeof data?.referralCode === 'string' && data.referralCode.length >= 6
              ? data.referralCode
              : buildReferralCode(user.uid);
          setReferralCode(code);

          const needsSchemaMigration =
            typeof data?.uid !== 'string' ||
            !data?.createdAt ||
            typeof data?.referralCode !== 'string' ||
            typeof data?.plan !== 'string' ||
            typeof data?.dailyCount !== 'number' ||
            typeof data?.lastUsageDate !== 'string' ||
            !Array.isArray(data?.favorites);

          if (needsSchemaMigration && !isMigratingSchema && !snapshot.metadata.hasPendingWrites) {
            isMigratingSchema = true;
            const patch: Record<string, any> = {
              plan: safePlan,
              dailyCount: safeDailyCount,
              lastUsageDate: safeLastUsageDate,
              updatedAt: serverTimestamp(),
            };
            if (typeof data?.uid !== 'string') {
              patch.uid = user.uid.slice(0, 128);
            }
            if (!data?.createdAt) {
              patch.createdAt = serverTimestamp();
            }
            if (!Array.isArray(data?.favorites)) {
              patch.favorites = safeFavorites;
            }
            if (typeof data?.referralCode !== 'string') {
              patch.referralCode = code;
            }
            if (typeof data?.bonusCredits !== 'number') {
              patch.bonusCredits = 0;
            }
            try {
              await updateDoc(userRef, patch);
            } catch (error) {
              handleFirestoreError(error, OperationType.UPDATE, userPath);
            } finally {
              isMigratingSchema = false;
            }
          }

          if (!snapshot.metadata.hasPendingWrites) {
            try {
              await handleReferralLifecycle(code);
            } catch (err) {
              console.error('Referral lifecycle error:', err);
            }
          }
        } else if (!initializedDoc) {
          initializedDoc = true;
          let localFavs: string[] = [];
          try {
            const saved = localStorage.getItem(userStorageKey);
            if (saved) localFavs = sanitizeFavorites(JSON.parse(saved));
          } catch {}

          const today = getTodayUtcDate();
          const myCode = buildReferralCode(user.uid);
          setReferralCode(myCode);
          setBonusCredits(0);
          setReferralCount(0);

          const payload: Record<string, any> = {
            uid: user.uid.slice(0, 128),
            favorites: localFavs,
            plan: 'free',
            dailyCount: 0,
            lastUsageDate: today,
            referralCode: myCode,
            bonusCredits: 0,
            referralCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (user.displayName) payload.displayName = user.displayName.slice(0, 120);
          if (user.email) payload.email = user.email.slice(0, 254);
          if (user.photoURL) payload.photoURL = user.photoURL.slice(0, 512);

          try {
            await setDoc(userRef, payload);
            await handleReferralLifecycle(myCode);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, userPath);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, userPath);
      }
    );

    const configRef = doc(db, 'appConfig', 'proPlan');
    const unsubConfig = onSnapshot(
      configRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const nextApiBaseUrl = typeof d?.apiBaseUrl === 'string' ? d.apiBaseUrl.trim() : '';
          setDynamicApiBaseUrl(nextApiBaseUrl);
          const feeAmount =
            typeof d?.feeAmount === 'string' && d.feeAmount ? d.feeAmount : DEFAULT_BILLING_CONFIG.feeAmount;
          const monthlyFee =
            typeof d?.monthlyFee === 'string' && d.monthlyFee ? d.monthlyFee : feeAmount;
          const yearlyFee =
            typeof d?.yearlyFee === 'string' && d.yearlyFee ? d.yearlyFee : DEFAULT_BILLING_CONFIG.yearlyFee;
          setBillingConfig({
            feeAmount,
            monthlyFee,
            yearlyFee,
            paymentMethod: typeof d?.paymentMethod === 'string' && d.paymentMethod ? d.paymentMethod : DEFAULT_BILLING_CONFIG.paymentMethod,
            paymentAccount: typeof d?.paymentAccount === 'string' ? d.paymentAccount : '',
            instructions: typeof d?.instructions === 'string' && d.instructions ? d.instructions : DEFAULT_BILLING_CONFIG.instructions,
            freeDailyLimit: typeof d?.freeDailyLimit === 'number' && d.freeDailyLimit >= 1 ? d.freeDailyLimit : DEFAULT_BILLING_CONFIG.freeDailyLimit,
            apiBaseUrl: nextApiBaseUrl,
          });
        } else {
          setDynamicApiBaseUrl('');
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'appConfig/proPlan');
      }
    );

    const salonConfigRef = doc(db, 'salonConfig', 'default');
    const unsubSalonConfig = onSnapshot(
      salonConfigRef,
      (snap) => {
        if (snap.exists()) {
          setSalonConfig(sanitizeSalonConfig(snap.data()));
        } else {
          setSalonConfig(DEFAULT_SALON_CONFIG);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'salonConfig/default');
      }
    );

    return () => {
      unsubscribe();
      unsubConfig();
      unsubSalonConfig();
    };
  }, [authReady, user]);

  // Theme Management (persisted)
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('srabon_theme', isDarkMode ? 'dark' : 'light');
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', isDarkMode ? '#09090b' : '#18181b');
      }
    } catch {}
  }, [isDarkMode]);

  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(`${FAVORITES_STORAGE_KEY}:${user.uid}`, JSON.stringify(favorites));
    } catch {}
  }, [favorites, user]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const toggleFavorite = async (voiceName: string) => {
    const nextFavorites = sanitizeFavorites(
      favorites.includes(voiceName)
        ? favorites.filter(name => name !== voiceName)
        : [...favorites, voiceName]
    );
    setFavorites(nextFavorites);

    if (user) {
      const userPath = `users/${user.uid}`;
      const userRef = doc(db, 'users', user.uid);
      const today = getTodayUtcDate();
      const nextCount = lastUsageDate === today ? dailyCount : 0;
      try {
        await updateDoc(userRef, {
          favorites: nextFavorites,
          plan: userPlan,
          dailyCount: nextCount,
          lastUsageDate: today,
          updatedAt: serverTimestamp(),
        });
      } catch (error: any) {
        if (error?.code === 'not-found') {
          const myCode = referralCode || buildReferralCode(user.uid);
          const payload: Record<string, any> = {
            uid: user.uid.slice(0, 128),
            favorites: nextFavorites,
            plan: 'free',
            dailyCount: 0,
            lastUsageDate: today,
            referralCode: myCode,
            bonusCredits: 0,
            referralCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (user.displayName) payload.displayName = user.displayName.slice(0, 120);
          if (user.email) payload.email = user.email.slice(0, 254);
          if (user.photoURL) payload.photoURL = user.photoURL.slice(0, 512);
          try {
            await setDoc(userRef, payload);
            await ensureReferralCodeRegistered(user.uid, myCode);
          } catch (createErr) {
            handleFirestoreError(createErr, OperationType.CREATE, userPath);
          }
        } else {
          handleFirestoreError(error, OperationType.UPDATE, userPath);
        }
      }
    }
  };

  const consumeAiQuota = async (): Promise<boolean> => {
    if (!user) return false;
    if (isAdmin || effectiveUserPlan === 'pro') return true;

    const today = getTodayUtcDate();
    const currentUsed = lastUsageDate === today ? dailyCount : 0;

    if (currentUsed < billingConfig.freeDailyLimit) {
      const nextCount = currentUsed + 1;
      setDailyCount(nextCount);
      setLastUsageDate(today);

      const userPath = `users/${user.uid}`;
      const userRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userRef, {
          plan: userPlan,
          dailyCount: nextCount,
          lastUsageDate: today,
          updatedAt: serverTimestamp(),
        });
      } catch (error: any) {
        if (error?.code === 'not-found') {
          const myCode = referralCode || buildReferralCode(user.uid);
          const payload: Record<string, any> = {
            uid: user.uid.slice(0, 128),
            favorites,
            plan: 'free',
            dailyCount: nextCount,
            lastUsageDate: today,
            referralCode: myCode,
            bonusCredits: 0,
            referralCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          if (user.displayName) payload.displayName = user.displayName.slice(0, 120);
          if (user.email) payload.email = user.email.slice(0, 254);
          if (user.photoURL) payload.photoURL = user.photoURL.slice(0, 512);
          try {
            await setDoc(userRef, payload);
            await ensureReferralCodeRegistered(user.uid, myCode);
          } catch (createErr) {
            handleFirestoreError(createErr, OperationType.CREATE, userPath);
          }
        } else {
          handleFirestoreError(error, OperationType.UPDATE, userPath);
        }
      }
      return true;
    }

    if (bonusCredits > 0) {
      const nextCredits = bonusCredits - 1;
      setBonusCredits(nextCredits);

      const userPath = `users/${user.uid}`;
      const userRef = doc(db, 'users', user.uid);
      try {
        await updateDoc(userRef, {
          plan: userPlan,
          dailyCount: currentUsed,
          lastUsageDate: today,
          bonusCredits: nextCredits,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }
      return true;
    }

    setProModalTab('refer');
    setShowProModal(true);
    return false;
  };

  const handleSignOut = async () => {
    setPlayingVoice(null);
    setShowVoiceFinder(false);
    setIsAiCardVisible(false);
    setAiResult(null);
    setFavorites([]);
    setUserPlan('free');
    setProPackageType(null);
    setProExpiresAtMs(null);
    setDailyCount(0);
    setReferralCode('');
    setBonusCredits(0);
    setReferralCount(0);
    setAlreadyClaimedReferral(false);
    setProModalTab('refer');
    setProSelectedPackage('monthly');
    setShowProModal(false);
    setShowAdminPanel(false);
    setShowAdminNotifications(false);
    setShowChatHub(false);
    setUnreadChatCount(0);
    setFloatingNoticeHidden(false);
    setFirestoreIssues([]);
    setAdminInitialTab('requests');
    setSalonConfig(DEFAULT_SALON_CONFIG);
    setLegalTab(null);
    setStudioDraft(null);
    setDynamicApiBaseUrl('');
    await signOutUser();
  };

  const allAdminIssues = useMemo(() => {
    const getMs = (item: AppIssueRecord) =>
      typeof item.createdAt?.toMillis === 'function' ? item.createdAt.toMillis() : 0;

    const merged: AppIssueRecord[] = firestoreIssues.filter(
      (item) => !isBenignAppIssueNoise(item.message || '')
    );
    for (const sItem of sessionIssues) {
      if (isBenignAppIssueNoise(sItem.message || '')) continue;
      const sMs = getMs(sItem);
      const hasFirestoreMatch = merged.some(
        (fItem) =>
          fItem.source === sItem.source &&
          fItem.message === sItem.message &&
          Math.abs(getMs(fItem) - sMs) < 30_000
      );
      if (!hasFirestoreMatch) {
        merged.push(sItem);
      }
    }
    merged.sort((a, b) => getMs(b) - getMs(a));
    return merged;
  }, [firestoreIssues, sessionIssues]);

  const unreadIssues = useMemo(
    () => allAdminIssues.filter((i) => i.status === 'unread'),
    [allAdminIssues]
  );
  const unreadIssuesCount = unreadIssues.length;

  useEffect(() => {
    if (unreadIssuesCount > 0) {
      setFloatingNoticeHidden(false);
    }
  }, [unreadIssuesCount]);

  const uniqueGenders = useMemo(() => Array.from(new Set(VOICE_DATA.map(v => v.analysis.gender))).sort(), []);
  const uniquePitches = useMemo(() => Array.from(new Set(VOICE_DATA.map(v => v.analysis.pitch))).sort(), []);

  const filteredVoices = useMemo(() => {
    let baseData = VOICE_DATA;
    if (viewMode === 'favorites') {
      baseData = VOICE_DATA.filter(v => favorites.includes(v.name));
    } else if (aiResult) {
       const recommended = aiResult.voiceNames
          .map(name => VOICE_DATA.find(v => v.name === name))
          .filter((v): v is typeof VOICE_DATA[0] => !!v);
       return recommended.length > 0 ? recommended : baseData;
    }

    return baseData.filter(voice => {
      const matchGender = filters.gender === 'All' || voice.analysis.gender === filters.gender;
      const matchPitch = filters.pitch === 'All' || voice.analysis.pitch === filters.pitch;
      
      const searchLower = filters.search.toLowerCase();
      const matchSearch = filters.search === '' || 
        voice.name.toLowerCase().includes(searchLower) || 
        voice.characteristics.some(c => c.toLowerCase().includes(searchLower)) ||
        voice.analysis.characteristics.some(c => c.toLowerCase().includes(searchLower)) ||
        voice.analysis.gender.toLowerCase().startsWith(searchLower) ||
        voice.pitch.toLowerCase().includes(searchLower) ||
        voice.analysis.pitch.toLowerCase().includes(searchLower);

      return matchGender && matchPitch && matchSearch;
    });
  }, [filters, aiResult, viewMode, favorites]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filteredVoices]);

  const handlePlayToggle = (voiceName: string) => {
    setPlayingVoice(current => current === voiceName ? null : voiceName);
  };

  const handleUseInStudio = (voiceName: string) => {
    setPlayingVoice(null);
    setStudioVoiceName(voiceName);
    setViewMode('studio');
  };

  const handleViewModeChange = (mode: AppViewMode) => {
    if (mode === 'home' || mode === 'studio' || mode === 'ideas' || mode === 'salon') {
      setPlayingVoice(null);
    }
    setViewMode(mode);
  };

  const clearAiResult = () => {
    setAiResult(null);
    setIsAiCardVisible(false);
    setFilters({ ...filters, search: '' });
  };

  const isModalOpen = Boolean(
    showVoiceFinder ||
      showProModal ||
      showAdminPanel ||
      showAdminNotifications ||
      showChatHub ||
      legalTab ||
      (aiResult && isAiCardVisible)
  );

  if (!authReady) {
    return (
      <div className="h-screen w-screen bg-[#FDFDFD] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-500 dark:text-zinc-400">
          <Loader2 size={28} className="animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-sm font-medium">Checking Google sign-in...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <GoogleLoginGate isDarkMode={isDarkMode} toggleTheme={toggleTheme} />;
  }

  return (
    <div className="h-screen w-screen bg-[#FDFDFD] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden flex flex-col relative transition-colors duration-300">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-50 dark:bg-blue-900/20 blur-3xl opacity-60"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-50 dark:bg-purple-900/20 blur-3xl opacity-50"></div>
      </div>

      {/* Main App Content - aria-hidden and inert when modal is open */}
      <div 
        className="flex flex-col flex-1 overflow-hidden" 
        aria-hidden={isModalOpen}
        inert={isModalOpen}
        style={isModalOpen ? { pointerEvents: 'none' } : {}}
      >
        <FilterBar 
          filters={filters}
          onFilterChange={(next) => {
            setFilters(next);
            if ((viewMode === 'home' || viewMode === 'studio' || viewMode === 'ideas' || viewMode === 'salon') && (next.search || next.gender !== 'All' || next.pitch !== 'All')) {
              setViewMode('grid');
            }
          }}
          uniqueGenders={uniqueGenders}
          uniquePitches={uniquePitches}
          onOpenAiCasting={() => setShowVoiceFinder(true)}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          favoritesCount={favorites.length}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          user={user}
          onSignOut={handleSignOut}
          userPlan={effectiveUserPlan}
          usedToday={effectiveUsedToday}
          freeDailyLimit={billingConfig.freeDailyLimit}
          bonusCredits={bonusCredits}
          isAdmin={isAdmin}
          onOpenProModal={(tab = 'refer') => {
            setProModalTab(tab);
            setShowProModal(true);
          }}
          onOpenAdminPanel={() => {
            setAdminInitialTab('requests');
            setShowAdminPanel(true);
          }}
          unreadIssuesCount={unreadIssuesCount}
          onOpenNotifications={() => setShowAdminNotifications(true)}
          unreadChatCount={unreadChatCount}
          onOpenChat={() => setShowChatHub(true)}
        />

        <main className="flex-1 relative flex flex-col overflow-hidden">
              {viewMode === 'home' ? (
                <HomePage
                  user={user}
                  userPlan={effectiveUserPlan}
                  isAdmin={isAdmin}
                  salonConfig={salonConfig}
                  voicesCount={VOICE_DATA.length}
                  favoritesCount={favorites.length}
                  onNavigate={handleViewModeChange}
                  onOpenAdminPanel={() => {
                    setAdminInitialTab('salon');
                    setShowAdminPanel(true);
                  }}
                  onOpenLegal={setLegalTab}
                />
              ) : viewMode === 'salon' ? (
                <SalonBookingPage
                  user={user}
                  isAdmin={isAdmin}
                  salonConfig={salonConfig}
                  onBackHome={() => handleViewModeChange('home')}
                  onOpenAdminPanel={() => {
                    setAdminInitialTab('salon');
                    setShowAdminPanel(true);
                  }}
                />
              ) : viewMode === 'studio' ? (
                <TtsStudio
                  voices={VOICE_DATA}
                  selectedVoiceName={studioVoiceName}
                  onSelectVoice={setStudioVoiceName}
                  onBeforeGenerate={consumeAiQuota}
                  onOpenLegal={setLegalTab}
                  incomingDraft={studioDraft}
                  onOpenIdeas={() => handleViewModeChange('ideas')}
                  isAdmin={isAdmin}
                  apiBaseUrl={billingConfig.apiBaseUrl || ''}
                  billingConfig={billingConfig}
                  userPlan={effectiveUserPlan}
                  proPackageType={proPackageType}
                  proExpiresAtMs={proExpiresAtMs}
                  usedToday={effectiveUsedToday}
                  bonusCredits={bonusCredits}
                  onOpenUpgradePackage={(pkg) => {
                    setProSelectedPackage(pkg);
                    setProModalTab('pro');
                    setShowProModal(true);
                  }}
                  onOpenAdminSettings={() => {
                    setAdminInitialTab('settings');
                    setShowAdminPanel(true);
                  }}
                />
              ) : viewMode === 'ideas' ? (
                <TrendingIdeas
                  voices={VOICE_DATA}
                  onUseIdeaInStudio={(idea) => {
                    setPlayingVoice(null);
                    setStudioVoiceName(idea.voiceName);
                    setStudioDraft((prev) => ({
                      text: idea.text,
                      style: idea.style,
                      revision: (prev?.revision ?? 0) + 1,
                    }));
                    setViewMode('studio');
                  }}
                  onBeforeGenerate={consumeAiQuota}
                  onOpenLegal={setLegalTab}
                  isAdmin={isAdmin}
                />
              ) : filteredVoices.length > 0 ? (
                  viewMode === 'carousel' ? (
                    <div className="w-full flex-1 flex items-center justify-center pb-8 min-h-0">
                         <Carousel3D 
                            voices={filteredVoices}
                            activeIndex={activeIndex}
                            onChange={setActiveIndex}
                            playingVoice={playingVoice}
                            onPlayToggle={handlePlayToggle}
                            favorites={favorites}
                            onToggleFavorite={toggleFavorite}
                            onUseInStudio={handleUseInStudio}
                            disabled={isModalOpen}
                         />
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto">
                      <GridView 
                          voices={filteredVoices}
                          playingVoice={playingVoice}
                          onPlayToggle={handlePlayToggle}
                          favorites={favorites}
                          onToggleFavorite={toggleFavorite}
                          onUseInStudio={handleUseInStudio}
                          onOpenLegal={setLegalTab}
                      />
                    </div>
                  )
              ) : viewMode === 'favorites' ? (
                  <div className="w-full h-full flex items-center justify-center pb-24">
                      <div className="text-center animate-fade-in px-4">
                          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 mb-6 shadow-sm">
                              <Heart size={28} className="text-rose-400 dark:text-rose-400" />
                          </div>
                          <h3 className="text-xl font-serif text-zinc-900 dark:text-white mb-2">
                            {favorites.length === 0 ? 'No favorite voices yet' : 'No matching favorites'}
                          </h3>
                          <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
                            {favorites.length === 0
                              ? 'Click the heart icon on any voice card in Grid or Carousel view to save it here.'
                              : 'None of your favorite voices match the current search or filter criteria.'}
                          </p>
                          {favorites.length === 0 ? (
                            <button 
                                onClick={() => setViewMode('grid')}
                                className="px-5 py-2 bg-zinc-900 dark:bg-indigo-600 text-white rounded-full text-sm font-medium hover:bg-zinc-800 dark:hover:bg-indigo-500 transition-colors"
                            >
                                Browse Voices
                            </button>
                          ) : (
                            <button 
                                onClick={() => setFilters({ gender: 'All', pitch: 'All', search: '' })}
                                className="px-5 py-2 bg-zinc-900 dark:bg-indigo-600 text-white rounded-full text-sm font-medium hover:bg-zinc-800 dark:hover:bg-indigo-500 transition-colors"
                            >
                                Clear Filters
                            </button>
                          )}
                      </div>
                  </div>
              ) : (
                  <div className="w-full h-full flex items-center justify-center pb-24">
                      <div className="text-center animate-fade-in">
                          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 mb-6 shadow-sm">
                              <Info size={32} className="text-zinc-300 dark:text-zinc-500" />
                          </div>
                          <h3 className="text-xl font-serif text-zinc-900 dark:text-white mb-2">No voices found</h3>
                          <p className="text-zinc-500 dark:text-zinc-400 mb-6">Try adjusting your filters or use AI Match.</p>
                          <button 
                              onClick={() => setShowVoiceFinder(true)}
                              className="px-4 py-2 bg-zinc-900 dark:bg-indigo-600 text-white rounded-full text-sm font-medium hover:bg-zinc-800 dark:hover:bg-indigo-500 transition-colors"
                          >
                              Open AI Casting
                          </button>
                      </div>
                  </div>
              )}
              
              {!aiResult && filteredVoices.length > 0 && viewMode === 'carousel' && (
                  <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium tracking-widest uppercase bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm inline-block px-3 py-1 rounded-full border border-white/50 dark:border-zinc-800">
                          {activeIndex + 1} / {filteredVoices.length}
                      </p>
                  </div>
              )}
        </main>
      </div>

      {/* Modals are rendered outside the aria-hidden container */}
      {showVoiceFinder && (
        <VoiceFinder 
            voices={VOICE_DATA}
            onRecommendation={(rec) => {
                if (rec) {
                    setAiResult(rec);
                    setIsAiCardVisible(true);
                    setFilters(prev => ({ ...prev, search: '' })); 
                }
                setShowVoiceFinder(false);
            }}
            onClose={() => setShowVoiceFinder(false)}
            onBeforeGenerate={consumeAiQuota}
            isAdmin={isAdmin}
        />
      )}

      {showProModal && user && (
        <ProUpgradeModal
          user={user}
          userPlan={effectiveUserPlan}
          proPackageType={proPackageType}
          proExpiresAtMs={proExpiresAtMs}
          usedToday={effectiveUsedToday}
          billingConfig={billingConfig}
          isAdmin={isAdmin}
          referralCode={referralCode}
          bonusCredits={bonusCredits}
          referralCount={referralCount}
          alreadyClaimedReferral={alreadyClaimedReferral}
          onReferralClaimed={() => setAlreadyClaimedReferral(true)}
          initialTab={proModalTab}
          initialPackage={proSelectedPackage}
          onClose={() => setShowProModal(false)}
        />
      )}

      {showAdminPanel && isAdmin && (
        <AdminPanelModal
          billingConfig={billingConfig}
          salonConfig={salonConfig}
          initialTab={adminInitialTab}
          onClose={() => setShowAdminPanel(false)}
        />
      )}

      {aiResult && isAiCardVisible && (
          <div 
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-result-title"
          >
             <div className="absolute inset-0" onClick={clearAiResult}></div>
             <div className="relative w-full max-w-5xl animate-slide-up max-h-[90vh] overflow-hidden rounded-2xl">
                  <AiResultCard 
                    result={aiResult} 
                    voices={filteredVoices} 
                    onClose={clearAiResult}
                    onBeforeGenerate={consumeAiQuota}
                    isAdmin={isAdmin}
                 />
             </div>
          </div>
      )}

      {showAdminNotifications && isAdmin && (
        <AdminNotificationsBox
          issues={allAdminIssues}
          onClose={() => setShowAdminNotifications(false)}
        />
      )}

      {/* Separate Admin-only Floating Issue Notification Box */}
      {isAdmin && unreadIssuesCount > 0 && !showAdminNotifications && !floatingNoticeHidden && (
        <aside
          aria-label="Admin Issue Notification"
          className="fixed bottom-4 right-4 z-[80] w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900 shadow-2xl p-4 space-y-3 animate-slide-up"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Bell size={15} />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-900 dark:text-white">
                  অ্যাডমিন নোটিফিকেশন বক্স ({unreadIssuesCount})
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  অ্যাপে নতুন সমস্যা পাওয়া গেছে (শুধু আপনি দেখছেন)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFloatingNoticeHidden(true)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              aria-label="Hide notification preview"
            >
              <X size={14} />
            </button>
          </div>

          <div className="p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-[11px] uppercase tracking-wider opacity-80">
                {unreadIssues[0].source}
              </p>
              <p className="line-clamp-2 break-words">{unreadIssues[0].message}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setFloatingNoticeHidden(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
            >
              পরে দেখুন
            </button>
            <button
              type="button"
              onClick={() => setShowAdminNotifications(true)}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
            >
              নোটিফিকেশন বক্স খুলুন
            </button>
          </div>
        </aside>
      )}

      {legalTab && (
        <SiteLegalModal
          initialTab={legalTab}
          onClose={() => setLegalTab(null)}
        />
      )}

      {/* App-wide Floating Chat List Hub Launcher */}
      {!showChatHub && (
        <button
          type="button"
          onClick={() => setShowChatHub(true)}
          className="fixed bottom-4 left-4 z-[70] inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-zinc-900 dark:bg-indigo-600 hover:bg-zinc-800 dark:hover:bg-indigo-500 text-white shadow-xl border border-white/10 transition-all hover:scale-105 active:scale-95"
          aria-label="Open Chat List"
          title="চ্যাট লিস্ট · মতামত ও আলোচনা"
        >
          <MessageSquare size={16} />
          <span className="text-xs font-semibold tracking-wide">চ্যাট ও মতামত</span>
          {unreadChatCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white tabular-nums">
              {unreadChatCount > 99 ? '99+' : unreadChatCount}
            </span>
          )}
        </button>
      )}

      {showChatHub && user && (
        <ChatHubModal
          user={user}
          isAdmin={isAdmin}
          currentViewMode={viewMode}
          salonName={salonConfig.salonName}
          onClose={() => setShowChatHub(false)}
        />
      )}

    </div>
  );
};

export default App;