/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BellRing,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Hash,
  Loader2,
  MapPin,
  MessageCircle,
  PenTool,
  Phone,
  Scissors,
  Shield,
  Smartphone,
  Sparkles,
  Ticket,
  Users,
  XCircle,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, reportFirestoreError, OperationType } from '../firebase';
import { reportAppIssue } from '../utils/appIssues';
import {
  SalonBooking,
  SalonConfig,
  SalonCoupon,
  SalonQueueSummary,
  SalonQueueTicket,
  SalonServiceKey,
} from '../types';
import {
  SALON_LATE_GRACE_MINUTES,
  SALON_SERVICES,
  SALON_TIME_SLOTS,
  SALON_TURN_ALERT_MINUTES,
  buildSalonWhatsAppUrl,
  calculateSalonDiscount,
  formatSalonPrice,
  getMsUntilSlot,
  getSlotCutoffLabel,
  isBookingTimeExpired,
  parseTimeSlotToMinutes,
  playTurnAlertChime,
  requestTurnNotificationPermission,
  sendTurnNotification,
} from '../utils/salon';
import { generateAiSalonCoupon } from '../utils/salonCoupon';
import { STUDIO_MEDIA } from '../utils/studioAlbums';
import {
  copyTextSafely,
  extractTimestampMillis,
  formatBookingCreatedTimestamp,
  localizeBookingStatus,
  localizeSalonService,
  useLanguage,
} from '../utils/i18n';
import CompletionSignatureModal from './CompletionSignatureModal';
import PWAInstallButton from './PWAInstallButton';
import { fetchSalonSmartInsights, SmartSalonInsights } from '../utils/smartEngine';

interface SalonBookingPageProps {
  user: User;
  isAdmin: boolean;
  salonConfig: SalonConfig;
  onBackHome: () => void;
  onOpenAdminPanel?: () => void;
}

