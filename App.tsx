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
import CustomVoiceCloneStudio from './components/CustomVoiceCloneStudio';
import VoiceComparisonModal from './components/VoiceComparisonModal';
import OfflineIndicator from './components/OfflineIndicator';
import { AppIssueRecord, AppViewMode, CustomVoiceProfile, FilterState, AiRecommendation, BillingConfig, ProPackageType, SalonConfig, SocialLinksConfig, UserPlan } from './types';
import { Info, Heart, Loader2, Bell, AlertTriangle, X, MessageSquare, ArrowLeftRight } from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, deleteDoc, doc, onSnapshot, query, runTransaction, setDoc, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { auth, db, signOutUser, reportFirestoreError, OperationType } from './firebase';
import { initGoogleAdsTag } from './utils/googleAds';
import { setDynamicApiBaseUrl } from './utils/audio';
import { isBenignAppIssueNoise, reportAppIssue, subscribeSessionIssues } from './utils/appIssues';
import { DEFAULT_SALON_CONFIG, sanitizeSalonConfig } from './utils/salon';
import { DEFAULT_SOCIAL_LINKS, sanitizeSocialLinksConfig } from './utils/socialLinks';
import {
  buildReferralCode,
  capturePendingReferralFromUrl,
  claimReferralCode,
  clearPendingReferral,
  ensureReferralCodeRegistered,
  hasUserClaimedReferral,
} from './utils/referral';
import {
  loadCustomVoiceProfiles,
  persistCustomVoiceProfiles,
} from './utils/voiceClone';
import {
  localizeGender,
  localizePitch,
  localizeTrait,
  useLanguage,
} from './utils/i18n';

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

function isSalonEntryUrl(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const entry = document.getElementById('root')?.getAttribute('data-entry');
  return (
    entry === 'salon' ||
    path === '/salon' ||
    path === '/salon/' ||
    path === '/salon.html' ||
    params.get('app') === 'salon' ||
    params.get('page') === 'salon' ||
    window.location.hash === '#salon'
  );
}

