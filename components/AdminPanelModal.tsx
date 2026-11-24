/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useEffect, useRef, useState } from 'react';
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
  PenTool,
  ArrowLeft,
  ChevronRight,
  Search,
  CalendarDays,
  Share2,
  RotateCcw,
  Clock,
} from 'lucide-react';
import { normalizeApiBaseUrl, setDynamicApiBaseUrl, testApiHealthAtUrl } from '../utils/audio';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, reportFirestoreError, OperationType } from '../firebase';
import {
  BillingConfig,
  ProPackageType,
  ProUpgradeRequest,
  SalonBooking,
  SalonBookingStatus,
  SalonConfig,
  SocialLinksConfig,
  UserAccountRecord,
  UserPlan,
} from '../types';
import { SALON_SERVICES, formatSalonPrice, isBookingTimeExpired } from '../utils/salon';
import { DEFAULT_SOCIAL_LINKS, normalizeSocialUrlInput } from '../utils/socialLinks';
import {
  extractTimestampMillis,
  formatBookingCreatedTimestamp,
  isCustomSalonServiceTitle,
  localizeBookingStatus,
  localizeDate,
  localizePlanLabel,
  localizeSalonService,
  localizeUpgradeStatus,
  translateSalonServiceText,
  useLanguage,
} from '../utils/i18n';
import CompletionSignatureModal from './CompletionSignatureModal';

export type AdminPanelTab =
  | 'menu'
  | 'requests'
  | 'users'
  | 'settings'
  | 'api'
  | 'social-links'
  | 'salon'
  | 'salon-settings'
  | 'salon-bookings';

interface AdminPanelModalProps {
  billingConfig: BillingConfig;
  salonConfig: SalonConfig;
  socialLinks?: SocialLinksConfig;
  initialTab?: AdminPanelTab;
  onClose: () => void;
}

function getTodayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  billingConfig,
  salonConfig,
  socialLinks = DEFAULT_SOCIAL_LINKS,
  initialTab = 'menu',
  onClose,
}) => {
  const { lang, bi } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminPanelTab>(
    initialTab === 'salon' ? 'salon-settings' : initialTab
  );
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<
    'all' | SalonBookingStatus
  >('all');
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
  const resolveInitialTitles = (
    key: (typeof SALON_SERVICES)[number]['key'],
    cfg: SalonConfig
  ): { en: string; bn: string } => {
    const meta = SALON_SERVICES.find((s) => s.key === key)!;
    const rawEn = (cfg[meta.titleField] || '').trim();
    const rawBn = (cfg[meta.titleBnField] || '').trim();
    const defaultEn = localizeSalonService(key, 'en').primaryTitle;
    const defaultBn = localizeSalonService(key, 'bn').primaryTitle;

    const hasLegacyBnOnlyInEn =
      !rawBn &&
      isCustomSalonServiceTitle(key, rawEn) &&
      /[\u0980-\u09FF]/.test(rawEn) &&
      !/[A-Za-z]/.test(rawEn);

    const enVal = hasLegacyBnOnlyInEn
      ? translateSalonServiceText(rawEn, 'en') || defaultEn
      : rawEn.length >= 2
      ? rawEn
      : isCustomSalonServiceTitle(key, rawBn)
      ? translateSalonServiceText(rawBn, 'en') || defaultEn
      : defaultEn;

    const bnVal =
      rawBn.length >= 2
        ? rawBn
        : hasLegacyBnOnlyInEn
        ? rawEn
        : isCustomSalonServiceTitle(key, rawEn)
        ? translateSalonServiceText(rawEn, 'bn') || defaultBn
        : defaultBn;

    return { en: enVal, bn: bnVal };
  };

  const [salonName, setSalonName] = useState(salonConfig.salonName);
  const [currencySymbol, setCurrencySymbol] = useState(salonConfig.currencySymbol);
  const [haircutPrice, setHaircutPrice] = useState(String(salonConfig.haircutPrice));
  const [beardTrimPrice, setBeardTrimPrice] = useState(String(salonConfig.beardTrimPrice));
  const [shavePrice, setShavePrice] = useState(String(salonConfig.shavePrice));
  const [hairColorPrice, setHairColorPrice] = useState(String(salonConfig.hairColorPrice));
  const [facialPrice, setFacialPrice] = useState(String(salonConfig.facialPrice));
  const [comboPrice, setComboPrice] = useState(String(salonConfig.comboPrice));

  const [haircutTitle, setHaircutTitle] = useState(() => resolveInitialTitles('haircut', salonConfig).en);
  const [beardTrimTitle, setBeardTrimTitle] = useState(() => resolveInitialTitles('beard', salonConfig).en);
  const [shaveTitle, setShaveTitle] = useState(() => resolveInitialTitles('shave', salonConfig).en);
  const [hairColorTitle, setHairColorTitle] = useState(() => resolveInitialTitles('color', salonConfig).en);
  const [facialTitle, setFacialTitle] = useState(() => resolveInitialTitles('facial', salonConfig).en);
  const [comboTitle, setComboTitle] = useState(() => resolveInitialTitles('combo', salonConfig).en);

  const [haircutTitleBn, setHaircutTitleBn] = useState(() => resolveInitialTitles('haircut', salonConfig).bn);
  const [beardTrimTitleBn, setBeardTrimTitleBn] = useState(() => resolveInitialTitles('beard', salonConfig).bn);
  const [shaveTitleBn, setShaveTitleBn] = useState(() => resolveInitialTitles('shave', salonConfig).bn);
  const [hairColorTitleBn, setHairColorTitleBn] = useState(() => resolveInitialTitles('color', salonConfig).bn);
  const [facialTitleBn, setFacialTitleBn] = useState(() => resolveInitialTitles('facial', salonConfig).bn);
  const [comboTitleBn, setComboTitleBn] = useState(() => resolveInitialTitles('combo', salonConfig).bn);

  const [bookingFee, setBookingFee] = useState(String(salonConfig.bookingFee));
  const [salonAddress, setSalonAddress] = useState(salonConfig.address);
  const [salonPhone, setSalonPhone] = useState(salonConfig.phone);
  const [salonOpenHours, setSalonOpenHours] = useState(salonConfig.openHours);
  const [isBookingOpen, setIsBookingOpen] = useState(salonConfig.isBookingOpen);
  const [savingSalon, setSavingSalon] = useState(false);
  const [savedSalonBanner, setSavedSalonBanner] = useState(false);
  const [signingTargetBooking, setSigningTargetBooking] = useState<SalonBooking | null>(null);
  const adminAutoCancelRef = useRef<Set<string>>(new Set());

  // Social links config form state
  const [facebookUrl, setFacebookUrl] = useState(socialLinks.facebookUrl);
  const [instagramUrl, setInstagramUrl] = useState(socialLinks.instagramUrl);
  const [linkedinUrl, setLinkedinUrl] = useState(socialLinks.linkedinUrl);
  const [youtubeUrl, setYoutubeUrl] = useState(socialLinks.youtubeUrl);
  const [savingSocialLinks, setSavingSocialLinks] = useState(false);
  const [savedSocialBanner, setSavedSocialBanner] = useState(false);

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

    const hc = resolveInitialTitles('haircut', salonConfig);
    const bd = resolveInitialTitles('beard', salonConfig);
    const sh = resolveInitialTitles('shave', salonConfig);
    const cl = resolveInitialTitles('color', salonConfig);
    const fc = resolveInitialTitles('facial', salonConfig);
    const cb = resolveInitialTitles('combo', salonConfig);

    setHaircutTitle(hc.en);
    setHaircutTitleBn(hc.bn);
    setBeardTrimTitle(bd.en);
    setBeardTrimTitleBn(bd.bn);
    setShaveTitle(sh.en);
    setShaveTitleBn(sh.bn);
    setHairColorTitle(cl.en);
    setHairColorTitleBn(cl.bn);
    setFacialTitle(fc.en);
    setFacialTitleBn(fc.bn);
    setComboTitle(cb.en);
    setComboTitleBn(cb.bn);

    setBookingFee(String(salonConfig.bookingFee));
    setSalonAddress(salonConfig.address);
    setSalonPhone(salonConfig.phone);
    setSalonOpenHours(salonConfig.openHours);
    setIsBookingOpen(salonConfig.isBookingOpen);
  }, [salonConfig]);

  useEffect(() => {
    setFacebookUrl(socialLinks.facebookUrl || '');
    setInstagramUrl(socialLinks.instagramUrl || '');
    setLinkedinUrl(socialLinks.linkedinUrl || '');
    setYoutubeUrl(socialLinks.youtubeUrl || '');
  }, [socialLinks]);

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
        reportFirestoreError(error, OperationType.LIST, 'proRequests');
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
        reportFirestoreError(error, OperationType.LIST, 'users');
      }
    );

    const unsubSalonBookings = onSnapshot(
      query(collection(db, 'salonBookings'), limit(250)),
      (snapshot) => {
        const list: SalonBooking[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data({ serverTimestamps: 'estimate' }) as Omit<SalonBooking, 'id'>),
        }));
        list.sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (a.status !== 'pending' && b.status === 'pending') return 1;
          const at = extractTimestampMillis(a.createdAt) ?? 0;
          const bt = extractTimestampMillis(b.createdAt) ?? 0;
          return bt - at;
        });
        setSalonBookings(list);
      },
      (error) => {
        reportFirestoreError(error, OperationType.LIST, 'salonBookings');
      }
    );

    return () => {
      unsubReqs();
      unsubUsers();
      unsubSalonBookings();
    };
  }, []);

  const salonBookingsRef = useRef<SalonBooking[]>([]);
  salonBookingsRef.current = salonBookings;

  // Admin auto-cancels overdue active bookings (+10 min grace window)
  useEffect(() => {
    let mounted = true;
    const expireOverdue = async () => {
      if (!mounted || salonBookingsRef.current.length === 0) return;
      const now = Date.now();
      const overdue = salonBookingsRef.current.filter(
        (b) =>
          (b.status === 'pending' || b.status === 'confirmed') &&
          isBookingTimeExpired(b.bookingDate, b.timeSlot, now) &&
          !adminAutoCancelRef.current.has(b.id)
      );
      for (const b of overdue) {
        if (!mounted) break;
        adminAutoCancelRef.current.add(b.id);
        try {
          const bookingRef = doc(db, 'salonBookings', b.id);
          const ticketRef = doc(db, 'salonQueues', b.bookingDate, 'tickets', b.id);
          const ticketSnap = await getDoc(ticketRef);

          const batch = writeBatch(db);
          batch.update(bookingRef, {
            status: 'cancelled',
            autoCancelledReason: 'time_expired',
            updatedAt: serverTimestamp(),
          });
          if (ticketSnap.exists()) {
            batch.update(ticketRef, {
              status: 'cancelled',
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        } catch (error) {
          adminAutoCancelRef.current.delete(b.id);
          reportFirestoreError(error, OperationType.UPDATE, `salonBookings/${b.id}`);
        }
      }
    };
    void expireOverdue();
    const timer = window.setInterval(() => void expireOverdue(), 20_000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
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
      setActionError(
        error?.message || bi('Pro রিকোয়েস্ট অনুমোদন করা যায়নি।', 'Failed to approve Pro request.')
      );
      reportFirestoreError(error, OperationType.UPDATE, `proRequests/${req.id}`);
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
    } catch (error: any) {
      setActionError(
        error?.message || bi('Pro রিকোয়েস্ট বাতিল করা যায়নি।', 'Failed to reject Pro request.')
      );
      reportFirestoreError(error, OperationType.UPDATE, `proRequests/${req.id}`);
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
    } catch (error: any) {
      setActionError(
        error?.message || bi('ইউজারের প্যাকেজ আপডেট করা যায়নি।', 'Failed to update user package.')
      );
      reportFirestoreError(error, OperationType.UPDATE, `users/${target.uid}`);
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
      setActionError(
        error?.message || bi('বোনাস ক্রেডিট যোগ করা যায়নি।', 'Failed to grant bonus credits.')
      );
      reportFirestoreError(error, OperationType.UPDATE, `users/${target.uid}`);
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
      setActionError(
        bi(
          'সঠিক https:// বা http:// ব্যাকএন্ড সার্ভার URL দিন (যেমন https://srabon-go-api.onrender.com)।',
          'Enter a valid https:// or http:// backend server URL (e.g., https://srabon-go-api.onrender.com).'
        )
      );
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
      setActionError(
        bi(
          'সঠিক https:// বা http:// সার্ভার URL দিন (স্পেস বা query ছাড়া, যেমন https://srabon-go-api.onrender.com)।',
          'Enter a valid https:// or http:// server URL without spaces or query parameters.'
        )
      );
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
      setActionError(
        error?.message || bi('সেটিংস সেভ করা যায়নি।', 'Failed to save settings.')
      );
      reportFirestoreError(error, OperationType.WRITE, 'appConfig/proPlan');
    } finally {
      setSavingConfig(false);
    }
  };

  const parsePriceInput = (val: string, fallback: number): number => {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(50000, Math.max(0, n));
  };

  const cleanTitleInput = (
    val: string,
    key: (typeof SALON_SERVICES)[number]['key'],
    targetLang: 'en' | 'bn',
    otherLangFallback?: string
  ): string => {
    const trimmed = val.trim().slice(0, 100);
    if (trimmed.length >= 2) return trimmed;
    if (otherLangFallback && otherLangFallback.trim().length >= 2) {
      const translated = translateSalonServiceText(otherLangFallback, targetLang);
      if (translated.length >= 2) return translated.slice(0, 100);
    }
    return localizeSalonService(key, targetLang).primaryTitle.slice(0, 100);
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
      haircutTitle: cleanTitleInput(haircutTitle, 'haircut', 'en', haircutTitleBn),
      beardTrimTitle: cleanTitleInput(beardTrimTitle, 'beard', 'en', beardTrimTitleBn),
      shaveTitle: cleanTitleInput(shaveTitle, 'shave', 'en', shaveTitleBn),
      hairColorTitle: cleanTitleInput(hairColorTitle, 'color', 'en', hairColorTitleBn),
      facialTitle: cleanTitleInput(facialTitle, 'facial', 'en', facialTitleBn),
      comboTitle: cleanTitleInput(comboTitle, 'combo', 'en', comboTitleBn),
      haircutTitleBn: cleanTitleInput(haircutTitleBn, 'haircut', 'bn', haircutTitle),
      beardTrimTitleBn: cleanTitleInput(beardTrimTitleBn, 'beard', 'bn', beardTrimTitle),
      shaveTitleBn: cleanTitleInput(shaveTitleBn, 'shave', 'bn', shaveTitle),
      hairColorTitleBn: cleanTitleInput(hairColorTitleBn, 'color', 'bn', hairColorTitle),
      facialTitleBn: cleanTitleInput(facialTitleBn, 'facial', 'bn', facialTitle),
      comboTitleBn: cleanTitleInput(comboTitleBn, 'combo', 'bn', comboTitle),
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
      setActionError(
        error?.message ||
          bi('সেলুনের নাম, প্রাইস ও সেটিংস সেভ করা যায়নি।', 'Failed to save salon names, prices, and settings.')
      );
      reportFirestoreError(error, OperationType.WRITE, 'salonConfig/default');
    } finally {
      setSavingSalon(false);
    }
  };

  const handleSaveSocialLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingSocialLinks) return;
    setActionError(null);
    setSavedSocialBanner(false);

    const fb = normalizeSocialUrlInput(facebookUrl);
    const ig = normalizeSocialUrlInput(instagramUrl);
    const li = normalizeSocialUrlInput(linkedinUrl);
    const yt = normalizeSocialUrlInput(youtubeUrl);

    if (!fb.valid || !ig.valid || !li.valid || !yt.valid) {
      setActionError(
        bi(
          'অনুগ্রহ করে সঠিক https:// সোশ্যাল মিডিয়া লিংক দিন (যেমন https://www.facebook.com/srabongo) অথবা খালি রাখুন।',
          'Please enter valid https:// social links (e.g. https://www.facebook.com/srabongo) or leave them blank.'
        )
      );
      return;
    }

    setSavingSocialLinks(true);
    try {
      await setDoc(doc(db, 'publicConfig', 'socialLinks'), {
        facebookUrl: fb.value,
        instagramUrl: ig.value,
        linkedinUrl: li.value,
        youtubeUrl: yt.value,
        updatedAt: serverTimestamp(),
      });
      setFacebookUrl(fb.value);
      setInstagramUrl(ig.value);
      setLinkedinUrl(li.value);
      setYoutubeUrl(yt.value);
      setSavedSocialBanner(true);
      window.setTimeout(() => setSavedSocialBanner(false), 2500);
    } catch (error: any) {
      setActionError(
        error?.message || bi('সোশ্যাল লিংক সেভ করা যায়নি।', 'Failed to save social links.')
      );
      reportFirestoreError(error, OperationType.WRITE, 'publicConfig/socialLinks');
    } finally {
      setSavingSocialLinks(false);
    }
  };

  const handleUpdateBookingStatus = async (
    booking: SalonBooking,
    nextStatus: 'pending' | 'confirmed' | 'cancelled'
  ) => {
    if (busyId) return;
    setBusyId(`bk_${booking.id}`);
    setActionError(null);
    try {
      const bookingRef = doc(db, 'salonBookings', booking.id);
      const ticketRef = doc(db, 'salonQueues', booking.bookingDate, 'tickets', booking.id);
      const ticketSnap = await getDoc(ticketRef);

      const batch = writeBatch(db);
      const bookingUpdate: Record<string, any> = {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      };
      batch.update(bookingRef, bookingUpdate);

      if (ticketSnap.exists()) {
        batch.update(ticketRef, {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (error: any) {
      setActionError(
        error?.message || bi('বুকিং স্ট্যাটাস আপডেট করা যায়নি।', 'Failed to update booking status.')
      );
      reportFirestoreError(error, OperationType.UPDATE, `salonBookings/${booking.id}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleAdminSubmitSignature = async ({
    signaturePath,
    signerName,
  }: {
    signaturePath: string;
    signerName: string;
  }) => {
    if (!signingTargetBooking) return;
    setActionError(null);
    const target = signingTargetBooking;
    const bookingRef = doc(db, 'salonBookings', target.id);
    const ticketRef = doc(db, 'salonQueues', target.bookingDate, 'tickets', target.id);
    const ticketSnap = await getDoc(ticketRef);

    const batch = writeBatch(db);
    const bookingUpdate: Record<string, any> = {
      status: 'completed',
      shopSignaturePath: signaturePath,
      shopSignerName: signerName,
      shopSignedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (!target.completedAt) {
      bookingUpdate.completedAt = serverTimestamp();
    }
    batch.update(bookingRef, bookingUpdate);
    if (ticketSnap.exists()) {
      batch.update(ticketRef, {
        status: 'completed',
        hasShopSignature: true,
        shopSignerName: signerName,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    setSigningTargetBooking(null);
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const pendingSalonCount = salonBookings.filter((b) => b.status === 'pending').length;
  const completedSalonCount = salonBookings.filter((b) => b.status === 'completed').length;

  const normalizedSearch = userSearchQuery.trim().toLowerCase();
  const filteredUsers = normalizedSearch
    ? usersList.filter(
        (u) =>
          (u.displayName || '').toLowerCase().includes(normalizedSearch) ||
          (u.email || '').toLowerCase().includes(normalizedSearch) ||
          u.uid.toLowerCase().includes(normalizedSearch)
      )
    : usersList;

  const filteredSalonBookings =
    bookingStatusFilter === 'all'
      ? salonBookings
      : salonBookings.filter((b) => b.status === bookingStatusFilter);

  const adminMenuOptions: Array<{
    id: Exclude<AdminPanelTab, 'menu' | 'salon'>;
    title: string;
    meta: string;
    highlight?: string;
    icon: React.ReactNode;
    accentBg: string;
  }> = [
    {
      id: 'requests',
      title: bi('Pro আপগ্রেড রিকোয়েস্ট', 'Pro Upgrade Requests'),
      meta: bi(
        `${pendingCount}টি পেন্ডিং · মোট ${requests.length}টি রিকোয়েস্ট`,
        `${pendingCount} pending · ${requests.length} total requests`
      ),
      highlight: pendingCount > 0 ? bi(`${pendingCount} নতুন`, `${pendingCount} pending`) : undefined,
      icon: <Receipt size={20} />,
      accentBg: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
    },
    {
      id: 'users',
      title: bi('ইউজার ও প্যাকেজ নিয়ন্ত্রণ', 'Users & Package Control'),
      meta: bi(
        `মোট ${usersList.length} জন নিবন্ধিত ইউজার · ক্রেডিট ও প্ল্যান`,
        `${usersList.length} registered users · credits & plans`
      ),
      icon: <Users size={20} />,
      accentBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    },
    {
      id: 'settings',
      title: bi('ফি, পেমেন্ট ও কোটা সেটিংস', 'Fees, Payment & Quota Settings'),
      meta: `${monthlyFee || billingConfig.monthlyFee} · ${yearlyFee || billingConfig.yearlyFee} · ${bi(`ফ্রি ${freeDailyLimit}/দিন`, `${freeDailyLimit} free/day`)}`,
      icon: <Settings size={20} />,
      accentBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    },
    {
      id: 'api',
      title: bi('ব্যাকএন্ড সার্ভার ও API সংযোগ', 'Backend Server & API Bridge'),
      meta: apiBaseUrl.trim()
        ? apiBaseUrl.trim()
        : bi('ডিফল্ট সার্ভার URL সক্রিয়', 'Using default server URL'),
      icon: <Globe size={20} />,
      accentBg: 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800',
    },
    {
      id: 'salon-settings',
      title: bi('সেলুন সার্ভিস ও প্রাইস সেটিংস', 'Salon Services & Price Settings'),
      meta: bi(
        `${salonName || salonConfig.salonName} · বুকিং ${isBookingOpen ? 'চালু' : 'বন্ধ'}`,
        `${salonName || salonConfig.salonName} · Booking ${isBookingOpen ? 'Open' : 'Closed'}`
      ),
      icon: <Scissors size={20} />,
      accentBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    },
    {
      id: 'salon-bookings',
      title: bi('সেলুন বুকিং ও সিগনেচার তালিকা', 'Salon Bookings & Signatures'),
      meta: bi(
        `${pendingSalonCount} পেন্ডিং · ${completedSalonCount} সম্পন্ন · মোট ${salonBookings.length}টি`,
        `${pendingSalonCount} pending · ${completedSalonCount} completed · ${salonBookings.length} total`
      ),
      highlight:
        pendingSalonCount > 0 ? bi(`${pendingSalonCount} পেন্ডিং`, `${pendingSalonCount} pending`) : undefined,
      icon: <CalendarDays size={20} />,
      accentBg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    },
    {
      id: 'social-links',
      title: bi('সোশ্যাল মিডিয়া লিংক', 'Social Media Links'),
      meta: bi(
        `${[facebookUrl, instagramUrl, linkedinUrl, youtubeUrl].filter((u) => u.trim().length > 0).length}টি সক্রিয় লিংক · Facebook, Instagram, LinkedIn, YouTube`,
        `${[facebookUrl, instagramUrl, linkedinUrl, youtubeUrl].filter((u) => u.trim().length > 0).length} active links · Facebook, Instagram, LinkedIn, YouTube`
      ),
      icon: <Share2 size={20} />,
      accentBg: 'bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800',
    },
  ];

  const activeOptionMeta = adminMenuOptions.find((opt) => opt.id === activeTab);

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

      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {activeTab !== 'menu' ? (
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setActiveTab('menu');
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[42px]"
                aria-label={bi('সব অপশনে ফিরুন', 'Back to all options')}
              >
                <ArrowLeft size={16} />
                <span>{bi('সব অপশন', 'All Options')}</span>
              </button>
            ) : (
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <Shield size={20} />
              </div>
            )}
            <div className="min-w-0 space-y-0.5">
              <h2
                id="admin-panel-title"
                className="text-xl font-serif font-medium text-zinc-900 dark:text-white leading-snug truncate"
              >
                {activeTab === 'menu'
                  ? bi('শ্রাবণ গো অ্যাডমিন কন্ট্রোল', 'Srabon Go Admin Control')
                  : activeOptionMeta?.title}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed truncate">
                {activeTab === 'menu'
                  ? bi(
                      'যেকোনো একটি অপশনে টাচ করলে সেই বিষয়ের সম্পূর্ণ তথ্য ও নিয়ন্ত্রণ দেখতে পাবেন',
                      'Tap any option below to view and manage all details for that topic'
                    )
                  : activeOptionMeta?.meta}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors shrink-0 min-h-[42px] min-w-[42px] flex items-center justify-center"
            aria-label={bi('বন্ধ করুন', 'Close')}
          >
            <X size={19} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-5">
          {actionError && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-600 dark:text-red-300 flex items-center justify-between gap-3 leading-relaxed">
              <span>{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="underline font-semibold shrink-0"
              >
                {bi('সরিয়ে দিন', 'Dismiss')}
              </button>
            </div>
          )}

          {/* OPTION MENU (Default clean view: Option names only, touch to open details) */}
          {activeTab === 'menu' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {adminMenuOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setActiveTab(option.id);
                  }}
                  className="group w-full text-left p-5 rounded-2xl bg-zinc-50/80 dark:bg-zinc-800/50 hover:bg-white dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all flex items-center justify-between gap-4 min-h-[84px]"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${option.accentBg}`}
                    >
                      {option.icon}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-base sm:text-lg font-medium text-zinc-900 dark:text-white leading-snug">
                          {option.title}
                        </span>
                        {option.highlight && (
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                            · {option.highlight}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 truncate tabular-nums leading-relaxed">
                        {option.meta}
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    size={20}
                    className="text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0"
                  />
                </button>
              ))}
            </div>
          )}

          {/* 1. PRO UPGRADE REQUESTS */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              {requests.length === 0 ? (
                <p className="text-base text-zinc-500 dark:text-zinc-400 text-center py-12">
                  {bi('এখনও কোনো Pro আপগ্রেড রিকোয়েস্ট আসেনি।', 'No Pro upgrade requests yet.')}
                </p>
              ) : (
                requests.map((req) => (
                  <div
                    key={req.id}
                    className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap leading-relaxed">
                        <span className="text-base font-semibold text-zinc-900 dark:text-white">
                          {req.userName || req.userEmail || req.uid}
                        </span>
                        <span className="text-xs sm:text-sm text-zinc-400">·</span>
                        <span
                          className={`text-xs sm:text-sm font-bold ${
                            req.packageType === 'yearly'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-indigo-600 dark:text-indigo-400'
                          }`}
                        >
                          {req.packageType === 'yearly'
                            ? bi('ইয়ারলি (৩৬৫ দিন)', 'Yearly (365d)')
                            : bi('মান্থলি (৩০ দিন)', 'Monthly (30d)')}
                        </span>
                        <span className="text-xs sm:text-sm text-zinc-400">·</span>
                        <span
                          className={`text-xs sm:text-sm font-bold ${
                            req.status === 'approved'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : req.status === 'rejected'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {localizeUpgradeStatus(req.status, lang)}
                        </span>
                      </div>
                      {req.userEmail && (
                        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 truncate">
                          {req.userEmail}
                        </p>
                      )}
                      <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        <strong>{req.paymentMethod}</strong> · {req.amountText} ·{' '}
                        {bi('প্রেরক:', 'Sender:')}{' '}
                        <span className="font-mono tabular-nums">{req.senderNumber}</span> · TrxID:{' '}
                        <span className="font-mono font-semibold">{req.transactionId}</span>
                      </p>
                      {req.note && (
                        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 italic leading-relaxed">
                          &ldquo;{req.note}&rdquo;
                        </p>
                      )}
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleApproveRequest(req)}
                          disabled={busyId === req.id}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 min-h-[42px]"
                        >
                          {busyId === req.id ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={15} />
                          )}
                          <span>{bi('Pro অনুমোদন করুন', 'Approve Pro')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectRequest(req)}
                          disabled={busyId === req.id}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-700 hover:bg-red-100 dark:hover:bg-red-950/60 text-zinc-700 dark:text-zinc-200 hover:text-red-600 dark:hover:text-red-300 text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 min-h-[42px]"
                        >
                          <XCircle size={15} />
                          <span>{bi('বাতিল', 'Reject')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* 2. USERS MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {usersList.length > 0 && (
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder={bi(
                      'নাম, ইমেইল বা UID দিয়ে ইউজার খুঁজুন...',
                      'Search users by name, email, or UID...'
                    )}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm sm:text-base text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
              )}

              {filteredUsers.length === 0 ? (
                <p className="text-base text-zinc-500 dark:text-zinc-400 text-center py-12">
                  {usersList.length === 0
                    ? bi('এখনও কোনো ইউজার নেই।', 'No users yet.')
                    : bi('এই সার্চে কোনো ইউজার পাওয়া যায়নি।', 'No users match your search.')}
                </p>
              ) : (
                <div className="space-y-3.5">
                  {filteredUsers.map((u) => {
                    const expMs =
                      typeof u.proExpiresAt?.toMillis === 'function'
                        ? u.proExpiresAt.toMillis()
                        : null;
                    const isExpired = u.plan === 'pro' && expMs !== null && expMs <= Date.now();
                    return (
                      <div
                        key={u.uid}
                        className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2.5 flex-wrap leading-relaxed">
                            <span className="text-base font-semibold text-zinc-900 dark:text-white truncate">
                              {u.displayName || u.email || u.uid}
                            </span>
                            <span className="text-xs sm:text-sm text-zinc-400">·</span>
                            <span
                              className={`text-xs sm:text-sm font-bold ${
                                u.plan === 'pro' && !isExpired
                                  ? u.proPackageType === 'yearly'
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-indigo-600 dark:text-indigo-400'
                                  : isExpired
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-zinc-600 dark:text-zinc-300'
                              }`}
                            >
                              {isExpired
                                ? bi(
                                    `মেয়াদোত্তীর্ণ (${u.proPackageType === 'yearly' ? 'ইয়ারলি' : 'মান্থলি'})`,
                                    `Expired (${u.proPackageType || 'pro'})`
                                  )
                                : localizePlanLabel(u.plan, u.proPackageType, false, lang)}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed break-words tabular-nums">
                            {u.email || u.uid} · {bi('ব্যবহার', 'Usage')} ({u.lastUsageDate}):{' '}
                            {u.dailyCount} · {bi('ক্রেডিট', 'Credits')}: {u.bonusCredits ?? 0} ·{' '}
                            {bi('রেফার', 'Refs')}: {u.referralCount ?? 0}
                            {u.plan === 'pro' && expMs !== null
                              ? ` · ${bi('মেয়াদ:', 'Exp:')} ${localizeDate(expMs, lang)}`
                              : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleGrantTenCredits(u)}
                            disabled={Boolean(busyId)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 min-h-[40px]"
                            title={bi('+১০ বোনাস ক্রেডিট যোগ করুন', 'Add +10 Bonus Credits')}
                          >
                            {busyId === `cr_${u.uid}` ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <span>{bi('+১০ ক্রেডিট', '+10 Cr')}</span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetUserPackage(u, 'pro', 'monthly')}
                            disabled={Boolean(busyId)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 bg-indigo-600 hover:bg-indigo-500 text-white min-h-[40px]"
                          >
                            {busyId === `${u.uid}_monthly` ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Crown size={13} />
                            )}
                            <span>
                              {u.plan === 'pro' && u.proPackageType === 'monthly' && !isExpired
                                ? bi('রিনিউ ৩০ দিন', 'Renew 30d')
                                : bi('মান্থলি', 'Monthly')}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetUserPackage(u, 'pro', 'yearly')}
                            disabled={Boolean(busyId)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 bg-amber-600 hover:bg-amber-500 text-white min-h-[40px]"
                          >
                            {busyId === `${u.uid}_yearly` ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Crown size={13} />
                            )}
                            <span>
                              {u.plan === 'pro' && u.proPackageType === 'yearly' && !isExpired
                                ? bi('রিনিউ ৩৬৫ দিন', 'Renew 365d')
                                : bi('ইয়ারলি', 'Yearly')}
                            </span>
                          </button>
                          {u.plan === 'pro' && (
                            <button
                              type="button"
                              onClick={() => handleSetUserPackage(u, 'free')}
                              disabled={Boolean(busyId)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 min-h-[40px]"
                            >
                              {busyId === u.uid ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Crown size={14} />
                              )}
                              <span>{bi('ফ্রি করুন', 'Set Free')}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. FEE, PAYMENT & QUOTA SETTINGS */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveConfig} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-2">
                    {bi('Monthly প্যাকেজ ফি (৩০ দিন)', 'Monthly Package Fee (30 Days)')}
                  </label>
                  <input
                    type="text"
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(e.target.value)}
                    maxLength={40}
                    placeholder={bi('যেমন: 50 BDT', 'e.g. 50 BDT')}
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2">
                    {bi('Yearly প্যাকেজ ফি (৩৬৫ দিন)', 'Yearly Package Fee (365 Days)')}
                  </label>
                  <input
                    type="text"
                    value={yearlyFee}
                    onChange={(e) => setYearlyFee(e.target.value)}
                    maxLength={40}
                    placeholder={bi('যেমন: 480 BDT', 'e.g. 480 BDT')}
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                    {bi('ফ্রি দৈনিক লিমিট (১ - ১০০)', 'Free Daily Limit (1 - 100)')}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={freeDailyLimit}
                    onChange={(e) => setFreeDailyLimit(e.target.value)}
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                    {bi('পেমেন্ট মাধ্যম', 'Payment Method')}
                  </label>
                  <input
                    type="text"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    maxLength={60}
                    placeholder={bi('যেমন: bKash / Nagad Personal', 'e.g. bKash / Nagad Personal')}
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                    {bi('আপনার পেমেন্ট নম্বর / অ্যাকাউন্ট', 'Payment Number / Account')}
                  </label>
                  <input
                    type="text"
                    value={paymentAccount}
                    onChange={(e) => setPaymentAccount(e.target.value)}
                    maxLength={80}
                    placeholder="01XXXXXXXXX"
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                  {bi('ইউজারদের জন্য নির্দেশনা', 'Instructions for Users')}
                </label>
                <textarea
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  maxLength={500}
                  className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white resize-none leading-relaxed"
                />
              </div>

              {savedBanner && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{bi('সেটিংস সফলভাবে সেভ হয়েছে!', 'Settings saved successfully!')}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={savingConfig}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-900 dark:bg-indigo-600 hover:bg-zinc-800 dark:hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {savingConfig ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{bi('ফি ও কোটা সেভ করুন', 'Save Fee & Quota Settings')}</span>
              </button>
            </form>
          )}

          {/* 4. BACKEND SERVER & API BRIDGE */}
          {activeTab === 'api' && (
            <form onSubmit={handleSaveConfig} className="space-y-5">
              <div className="p-5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/25 border border-sky-200/80 dark:border-sky-900/60 space-y-4">
                <div className="flex items-center gap-2 text-base font-semibold text-sky-700 dark:text-sky-300">
                  <Globe size={18} />
                  <span>{bi('ডায়নামিক ব্যাকএন্ড API URL (GitHub Pages ব্রিজ)', 'Dynamic Backend API URL (GitHub Pages Bridge)')}</span>
                </div>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {bi(
                    'GitHub Pages স্ট্যাটিক হোস্ট হলেও, এখানে আপনার লাইভ Node/Render সার্ভার URL সেভ করলে সব ইউজারের জন্য সাথে সাথে রিয়েল-টাইম Gemini ভয়েস ও AI ট্রেন্ডিং আইডিয়া ডায়নামিকভাবে চালু হয়ে যাবে (কোড রিবিল্ড ছাড়াই)।',
                    'Even on static hosting like GitHub Pages, saving your live Node/Render server URL here dynamically enables real-time Gemini voices and AI trending ideas for all users without rebuilding.'
                  )}
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="url"
                    value={apiBaseUrl}
                    onChange={(e) => {
                      setApiBaseUrl(e.target.value);
                      setApiTestResult(null);
                    }}
                    maxLength={200}
                    placeholder="https://srabon-go-api.onrender.com"
                    className="flex-1 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleTestApiConnection}
                    disabled={testingApi}
                    className="px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    {testingApi ? bi('পরীক্ষা হচ্ছে...', 'Testing...') : bi('সংযোগ পরীক্ষা করুন', 'Test Connection')}
                  </button>
                </div>
                {apiTestResult === 'ok' && (
                  <p className="text-xs sm:text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {bi(
                      '✓ সার্ভার সফলভাবে সংযুক্ত আছে (/api/health OK)! এখন Save বাটনে চাপুন।',
                      '✓ Server connected successfully (/api/health OK)! Click Save to apply.'
                    )}
                  </p>
                )}
                {apiTestResult === 'fail' && (
                  <p className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-400">
                    {bi(
                      '✕ এই URL-এ /api/health পাওয়া যায়নি। Render/Node সার্ভার চালু আছে কি না ও সঠিক URL দিয়েছেন কি না যাচাই করুন।',
                      '✕ /api/health could not be reached at this URL. Verify that your server is running and the URL is correct.'
                    )}
                  </p>
                )}
              </div>

              {savedBanner && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{bi('সার্ভার URL সফলভাবে সেভ হয়েছে!', 'Server URL saved successfully!')}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={savingConfig}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-900 dark:bg-sky-600 hover:bg-zinc-800 dark:hover:bg-sky-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {savingConfig ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{bi('API সেটিংস সেভ করুন', 'Save API Settings')}</span>
              </button>
            </form>
          )}

          {/* 4B. SOCIAL MEDIA LINKS */}
          {activeTab === 'social-links' && (
            <form onSubmit={handleSaveSocialLinks} className="space-y-5">
              <div className="p-5 rounded-2xl bg-violet-50/70 dark:bg-violet-950/25 border border-violet-200/80 dark:border-violet-900/60 space-y-2">
                <div className="flex items-center gap-2 text-base font-semibold text-violet-700 dark:text-violet-300">
                  <Share2 size={18} />
                  <span>{bi('শ্রাবণ গো সোশ্যাল মিডিয়া লিংক পরিচালনা', 'Manage Srabon Go Social Media Links')}</span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {bi(
                    'এখান থেকে Facebook, Instagram, LinkedIn এবং YouTube লিংক যোগ বা পরিবর্তন করলে লগইনের আগে, ফুটারে এবং ৩-ডট মেনুতে সাথে সাথে আপডেট হবে। কোনো প্ল্যাটফর্ম না দেখাতে চাইলে বক্স খালি রাখুন।',
                    'Add or edit Facebook, Instagram, LinkedIn, and YouTube links here. Changes sync instantly to the pre-login page, home footer, and 3-dot menu. Leave any box blank to hide it.'
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-2">
                    Facebook URL
                  </label>
                  <input
                    type="text"
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    maxLength={300}
                    placeholder="https://www.facebook.com/srabongo"
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-2">
                    Instagram URL
                  </label>
                  <input
                    type="text"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    maxLength={300}
                    placeholder="https://www.instagram.com/srabongo"
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-2">
                    LinkedIn URL
                  </label>
                  <input
                    type="text"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    maxLength={300}
                    placeholder="https://www.linkedin.com/company/srabongo"
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-2">
                    YouTube URL ({bi('ঐচ্ছিক', 'Optional')})
                  </label>
                  <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    maxLength={300}
                    placeholder="https://www.youtube.com/@srabongo"
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              {savedSocialBanner && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{bi('সোশ্যাল মিডিয়া লিংক সফলভাবে সেভ হয়েছে!', 'Social media links saved successfully!')}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={savingSocialLinks}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {savingSocialLinks ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{bi('সোশ্যাল লিংক সেভ করুন', 'Save Social Links')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFacebookUrl(DEFAULT_SOCIAL_LINKS.facebookUrl);
                    setInstagramUrl(DEFAULT_SOCIAL_LINKS.instagramUrl);
                    setLinkedinUrl(DEFAULT_SOCIAL_LINKS.linkedinUrl);
                    setYoutubeUrl(DEFAULT_SOCIAL_LINKS.youtubeUrl);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-sm font-semibold transition-colors"
                >
                  <RotateCcw size={15} />
                  <span>{bi('ডিফল্ট রিসেট', 'Reset Defaults')}</span>
                </button>
              </div>
            </form>
          )}

          {/* 5. SALON SERVICE & PRICE SETTINGS */}
          {(activeTab === 'salon-settings' || activeTab === 'salon') && (
            <form onSubmit={handleSaveSalonConfig} className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                    {bi('সেলুন সার্ভিস নাম ও বুকিং প্রাইস সেটিংস', 'Salon Service Names & Price Settings')}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {bi(
                      'এখান থেকে বুকিং ফি ও প্রতিটি সার্ভিসের নাম এবং দাম পরিবর্তন করলে সাথে সাথে সব ইউজারের পেজে আপডেট হবে।',
                      'Updating the booking fee or any service name and price here updates every user page in real time.'
                    )}
                  </p>
                </div>
                <label className="inline-flex items-center gap-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isBookingOpen}
                    onChange={(e) => setIsBookingOpen(e.target.checked)}
                    className="rounded border-zinc-300 dark:border-zinc-700 text-amber-600 focus:ring-amber-500 w-4 h-4"
                  />
                  <span>{bi('অনলাইন বুকিং চালু রাখুন', 'Keep Online Booking Open')}</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                    {bi('সেলুনের নাম', 'Salon Name')}
                  </label>
                  <input
                    type="text"
                    value={salonName}
                    onChange={(e) => setSalonName(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                      {bi('কারেন্সি (৳ / BDT)', 'Currency (৳ / BDT)')}
                    </label>
                    <input
                      type="text"
                      value={currencySymbol}
                      onChange={(e) => setCurrencySymbol(e.target.value)}
                      maxLength={10}
                      placeholder="৳"
                      className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2">
                      {bi('বুকিং ফি', 'Booking Fee')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50000}
                      value={bookingFee}
                      onChange={(e) => setBookingFee(e.target.value)}
                      className="w-full rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 px-3.5 py-2.5 text-sm sm:text-base font-semibold text-zinc-900 dark:text-white tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Editable Bilingual Service Names & Prices Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(
                  [
                    {
                      meta: SALON_SERVICES[0],
                      titleEnVal: haircutTitle,
                      setTitleEnVal: setHaircutTitle,
                      titleBnVal: haircutTitleBn,
                      setTitleBnVal: setHaircutTitleBn,
                      priceVal: haircutPrice,
                      setPriceVal: setHaircutPrice,
                    },
                    {
                      meta: SALON_SERVICES[1],
                      titleEnVal: beardTrimTitle,
                      setTitleEnVal: setBeardTrimTitle,
                      titleBnVal: beardTrimTitleBn,
                      setTitleBnVal: setBeardTrimTitleBn,
                      priceVal: beardTrimPrice,
                      setPriceVal: setBeardTrimPrice,
                    },
                    {
                      meta: SALON_SERVICES[2],
                      titleEnVal: shaveTitle,
                      setTitleEnVal: setShaveTitle,
                      titleBnVal: shaveTitleBn,
                      setTitleBnVal: setShaveTitleBn,
                      priceVal: shavePrice,
                      setPriceVal: setShavePrice,
                    },
                    {
                      meta: SALON_SERVICES[3],
                      titleEnVal: hairColorTitle,
                      setTitleEnVal: setHairColorTitle,
                      titleBnVal: hairColorTitleBn,
                      setTitleBnVal: setHairColorTitleBn,
                      priceVal: hairColorPrice,
                      setPriceVal: setHairColorPrice,
                    },
                    {
                      meta: SALON_SERVICES[4],
                      titleEnVal: facialTitle,
                      setTitleEnVal: setFacialTitle,
                      titleBnVal: facialTitleBn,
                      setTitleBnVal: setFacialTitleBn,
                      priceVal: facialPrice,
                      setPriceVal: setFacialPrice,
                    },
                    {
                      meta: SALON_SERVICES[5],
                      titleEnVal: comboTitle,
                      setTitleEnVal: setComboTitle,
                      titleBnVal: comboTitleBn,
                      setTitleBnVal: setComboTitleBn,
                      priceVal: comboPrice,
                      setPriceVal: setComboPrice,
                    },
                  ] as const
                ).map((item) => {
                  const defaultEn = localizeSalonService(item.meta.key, 'en').primaryTitle;
                  const defaultBn = localizeSalonService(item.meta.key, 'bn').primaryTitle;
                  const isModified =
                    isCustomSalonServiceTitle(item.meta.key, item.titleEnVal) ||
                    isCustomSalonServiceTitle(item.meta.key, item.titleBnVal);
                  return (
                    <div
                      key={item.meta.key}
                      className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                          {item.meta.number}. {bi('সার্ভিসের নাম (বাংলা + EN) ও মূল্য', 'Service Name (BN + EN) & Price')}
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              if (lang === 'bn' && item.titleBnVal.trim()) {
                                item.setTitleEnVal(translateSalonServiceText(item.titleBnVal, 'en'));
                              } else if (item.titleEnVal.trim()) {
                                item.setTitleBnVal(translateSalonServiceText(item.titleEnVal, 'bn'));
                              } else if (item.titleBnVal.trim()) {
                                item.setTitleEnVal(translateSalonServiceText(item.titleBnVal, 'en'));
                              }
                            }}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 underline-offset-2 hover:underline transition-colors"
                          >
                            {bi('অটো অনুবাদ', 'Auto-Translate')}
                          </button>
                          {isModified && (
                            <button
                              type="button"
                              onClick={() => {
                                item.setTitleEnVal(defaultEn);
                                item.setTitleBnVal(defaultBn);
                              }}
                              className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white underline-offset-2 hover:underline transition-colors"
                            >
                              {bi('ডিফল্ট নাম', 'Reset Name')}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                            {bi('বাংলা নাম (Bengali Name)', 'Bengali Name (বাংলা)')}
                          </label>
                          <input
                            type="text"
                            required
                            minLength={2}
                            maxLength={100}
                            value={item.titleBnVal}
                            onChange={(e) => item.setTitleBnVal(e.target.value)}
                            placeholder={defaultBn}
                            className="w-full rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white min-h-[42px]"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                          <div className="sm:col-span-8">
                            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                              {bi('ইংরেজি নাম (English Name)', 'English Name')}
                            </label>
                            <input
                              type="text"
                              required
                              minLength={2}
                              maxLength={100}
                              value={item.titleEnVal}
                              onChange={(e) => item.setTitleEnVal(e.target.value)}
                              placeholder={defaultEn}
                              className="w-full rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white min-h-[42px]"
                            />
                          </div>
                          <div className="sm:col-span-4">
                            <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-1.5">
                              {bi('মূল্য', 'Price')} ({currencySymbol || salonConfig.currencySymbol})
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={50000}
                              value={item.priceVal}
                              onChange={(e) => item.setPriceVal(e.target.value)}
                              className="w-full rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base font-semibold text-zinc-900 dark:text-white tabular-nums min-h-[42px]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Location / Phone / Hours */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                    {bi('ঠিকানা', 'Address')}
                  </label>
                  <input
                    type="text"
                    value={salonAddress}
                    onChange={(e) => setSalonAddress(e.target.value)}
                    maxLength={200}
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                    {bi('ফোন / WhatsApp নম্বর', 'Phone / WhatsApp Number')}
                  </label>
                  <input
                    type="text"
                    value={salonPhone}
                    onChange={(e) => setSalonPhone(e.target.value)}
                    maxLength={30}
                    placeholder="017XXXXXXXX"
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                    {bi('খোলা থাকার সময়', 'Opening Hours')}
                  </label>
                  <input
                    type="text"
                    value={salonOpenHours}
                    onChange={(e) => setSalonOpenHours(e.target.value)}
                    maxLength={80}
                    className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm sm:text-base text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              {savedSalonBanner && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{bi('সেলুনের সার্ভিস নাম, প্রাইস ও তথ্য সফলভাবে সেভ হয়েছে!', 'Salon service names, prices, and details saved successfully!')}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={savingSalon}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {savingSalon ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>{bi('সেলুন সেটিংস সেভ করুন', 'Save Salon Settings')}</span>
              </button>
            </form>
          )}

          {/* 6. SALON BOOKINGS & COMPLETION SIGNATURES */}
          {activeTab === 'salon-bookings' && (
            <div className="space-y-4">
              {salonBookings.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 w-fit">
                  {(
                    [
                      { id: 'all', labelBn: 'সবগুলো', labelEn: 'All' },
                      { id: 'pending', labelBn: 'পেন্ডিং', labelEn: 'Pending' },
                      { id: 'confirmed', labelBn: 'নিশ্চিত', labelEn: 'Confirmed' },
                      { id: 'completed', labelBn: 'সম্পন্ন', labelEn: 'Completed' },
                      { id: 'cancelled', labelBn: 'বাতিল', labelEn: 'Cancelled' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setBookingStatusFilter(f.id)}
                      className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        bookingStatusFilter === f.id
                          ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                          : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      {bi(f.labelBn, f.labelEn)}
                    </button>
                  ))}
                </div>
              )}

              {filteredSalonBookings.length === 0 ? (
                <p className="text-base text-zinc-500 dark:text-zinc-400 py-12 text-center">
                  {salonBookings.length === 0
                    ? bi('এখনও কোনো সেলুন বুকিং আসেনি।', 'No salon bookings received yet.')
                    : bi('এই ফিল্টারে কোনো বুকিং নেই।', 'No bookings match this filter.')}
                </p>
              ) : (
                <div className="space-y-3.5">
                  {filteredSalonBookings.map((b) => (
                    <div
                      key={b.id}
                      className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-2 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap leading-relaxed">
                          {typeof b.serialNumber === 'number' && (
                            <span className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                              #{b.serialNumber} ·
                            </span>
                          )}
                          <span className="text-base font-semibold text-zinc-900 dark:text-white">
                            {b.customerName}
                          </span>
                          <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">
                            ({b.customerPhone})
                          </span>
                          <span
                            className={`text-xs sm:text-sm font-bold ${
                              b.status === 'confirmed'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : b.status === 'completed'
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : b.status === 'cancelled'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            · {localizeBookingStatus(b.status, lang)}
                          </span>
                          {b.autoCancelledReason === 'time_expired' && (
                            <span className="text-xs sm:text-sm font-semibold text-rose-600 dark:text-rose-400">
                              · {bi('সময় পার হওয়ায় অটো-ক্যানসেল', 'Auto-cancelled (Expired)')}
                            </span>
                          )}
                          {b.couponCode && (
                            <span className="text-xs sm:text-sm font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                              · {bi('AI কুপন:', 'AI Coupon:')} {b.couponCode}
                              {typeof b.discountPercent === 'number' ? ` (-${b.discountPercent}%)` : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 tabular-nums leading-relaxed">
                          <strong>
                            {b.serviceKey
                              ? localizeSalonService(b.serviceKey, lang, salonConfig, b.serviceTitle).primaryTitle
                              : b.serviceTitle}
                          </strong>{' '}
                          · {bi('নির্ধারিত স্লট:', 'Slot:', 'Horário:')} {b.bookingDate} ({b.timeSlot}) ·{' '}
                          {bi('বিল:', 'Bill:', 'Valor:')}{' '}
                          {formatSalonPrice(b.totalPrice, currencySymbol || salonConfig.currencySymbol)}
                          {typeof b.discountAmount === 'number' && b.discountAmount > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {' '}
                              ({bi('ছাড়:', 'Discount:', 'Desconto:')} -
                              {formatSalonPrice(
                                b.discountAmount,
                                currencySymbol || salonConfig.currencySymbol
                              )}
                              )
                            </span>
                          )}
                        </p>
                        {(() => {
                          const bookedStamp = formatBookingCreatedTimestamp(b.createdAt, lang);
                          const bookedEarlierDay = Boolean(
                            bookedStamp && bookedStamp.localDateKey < b.bookingDate
                          );
                          return (
                            <div className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/35 border border-amber-200/80 dark:border-amber-800/60 text-xs sm:text-sm tabular-nums">
                              <Clock size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                              <span className="font-medium text-amber-800 dark:text-amber-200">
                                {bi('বুকিং করার তারিখ ও সময়:', 'Booked Date & Time:', 'Data e Hora da Reserva:')}
                              </span>
                              <span className="font-semibold text-zinc-900 dark:text-white">
                                {bookedStamp ? bookedStamp.dateTimeLabel : bi('এইমাত্র', 'Just now', 'Agora mesmo')}
                              </span>
                              {bookedEarlierDay && (
                                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                  ({bi('আগের দিন বুকিং', 'Booked day before', 'Reservado antes')})
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        {b.notes && (
                          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 italic leading-relaxed">
                            {bi('নোট:', 'Note:')} {b.notes}
                          </p>
                        )}
                        {(b.completionSignaturePath || b.shopSignaturePath) && (
                          <div className="pt-2 flex flex-wrap items-center gap-4">
                            {b.completionSignaturePath && (
                              <div className="flex items-center gap-2.5">
                                <div className="rounded-xl bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 px-2.5 py-1">
                                  <svg
                                    viewBox="0 0 480 170"
                                    className="w-24 h-8 text-amber-600 dark:text-amber-400"
                                    aria-label={bi('কাস্টমারের কমপ্লিট সিগনেচার', 'Customer completion signature')}
                                  >
                                    <path
                                      d={b.completionSignaturePath}
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="6"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </div>
                                <span className="text-xs font-medium text-amber-700 dark:text-amber-300 leading-snug">
                                  {bi('কাস্টমার:', 'Customer:')} {b.completionSignerName || b.customerName}
                                </span>
                              </div>
                            )}
                            {b.shopSignaturePath && (
                              <div className="flex items-center gap-2.5">
                                <div className="rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1">
                                  <svg
                                    viewBox="0 0 480 170"
                                    className="w-24 h-8 text-emerald-600 dark:text-emerald-400"
                                    aria-label={bi('দোকানদারের কমপ্লিট সিগনেচার', 'Shopkeeper completion signature')}
                                  >
                                    <path
                                      d={b.shopSignaturePath}
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="6"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </div>
                                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300 leading-snug">
                                  {bi('দোকানদার:', 'Shopkeeper:')} {b.shopSignerName || salonConfig.salonName}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {b.status === 'pending' && (
                          <button
                            type="button"
                            disabled={busyId === `bk_${b.id}`}
                            onClick={() => handleUpdateBookingStatus(b, 'confirmed')}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 min-h-[40px]"
                          >
                            {bi('নিশ্চিত করুন', 'Confirm')}
                          </button>
                        )}
                        {b.status !== 'cancelled' && !b.shopSignaturePath && (
                          <button
                            type="button"
                            disabled={busyId === `bk_${b.id}`}
                            onClick={() => setSigningTargetBooking(b)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 min-h-[40px]"
                          >
                            <PenTool size={13} />
                            <span>{bi('দোকানদার সিগনেচারে সম্পন্ন করুন', 'Shop Sign & Complete')}</span>
                          </button>
                        )}
                        {(b.status === 'pending' || b.status === 'confirmed') && (
                          <button
                            type="button"
                            disabled={busyId === `bk_${b.id}`}
                            onClick={() => handleUpdateBookingStatus(b, 'cancelled')}
                            className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-700 hover:bg-red-100 dark:hover:bg-red-950/60 text-zinc-700 dark:text-zinc-200 hover:text-red-600 dark:hover:text-red-300 text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 min-h-[40px]"
                          >
                            {bi('বাতিল', 'Cancel')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {signingTargetBooking && (
        <CompletionSignatureModal
          title={bi('দোকানদারের কমপ্লিট সিগনেচার', 'Shopkeeper Completion Signature')}
          subtitle={`${
            typeof signingTargetBooking.serialNumber === 'number'
              ? `#${signingTargetBooking.serialNumber} · `
              : ''
          }${signingTargetBooking.customerName} · ${signingTargetBooking.timeSlot}`}
          defaultSignerName={salonName.trim() || salonConfig.salonName}
          signerLabel={bi('দোকানদার / প্রতিষ্ঠানের নাম', 'Shopkeeper / Salon Name')}
          namePlaceholder={bi('দোকানদার বা সেলুনের নাম লিখুন', 'Enter shopkeeper or salon name')}
          submitLabel={bi('দোকানদারের সিগনেচারে সম্পন্ন করুন', 'Confirm with Shopkeeper Signature')}
          onClose={() => setSigningTargetBooking(null)}
          onSubmit={handleAdminSubmitSignature}
        />
      )}
    </div>
  );
};

export default AdminPanelModal;