function getTodayLocalDate(dateObj: Date = new Date()): string {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTomorrowLocalDate(dateObj: Date = new Date()): string {
  const next = new Date(dateObj);
  next.setDate(next.getDate() + 1);
  return getTodayLocalDate(next);
}

function getMaxBookingDate(dateObj: Date = new Date()): string {
  const future = new Date(dateObj);
  future.setDate(future.getDate() + 30);
  return getTodayLocalDate(future);
}

function getInitialBookingTarget(): { date: string; slot: string } {
  const now = Date.now();
  const today = getTodayLocalDate(new Date(now));
  const todayOpenSlot = SALON_TIME_SLOTS.find((s) => !isBookingTimeExpired(today, s, now, 0));
  if (todayOpenSlot) {
    return { date: today, slot: todayOpenSlot };
  }
  return {
    date: getTomorrowLocalDate(new Date(now)),
    slot: SALON_TIME_SLOTS[0],
  };
}

const SalonBookingPage: React.FC<SalonBookingPageProps> = ({
  user,
  isAdmin,
  salonConfig,
  onBackHome,
  onOpenAdminPanel,
}) => {
  const { lang, bi } = useLanguage();
  const biRef = useRef(bi);
  biRef.current = bi;

  const [initialTarget] = useState(getInitialBookingTarget);
  const [selectedServiceKey, setSelectedServiceKey] = useState<SalonServiceKey>('haircut');
  const [bookingDate, setBookingDate] = useState<string>(initialTarget.date);
  const [timeSlot, setTimeSlot] = useState<string>(initialTarget.slot);
  const [customerName, setCustomerName] = useState<string>(
    user.displayName || user.email?.split('@')[0] || ''
  );
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);
  const [lastSubmittedWhatsAppUrl, setLastSubmittedWhatsAppUrl] = useState<string | null>(null);
  const [myBookings, setMyBookings] = useState<SalonBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  // Live queue, clock, auto-cancel, 5-min turn alert, completion signature
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [queueDate, setQueueDate] = useState<string>(() => getTodayLocalDate());
  const [queueSummary, setQueueSummary] = useState<SalonQueueSummary | null>(null);
  const [queueTickets, setQueueTickets] = useState<SalonQueueTicket[]>([]);
  const [separateTodayTickets, setSeparateTodayTickets] = useState<SalonQueueTicket[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [autoCancelNotice, setAutoCancelNotice] = useState<string | null>(null);
  const [signingBooking, setSigningBooking] = useState<SalonBooking | null>(null);
  const [smartInsights, setSmartInsights] = useState<SmartSalonInsights | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [turnAlertBanner, setTurnAlertBanner] = useState<{
    bookingId: string;
    serialNumber?: number;
    timeSlot: string;
    title: string;
    message: string;
  } | null>(null);

  const isMountedRef = useRef(true);
  const copiedCouponTimerRef = useRef<number | null>(null);
  const autoCancellingIdsRef = useRef<Set<string>>(new Set());
  const notifiedTurnKeysRef = useRef<Set<string>>(new Set());

  const [coupon, setCoupon] = useState<SalonCoupon | null>(null);
  const [loadingCoupon, setLoadingCoupon] = useState(true);
  const [generatingCoupon, setGeneratingCoupon] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<string | null>(null);
  const [applyCoupon, setApplyCoupon] = useState(false);
  const [copiedCoupon, setCopiedCoupon] = useState(false);
  const [copiedSalonAppLink, setCopiedSalonAppLink] = useState(false);
  const copiedSalonAppTimerRef = useRef<number | null>(null);

  const isEmailVerified = Boolean(user.emailVerified);
  const canApplyCoupon =
    isEmailVerified && coupon !== null && coupon.status === 'available' && applyCoupon;

  const selectedService =
    SALON_SERVICES.find((s) => s.key === selectedServiceKey) || SALON_SERVICES[0];
  const localizedSelected = localizeSalonService(selectedService.key, lang, salonConfig);
  const currentServicePrice = salonConfig[selectedService.priceField];
  const currentBookingFee = salonConfig.bookingFee;
  const discountAmount =
    canApplyCoupon && coupon
      ? calculateSalonDiscount(currentServicePrice, coupon.discountPercent)
      : 0;
  const totalPayable = Math.max(0, currentServicePrice + currentBookingFee - discountAmount);

  const displayOpenHours =
    salonConfig.openHours === 'সকাল ৯:০০ টা – রাত ১০:০০ টা (প্রতিদিন)'
      ? bi('সকাল ৯:০০ টা – রাত ১০:০০ টা (প্রতিদিন)', '9:00 AM – 10:00 PM (Daily)')
      : salonConfig.openHours;

  const liveWhatsAppUrl = buildSalonWhatsAppUrl({
    salonName: salonConfig.salonName,
    adminPhone: salonConfig.phone,
    customerName,
    customerPhone,
    serviceTitle: localizedSelected.secondaryTitle
      ? `${localizedSelected.primaryTitle} (${localizedSelected.secondaryTitle})`
      : localizedSelected.primaryTitle,
    bookingDate,
    timeSlot,
    couponCode: canApplyCoupon && coupon ? coupon.code : undefined,
    discountLabel:
      canApplyCoupon && coupon
        ? bi(
            `${coupon.discountPercent}% ছাড় / -${formatSalonPrice(discountAmount, salonConfig.currencySymbol)}`,
            `${coupon.discountPercent}% off / -${formatSalonPrice(discountAmount, salonConfig.currencySymbol)}`
          )
        : undefined,
    totalPriceLabel: formatSalonPrice(totalPayable, salonConfig.currencySymbol),
    notes,
    lang,
  });

  const todayStr = useMemo(() => getTodayLocalDate(new Date(nowMs)), [nowMs]);
  const hasAnyOpenSlot = useMemo(
    () => SALON_TIME_SLOTS.some((s) => !isBookingTimeExpired(bookingDate, s, nowMs, 0)),
    [bookingDate, nowMs]
  );

  // Mount tracking + 15-second live ticker for slot expiry & turn countdown
  useEffect(() => {
    isMountedRef.current = true;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 15_000);
    return () => {
      isMountedRef.current = false;
      window.clearInterval(id);
      if (copiedCouponTimerRef.current !== null) {
        window.clearTimeout(copiedCouponTimerRef.current);
      }
    };
  }, []);

  // Auto-select nearest upcoming slot if selected slot becomes expired on bookingDate
  useEffect(() => {
    if (isBookingTimeExpired(bookingDate, timeSlot, nowMs, 0)) {
      const nextOpen = SALON_TIME_SLOTS.find((s) => !isBookingTimeExpired(bookingDate, s, nowMs, 0));
      if (nextOpen && nextOpen !== timeSlot) {
        setTimeSlot(nextOpen);
      }
    }
  }, [bookingDate, timeSlot, nowMs]);

  useEffect(() => {
    if (!user.emailVerified) {
      setMyBookings([]);
      setLoadingBookings(false);
      return;
    }
    const q = query(
      collection(db, 'salonBookings'),
      where('uid', '==', user.uid)
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: SalonBooking[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data({ serverTimestamps: 'estimate' }) as Omit<SalonBooking, 'id'>),
        }));
        list.sort((a, b) => {
          const at = extractTimestampMillis(a.createdAt) ?? 0;
          const bt = extractTimestampMillis(b.createdAt) ?? 0;
          return bt - at;
        });
        setMyBookings(list);
        setLoadingBookings(false);
      },
      (error) => {
        setLoadingBookings(false);
        reportFirestoreError(error, OperationType.LIST, 'salonBookings');
      }
    );
    return () => unsubscribe();
  }, [user.uid, user.emailVerified]);

  // Live non-PII Daily Serial Queue Summary + Tickets listener
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(queueDate)) return;
    setLoadingQueue(true);

    const summaryRef = doc(db, 'salonQueues', queueDate);
    const unsubSummary = onSnapshot(
      summaryRef,
      (snap) => {
        if (snap.exists()) {
          setQueueSummary(snap.data() as SalonQueueSummary);
        } else {
          setQueueSummary(null);
        }
      },
      (error) => {
        reportFirestoreError(error, OperationType.GET, `salonQueues/${queueDate}`);
      }
    );

    const ticketsQuery = query(
      collection(db, 'salonQueues', queueDate, 'tickets'),
      where('serialNumber', '>=', 1),
      limit(200)
    );
    const unsubTickets = onSnapshot(
      ticketsQuery,
      (snapshot) => {
        const list: SalonQueueTicket[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data({ serverTimestamps: 'estimate' }) as Omit<SalonQueueTicket, 'id'>),
        }));
        list.sort((a, b) => a.serialNumber - b.serialNumber);
        setQueueTickets(list);
        setLoadingQueue(false);
      },
      (error) => {
        setLoadingQueue(false);
        reportFirestoreError(error, OperationType.LIST, `salonQueues/${queueDate}/tickets`);
      }
    );

    return () => {
      unsubSummary();
      unsubTickets();
    };
  }, [queueDate]);

  // Dedicated live listener for today's tickets whenever queueDate points to a different day
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(todayStr) || queueDate === todayStr) {
      setSeparateTodayTickets([]);
      return;
    }
    const todayTicketsQuery = query(
      collection(db, 'salonQueues', todayStr, 'tickets'),
      where('serialNumber', '>=', 1),
      limit(200)
    );
    const unsubToday = onSnapshot(
      todayTicketsQuery,
      (snapshot) => {
        const list: SalonQueueTicket[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data({ serverTimestamps: 'estimate' }) as Omit<SalonQueueTicket, 'id'>),
        }));
        list.sort((a, b) => a.serialNumber - b.serialNumber);
        setSeparateTodayTickets(list);
      },
      (error) => {
        reportFirestoreError(error, OperationType.LIST, `salonQueues/${todayStr}/tickets`);
      }
    );
    return () => unsubToday();
  }, [queueDate, todayStr]);

  useEffect(() => {
    const couponRef = doc(db, 'salonCoupons', user.uid);
    const unsubscribe = onSnapshot(
      couponRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as SalonCoupon;
          setCoupon(data);
          if (data.status === 'used') {
            setApplyCoupon(false);
          }
        } else {
          setCoupon(null);
          setApplyCoupon(false);
        }
        setLoadingCoupon(false);
      },
      (error) => {
        setLoadingCoupon(false);
        reportFirestoreError(error, OperationType.GET, `salonCoupons/${user.uid}`);
      }
    );
    return () => unsubscribe();
  }, [user.uid]);

  // Auto-cancel user's overdue active bookings (+ 10 min grace period)
  useEffect(() => {
    if (!user.emailVerified || myBookings.length === 0) return;

    const overdue = myBookings.filter(
      (b) =>
        (b.status === 'pending' || b.status === 'confirmed') &&
        isBookingTimeExpired(b.bookingDate, b.timeSlot, nowMs) &&
        !autoCancellingIdsRef.current.has(b.id)
    );
    if (overdue.length === 0) return;

    overdue.forEach(async (b) => {
      autoCancellingIdsRef.current.add(b.id);
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

        if (!isMountedRef.current) return;
        const serialLabel = typeof b.serialNumber === 'number' ? `#${b.serialNumber}` : b.timeSlot;
        setAutoCancelNotice(
          biRef.current(
            `নির্ধারিত সময় (${b.timeSlot} + ${SALON_LATE_GRACE_MINUTES} মি.) পার হওয়ায় আপনার সিরিয়াল ${serialLabel} অটো-ক্যানসেল হয়ে গেছে।`,
            `Your booking (${serialLabel} at ${b.timeSlot}) exceeded the ${SALON_LATE_GRACE_MINUTES}-min grace window and was automatically cancelled.`
          )
        );
      } catch (error) {
        autoCancellingIdsRef.current.delete(b.id);
        reportFirestoreError(error, OperationType.UPDATE, `salonBookings/${b.id}`);
      }
    });
  }, [myBookings, nowMs, user.emailVerified]);

  // Live Queue insights & 5-minute before turn notifications
  const todayTickets = useMemo(() => {
    return queueDate === todayStr ? queueTickets : separateTodayTickets;
  }, [queueDate, todayStr, queueTickets, separateTodayTickets]);

  const queueStats = useMemo(() => {
    const total = Math.max(queueTickets.length, queueSummary?.totalSerials ?? 0);
    const completed = queueTickets.filter((t) => t.status === 'completed').length;
    const cancelled = queueTickets.filter((t) => t.status === 'cancelled').length;
    const active = queueTickets.filter((t) => t.status === 'pending' || t.status === 'confirmed').length;
    const currentServing =
      queueTickets.find((t) => t.status === 'confirmed') ||
      queueTickets.find((t) => t.status === 'pending') ||
      null;
    const myTicketsOnDate = queueTickets.filter((t) => t.uid === user.uid);
    return { total, completed, cancelled, active, currentServing, myTicketsOnDate };
  }, [queueTickets, queueSummary, user.uid]);

  const nowMinuteBucket = Math.floor(nowMs / 60000);
  useEffect(() => {
    const controller = new AbortController();
    const nowDateObj = new Date(nowMs);
    const nowMinutes = nowDateObj.getHours() * 60 + nowDateObj.getMinutes();
    const activeDateTickets =
      queueDate === bookingDate
        ? queueTickets
        : bookingDate === todayStr
        ? separateTodayTickets
        : [];

    const timer = window.setTimeout(() => {
      fetchSalonSmartInsights({
        bookingDate,
        todayDate: todayStr,
        nowMinutes,
        timeSlots: SALON_TIME_SLOTS,
        tickets: activeDateTickets.map((t) => ({
          timeSlot: t.timeSlot,
          status: t.status,
          serviceKey: t.serviceKey,
        })),
        signal: controller.signal,
      }).then((res) => {
        if (!controller.signal.aborted && isMountedRef.current && res) {
          setSmartInsights(res);
        }
      });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [bookingDate, todayStr, nowMinuteBucket, queueDate, queueTickets, separateTodayTickets]);

  useEffect(() => {
    const activeTodayBookings = myBookings.filter(
      (b) =>
        b.bookingDate === todayStr &&
        (b.status === 'pending' || b.status === 'confirmed') &&
        !isBookingTimeExpired(b.bookingDate, b.timeSlot, nowMs)
    );

    if (activeTodayBookings.length === 0) {
      setTurnAlertBanner(null);
      return;
    }

    let nextBanner: {
      bookingId: string;
      serialNumber?: number;
      timeSlot: string;
      title: string;
      message: string;
    } | null = null;

    for (const b of activeTodayBookings) {
      const msLeft = getMsUntilSlot(b.bookingDate, b.timeSlot, nowMs);
      const isWithinFiveMins = msLeft !== null && msLeft > 0 && msLeft <= SALON_TURN_ALERT_MINUTES * 60_000;

      let prevCompletedReady = false;
      let prevSerialNumber: number | undefined;

      if (typeof b.serialNumber === 'number' && b.serialNumber > 1 && todayTickets.length > 0) {
        const earlier = todayTickets.filter((t) => t.serialNumber < b.serialNumber!);
        const activeAhead = earlier.filter((t) => t.status === 'pending' || t.status === 'confirmed');
        const lastEarlier = earlier[earlier.length - 1];
        if (lastEarlier) {
          prevSerialNumber = lastEarlier.serialNumber;
        }
        if (activeAhead.length === 0 && earlier.some((t) => t.status === 'completed')) {
          prevCompletedReady = true;
        }
      }

      if (isWithinFiveMins || prevCompletedReady) {
        const minsLeft = msLeft !== null ? Math.max(1, Math.ceil(msLeft / 60_000)) : SALON_TURN_ALERT_MINUTES;
        const serialText = typeof b.serialNumber === 'number' ? `#${b.serialNumber}` : '';
        const title = bi(
          `প্রস্তুত হোন! আপনার পালা চলে আসছে ${serialText}`.trim(),
          `Get Ready! Your Turn Is Next ${serialText}`.trim()
        );
        const message = prevCompletedReady
          ? bi(
              `আগের সিরিয়াল #${prevSerialNumber ?? (b.serialNumber! - 1)} সম্পন্ন হয়েছে — আর মাত্র ৫ মিনিটের মধ্যে আপনার সিরিয়াল ${serialText} (${b.timeSlot}) শুরু হবে!`,
              `Previous serial #${prevSerialNumber ?? (b.serialNumber! - 1)} is completed — your turn ${serialText} (${b.timeSlot}) is up within 5 minutes!`
            )
          : bi(
              `আর মাত্র ~${minsLeft} মিনিট পর আপনার সিরিয়াল ${serialText} (${b.timeSlot})। দয়া করে সেলুনে উপস্থিত থাকুন!`,
              `About ${minsLeft} min until your serial ${serialText} (${b.timeSlot}). Please be ready at the salon!`
            );

        nextBanner = {
          bookingId: b.id,
          serialNumber: b.serialNumber,
          timeSlot: b.timeSlot,
          title,
          message,
        };

        const alertKey = prevCompletedReady ? `prev_${b.id}` : `time_${b.id}`;
        if (!notifiedTurnKeysRef.current.has(alertKey)) {
          notifiedTurnKeysRef.current.add(alertKey);
          playTurnAlertChime();
          sendTurnNotification(title, message, `salon-turn-${b.id}`);
        }
        break;
      }
    }

    setTurnAlertBanner(nextBanner);
  }, [myBookings, todayTickets, nowMs, todayStr, bi]);

  const handleEnableNotifications = async () => {
    const result = await requestTurnNotificationPermission();
    setNotifPermission(result);
    if (result === 'granted') {
      playTurnAlertChime();
      sendTurnNotification(
        salonConfig.salonName,
        bi(
          '৫ মিনিট আগের সিরিয়াল নোটিফিকেশন চালু হয়েছে!',
          '5-minute before-turn alerts are now enabled!'
        ),
        'salon-notif-enabled'
      );
    }
  };

  const handleGenerateCoupon = async () => {
    if (generatingCoupon || coupon) return;
    setCouponFeedback(null);

    if (!isEmailVerified) {
      setCouponFeedback(
        bi(
          'AI কুপন পেতে অনুগ্রহ করে আগে আপনার Gmail অ্যাকাউন্ট ভেরিফাই করুন।',
          'Please verify your Gmail account first to unlock your AI coupon.'
        )
      );
      return;
    }

    setGeneratingCoupon(true);
    try {
      const created = await generateAiSalonCoupon({
        uid: user.uid,
        emailVerified: isEmailVerified,
        userEmail: user.email,
        userName: user.displayName,
        salonName: salonConfig.salonName,
      });
      setCoupon(created);
      if (created.status === 'available') {
        setApplyCoupon(true);
      }
    } catch (error: any) {
      const msg = error?.message || 'AI coupon generation failed';
      reportAppIssue({
        source: 'SalonCoupon:Generate',
        severity: 'error',
        message: msg,
      });
      setCouponFeedback(
        isAdmin
          ? msg
          : bi(
              'এই মুহূর্তে AI কুপন তৈরি করা যাচ্ছে না। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
              'Could not generate an AI coupon right now. Please try again shortly.'
            )
      );
    } finally {
      setGeneratingCoupon(false);
    }
  };

  const handleCopyCouponCode = async () => {
    if (!coupon?.code) return;
    const copied = await copyTextSafely(coupon.code);
    if (copied) {
      setCopiedCoupon(true);
      if (copiedCouponTimerRef.current !== null) {
        window.clearTimeout(copiedCouponTimerRef.current);
      }
      copiedCouponTimerRef.current = window.setTimeout(() => {
        if (isMountedRef.current) setCopiedCoupon(false);
      }, 2000);
    }
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    setBookingSuccess(null);

    if (!salonConfig.isBookingOpen) {
      setFormError(
        bi(
          'অনলাইন বুকিং সাময়িকভাবে বন্ধ আছে। অনুগ্রহ করে ফোনে যোগাযোগ করুন।',
          'Online booking is temporarily closed. Please contact us by phone.'
        )
      );
      return;
    }

    const cleanName = customerName.trim();
    if (cleanName.length < 2) {
      setFormError(
        bi(
          'অনুগ্রহ করে আপনার পুরো নাম লিখুন (কমপক্ষে ২ অক্ষর)।',
          'Please enter your full name (at least 2 characters).'
        )
      );
      return;
    }

    const cleanPhone = customerPhone.trim();
    if (!/^[0-9+\-\s()]{6,25}$/.test(cleanPhone)) {
      setFormError(
        bi(
          'সঠিক মোবাইল নম্বর দিন (যেমন 017XXXXXXXX)।',
          'Please enter a valid mobile number (e.g., 017XXXXXXXX).'
        )
      );
      return;
    }

    const minDate = getTodayLocalDate();
    const maxDate = getMaxBookingDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate) || bookingDate < minDate || bookingDate > maxDate) {
      setFormError(
        bi(
          'অনুগ্রহ করে আজ থেকে আগামী ৩০ দিনের মধ্যে সঠিক তারিখ নির্বাচন করুন।',
          'Please select a valid date between today and the next 30 days.'
        )
      );
      return;
    }

    if (!SALON_TIME_SLOTS.includes(timeSlot) || isBookingTimeExpired(bookingDate, timeSlot, Date.now(), 0)) {
      setFormError(
        bi(
          'এই সময়ের স্লটটি ইতিমধ্যে শেষ হয়ে গেছে। অনুগ্রহ করে পরবর্তী কোনো সময় বা আগামীকাল নির্বাচন করুন।',
          'This time slot has already passed. Please select an upcoming time slot or tomorrow.'
        )
      );
      return;
    }

    setSubmitting(true);
    try {
      const usingCouponNow = Boolean(canApplyCoupon && coupon);
      const appliedDiscountAmount =
        usingCouponNow && coupon
          ? calculateSalonDiscount(currentServicePrice, coupon.discountPercent)
          : 0;
      const finalTotalPrice = Math.max(
        0,
        currentServicePrice + currentBookingFee - appliedDiscountAmount
      );

      const newBookingRef = doc(collection(db, 'salonBookings'));
      const queueRef = doc(db, 'salonQueues', bookingDate);
      const ticketRef = doc(db, 'salonQueues', bookingDate, 'tickets', newBookingRef.id);
      const couponRef = doc(db, 'salonCoupons', user.uid);

      const assignedSerial = await runTransaction(db, async (tx) => {
        const queueSnap = await tx.get(queueRef);
        if (usingCouponNow && coupon) {
          const couponSnap = await tx.get(couponRef);
          const couponData = couponSnap.data();
          if (
            !couponSnap.exists() ||
            couponData?.status !== 'available' ||
            couponData?.code !== coupon.code ||
            couponData?.discountPercent !== coupon.discountPercent
          ) {
            throw new Error(
              bi(
                'এই AI কুপনটি ইতিমধ্যে ব্যবহৃত হয়েছে বা এখন আর প্রযোজ্য নয়।',
                'This AI coupon has already been redeemed or is no longer available.'
              )
            );
          }
        }

        const currentTotal = queueSnap.exists()
          ? Number(queueSnap.data()?.totalSerials) || 0
          : 0;
        if (currentTotal >= 500) {
          throw new Error(
            bi(
              'এই তারিখের জন্য সর্বোচ্চ দৈনিক সিরিয়াল পূর্ণ হয়ে গেছে।',
              'Daily serial limit has been reached for this date.'
            )
          );
        }
        const nextSerial = currentTotal + 1;

        const safeServicePrice = Math.max(0, Math.round(Number(currentServicePrice) || 0));
        const safeBookingFee = Math.max(0, Math.round(Number(currentBookingFee) || 0));
        const safeDiscountPercent =
          usingCouponNow && coupon ? Math.round(Number(coupon.discountPercent) || 0) : 0;
        const safeDiscountAmount =
          usingCouponNow && coupon ? Math.max(0, Math.round(Number(appliedDiscountAmount) || 0)) : 0;
        const safeTotalPrice = Math.max(
          0,
          safeServicePrice + safeBookingFee - (usingCouponNow && coupon ? safeDiscountAmount : 0)
        );
        const safeSerial = Math.max(1, Math.round(nextSerial));
        const safeSlotMinutes = Math.min(1439, Math.max(0, Math.round(parseTimeSlotToMinutes(timeSlot))));

        const payload: Record<string, any> = {
          uid: user.uid.slice(0, 128),
          customerName: cleanName.slice(0, 100),
          customerPhone: cleanPhone.slice(0, 25),
          serviceKey: selectedService.key,
          serviceTitle: localizedSelected.primaryTitle.slice(0, 100),
          servicePrice: safeServicePrice,
          bookingFee: safeBookingFee,
          totalPrice: safeTotalPrice,
          bookingDate,
          timeSlot: timeSlot.slice(0, 30),
          serialNumber: safeSerial,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (user.email && user.email.trim().length <= 254) {
          payload.customerEmail = user.email.trim().slice(0, 254);
        }
        const cleanNotes = notes.trim();
        if (cleanNotes) {
          payload.notes = cleanNotes.slice(0, 300);
        }
        if (usingCouponNow && coupon) {
          payload.couponCode = String(coupon.code).toUpperCase().slice(0, 20);
          payload.discountPercent = safeDiscountPercent;
          payload.discountAmount = safeDiscountAmount;
        }

        tx.set(newBookingRef, payload);

        if (!queueSnap.exists()) {
          tx.set(queueRef, {
            bookingDate,
            totalSerials: 1,
            lastBookingId: newBookingRef.id,
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.update(queueRef, {
            totalSerials: safeSerial,
            lastBookingId: newBookingRef.id,
            updatedAt: serverTimestamp(),
          });
        }

        tx.set(ticketRef, {
          bookingId: newBookingRef.id,
          uid: user.uid.slice(0, 128),
          bookingDate,
          serialNumber: safeSerial,
          serviceKey: selectedService.key,
          timeSlot: timeSlot.slice(0, 30),
          slotMinutes: safeSlotMinutes,
          status: 'pending',
          hasCompletionSignature: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (usingCouponNow && coupon) {
          tx.update(couponRef, {
            status: 'used',
            usedBookingId: newBookingRef.id,
            usedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        return nextSerial;
      });

      if (usingCouponNow) {
        setApplyCoupon(false);
      }
      setQueueDate(bookingDate);

      setLastSubmittedWhatsAppUrl(
        buildSalonWhatsAppUrl({
          salonName: salonConfig.salonName,
          adminPhone: salonConfig.phone,
          customerName: cleanName,
          customerPhone: cleanPhone,
          serviceTitle: `${localizedSelected.primaryTitle} (Serial #${assignedSerial})`,
          bookingDate,
          timeSlot,
          bookedAtLabel: formatBookingCreatedTimestamp(Date.now(), lang)?.dateTimeLabel,
          couponCode: usingCouponNow && coupon ? coupon.code : undefined,
          discountLabel:
            usingCouponNow && coupon
              ? bi(
                  `${coupon.discountPercent}% ছাড় / -${formatSalonPrice(appliedDiscountAmount, salonConfig.currencySymbol)}`,
                  `${coupon.discountPercent}% off / -${formatSalonPrice(appliedDiscountAmount, salonConfig.currencySymbol)}`
                )
              : undefined,
          totalPriceLabel: formatSalonPrice(finalTotalPrice, salonConfig.currencySymbol),
          notes: notes.trim(),
          lang,
        })
      );
      setNotes('');
      setBookingSuccess(
        usingCouponNow && coupon
          ? bi(
              `আপনার সিরিয়াল নম্বর #${assignedSerial}! AI কুপন (${coupon.code}) সহ "${localizedSelected.primaryTitle}" বুকিং (${bookingDate}, ${timeSlot}) সফলভাবে জমা হয়েছে।`,
              `Your serial is #${assignedSerial}! "${localizedSelected.primaryTitle}" booking (${bookingDate}, ${timeSlot}) with AI coupon (${coupon.code}) was submitted.`
            )
          : bi(
              `আপনার সিরিয়াল নম্বর #${assignedSerial}! "${localizedSelected.primaryTitle}" বুকিং (${bookingDate}, ${timeSlot}) সফলভাবে জমা হয়েছে।`,
              `Your serial is #${assignedSerial}! "${localizedSelected.primaryTitle}" booking (${bookingDate}, ${timeSlot}) was submitted.`
            )
      );
    } catch (error: any) {
      const msg =
        error?.message ||
        bi('বুকিং জমা দেওয়া যায়নি। আবার চেষ্টা করুন।', 'Could not submit booking. Please try again.');
      if (isAdmin) setFormError(msg);
      else
        setFormError(
          bi(
            'বুকিং জমা দিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
            'There was an issue submitting your booking. Please try again.'
          )
        );
      reportFirestoreError(error, OperationType.CREATE, 'salonBookings');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelMyBooking = async (booking: SalonBooking) => {
    if (cancellingId) return;
    setFormError(null);
    setCancellingId(booking.id);
    try {
      const bookingRef = doc(db, 'salonBookings', booking.id);
      const ticketRef = doc(db, 'salonQueues', booking.bookingDate, 'tickets', booking.id);
      const ticketSnap = await getDoc(ticketRef);

      const batch = writeBatch(db);
      batch.update(bookingRef, {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
      if (ticketSnap.exists()) {
        batch.update(ticketRef, {
          status: 'cancelled',
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (error: any) {
      const msg = error?.message || bi('বুকিং বাতিল করা যায়নি।', 'Could not cancel booking.');
      if (isAdmin) {
        setFormError(msg);
      } else {
        setFormError(
          bi(
            'বুকিং বাতিল করা যায়নি। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন।',
            'Could not cancel the booking. Please try again in a moment.'
          )
        );
      }
      reportFirestoreError(error, OperationType.UPDATE, `salonBookings/${booking.id}`);
    } finally {
      setCancellingId(null);
    }
  };

  const handleSubmitCompletionSignature = async ({
    signaturePath,
    signerName,
  }: {
    signaturePath: string;
    signerName: string;
  }) => {
    if (!signingBooking) return;
    const bookingRef = doc(db, 'salonBookings', signingBooking.id);
    const ticketRef = doc(
      db,
      'salonQueues',
      signingBooking.bookingDate,
      'tickets',
      signingBooking.id
    );
    const ticketSnap = await getDoc(ticketRef);

    const batch = writeBatch(db);
    const bookingUpdate: Record<string, any> = {
      status: 'completed',
      completionSignaturePath: signaturePath,
      completionSignerName: signerName,
      updatedAt: serverTimestamp(),
    };
    if (!signingBooking.completedAt) {
      bookingUpdate.completedAt = serverTimestamp();
    }
    batch.update(bookingRef, bookingUpdate);
    if (ticketSnap.exists()) {
      batch.update(ticketRef, {
        status: 'completed',
        hasCompletionSignature: true,
        completionSignerName: signerName,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    setSigningBooking(null);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 py-6 sm:py-10 space-y-8">
        {/* Top Back Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft size={15} />
            <span>{bi('হোম পেজে ফিরে যান', 'Back to Home')}</span>
          </button>

          {isAdmin && onOpenAdminPanel && (
            <button
              type="button"
              onClick={onOpenAdminPanel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Shield size={14} />
              <span>{bi('বুকিং প্রাইস পরিবর্তন করুন (অ্যাডমিন)', 'Update Booking Prices (Admin)')}</span>
            </button>
          )}
        </div>

        {/* Hero Header Banner with Luxury Salon Photography */}
        <section className="rounded-3xl bg-gradient-to-br from-[#17110d] via-[#1f1712] to-[#0f172a] text-white border border-amber-500/25 overflow-hidden shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-7 p-6 sm:p-9 flex flex-col justify-between gap-6">
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-400">
                  <Scissors size={14} />
                  <span>{bi('মেনজ হেয়ার কাটিং ও গ্রুমিং সেলুন', "Men's Hair Cutting & Grooming Salon")}</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-serif font-medium tracking-tight text-white">
                  {salonConfig.salonName}
                </h1>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-amber-100/80">
                  {salonConfig.address && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={14} className="text-amber-400 shrink-0" />
                      {salonConfig.address}
                    </span>
                  )}
                  {salonConfig.phone && (
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Phone size={14} className="text-amber-400 shrink-0" />
                      {salonConfig.phone}
                    </span>
                  )}
                  {displayOpenHours && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={14} className="text-amber-400 shrink-0" />
                      {displayOpenHours}
                    </span>
                  )}
                </div>
              </div>

              <div className="inline-flex flex-wrap items-center justify-between gap-4 bg-black/35 border border-amber-500/20 rounded-2xl px-5 py-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-amber-200/80">
                    {bi('বুকিং অবস্থা', 'Booking Status')}
                  </p>
                  <p
                    className={`text-sm sm:text-base font-semibold mt-1 ${
                      salonConfig.isBookingOpen ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {salonConfig.isBookingOpen
                      ? bi('অনলাইন বুকিং চালু আছে', 'Online Booking Open')
                      : bi('বুকিং সাময়িকভাবে বন্ধ', 'Booking Temporarily Closed')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wider text-amber-200/80">
                    {bi('অনলাইন বুকিং ফি', 'Online Booking Fee')}
                  </p>
                  <p className="text-base sm:text-lg font-bold text-amber-400 tabular-nums mt-1">
                    {formatSalonPrice(salonConfig.bookingFee, salonConfig.currencySymbol)}
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 relative min-h-[210px] lg:min-h-full bg-stone-900 overflow-hidden">
              <img
                src={STUDIO_MEDIA.salonInterior}
                alt={`${salonConfig.salonName} Grooming Lounge`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#17110d]/80 via-transparent to-transparent" />
            </div>
          </div>
        </section>

        {/* Dedicated Standalone Salon Android App Card */}
        <section className="rounded-3xl bg-white dark:bg-zinc-900 border border-amber-200/80 dark:border-amber-800/60 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 max-w-2xl">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-600 via-orange-600 to-stone-900 text-white flex items-center justify-center shadow-md shrink-0">
              <Smartphone size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                {bi('আলাদা অ্যান্ড্রয়েড সেলুন অ্যাপ', 'Dedicated Android Salon App')}
              </p>
              <h2 className="text-base sm:text-lg font-serif font-medium text-zinc-900 dark:text-white">
                {bi(
                  'এক ট্যাপেই সরাসরি সেলুন বুকিং ও সিরিয়াল পেজে যান',
                  'Open Directly to the Salon Booking & Serial App'
                )}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {bi(
                  'এই আলাদা অ্যাপ বা লিংক থেকে ঢুকলে সরাসরি এই সেলুন বুকিং ও লাইভ সিরিয়াল পেজ চালু হবে—কোনো অতিরিক্ত মেনু ছাড়াই।',
                  'Installing or opening this standalone app launches straight into this Salon booking and live serial queue page.'
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <PWAInstallButton variant="card" appTarget="salon" />
            <button
              type="button"
              onClick={async () => {
                const url =
                  typeof window !== 'undefined' ? `${window.location.origin}/salon` : '/salon';
                const ok = await copyTextSafely(url);
                if (ok) {
                  setCopiedSalonAppLink(true);
                  if (copiedSalonAppTimerRef.current !== null) {
                    window.clearTimeout(copiedSalonAppTimerRef.current);
                  }
                  copiedSalonAppTimerRef.current = window.setTimeout(() => {
                    setCopiedSalonAppLink(false);
                  }, 2200);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 text-xs sm:text-sm font-semibold transition-colors min-h-[46px]"
            >
              {copiedSalonAppLink ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
              <span>
                {copiedSalonAppLink
                  ? bi('অ্যাপ লিংক কপি হয়েছে ✓', 'App Link Copied ✓')
                  : bi('ডাইরেক্ট লিংক কপি', 'Copy Direct Link')}
              </span>
            </button>
          </div>
        </section>

        {/* AI One-Time Welcome Coupon Card (Verified Gmail Users Only) */}
        <section className="rounded-3xl bg-gradient-to-br from-amber-50 via-white to-orange-50/70 dark:from-amber-950/30 dark:via-zinc-900 dark:to-zinc-900 border border-amber-200/90 dark:border-amber-800/60 p-6 sm:p-7 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                <Sparkles size={14} />
                <span>{bi('ভেরিফাইড Gmail · একবার ব্যবহারযোগ্য AI ডিসকাউন্ট কুপন', 'Verified Gmail · One-Time AI Discount Coupon')}</span>
              </div>

              {loadingCoupon ? (
                <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 py-1">
                  <Loader2 size={15} className="animate-spin" />
                  <span>{bi('আপনার কুপন স্ট্যাটাস যাচাই করা হচ্ছে...', 'Checking your coupon status...')}</span>
                </div>
              ) : !isEmailVerified ? (
                <>
                  <h2 className="text-lg sm:text-xl font-serif font-medium text-zinc-900 dark:text-white">
                    {bi('Gmail ভেরিফিকেশন সম্পন্ন করুন', 'Complete Gmail Verification')}
                  </h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {bi(
                      'প্রতিটি ভেরিফাইড Gmail অ্যাকাউন্ট প্রথমবার সেলুন পেজে একটিমাত্র বিশেষ AI ডিসকাউন্ট কুপন আনলক ও ব্যবহার করতে পারে।',
                      'Each verified Gmail account can unlock and redeem one exclusive AI discount coupon on the salon page.'
                    )}
                  </p>
                </>
              ) : !coupon ? (
                <>
                  <h2 className="text-lg sm:text-xl font-serif font-medium text-zinc-900 dark:text-white">
                    {bi('আপনার প্রথমবার Gmail ভেরিফাইড AI সেলুন কুপন নিন!', 'Claim Your One-Time Gmail Verified AI Salon Coupon!')}
                  </h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {bi(
                      'প্রতিটি ইউজার ভেরিফাইড Gmail দিয়ে একবারই একটি AI জেনারেটেড ডিসকাউন্ট কুপন (১৫%–২৫% ছাড়) তৈরি করে যেকোনো ১টি বুকিংয়ে ব্যবহার করতে পারবেন।',
                      'Each verified Gmail user can generate one AI discount coupon (15%–25% off) once and apply it to any single booking.'
                    )}
                  </p>
                </>
              ) : coupon.status === 'available' ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg sm:text-xl font-serif font-medium text-zinc-900 dark:text-white">
                      {coupon.title}
                    </h2>
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      {bi(`${coupon.discountPercent}% ছাড় · ব্যবহারযোগ্য`, `${coupon.discountPercent}% Off · Available`)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {coupon.aiMessage}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg sm:text-xl font-serif font-medium text-zinc-900 dark:text-white">
                      {coupon.title}
                    </h2>
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {bi('ব্যবহৃত', 'Used')}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {bi(
                      <>
                        আপনার একটিমাত্র ভেরিফাইড Gmail AI কুপন (<span className="font-mono font-semibold">{coupon.code}</span> · {coupon.discountPercent}% ছাড়) ইতিমধ্যে ব্যবহার হয়ে গেছে। প্রতি ইউজার একবারই এই অফার পান।
                      </>,
                      <>
                        Your one-time verified Gmail AI coupon (<span className="font-mono font-semibold">{coupon.code}</span> · {coupon.discountPercent}% off) has already been redeemed. Limited to one per user.
                      </>
                    )}
                  </p>
                </>
              )}

              {couponFeedback && (
                <p className="text-xs text-red-600 dark:text-red-400 pt-1">
                  {couponFeedback}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {!loadingCoupon && isEmailVerified && !coupon && (
                <button
                  type="button"
                  onClick={handleGenerateCoupon}
                  disabled={generatingCoupon}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-semibold transition-colors shadow-sm disabled:opacity-60"
                >
                  {generatingCoupon ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Sparkles size={15} />
                  )}
                  <span>
                    {generatingCoupon
                      ? bi('AI কুপন তৈরি হচ্ছে...', 'Generating AI Coupon...')
                      : bi('AI কুপন জেনারেট করুন', 'Generate AI Coupon')}
                  </span>
                </button>
              )}

              {!loadingCoupon && coupon && coupon.status === 'available' && (
                <>
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700">
                    <Ticket size={14} className="text-amber-600 dark:text-amber-400" />
                    <span className="font-mono text-xs sm:text-sm font-bold tracking-wider text-zinc-900 dark:text-white">
                      {coupon.code}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCouponCode}
                      className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                      title={bi('কুপন কোড কপি করুন', 'Copy coupon code')}
                    >
                      {copiedCoupon ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setApplyCoupon((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      canApplyCoupon
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 hover:opacity-90'
                    }`}
                  >
                    <CheckCircle2 size={14} />
                    <span>
                      {canApplyCoupon
                        ? bi('কুপন প্রয়োগ করা হয়েছে ✓', 'Coupon Applied ✓')
                        : bi('এই বুকিংয়ে ব্যবহার করুন', 'Use in This Booking')}
                    </span>
                  </button>
                </>
              )}

              {!loadingCoupon && coupon && coupon.status === 'used' && (
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400">
                  <Ticket size={14} />
                  <span className="font-mono text-xs font-semibold line-through">
                    {coupon.code}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 5-Minute Turn Alert Banner */}
        {turnAlertBanner && (
          <section className="rounded-2xl bg-amber-600 text-white px-5 py-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <BellRing size={20} />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-sm sm:text-base font-bold">{turnAlertBanner.title}</h2>
                <p className="text-xs sm:text-sm text-amber-50">{turnAlertBanner.message}</p>
              </div>
            </div>
            <div className="text-xs font-semibold tabular-nums bg-black/20 px-3 py-1.5 rounded-xl shrink-0">
              {turnAlertBanner.serialNumber ? `#${turnAlertBanner.serialNumber} · ` : ''}
              {turnAlertBanner.timeSlot}
            </div>
          </section>
        )}

        {/* Auto-Cancel Overdue Notice */}
        {autoCancelNotice && (
          <section className="rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-5 py-3.5 flex items-center justify-between gap-3 text-xs sm:text-sm text-rose-700 dark:text-rose-300">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{autoCancelNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setAutoCancelNotice(null)}
              className="text-xs font-semibold underline shrink-0"
            >
              {bi('বুঝেছি', 'Dismiss')}
            </button>
          </section>
        )}

        {/* Daily Live Serial Queue & Previous Customer Tracker */}
        <section className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <Users size={14} />
                <span>{bi('লাইভ দৈনিক সিরিয়াল ও কিউ বোর্ড', 'Live Daily Serial & Queue Board')}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-serif font-medium text-zinc-900 dark:text-white mt-0.5">
                {bi('প্রতিদিনের মোট সিরিয়াল ও আপনার সিরিয়ালের অবস্থান', "Daily Total Serials & Your Position in Line")}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleEnableNotifications}
                disabled={notifPermission === 'unsupported'}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors min-h-[40px] ${
                  notifPermission === 'granted'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                }`}
              >
                <Bell size={14} />
                <span>
                  {notifPermission === 'granted'
                    ? bi('৫ মি. নোটিফিকেশন চালু ✓', '5-Min Alerts On ✓')
                    : notifPermission === 'denied'
                    ? bi('নোটিফিকেশন ব্লক করা আছে', 'Alerts Blocked in Browser')
                    : bi('৫ মি. আগে নোটিফিকেশন চালু করুন', 'Enable 5-Min Turn Alerts')}
                </span>
              </button>

              <input
                type="date"
                value={queueDate}
                min={todayStr}
                max={getMaxBookingDate()}
                onChange={(e) => setQueueDate(e.target.value)}
                aria-label={bi('সিরিয়াল তারিখ দেখুন', 'View queue date')}
                className="px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-900 dark:text-white tabular-nums min-h-[40px]"
              />
            </div>
          </div>

          {/* Queue Metrics Row (tabular-nums) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/80 dark:border-zinc-700/80">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {bi('মোট কাটা সিরিয়াল', 'Total Serials Cut')}
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tabular-nums mt-1.5">
                {queueStats.total}
              </p>
            </div>
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/80 dark:border-zinc-700/80">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {bi('বর্তমানে চলছে', 'Now Serving')}
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1.5">
                {queueStats.currentServing ? `#${queueStats.currentServing.serialNumber}` : '—'}
              </p>
            </div>
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/80 dark:border-zinc-700/80">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {bi('কাজ সম্পন্ন হয়েছে', 'Completed')}
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1.5">
                {queueStats.completed}
              </p>
            </div>
            <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200/80 dark:border-zinc-700/80">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {bi('অপেক্ষায় / বাতিল', 'Waiting / Cancelled')}
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tabular-nums mt-1.5">
                {queueStats.active} <span className="text-zinc-400 font-normal">/</span>{' '}
                <span className="text-rose-500">{queueStats.cancelled}</span>
              </p>
            </div>
          </div>

          {/* User's Own Serial(s) & Previous Person Status */}
          {queueStats.myTicketsOnDate.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {bi('আপনার কাটা সিরিয়াল ও আগের গ্রাহকের অবস্থা', 'Your Booked Serial & Previous Customer Status')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {queueStats.myTicketsOnDate.map((myTicket) => {
                  const earlierTickets = queueTickets.filter(
                    (t) => t.serialNumber < myTicket.serialNumber
                  );
                  const activeAhead = earlierTickets.filter(
                    (t) => t.status === 'pending' || t.status === 'confirmed'
                  );
                  const previousTicket = earlierTickets[earlierTickets.length - 1] || null;
                  const localizedSvc = localizeSalonService(myTicket.serviceKey, lang, salonConfig).primaryTitle;
                  const myBookedStamp = formatBookingCreatedTimestamp(myTicket.createdAt, lang);

                  return (
                    <div
                      key={myTicket.id}
                      className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/70 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-base font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                            <Hash size={15} />
                            {bi(`সিরিয়াল ${myTicket.serialNumber}`, `Serial ${myTicket.serialNumber}`, `Senha ${myTicket.serialNumber}`)}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">·</span>
                          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            {localizedSvc}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 tabular-nums">
                          {myTicket.timeSlot}
                        </span>
                      </div>

                      <div className="text-xs text-zinc-700 dark:text-zinc-300 space-y-1">
                        <p className="tabular-nums font-medium text-amber-800 dark:text-amber-200">
                          {bi('বুকিং করা হয়েছে:', 'Booked At:', 'Reservado em:')}{' '}
                          <span className="font-semibold text-zinc-900 dark:text-white">
                            {myBookedStamp ? myBookedStamp.dateTimeLabel : bi('এইমাত্র', 'Just now', 'Agora mesmo')}
                          </span>
                          {myBookedStamp && myBookedStamp.localDateKey < myTicket.bookingDate && (
                            <span className="ml-1.5 text-amber-700 dark:text-amber-300">
                              ({bi('আগের দিন বুকিং', 'Booked day before', 'Reserva antecipada')})
                            </span>
                          )}
                        </p>
                        {!previousTicket ? (
                          <p className="font-medium text-emerald-700 dark:text-emerald-300">
                            {bi(
                              'আপনার সামনে কোনো সিরিয়াল নেই — আপনিই প্রথম!',
                              'No customer ahead of you — you are first in line!'
                            )}
                          </p>
                        ) : (
                          <p>
                            {bi(
                              `আগের সিরিয়াল #${previousTicket.serialNumber} (${previousTicket.timeSlot}): `,
                              `Previous serial #${previousTicket.serialNumber} (${previousTicket.timeSlot}): `
                            )}
                            <strong
                              className={
                                previousTicket.status === 'completed'
                                  ? 'text-emerald-700 dark:text-emerald-300'
                                  : previousTicket.status === 'cancelled'
                                  ? 'text-zinc-500 dark:text-zinc-400'
                                  : 'text-amber-700 dark:text-amber-300'
                              }
                            >
                              {previousTicket.status === 'completed'
                                ? bi('কাজ শেষ হয়েছে ✓', 'Finished ✓')
                                : previousTicket.status === 'confirmed'
                                ? bi('কাজ চলছে...', 'In Progress...')
                                : previousTicket.status === 'cancelled'
                                ? bi('বাতিল / সময় শেষ', 'Cancelled / Expired')
                                : bi('এখনও শেষ হয়নি (অপেক্ষায়)', 'Not finished yet (Waiting)')}
                            </strong>
                          </p>
                        )}
                        <p className="tabular-nums text-zinc-600 dark:text-zinc-400">
                          {bi(
                            `স্ট্যাটাস: ${localizeBookingStatus(myTicket.status, lang)} · আপনার সামনে সক্রিয় সিরিয়াল: ${activeAhead.length} জন`,
                            `Status: ${localizeBookingStatus(myTicket.status, lang)} · Active ahead of you: ${activeAhead.length}`
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Public Non-PII Daily Serial Ledger */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {bi(`${queueDate} তারিখের সকল সিরিয়াল`, `All Serials for ${queueDate}`)}
              </h3>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {bi('ব্যক্তিগত তথ্য গোপন রাখা হয়েছে', 'Customer personal details hidden')}
              </span>
            </div>

            {loadingQueue ? (
              <div className="py-6 flex items-center justify-center text-zinc-400">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : queueTickets.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400 py-5 text-center rounded-2xl bg-zinc-50 dark:bg-zinc-800/40">
                {bi('এই তারিখে এখনও কোনো সিরিয়াল কাটা হয়নি।', 'No serials issued for this date yet.')}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                {queueTickets.map((t) => {
                  const isMine = t.uid === user.uid;
                  const svcTitle = localizeSalonService(t.serviceKey, lang, salonConfig).primaryTitle;
                  const isSignedEither = t.hasCompletionSignature || t.hasShopSignature;
                  const ticketBookedStamp = formatBookingCreatedTimestamp(t.createdAt, lang);
                  return (
                    <div
                      key={t.id}
                      className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-center justify-between gap-3 ${
                        isMine
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700'
                          : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200/80 dark:border-zinc-700/80'
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold text-zinc-900 dark:text-white truncate tabular-nums leading-snug">
                          #{t.serialNumber} · {t.timeSlot}
                          {isMine ? bi(' (আপনি)', ' (You)', ' (Você)') : ''}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate leading-snug">
                          {svcTitle}
                          {isSignedEither ? bi(' · স্বাক্ষরিত ✓', ' · Signed ✓', ' · Assinado ✓') : ''}
                        </p>
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-300 truncate tabular-nums leading-snug">
                          {bi('বুকিং:', 'Booked:', 'Reservado:')}{' '}
                          {ticketBookedStamp
                            ? `${ticketBookedStamp.shortDateTimeLabel}${
                                ticketBookedStamp.localDateKey < t.bookingDate
                                  ? bi(' (আগের দিন)', ' (Day before)', ' (Dia anterior)')
                                  : ''
                              }`
                            : bi('এইমাত্র', 'Just now', 'Agora mesmo')}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-bold shrink-0 ${
                          t.status === 'completed'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : t.status === 'confirmed'
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : t.status === 'cancelled'
                            ? 'text-rose-500 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {localizeBookingStatus(t.status, lang)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Main 2-column Booking Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Interactive Service & Live Rate List */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-serif font-medium text-zinc-900 dark:text-white">
                {bi('সার্ভিস নির্বাচন করুন', 'Select a Service')}
              </h2>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {bi('সকল প্রাইস অ্যাডমিন কর্তৃক আপডেটযোগ্য', 'All prices configurable by Admin')}
              </span>
            </div>

            <div className="space-y-3">
              {SALON_SERVICES.map((service) => {
                const price = salonConfig[service.priceField];
                const isSelected = selectedServiceKey === service.key;
                const localized = localizeSalonService(service.key, lang, salonConfig);
                return (
                  <button
                    key={service.key}
                    type="button"
                    onClick={() => setSelectedServiceKey(service.key)}
                    className={`w-full text-left p-5 rounded-2xl border transition-all flex items-start justify-between gap-4 ${
                      isSelected
                        ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-500 dark:border-amber-600 ring-1 ring-amber-500/40'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                          {service.number}
                        </span>
                        <h3 className="text-base font-serif font-medium text-zinc-900 dark:text-white">
                          {localized.primaryTitle}
                        </h3>
                      </div>
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {localized.secondaryTitle ? `${localized.secondaryTitle} · ` : ''}
                        {localized.duration}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {localized.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white tabular-nums">
                        {formatSalonPrice(price, salonConfig.currencySymbol)}
                      </span>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">
                        {isSelected ? bi('নির্বাচিত ✓', 'Selected ✓') : bi('সিলেক্ট করুন', 'Select')}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Appointment Booking Form */}
          <form
            onSubmit={handleSubmitBooking}
            className="lg:col-span-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-7 space-y-5 shadow-sm lg:sticky lg:top-6"
          >
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <h2 className="text-xl font-serif font-medium text-zinc-900 dark:text-white">
                {bi('অ্যাপয়েন্টমেন্ট বুক করুন', 'Book Appointment')}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {localizedSelected.secondaryTitle
                  ? `${localizedSelected.primaryTitle} (${localizedSelected.secondaryTitle})`
                  : localizedSelected.primaryTitle}
              </p>
            </div>

            {formError && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-600 dark:text-red-300 leading-relaxed">
                {formError}
              </div>
            )}

            {bookingSuccess && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-sm text-emerald-700 dark:text-emerald-300 space-y-3 leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  <span>{bookingSuccess}</span>
                </div>
                {lastSubmittedWhatsAppUrl && (
                  <a
                    href={lastSubmittedWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold transition-colors"
                  >
                    <MessageCircle size={14} />
                    <span>{bi('WhatsApp-এ অ্যাডমিনকে পাঠান', 'Send to Admin on WhatsApp')}</span>
                  </a>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-2">
                  {bi('তারিখ নির্বাচন করুন', 'Booking Date')}
                </label>
                <div className="relative">
                  <Calendar
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                  />
                  <input
                    type="date"
                    required
                    min={getTodayLocalDate()}
                    max={getMaxBookingDate()}
                    value={bookingDate}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      setBookingDate(nextDate);
                      if (/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
                        setQueueDate(nextDate);
                      }
                    }}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm sm:text-base text-zinc-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                    {bi('সময় নির্বাচন করুন', 'Select Time Slot')}
                  </label>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {bi(
                      `+${SALON_LATE_GRACE_MINUTES} মি. পর অটো-ক্যানসেল`,
                      `Auto-cancels +${SALON_LATE_GRACE_MINUTES}m late`
                    )}
                  </span>
                </div>
                {smartInsights && smartInsights.bestSlot && smartInsights.bookingDate === bookingDate && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 text-xs text-zinc-600 dark:text-zinc-300 tabular-nums">
                    <span>
                      {bi('সেরা সময়:', 'Best open slot:', 'Melhor horário:')}{' '}
                      <strong className="text-zinc-900 dark:text-white">{smartInsights.bestSlot}</strong>
                      {' · '}
                      {smartInsights.bestSlotBookedCount === 0
                        ? bi('এখনো খালি', 'No wait', 'Sem espera')
                        : bi(
                            `${smartInsights.bestSlotBookedCount} জন বুকড`,
                            `${smartInsights.bestSlotBookedCount} booked`,
                            `${smartInsights.bestSlotBookedCount} agendado(s)`
                          )}
                      {smartInsights.activeQueueCount > 0
                        ? ` · ${bi(
                            `সক্রিয় সিরিয়াল ${smartInsights.activeQueueCount}`,
                            `Active queue ${smartInsights.activeQueueCount}`,
                            `Fila ativa ${smartInsights.activeQueueCount}`
                          )}`
                        : ''}
                    </span>
                    {timeSlot !== smartInsights.bestSlot && (
                      <button
                        type="button"
                        onClick={() => setTimeSlot(smartInsights.bestSlot!)}
                        className="font-semibold text-amber-700 dark:text-amber-400 hover:underline"
                      >
                        {bi('এই স্লট নিন', 'Use best slot', 'Usar este horário')}
                      </button>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2.5">
                  {SALON_TIME_SLOTS.map((slot) => {
                    const isExpiredSlot = isBookingTimeExpired(bookingDate, slot, nowMs, 0);
                    const slotInsight =
                      smartInsights?.bookingDate === bookingDate
                        ? smartInsights.slots.find((s) => s.timeSlot === slot)
                        : undefined;
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={isExpiredSlot}
                        onClick={() => setTimeSlot(slot)}
                        className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold tabular-nums border transition-colors min-h-[42px] ${
                          isExpiredSlot
                            ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600 border-zinc-200 dark:border-zinc-800 line-through cursor-not-allowed opacity-60'
                            : timeSlot === slot
                            ? 'bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 border-zinc-900 dark:border-amber-500'
                            : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                        }`}
                      >
                        <span>{slot}</span>
                        {!isExpiredSlot && slotInsight && slotInsight.bookedCount > 0 && (
                          <span className="ml-1.5 text-xs opacity-75">
                            ({slotInsight.bookedCount})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {!hasAnyOpenSlot && (
                  <p className="mt-2.5 text-xs font-medium text-amber-700 dark:text-amber-300 leading-relaxed">
                    {bi(
                      'এই তারিখের সকল সময় শেষ হয়ে গেছে। বুকিং করতে আগামীকালের তারিখ নির্বাচন করুন।',
                      'All slots for this date have passed. Please choose tomorrow’s date to book.'
                    )}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-2">
                  {bi('আপনার নাম', 'Full Name')}
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={bi('আপনার নাম লিখুন', 'Enter your full name')}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm sm:text-base text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-2">
                  {bi('মোবাইল নম্বর', 'Mobile Number')}
                </label>
                <input
                  type="tel"
                  required
                  minLength={6}
                  maxLength={25}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm sm:text-base text-zinc-900 dark:text-white tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-2">
                  {bi('অতিরিক্ত নোট (ঐচ্ছিক)', 'Additional Notes (Optional)')}
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={bi(
                    'যেমন: মিডল ফেড, ছোট দাড়ি, বা পছন্দের স্টাইল',
                    'e.g., mid fade, short beard trim, or preferred style'
                  )}
                  className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm sm:text-base text-zinc-900 dark:text-white resize-none"
                />
              </div>
            </div>

            {/* Live Price Breakdown */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 space-y-2 text-xs">
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-300">
                <span>
                  {bi('সার্ভিস প্রাইস', 'Service Price')} ({localizedSelected.primaryTitle})
                </span>
                <span className="font-semibold tabular-nums">
                  {formatSalonPrice(currentServicePrice, salonConfig.currencySymbol)}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-300">
                <span>{bi('বুকিং চার্জ', 'Booking Fee')}</span>
                <span className="font-semibold tabular-nums">
                  {formatSalonPrice(currentBookingFee, salonConfig.currencySymbol)}
                </span>
              </div>
              {canApplyCoupon && coupon && discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>
                    {bi('AI কুপন ছাড়', 'AI Coupon Discount')} ({coupon.code} · {coupon.discountPercent}%)
                  </span>
                  <span className="tabular-nums">
                    -{formatSalonPrice(discountAmount, salonConfig.currencySymbol)}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-sm font-bold text-zinc-900 dark:text-white">
                <span>{bi('সর্বমোট বিল', 'Total Payable')}</span>
                <span className="text-amber-600 dark:text-amber-400 tabular-nums">
                  {formatSalonPrice(totalPayable, salonConfig.currencySymbol)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !salonConfig.isBookingOpen || !hasAnyOpenSlot}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Scissors size={16} />
              )}
              <span>
                {!salonConfig.isBookingOpen
                  ? bi('অনলাইন বুকিং বন্ধ আছে', 'Online Booking Closed')
                  : !hasAnyOpenSlot
                  ? bi('আজকের সময় শেষ (আগামীকাল দিন)', 'No Open Slots on Date')
                  : bi('বুকিং কনফার্ম করুন', 'Confirm Booking')}
              </span>
            </button>

            {liveWhatsAppUrl ? (
              <div className="space-y-1.5">
                <a
                  href={liveWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold transition-colors"
                >
                  <MessageCircle size={15} />
                  <span>{bi('WhatsApp-এ বুকিং রিকোয়েস্ট পাঠান', 'Send Booking Request on WhatsApp')}</span>
                </a>
                <p className="text-xs text-center text-zinc-500 dark:text-zinc-400 tabular-nums leading-relaxed">
                  {bi(
                    `অ্যাডমিনের WhatsApp (${salonConfig.phone})-এ নাম, তারিখ ও সার্ভিস অটো-ফিল হয়ে যাবে।`,
                    `Name, date, and service will auto-fill to Admin WhatsApp (${salonConfig.phone}).`
                  )}
                </p>
              </div>
            ) : (
              <p className="text-xs text-center text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {bi(
                  'WhatsApp-এ পাঠাতে অ্যাডমিন প্যানেল থেকে সঠিক সেলুন ফোন নম্বর সেট করুন।',
                  'Set a valid salon phone number in the Admin Panel to enable WhatsApp requests.'
                )}
              </p>
            )}
          </form>
        </div>

        {/* User's Own Bookings List */}
        <section className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-7 space-y-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-serif font-medium text-zinc-900 dark:text-white">
              {bi('আমার সেলুন বুকিংসমূহ', 'My Salon Bookings')}
            </h2>
            <span className="text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">
              {bi(`মোট ${myBookings.length}টি`, `Total ${myBookings.length}`)}
            </span>
          </div>

          {loadingBookings ? (
            <div className="py-8 flex items-center justify-center text-zinc-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : myBookings.length === 0 ? (
            <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 py-8 text-center">
              {bi(
                'আপনার এখনও কোনো বুকিং নেই। উপরের ফর্ম থেকে আপনার প্রথম অ্যাপয়েন্টমেন্ট বুক করুন।',
                'You have no bookings yet. Book your first appointment using the form above.'
              )}
            </p>
          ) : (
            <div className="space-y-4">
              {myBookings.map((b) => {
                const localizedBookingService = b.serviceKey
                  ? localizeSalonService(b.serviceKey, lang, salonConfig, b.serviceTitle).primaryTitle
                  : b.serviceTitle;
                const cutoffLabel = getSlotCutoffLabel(b.timeSlot);
                const canSignBooking = b.status !== 'cancelled' && !b.completionSignaturePath;
                const matchingQueueTickets =
                  b.bookingDate === queueDate
                    ? queueTickets
                    : b.bookingDate === todayStr
                    ? todayTickets
                    : [];
                const earlierToday =
                  matchingQueueTickets.length > 0 && typeof b.serialNumber === 'number'
                    ? matchingQueueTickets.filter((t) => t.serialNumber < b.serialNumber!)
                    : [];
                const prevToday = earlierToday[earlierToday.length - 1] || null;

                return (
                <div
                  key={b.id}
                  className="p-5 sm:p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                >
                  <div className="space-y-2.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap leading-relaxed">
                      {typeof b.serialNumber === 'number' && (
                        <span className="text-sm font-bold text-amber-700 dark:text-amber-300 tabular-nums">
                          #{b.serialNumber} ·
                        </span>
                      )}
                      <span className="text-base font-semibold text-zinc-900 dark:text-white">
                        {localizedBookingService}
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
                          · {bi('সময় পার হওয়ায় অটো-ক্যানসেল', 'Auto-cancelled (Time Expired)')}
                        </span>
                      )}
                      {b.couponCode && (
                        <span className="text-xs sm:text-sm font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                          · {bi('AI কুপন:', 'AI Coupon:')} {b.couponCode}
                          {typeof b.discountPercent === 'number' ? ` (-${b.discountPercent}%)` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 tabular-nums leading-relaxed">
                      {bi('নির্ধারিত স্লট:', 'Appointment Slot:', 'Horário marcado:')} {b.bookingDate} · {b.timeSlot} ({bi('শেষ সীমা:', 'Cutoff:', 'Limite:')} {cutoffLabel}) · {bi('ফোন:', 'Phone:', 'Telefone:')} {b.customerPhone}
                    </p>
                    {(() => {
                      const bookedStamp = formatBookingCreatedTimestamp(b.createdAt, lang);
                      const bookedEarlierDay = Boolean(bookedStamp && bookedStamp.localDateKey < b.bookingDate);
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
                    <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 tabular-nums leading-relaxed">
                      {bi('সার্ভিস:', 'Service:')} {formatSalonPrice(b.servicePrice, salonConfig.currencySymbol)} + {bi('বুকিং ফি:', 'Booking Fee:')}{' '}
                      {formatSalonPrice(b.bookingFee, salonConfig.currencySymbol)}
                      {typeof b.discountAmount === 'number' && b.discountAmount > 0
                        ? ` - ${bi('ছাড়:', 'Discount:')} ${formatSalonPrice(b.discountAmount, salonConfig.currencySymbol)}`
                        : ''}{' '}
                      = {bi('মোট:', 'Total:')}{' '}
                      <strong className="text-zinc-900 dark:text-white">
                        {formatSalonPrice(b.totalPrice, salonConfig.currencySymbol)}
                      </strong>
                    </p>
                    {prevToday && (b.status === 'pending' || b.status === 'confirmed') && (
                      <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 tabular-nums leading-relaxed">
                        {bi(`আগের সিরিয়াল #${prevToday.serialNumber}: `, `Previous serial #${prevToday.serialNumber}: `)}
                        <strong
                          className={
                            prevToday.status === 'completed'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {prevToday.status === 'completed'
                            ? bi('শেষ হয়েছে ✓', 'Finished ✓')
                            : prevToday.status === 'cancelled'
                            ? bi('বাতিল হয়েছে', 'Cancelled')
                            : bi('এখনও চলছে / অপেক্ষায়', 'Still in queue')}
                        </strong>
                      </p>
                    )}
                    {b.notes && (
                      <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 italic leading-relaxed">
                        {bi('নোট:', 'Note:')} {b.notes}
                      </p>
                    )}
                    {(b.completionSignaturePath || b.shopSignaturePath) && (
                      <div className="pt-2 flex flex-wrap items-center gap-4">
                        {b.completionSignaturePath && (
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 px-3 py-1.5">
                              <svg
                                viewBox="0 0 480 170"
                                className="w-28 h-9 text-amber-600 dark:text-amber-400"
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
                            <span className="text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-300 leading-snug">
                              {bi('কাস্টমারের সিগনেচার:', 'Customer Signature:')} {b.completionSignerName || b.customerName}
                            </span>
                          </div>
                        )}
                        {b.shopSignaturePath && (
                          <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5">
                              <svg
                                viewBox="0 0 480 170"
                                className="w-28 h-9 text-emerald-600 dark:text-emerald-400"
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
                            <span className="text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-300 leading-snug">
                              {bi('দোকানদারের সিগনেচার:', 'Shopkeeper Signature:')} {b.shopSignerName || salonConfig.salonName}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                    {b.status !== 'cancelled' && b.status !== 'completed' && (() => {
                      const itemWaUrl = buildSalonWhatsAppUrl({
                        salonName: salonConfig.salonName,
                        adminPhone: salonConfig.phone,
                        customerName: b.customerName,
                        customerPhone: b.customerPhone,
                        serviceTitle:
                          typeof b.serialNumber === 'number'
                            ? `${localizedBookingService} (Serial #${b.serialNumber})`
                            : localizedBookingService,
                        bookingDate: b.bookingDate,
                        timeSlot: b.timeSlot,
                        couponCode: b.couponCode,
                        discountLabel:
                          typeof b.discountPercent === 'number' && typeof b.discountAmount === 'number'
                            ? bi(
                                `${b.discountPercent}% ছাড় / -${formatSalonPrice(b.discountAmount, salonConfig.currencySymbol)}`,
                                `${b.discountPercent}% off / -${formatSalonPrice(b.discountAmount, salonConfig.currencySymbol)}`
                              )
                            : undefined,
                        totalPriceLabel: formatSalonPrice(b.totalPrice, salonConfig.currencySymbol),
                        notes: b.notes,
                        lang,
                      });
                      return itemWaUrl ? (
                        <a
                          href={itemWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shrink-0 min-h-[42px]"
                        >
                          <MessageCircle size={14} />
                          <span>WhatsApp</span>
                        </a>
                      ) : null;
                    })()}

                    {canSignBooking && (
                      <button
                        type="button"
                        onClick={() => setSigningBooking(b)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold transition-colors shrink-0 min-h-[42px]"
                      >
                        <PenTool size={14} />
                        <span>{bi('কাজ সম্পন্ন (নিজের সিগনেচার দিন)', 'Confirm Work (Sign Now)')}</span>
                      </button>
                    )}

                    {(b.status === 'pending' || b.status === 'confirmed') && (
                      <button
                        type="button"
                        disabled={cancellingId === b.id}
                        onClick={() => handleCancelMyBooking(b)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 transition-colors shrink-0 disabled:opacity-50 min-h-[42px]"
                      >
                        {cancellingId === b.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <XCircle size={14} />
                        )}
                        <span>{bi('বাতিল করুন', 'Cancel Booking')}</span>
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {signingBooking && (
        <CompletionSignatureModal
          title={bi('কাস্টমার কমপ্লিট সিগনেচার', 'Customer Completion Signature')}
          subtitle={`${
            typeof signingBooking.serialNumber === 'number'
              ? `#${signingBooking.serialNumber} · `
              : ''
          }${localizeSalonService(signingBooking.serviceKey, lang, salonConfig, signingBooking.serviceTitle).primaryTitle} · ${signingBooking.timeSlot}`}
          defaultSignerName={signingBooking.customerName}
          signerLabel={bi('কাস্টমারের নাম', 'Customer Name')}
          namePlaceholder={bi('আপনার নাম লিখুন', 'Enter your name')}
          submitLabel={bi('আমার সিগনেচারে কাজ সম্পন্ন করুন', 'Confirm Completion with My Signature')}
          onClose={() => setSigningBooking(null)}
          onSubmit={handleSubmitCompletionSignature}
        />
      )}
    </div>
  );
};

export default SalonBookingPage;