const App: React.FC = () => {
  const { lang, bi } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiRecommendation | null>(null);
  const [isAiCardVisible, setIsAiCardVisible] = useState(false);
  const [showVoiceFinder, setShowVoiceFinder] = useState(false);
  const [viewMode, setViewMode] = useState<AppViewMode>(() =>
    isSalonEntryUrl() ? 'salon' : 'home'
  );
  const [studioVoiceName, setStudioVoiceName] = useState<string>('Kore');
  const [studioDraft, setStudioDraft] = useState<{ text: string; style: string; revision: number } | null>(null);
  const [customVoiceProfiles, setCustomVoiceProfiles] = useState<CustomVoiceProfile[]>([]);
  const [selectedCustomVoiceId, setSelectedCustomVoiceId] = useState<string | null>(null);
  const [compareVoices, setCompareVoices] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [userPlan, setUserPlan] = useState<UserPlan>('free');
  const [proPackageType, setProPackageType] = useState<ProPackageType | null>(null);
  const [proExpiresAtMs, setProExpiresAtMs] = useState<number | null>(null);
  const [dailyCount, setDailyCount] = useState<number>(0);
  const [lastUsageDate, setLastUsageDate] = useState<string>(getTodayUtcDate());
  const [billingConfig, setBillingConfig] = useState<BillingConfig>(DEFAULT_BILLING_CONFIG);
  const [salonConfig, setSalonConfig] = useState<SalonConfig>(DEFAULT_SALON_CONFIG);
  const [socialLinks, setSocialLinks] = useState<SocialLinksConfig>(DEFAULT_SOCIAL_LINKS);
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
  const verifiedPathsRef = useRef<Map<string, number>>(new Map());
  const quotaLockRef = useRef<Promise<unknown>>(Promise.resolve());
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

  // Public real-time listener for Social Links (available both before and after login)
  useEffect(() => {
    const socialRef = doc(db, 'publicConfig', 'socialLinks');
    const unsubSocial = onSnapshot(
      socialRef,
      (snap) => {
        if (snap.exists()) {
          setSocialLinks(sanitizeSocialLinksConfig(snap.data()));
        } else {
          setSocialLinks(DEFAULT_SOCIAL_LINKS);
        }
      },
      (error) => {
        reportFirestoreError(error, OperationType.GET, 'publicConfig/socialLinks');
      }
    );
    return () => unsubSocial();
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

    const onPathVerifiedOk = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (!detail || typeof detail.pathPrefix !== 'string') return;
      const verifiedAtMs =
        typeof detail.verifiedAtMs === 'number' ? detail.verifiedAtMs : Date.now();
      verifiedPathsRef.current.set(detail.pathPrefix, verifiedAtMs);
    };

    window.addEventListener('srabon:app-issue', onCustomIssue);
    window.addEventListener('srabon:firestore-path-ok', onPathVerifiedOk);
    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      unsubSession();
      window.removeEventListener('srabon:app-issue', onCustomIssue);
      window.removeEventListener('srabon:firestore-path-ok', onPathVerifiedOk);
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

    const isStaleVerifiedPermissionIssue = (data: Omit<AppIssueRecord, 'id'>): boolean => {
      const msg = (data?.message || '').toLowerCase();
      if (!msg.includes('missing or insufficient permissions')) return false;
      const details = data?.details || '';
      const createdMs = typeof data?.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : 0;
      if (!createdMs) return false;
      for (const [prefix, verifiedAtMs] of verifiedPathsRef.current.entries()) {
        if (details.startsWith(prefix) && createdMs <= verifiedAtMs) {
          return true;
        }
      }
      return false;
    };

    const syncVerifiedCleanup = () => {
      setFirestoreIssues((prev) => {
        const next: AppIssueRecord[] = [];
        for (const item of prev) {
          if (isStaleVerifiedPermissionIssue(item)) {
            if (!cleanedObsoleteIssueIdsRef.current.has(item.id)) {
              cleanedObsoleteIssueIdsRef.current.add(item.id);
              deleteDoc(doc(db, 'appIssues', item.id)).catch(() => {});
            }
            continue;
          }
          next.push(item);
        }
        return next.length === prev.length ? prev : next;
      });
    };

    const onPathVerifiedOk = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (!detail || typeof detail.pathPrefix !== 'string') return;
      const verifiedAtMs =
        typeof detail.verifiedAtMs === 'number' ? detail.verifiedAtMs : Date.now();
      verifiedPathsRef.current.set(detail.pathPrefix, verifiedAtMs);
      syncVerifiedCleanup();
    };

    window.addEventListener('srabon:firestore-path-ok', onPathVerifiedOk);

    const unsubIssues = onSnapshot(
      collection(db, 'appIssues'),
      (snapshot) => {
        const items: AppIssueRecord[] = [];
        for (const d of snapshot.docs) {
          const data = d.data() as Omit<AppIssueRecord, 'id'>;
          if (isBenignAppIssueNoise(data?.message) || isStaleVerifiedPermissionIssue(data)) {
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

    return () => {
      window.removeEventListener('srabon:firestore-path-ok', onPathVerifiedOk);
      unsubIssues();
    };
  }, [authReady, user, isAdmin]);

  // Real-time unread count listener for Global Chat Hub (admin feedback threads)
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
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
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('srabon:firestore-path-ok', {
              detail: { pathPrefix: 'Path: adminFeedbackThreads', verifiedAtMs: Date.now() },
            })
          );
        }
      },
      (error) => {
        reportFirestoreError(error, OperationType.LIST, 'adminFeedbackThreads');
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

    const loadedCustomProfiles = loadCustomVoiceProfiles(user.uid);
    setCustomVoiceProfiles(loadedCustomProfiles);
    setSelectedCustomVoiceId((prev) =>
      prev && loadedCustomProfiles.some((p) => p.id === prev)
        ? prev
        : loadedCustomProfiles[0]?.id || null
    );

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
              if (user.emailVerified) {
                await updateDoc(userRef, patch);
              }
            } catch (error) {
              reportFirestoreError(error, OperationType.UPDATE, userPath);
            } finally {
              isMigratingSchema = false;
            }
          }

          if (!snapshot.metadata.hasPendingWrites && user.emailVerified) {
            try {
              await handleReferralLifecycle(code);
            } catch (err) {
              console.error('Referral lifecycle error:', err);
            }
          }
        } else if (!initializedDoc && user.emailVerified) {
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
            reportFirestoreError(error, OperationType.CREATE, userPath);
          }
        }
      },
      (error) => {
        reportFirestoreError(error, OperationType.GET, userPath);
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
        reportFirestoreError(error, OperationType.GET, 'appConfig/proPlan');
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
        reportFirestoreError(error, OperationType.GET, 'salonConfig/default');
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

    if (user && user.emailVerified) {
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
            reportFirestoreError(createErr, OperationType.CREATE, userPath);
          }
        } else {
          reportFirestoreError(error, OperationType.UPDATE, userPath);
        }
      }
    }
  };

  const consumeAiQuota = async (): Promise<boolean> => {
    if (!user) return false;
    if (isAdmin || effectiveUserPlan === 'pro') return true;
    if (!user.emailVerified) return false;

    const runDeduction = async (): Promise<boolean> => {
      const today = getTodayUtcDate();
      const userPath = `users/${user.uid}`;
      const userRef = doc(db, 'users', user.uid);
      const freeLimit = Math.max(1, billingConfig.freeDailyLimit || 5);

      let txWasCreate = false;
      try {
        const outcome = await runTransaction(db, async (tx) => {
          const snap = await tx.get(userRef);
          if (!snap.exists()) {
            txWasCreate = true;
            const myCode = referralCode || buildReferralCode(user.uid);
            const payload: Record<string, any> = {
              uid: user.uid.slice(0, 128),
              favorites,
              plan: 'free',
              dailyCount: 1,
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
            tx.set(userRef, payload);
            return {
              allowed: true,
              created: true,
              myCode,
              nextDailyCount: 1,
              nextUsageDate: today,
              nextBonus: 0,
            };
          }
          txWasCreate = false;

          const data = snap.data() || {};
          const serverPlan: UserPlan = data.plan === 'pro' ? 'pro' : 'free';
          const serverExpiresMs =
            typeof data.proExpiresAt?.toMillis === 'function' ? data.proExpiresAt.toMillis() : null;
          if (serverPlan === 'pro' && (!serverExpiresMs || serverExpiresMs > Date.now())) {
            return {
              allowed: true,
              created: false,
              nextDailyCount: typeof data.dailyCount === 'number' ? data.dailyCount : 0,
              nextUsageDate: typeof data.lastUsageDate === 'string' ? data.lastUsageDate : today,
              nextBonus: typeof data.bonusCredits === 'number' ? data.bonusCredits : 0,
            };
          }

          const serverDate = typeof data.lastUsageDate === 'string' ? data.lastUsageDate : '';
          const serverCount =
            serverDate === today && typeof data.dailyCount === 'number' && data.dailyCount >= 0
              ? data.dailyCount
              : 0;
          const serverBonus =
            typeof data.bonusCredits === 'number' && Number.isInteger(data.bonusCredits) && data.bonusCredits >= 0
              ? data.bonusCredits
              : 0;

          if (serverCount < freeLimit) {
            const nextCount = serverCount + 1;
            tx.update(userRef, {
              plan: serverPlan,
              dailyCount: nextCount,
              lastUsageDate: today,
              updatedAt: serverTimestamp(),
            });
            return {
              allowed: true,
              created: false,
              nextDailyCount: nextCount,
              nextUsageDate: today,
              nextBonus: serverBonus,
            };
          }

          if (serverBonus > 0) {
            const nextCredits = serverBonus - 1;
            tx.update(userRef, {
              plan: serverPlan,
              dailyCount: serverCount,
              lastUsageDate: today,
              bonusCredits: nextCredits,
              updatedAt: serverTimestamp(),
            });
            return {
              allowed: true,
              created: false,
              nextDailyCount: serverCount,
              nextUsageDate: today,
              nextBonus: nextCredits,
            };
          }

          return {
            allowed: false,
            created: false,
            nextDailyCount: serverCount,
            nextUsageDate: today,
            nextBonus: serverBonus,
          };
        });

        setDailyCount(outcome.nextDailyCount);
        setLastUsageDate(outcome.nextUsageDate);
        setBonusCredits(outcome.nextBonus);

        if (outcome.created && outcome.myCode) {
          try {
            await ensureReferralCodeRegistered(user.uid, outcome.myCode);
          } catch (refErr) {
            console.error('Referral registration notice:', refErr);
          }
        }

        if (!outcome.allowed) {
          setProModalTab('refer');
          setShowProModal(true);
          return false;
        }
        return true;
      } catch (error) {
        reportFirestoreError(error, txWasCreate ? OperationType.CREATE : OperationType.UPDATE, userPath);
        return false;
      }
    };

    const chained = quotaLockRef.current.then(runDeduction, runDeduction);
    quotaLockRef.current = chained.then(
      () => undefined,
      () => undefined
    );
    return chained;
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
    setCustomVoiceProfiles([]);
    setSelectedCustomVoiceId(null);
    setCompareVoices([]);
    setShowCompareModal(false);
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
      
      const searchLower = filters.search.trim().toLowerCase();
      const bnGender = localizeGender(voice.analysis.gender, 'bn').toLowerCase();
      const bnPitch = localizePitch(voice.pitch, 'bn').toLowerCase();
      const bnAnalysisPitch = localizePitch(voice.analysis.pitch, 'bn').toLowerCase();
      const ptGender = localizeGender(voice.analysis.gender, 'pt').toLowerCase();
      const ptPitch = localizePitch(voice.pitch, 'pt').toLowerCase();
      const ptAnalysisPitch = localizePitch(voice.analysis.pitch, 'pt').toLowerCase();
      const matchSearch = searchLower === '' || 
        voice.name.toLowerCase().includes(searchLower) || 
        voice.characteristics.some(
          (c) =>
            c.toLowerCase().includes(searchLower) ||
            localizeTrait(c, 'bn').toLowerCase().includes(searchLower) ||
            localizeTrait(c, 'pt').toLowerCase().includes(searchLower)
        ) ||
        voice.analysis.characteristics.some(
          (c) =>
            c.toLowerCase().includes(searchLower) ||
            localizeTrait(c, 'bn').toLowerCase().includes(searchLower) ||
            localizeTrait(c, 'pt').toLowerCase().includes(searchLower)
        ) ||
        voice.analysis.gender.toLowerCase().startsWith(searchLower) ||
        bnGender.includes(searchLower) ||
        ptGender.includes(searchLower) ||
        voice.pitch.toLowerCase().includes(searchLower) ||
        voice.analysis.pitch.toLowerCase().includes(searchLower) ||
        bnPitch.includes(searchLower) ||
        bnAnalysisPitch.includes(searchLower) ||
        ptPitch.includes(searchLower) ||
        ptAnalysisPitch.includes(searchLower);

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
    setSelectedCustomVoiceId(null);
    setStudioVoiceName(voiceName);
    setViewMode('studio');
  };

  const handleAddCustomVoiceProfile = (profile: CustomVoiceProfile) => {
    setCustomVoiceProfiles((prev) => {
      const next = [profile, ...prev].slice(0, 12);
      persistCustomVoiceProfiles(user?.uid, next);
      return next;
    });
    setSelectedCustomVoiceId(profile.id);
  };

  const handleUpdateCustomVoiceProfile = (updated: CustomVoiceProfile) => {
    setCustomVoiceProfiles((prev) => {
      const next = prev.map((p) => (p.id === updated.id ? updated : p));
      persistCustomVoiceProfiles(user?.uid, next);
      return next;
    });
  };

  const handleDeleteCustomVoiceProfile = (profileId: string) => {
    setCustomVoiceProfiles((prev) => {
      const next = prev.filter((p) => p.id !== profileId);
      persistCustomVoiceProfiles(user?.uid, next);
      if (selectedCustomVoiceId === profileId) {
        setSelectedCustomVoiceId(next[0]?.id || null);
      }
      return next;
    });
  };

  const handleViewModeChange = (mode: AppViewMode) => {
    if (
      mode === 'home' ||
      mode === 'studio' ||
      mode === 'voice-clone' ||
      mode === 'ideas' ||
      mode === 'salon'
    ) {
      setPlayingVoice(null);
    }
    setViewMode(mode);
  };

  const clearAiResult = () => {
    setAiResult(null);
    setIsAiCardVisible(false);
    setFilters({ ...filters, search: '' });
  };

  const handleToggleCompareVoice = (voiceName: string) => {
    if (compareVoices.includes(voiceName)) {
      setCompareVoices(compareVoices.filter((v) => v !== voiceName));
      return;
    }
    if (compareVoices.length === 0) {
      setCompareVoices([voiceName]);
      return;
    }
    setPlayingVoice(null);
    setCompareVoices([compareVoices[0], voiceName]);
    setShowCompareModal(true);
  };

  const getInitialComparePair = (): [string, string] => {
    const first =
      compareVoices[0] ||
      studioVoiceName ||
      VOICE_DATA[0]?.name ||
      'Kore';
    if (compareVoices[1] && compareVoices[1] !== first) {
      return [first, compareVoices[1]];
    }
    const firstVoice = VOICE_DATA.find((v) => v.name === first);
    const contrasting =
      VOICE_DATA.find(
        (v) =>
          v.name !== first &&
          firstVoice &&
          v.analysis.gender !== firstVoice.analysis.gender
      ) || VOICE_DATA.find((v) => v.name !== first);
    return [first, contrasting?.name || first];
  };

  const handleOpenCompareModal = () => {
    setPlayingVoice(null);
    const [a, b] = getInitialComparePair();
    if (compareVoices.length === 0 || compareVoices.length === 1) {
      setCompareVoices(a === b ? [a] : [a, b]);
    }
    setShowCompareModal(true);
  };

  const isModalOpen = Boolean(
    showVoiceFinder ||
      showProModal ||
      showAdminPanel ||
      showAdminNotifications ||
      showChatHub ||
      showCompareModal ||
      legalTab ||
      (aiResult && isAiCardVisible)
  );

  if (!authReady) {
    return (
      <div className="h-screen w-screen bg-[#f4f6fb] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-600 dark:text-slate-300">
          <Loader2 size={28} className="animate-spin text-indigo-600 dark:text-amber-400" />
          <p className="text-sm font-medium">
            {bi('গুগল সাইন-ইন যাচাই করা হচ্ছে...', 'Checking Google sign-in...')}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <GoogleLoginGate
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        socialLinks={socialLinks}
      />
    );
  }

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-[#f4f6fb] via-[#f8fafc] to-[#eef2ff] dark:from-[#070b14] dark:via-[#0b1120] dark:to-[#11152b] text-slate-900 dark:text-slate-100 font-sans overflow-hidden flex flex-col relative transition-colors duration-300">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute top-[-18%] right-[-8%] w-[640px] h-[640px] rounded-full bg-indigo-200/45 dark:bg-indigo-700/20 blur-3xl opacity-75"></div>
          <div className="absolute top-[25%] left-[-12%] w-[520px] h-[520px] rounded-full bg-amber-200/35 dark:bg-amber-600/15 blur-3xl opacity-65"></div>
          <div className="absolute bottom-[-14%] right-[18%] w-[520px] h-[520px] rounded-full bg-teal-200/35 dark:bg-teal-700/15 blur-3xl opacity-60"></div>
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
            if ((viewMode === 'home' || viewMode === 'studio' || viewMode === 'voice-clone' || viewMode === 'ideas' || viewMode === 'salon') && (next.search || next.gender !== 'All' || next.pitch !== 'All')) {
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
            setAdminInitialTab('menu');
            setShowAdminPanel(true);
          }}
          unreadIssuesCount={unreadIssuesCount}
          onOpenNotifications={() => setShowAdminNotifications(true)}
          unreadChatCount={unreadChatCount}
          onOpenChat={() => setShowChatHub(true)}
          onOpenVoiceCompare={handleOpenCompareModal}
          compareCount={compareVoices.length}
          socialLinks={socialLinks}
        />

        <main className="flex-1 relative flex flex-col overflow-hidden">
              {viewMode === 'home' ? (
                <HomePage
                  user={user}
                  userPlan={effectiveUserPlan}
                  isAdmin={isAdmin}
                  salonConfig={salonConfig}
                  socialLinks={socialLinks}
                  voicesCount={VOICE_DATA.length}
                  favoritesCount={favorites.length}
                  onNavigate={handleViewModeChange}
                  onUseInStudio={handleUseInStudio}
                  onOpenAdminPanel={() => {
                    setAdminInitialTab('salon-settings');
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
                    setAdminInitialTab('salon-settings');
                    setShowAdminPanel(true);
                  }}
                />
              ) : viewMode === 'voice-clone' ? (
                <CustomVoiceCloneStudio
                  profiles={customVoiceProfiles}
                  activeProfileId={selectedCustomVoiceId}
                  onSelectProfile={setSelectedCustomVoiceId}
                  onAddProfile={handleAddCustomVoiceProfile}
                  onUpdateProfile={handleUpdateCustomVoiceProfile}
                  onDeleteProfile={handleDeleteCustomVoiceProfile}
                  onUseProfileInStudio={(profileId) => {
                    setSelectedCustomVoiceId(profileId);
                    setViewMode('studio');
                  }}
                  onBackToStudio={() => handleViewModeChange('studio')}
                  onBeforeGenerate={consumeAiQuota}
                  onOpenLegal={setLegalTab}
                  isAdmin={isAdmin}
                  isDarkMode={isDarkMode}
                  billingConfig={billingConfig}
                  userPlan={effectiveUserPlan}
                  proPackageType={proPackageType}
                  usedToday={effectiveUsedToday}
                  bonusCredits={bonusCredits}
                  onOpenUpgradePackage={(pkg) => {
                    setProSelectedPackage(pkg);
                    setProModalTab('pro');
                    setShowProModal(true);
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
                  userId={user.uid}
                  isDarkMode={isDarkMode}
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
                  customVoices={customVoiceProfiles}
                  selectedCustomVoiceId={selectedCustomVoiceId}
                  onSelectCustomVoice={setSelectedCustomVoiceId}
                  onOpenVoiceCloneTool={() => handleViewModeChange('voice-clone')}
                  onOpenVoiceCompare={handleOpenCompareModal}
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
                            compareVoices={compareVoices}
                            onToggleCompare={handleToggleCompareVoice}
                            disabled={isModalOpen}
                            isDarkMode={isDarkMode}
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
                          compareVoices={compareVoices}
                          onToggleCompare={handleToggleCompareVoice}
                          onClearCompare={() => setCompareVoices([])}
                          onOpenCompare={handleOpenCompareModal}
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
                            {favorites.length === 0
                              ? bi('এখনো কোনো পছন্দের ভয়েস নেই', 'No favorite voices yet')
                              : bi('ফিল্টারের সাথে কোনো পছন্দের ভয়েস মেলেনি', 'No matching favorites')}
                          </h3>
                          <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm mx-auto">
                            {favorites.length === 0
                              ? bi(
                                  'গ্রিড বা ক্যারোসেল ভিউ থেকে যেকোনো ভয়েস কার্ডের হার্ট আইকনে ক্লিক করে এখানে সংরক্ষণ করুন।',
                                  'Click the heart icon on any voice card in Grid or Carousel view to save it here.'
                                )
                              : bi(
                                  'আপনার পছন্দের কোনো ভয়েস বর্তমান সার্চ বা ফিল্টারের সাথে মেলেনি।',
                                  'None of your favorite voices match the current search or filter criteria.'
                                )}
                          </p>
                          {favorites.length === 0 ? (
                            <button 
                                onClick={() => setViewMode('grid')}
                                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-full text-sm font-semibold hover:from-indigo-500 hover:to-blue-500 shadow-md shadow-indigo-500/20 transition-all"
                            >
                                {bi('সব ভয়েস দেখুন', 'Browse Voices')}
                            </button>
                          ) : (
                            <button 
                                onClick={() => setFilters({ gender: 'All', pitch: 'All', search: '' })}
                                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-full text-sm font-semibold hover:from-indigo-500 hover:to-blue-500 shadow-md shadow-indigo-500/20 transition-all"
                            >
                                {bi('ফিল্টার মুছুন', 'Clear Filters')}
                            </button>
                          )}
                      </div>
                  </div>
              ) : (
                  <div className="w-full h-full flex items-center justify-center pb-24">
                      <div className="text-center animate-fade-in">
                          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 mb-6 shadow-sm">
                              <Info size={32} className="text-indigo-500 dark:text-indigo-400" />
                          </div>
                          <h3 className="text-xl font-serif text-slate-900 dark:text-white mb-2">
                            {bi('কোনো ভয়েস পাওয়া যায়নি', 'No voices found')}
                          </h3>
                          <p className="text-slate-500 dark:text-slate-400 mb-6">
                            {bi('ফিল্টার পরিবর্তন করে দেখুন অথবা AI ম্যাচ ব্যবহার করুন।', 'Try adjusting your filters or use AI Match.')}
                          </p>
                          <button 
                              onClick={() => setShowVoiceFinder(true)}
                              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-full text-sm font-semibold hover:from-indigo-500 hover:to-blue-500 shadow-md shadow-indigo-500/20 transition-all"
                          >
                              {bi('AI কাস্টিং খুলুন', 'Open AI Casting')}
                          </button>
                      </div>
                  </div>
              )}
              
              {!aiResult && filteredVoices.length > 0 && viewMode === 'carousel' && (
                  <div className="absolute bottom-6 left-0 right-0 flex flex-wrap items-center justify-center gap-3 pointer-events-none px-4">
                      <p className="text-xs text-indigo-700 dark:text-indigo-200 font-semibold tracking-widest uppercase bg-white/80 dark:bg-indigo-950/70 backdrop-blur-md inline-block px-3.5 py-1.5 rounded-full border border-indigo-200/80 dark:border-indigo-800/80 shadow-sm tabular-nums">
                          {activeIndex + 1} / {filteredVoices.length}
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenCompareModal}
                        className="pointer-events-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 hover:bg-indigo-50 dark:hover:bg-slate-800 text-xs font-semibold text-indigo-700 dark:text-amber-300 border border-indigo-200/80 dark:border-indigo-800/80 shadow-sm transition-colors"
                      >
                        <ArrowLeftRight size={12} />
                        <span>
                          {compareVoices.length === 2
                            ? bi(
                                `তুলনা: ${compareVoices[0]} বনাম ${compareVoices[1]}`,
                                `Compare ${compareVoices[0]} vs ${compareVoices[1]}`
                              )
                            : compareVoices.length === 1
                            ? bi(
                                `তুলনায়: ${compareVoices[0]} (+১টি)`,
                                `Comparing ${compareVoices[0]} (+1)`
                              )
                            : bi('ভয়েস তুলনা করুন', 'Compare Voices')}
                        </span>
                      </button>
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
          socialLinks={socialLinks}
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
          aria-label={bi('অ্যাডমিন সমস্যা নোটিফিকেশন', 'Admin Issue Notification')}
          className="fixed bottom-16 sm:bottom-5 right-4 sm:right-5 z-[80] w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900 shadow-2xl p-5 space-y-4 animate-slide-up"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Bell size={18} />
              </div>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-bold text-zinc-900 dark:text-white leading-snug">
                  {bi(
                    `অ্যাডমিন নোটিফিকেশন বক্স (${unreadIssuesCount})`,
                    `Admin Notification Box (${unreadIssuesCount})`
                  )}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {bi(
                    'অ্যাপে নতুন সমস্যা পাওয়া গেছে (শুধু আপনি দেখছেন)',
                    'New app issue detected (visible to Admin only)'
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFloatingNoticeHidden(true)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors shrink-0"
              aria-label={bi('নোটিফিকেশন প্রিভিউ লুকান', 'Hide notification preview')}
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/60 text-sm text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <div className="min-w-0 space-y-1">
              <p className="font-semibold text-xs uppercase tracking-wider opacity-85">
                {unreadIssues[0].source}
              </p>
              <p className="text-sm leading-relaxed line-clamp-2 break-words">{unreadIssues[0].message}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setFloatingNoticeHidden(true)}
              className="px-3.5 py-2 rounded-xl text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition-colors"
            >
              {bi('পরে দেখুন', 'Later')}
            </button>
            <button
              type="button"
              onClick={() => setShowAdminNotifications(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors"
            >
              {bi('নোটিফিকেশন বক্স খুলুন', 'Open Notification Box')}
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

      {/* App-wide Floating Chat Launcher */}
      {!showChatHub && (
        <button
          type="button"
          onClick={() => setShowChatHub(true)}
          className="fixed bottom-4 left-4 z-[70] inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 hover:from-indigo-500 hover:via-blue-500 hover:to-violet-500 text-white shadow-xl shadow-indigo-600/25 border border-white/20 transition-all hover:scale-105 active:scale-95"
          aria-label={bi('চ্যাট খুলুন', 'Open Chat')}
          title={bi('চ্যাট', 'Chat')}
        >
          <MessageSquare size={16} />
          <span className="text-xs font-semibold tracking-wide">
            {bi('চ্যাট', 'Chat')}
          </span>
          {unreadChatCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white tabular-nums">
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

      {showCompareModal && (() => {
        const [initialA, initialB] = getInitialComparePair();
        return (
          <VoiceComparisonModal
            voices={VOICE_DATA}
            initialVoiceA={initialA}
            initialVoiceB={initialB}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            onUseInStudio={(voiceName) => {
              setShowCompareModal(false);
              handleUseInStudio(voiceName);
            }}
            onSyncPair={(a, b) => {
              setCompareVoices((prev) =>
                prev[0] === a && prev[1] === b ? prev : [a, b]
              );
            }}
            onClose={() => setShowCompareModal(false)}
            isDarkMode={isDarkMode}
          />
        );
      })()}

      <OfflineIndicator />
    </div>
  );
};

export default App;