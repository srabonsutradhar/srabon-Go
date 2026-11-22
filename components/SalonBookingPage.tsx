/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Scissors,
  Shield,
  Sparkles,
  Ticket,
  XCircle,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, reportFirestoreError, OperationType } from '../firebase';
import { reportAppIssue } from '../utils/appIssues';
import {
  SalonBooking,
  SalonConfig,
  SalonCoupon,
  SalonServiceKey,
} from '../types';
import {
  SALON_SERVICES,
  SALON_TIME_SLOTS,
  buildSalonWhatsAppUrl,
  calculateSalonDiscount,
  formatSalonPrice,
} from '../utils/salon';
import { generateAiSalonCoupon } from '../utils/salonCoupon';
import { STUDIO_MEDIA } from '../utils/studioAlbums';

interface SalonBookingPageProps {
  user: User;
  isAdmin: boolean;
  salonConfig: SalonConfig;
  onBackHome: () => void;
  onOpenAdminPanel?: () => void;
}

function getTodayLocalDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMaxBookingDate(): string {
  const future = new Date();
  future.setDate(future.getDate() + 30);
  const y = future.getFullYear();
  const m = String(future.getMonth() + 1).padStart(2, '0');
  const d = String(future.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const STATUS_LABELS: Record<SalonBooking['status'], string> = {
  pending: 'অপেক্ষমান (Pending)',
  confirmed: 'কনফার্মড (Confirmed)',
  completed: 'সম্পন্ন (Completed)',
  cancelled: 'বাতিল (Cancelled)',
};

const SalonBookingPage: React.FC<SalonBookingPageProps> = ({
  user,
  isAdmin,
  salonConfig,
  onBackHome,
  onOpenAdminPanel,
}) => {
  const [selectedServiceKey, setSelectedServiceKey] = useState<SalonServiceKey>('haircut');
  const [bookingDate, setBookingDate] = useState<string>(getTodayLocalDate());
  const [timeSlot, setTimeSlot] = useState<string>(SALON_TIME_SLOTS[1]);
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

  const [coupon, setCoupon] = useState<SalonCoupon | null>(null);
  const [loadingCoupon, setLoadingCoupon] = useState(true);
  const [generatingCoupon, setGeneratingCoupon] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState<string | null>(null);
  const [applyCoupon, setApplyCoupon] = useState(false);
  const [copiedCoupon, setCopiedCoupon] = useState(false);

  const isEmailVerified = Boolean(user.emailVerified);
  const canApplyCoupon =
    isEmailVerified && coupon !== null && coupon.status === 'available' && applyCoupon;

  const selectedService =
    SALON_SERVICES.find((s) => s.key === selectedServiceKey) || SALON_SERVICES[0];
  const currentServicePrice = salonConfig[selectedService.priceField];
  const currentBookingFee = salonConfig.bookingFee;
  const discountAmount =
    canApplyCoupon && coupon
      ? calculateSalonDiscount(currentServicePrice, coupon.discountPercent)
      : 0;
  const totalPayable = Math.max(0, currentServicePrice + currentBookingFee - discountAmount);

  const liveWhatsAppUrl = buildSalonWhatsAppUrl({
    salonName: salonConfig.salonName,
    adminPhone: salonConfig.phone,
    customerName,
    customerPhone,
    serviceTitle: `${selectedService.title} (${selectedService.bengaliTitle})`,
    bookingDate,
    timeSlot,
    couponCode: canApplyCoupon && coupon ? coupon.code : undefined,
    discountLabel:
      canApplyCoupon && coupon
        ? `${coupon.discountPercent}% ছাড় / -${formatSalonPrice(discountAmount, salonConfig.currencySymbol)}`
        : undefined,
    totalPriceLabel: formatSalonPrice(totalPayable, salonConfig.currencySymbol),
    notes,
  });

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
          ...(d.data() as Omit<SalonBooking, 'id'>),
        }));
        list.sort((a, b) => {
          const at = a.createdAt?.toMillis?.() ?? 0;
          const bt = b.createdAt?.toMillis?.() ?? 0;
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

  const handleGenerateCoupon = async () => {
    if (generatingCoupon || coupon) return;
    setCouponFeedback(null);

    if (!isEmailVerified) {
      setCouponFeedback('AI কুপন পেতে অনুগ্রহ করে আগে আপনার Gmail অ্যাকাউন্ট ভেরিফাই করুন।');
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
          : 'এই মুহূর্তে AI কুপন তৈরি করা যাচ্ছে না। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'
      );
    } finally {
      setGeneratingCoupon(false);
    }
  };

  const handleCopyCouponCode = async () => {
    if (!coupon?.code) return;
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopiedCoupon(true);
      setTimeout(() => setCopiedCoupon(false), 2000);
    } catch {
      // Ignore clipboard failures in restricted iframes
    }
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    setBookingSuccess(null);

    if (!salonConfig.isBookingOpen) {
      setFormError('অনলাইন বুকিং সাময়িকভাবে বন্ধ আছে। অনুগ্রহ করে ফোনে যোগাযোগ করুন।');
      return;
    }

    const cleanName = customerName.trim();
    if (cleanName.length < 2) {
      setFormError('অনুগ্রহ করে আপনার পুরো নাম লিখুন (কমপক্ষে ২ অক্ষর)।');
      return;
    }

    const cleanPhone = customerPhone.trim();
    if (!/^[0-9+\-\s()]{6,25}$/.test(cleanPhone)) {
      setFormError('সঠিক মোবাইল নম্বর দিন (যেমন 017XXXXXXXX)।');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
      setFormError('সঠিক তারিখ নির্বাচন করুন।');
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

      const payload: Record<string, any> = {
        uid: user.uid.slice(0, 128),
        customerName: cleanName.slice(0, 100),
        customerPhone: cleanPhone.slice(0, 25),
        serviceKey: selectedService.key,
        serviceTitle: selectedService.title.slice(0, 100),
        servicePrice: currentServicePrice,
        bookingFee: currentBookingFee,
        totalPrice: finalTotalPrice,
        bookingDate,
        timeSlot: timeSlot.slice(0, 30),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (user.email) {
        payload.customerEmail = user.email.slice(0, 254);
      }
      const cleanNotes = notes.trim();
      if (cleanNotes) {
        payload.notes = cleanNotes.slice(0, 300);
      }
      if (usingCouponNow && coupon) {
        payload.couponCode = coupon.code;
        payload.discountPercent = coupon.discountPercent;
        payload.discountAmount = appliedDiscountAmount;
      }

      if (usingCouponNow && coupon) {
        const batch = writeBatch(db);
        const newBookingRef = doc(collection(db, 'salonBookings'));
        batch.set(newBookingRef, payload);
        batch.update(doc(db, 'salonCoupons', user.uid), {
          status: 'used',
          usedBookingId: newBookingRef.id,
          usedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        setApplyCoupon(false);
      } else {
        await addDoc(collection(db, 'salonBookings'), payload);
      }

      setLastSubmittedWhatsAppUrl(
        buildSalonWhatsAppUrl({
          salonName: salonConfig.salonName,
          adminPhone: salonConfig.phone,
          customerName: cleanName,
          customerPhone: cleanPhone,
          serviceTitle: `${selectedService.title} (${selectedService.bengaliTitle})`,
          bookingDate,
          timeSlot,
          couponCode: usingCouponNow && coupon ? coupon.code : undefined,
          discountLabel:
            usingCouponNow && coupon
              ? `${coupon.discountPercent}% ছাড় / -${formatSalonPrice(appliedDiscountAmount, salonConfig.currencySymbol)}`
              : undefined,
          totalPriceLabel: formatSalonPrice(finalTotalPrice, salonConfig.currencySymbol),
          notes: cleanNotes,
        })
      );
      setNotes('');
      setBookingSuccess(
        usingCouponNow && coupon
          ? `AI কুপন (${coupon.code}) সহ আপনার "${selectedService.title}" বুকিং (${bookingDate}, ${timeSlot}) সফলভাবে জমা হয়েছে!`
          : `আপনার "${selectedService.title}" বুকিং (${bookingDate}, ${timeSlot}) সফলভাবে জমা হয়েছে!`
      );
    } catch (error: any) {
      const msg = error?.message || 'বুকিং জমা দেওয়া যায়নি। আবার চেষ্টা করুন।';
      if (isAdmin) setFormError(msg);
      else setFormError('বুকিং জমা দিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      reportFirestoreError(error, OperationType.CREATE, 'salonBookings');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelMyBooking = async (bookingId: string) => {
    if (cancellingId) return;
    setCancellingId(bookingId);
    try {
      await updateDoc(doc(db, 'salonBookings', bookingId), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
    } catch (error: any) {
      const msg = error?.message || 'বুকিং বাতিল করা যায়নি।';
      if (isAdmin) setFormError(msg);
      reportFirestoreError(error, OperationType.UPDATE, `salonBookings/${bookingId}`);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
        {/* Top Back Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft size={14} />
            <span>হোম পেজে ফিরে যান</span>
          </button>

          {isAdmin && onOpenAdminPanel && (
            <button
              type="button"
              onClick={onOpenAdminPanel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Shield size={14} />
              <span>বুকিং প্রাইস পরিবর্তন করুন (Admin)</span>
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
                  <span>Men&apos;s Hair Cutting &amp; Grooming Salon</span>
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
                  {salonConfig.openHours && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={14} className="text-amber-400 shrink-0" />
                      {salonConfig.openHours}
                    </span>
                  )}
                </div>
              </div>

              <div className="inline-flex flex-wrap items-center justify-between gap-4 bg-black/35 border border-amber-500/20 rounded-2xl px-5 py-3.5">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-amber-200/70">
                    বুকিং অবস্থা
                  </p>
                  <p
                    className={`text-sm font-semibold mt-0.5 ${
                      salonConfig.isBookingOpen ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {salonConfig.isBookingOpen
                      ? 'অনলাইন বুকিং চালু আছে'
                      : 'বুকিং সাময়িকভাবে বন্ধ'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wider text-amber-200/70">
                    অনলাইন বুকিং ফি
                  </p>
                  <p className="text-base font-bold text-amber-400 tabular-nums mt-0.5">
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

        {/* AI One-Time Welcome Coupon Card (Verified Gmail Users Only) */}
        <section className="rounded-3xl bg-gradient-to-br from-amber-50 via-white to-orange-50/70 dark:from-amber-950/30 dark:via-zinc-900 dark:to-zinc-900 border border-amber-200/90 dark:border-amber-800/60 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                <Sparkles size={13} />
                <span>Verified Gmail · One-Time AI Discount Coupon</span>
              </div>

              {loadingCoupon ? (
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 py-1">
                  <Loader2 size={14} className="animate-spin" />
                  <span>আপনার কুপন স্ট্যাটাস যাচাই করা হচ্ছে...</span>
                </div>
              ) : !isEmailVerified ? (
                <>
                  <h2 className="text-base sm:text-lg font-serif font-medium text-zinc-900 dark:text-white">
                    Gmail ভেরিফিকেশন সম্পন্ন করুন
                  </h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    প্রতিটি ভেরিফাইড Gmail অ্যাকাউন্ট প্রথমবার সেলুন পেজে একটিমাত্র বিশেষ AI ডিসকাউন্ট কুপন আনলক ও ব্যবহার করতে পারে।
                  </p>
                </>
              ) : !coupon ? (
                <>
                  <h2 className="text-base sm:text-lg font-serif font-medium text-zinc-900 dark:text-white">
                    আপনার প্রথমবার Gmail ভেরিফাইড AI সেলুন কুপন নিন!
                  </h2>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    প্রতিটি ইউজার ভেরিফাইড Gmail দিয়ে একবারই একটি AI জেনারেটেড ডিসকাউন্ট কুপন (১৫%–২৫% ছাড়) তৈরি করে যেকোনো ১টি বুকিংয়ে ব্যবহার করতে পারবেন।
                  </p>
                </>
              ) : coupon.status === 'available' ? (
                <>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-base sm:text-lg font-serif font-medium text-zinc-900 dark:text-white">
                      {coupon.title}
                    </h2>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                      {coupon.discountPercent}% ছাড় · ব্যবহারযোগ্য
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                    {coupon.aiMessage}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-base sm:text-lg font-serif font-medium text-zinc-900 dark:text-white">
                      {coupon.title}
                    </h2>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      ব্যবহৃত (Used)
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    আপনার একটিমাত্র ভেরিফাইড Gmail AI কুপন (<span className="font-mono font-semibold">{coupon.code}</span> · {coupon.discountPercent}% ছাড়) ইতিমধ্যে ব্যবহার হয়ে গেছে। প্রতি ইউজার একবারই এই অফার পান।
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
                  <span>{generatingCoupon ? 'AI কুপন তৈরি হচ্ছে...' : 'AI কুপন জেনারেট করুন'}</span>
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
                      title="Copy coupon code"
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
                      {canApplyCoupon ? 'কুপন প্রয়োগ করা হয়েছে ✓' : 'এই বুকিংয়ে ব্যবহার করুন'}
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

        {/* Main 2-column Booking Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Interactive Service & Live Rate List */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-serif font-medium text-zinc-900 dark:text-white">
                সার্ভিস নির্বাচন করুন
              </h2>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                সকল প্রাইস অ্যাডমিন কর্তৃক আপডেটযোগ্য
              </span>
            </div>

            <div className="space-y-3">
              {SALON_SERVICES.map((service) => {
                const price = salonConfig[service.priceField];
                const isSelected = selectedServiceKey === service.key;
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
                          {service.title}
                        </h3>
                      </div>
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {service.bengaliTitle} · {service.duration}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {service.description}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-lg font-bold text-zinc-900 dark:text-white tabular-nums">
                        {formatSalonPrice(price, salonConfig.currencySymbol)}
                      </span>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {isSelected ? 'নির্বাচিত ✓' : 'সিলেক্ট করুন'}
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
            className="lg:col-span-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-sm lg:sticky lg:top-6"
          >
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <h2 className="text-lg font-serif font-medium text-zinc-900 dark:text-white">
                অ্যাপয়েন্টমেন্ট বুক করুন
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {selectedService.title} ({selectedService.bengaliTitle})
              </p>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-300">
                {formError}
              </div>
            )}

            {bookingSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 space-y-2.5">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                  <span>{bookingSuccess}</span>
                </div>
                {lastSubmittedWhatsAppUrl && (
                  <a
                    href={lastSubmittedWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                  >
                    <MessageCircle size={13} />
                    <span>WhatsApp-এ অ্যাডমিনকে পাঠান</span>
                  </a>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                  তারিখ (Booking Date)
                </label>
                <div className="relative">
                  <Calendar
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                  />
                  <input
                    type="date"
                    required
                    min={getTodayLocalDate()}
                    max={getMaxBookingDate()}
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                  সময় নির্বাচন করুন (Time Slot)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
                  {SALON_TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setTimeSlot(slot)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold tabular-nums border transition-colors ${
                        timeSlot === slot
                          ? 'bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 border-zinc-900 dark:border-amber-500'
                          : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                  আপনার নাম (Full Name)
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="আপনার নাম লিখুন"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                  মোবাইল নম্বর (Phone Number)
                </label>
                <input
                  type="tel"
                  required
                  minLength={6}
                  maxLength={25}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white tabular-nums"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                  অতিরিক্ত নোট (ঐচ্ছিক)
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="যেমন: মিডল ফেড, ছোট দাড়ি, বা পছন্দের স্টাইল"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-900 dark:text-white resize-none"
                />
              </div>
            </div>

            {/* Live Price Breakdown */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 space-y-2 text-xs">
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-300">
                <span>সার্ভিস প্রাইস ({selectedService.title})</span>
                <span className="font-semibold tabular-nums">
                  {formatSalonPrice(currentServicePrice, salonConfig.currencySymbol)}
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-300">
                <span>বুকিং চার্জ (Booking Fee)</span>
                <span className="font-semibold tabular-nums">
                  {formatSalonPrice(currentBookingFee, salonConfig.currencySymbol)}
                </span>
              </div>
              {canApplyCoupon && coupon && discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>
                    AI কুপন ছাড় ({coupon.code} · {coupon.discountPercent}%)
                  </span>
                  <span className="tabular-nums">
                    -{formatSalonPrice(discountAmount, salonConfig.currencySymbol)}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-sm font-bold text-zinc-900 dark:text-white">
                <span>সর্বমোট বিল (Total)</span>
                <span className="text-amber-600 dark:text-amber-400 tabular-nums">
                  {formatSalonPrice(totalPayable, salonConfig.currencySymbol)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !salonConfig.isBookingOpen}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Scissors size={16} />
              )}
              <span>
                {salonConfig.isBookingOpen
                  ? 'বুকিং কনফার্ম করুন'
                  : 'অনলাইন বুকিং বন্ধ আছে'}
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
                  <span>WhatsApp-এ বুকিং রিকোয়েস্ট পাঠান</span>
                </a>
                <p className="text-[11px] text-center text-zinc-500 dark:text-zinc-400 tabular-nums">
                  অ্যাডমিনের WhatsApp ({salonConfig.phone})-এ নাম, তারিখ ও সার্ভিস অটো-ফিল হয়ে যাবে।
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-center text-zinc-500 dark:text-zinc-400">
                WhatsApp-এ পাঠাতে অ্যাডমিন প্যানেল থেকে সঠিক সেলুন ফোন নম্বর সেট করুন।
              </p>
            )}
          </form>
        </div>

        {/* User's Own Bookings List */}
        <section className="rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-serif font-medium text-zinc-900 dark:text-white">
              আমার সেলুন বুকিংসমূহ
            </h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
              মোট {myBookings.length}টি
            </span>
          </div>

          {loadingBookings ? (
            <div className="py-8 flex items-center justify-center text-zinc-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : myBookings.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 py-6 text-center">
              আপনার এখনও কোনো বুকিং নেই। উপরের ফর্ম থেকে আপনার প্রথম অ্যাপয়েন্টমেন্ট বুক করুন।
            </p>
          ) : (
            <div className="space-y-3">
              {myBookings.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                        {b.serviceTitle}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          b.status === 'confirmed'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : b.status === 'completed'
                            ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                            : b.status === 'cancelled'
                            ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {STATUS_LABELS[b.status]}
                      </span>
                      {b.couponCode && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                          AI Coupon: {b.couponCode}
                          {typeof b.discountPercent === 'number' ? ` (-${b.discountPercent}%)` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 tabular-nums">
                      তারিখ: {b.bookingDate} · সময়: {b.timeSlot} · ফোন: {b.customerPhone}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                      সার্ভিস: {formatSalonPrice(b.servicePrice, salonConfig.currencySymbol)} + বুকিং ফি:{' '}
                      {formatSalonPrice(b.bookingFee, salonConfig.currencySymbol)}
                      {typeof b.discountAmount === 'number' && b.discountAmount > 0
                        ? ` - ছাড়: ${formatSalonPrice(b.discountAmount, salonConfig.currencySymbol)}`
                        : ''}{' '}
                      = মোট:{' '}
                      <strong className="text-zinc-900 dark:text-white">
                        {formatSalonPrice(b.totalPrice, salonConfig.currencySymbol)}
                      </strong>
                    </p>
                    {b.notes && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                        নোট: {b.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {b.status !== 'cancelled' && b.status !== 'completed' && (() => {
                      const itemWaUrl = buildSalonWhatsAppUrl({
                        salonName: salonConfig.salonName,
                        adminPhone: salonConfig.phone,
                        customerName: b.customerName,
                        customerPhone: b.customerPhone,
                        serviceTitle: b.serviceTitle,
                        bookingDate: b.bookingDate,
                        timeSlot: b.timeSlot,
                        couponCode: b.couponCode,
                        discountLabel:
                          typeof b.discountPercent === 'number' && typeof b.discountAmount === 'number'
                            ? `${b.discountPercent}% ছাড় / -${formatSalonPrice(b.discountAmount, salonConfig.currencySymbol)}`
                            : undefined,
                        totalPriceLabel: formatSalonPrice(b.totalPrice, salonConfig.currencySymbol),
                        notes: b.notes,
                      });
                      return itemWaUrl ? (
                        <a
                          href={itemWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shrink-0"
                        >
                          <MessageCircle size={13} />
                          <span>WhatsApp</span>
                        </a>
                      ) : null;
                    })()}

                    {b.status === 'pending' && (
                      <button
                        type="button"
                        disabled={cancellingId === b.id}
                        onClick={() => handleCancelMyBooking(b.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 transition-colors shrink-0 disabled:opacity-50"
                      >
                        {cancellingId === b.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <XCircle size={13} />
                        )}
                        <span>বাতিল করুন</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SalonBookingPage;
