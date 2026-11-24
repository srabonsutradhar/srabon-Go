/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import { SalonConfig, SalonServiceKey } from '../types';
import { AppLanguage } from './i18n';

export const DEFAULT_SALON_CONFIG: SalonConfig = {
  salonName: 'Jagannath gents parlour and salon',
  currencySymbol: '৳',
  haircutPrice: 150,
  beardTrimPrice: 100,
  shavePrice: 80,
  hairColorPrice: 350,
  facialPrice: 400,
  comboPrice: 500,
  bookingFee: 50,
  address: 'Main Market Road, City Center',
  phone: '01700-000000',
  openHours: 'সকাল ৯:০০ টা – রাত ১০:০০ টা (প্রতিদিন)',
  isBookingOpen: true,
};

export interface SalonServiceMeta {
  key: SalonServiceKey;
  number: string;
  title: string;
  bengaliTitle: string;
  duration: string;
  description: string;
  priceField: keyof Pick<
    SalonConfig,
    | 'haircutPrice'
    | 'beardTrimPrice'
    | 'shavePrice'
    | 'hairColorPrice'
    | 'facialPrice'
    | 'comboPrice'
  >;
  titleField: keyof Pick<
    SalonConfig,
    | 'haircutTitle'
    | 'beardTrimTitle'
    | 'shaveTitle'
    | 'hairColorTitle'
    | 'facialTitle'
    | 'comboTitle'
  >;
  titleBnField: keyof Pick<
    SalonConfig,
    | 'haircutTitleBn'
    | 'beardTrimTitleBn'
    | 'shaveTitleBn'
    | 'hairColorTitleBn'
    | 'facialTitleBn'
    | 'comboTitleBn'
  >;
}

export const SALON_SERVICES: SalonServiceMeta[] = [
  {
    key: 'haircut',
    number: '01',
    title: 'Classic & Modern Haircut',
    bengaliTitle: 'হেয়ার কাটিং ও স্টাইলিং',
    duration: '৩০ মিনিট',
    description: 'ফেড, আন্ডারকাট, ক্রপ বা ক্লাসিক জেন্টস হেয়ারকাট সাথে ফিনিশিং সেটিং।',
    priceField: 'haircutPrice',
    titleField: 'haircutTitle',
    titleBnField: 'haircutTitleBn',
  },
  {
    key: 'beard',
    number: '02',
    title: 'Beard Trim & Line-Up',
    bengaliTitle: 'দাড়ি সেট ও ট্রিম',
    duration: '২০ মিনিট',
    description: 'নিখুঁত রেজর লাইন-আপ, শেপিং এবং বিয়ার্ড অয়েল ম্যাসাজ।',
    priceField: 'beardTrimPrice',
    titleField: 'beardTrimTitle',
    titleBnField: 'beardTrimTitleBn',
  },
  {
    key: 'shave',
    number: '03',
    title: 'Royal Hot Towel Shave',
    bengaliTitle: 'হট টাওয়েল ক্লাসিক শেভ',
    duration: '২৫ মিনিট',
    description: 'স্টিম টাওয়েল, ডাবল-ব্লেড স্মুথ শেভ এবং আফটার-শেভ কুলিং জেল।',
    priceField: 'shavePrice',
    titleField: 'shaveTitle',
    titleBnField: 'shaveTitleBn',
  },
  {
    key: 'color',
    number: '04',
    title: 'Hair Color & Wash',
    bengaliTitle: 'হেয়ার কালার ও শ্যাম্পু ওয়াশ',
    duration: '৪৫ মিনিট',
    description: 'প্রাকৃতিক কালো বা স্টাইলিশ শেড হেয়ার কালার এবং কন্ডিশনিং ওয়াশ।',
    priceField: 'hairColorPrice',
    titleField: 'hairColorTitle',
    titleBnField: 'hairColorTitleBn',
  },
  {
    key: 'facial',
    number: '05',
    title: 'Gents Facial & Cleanup',
    bengaliTitle: 'জেন্টস ফেসিয়াল ও স্কিন কেয়ার',
    duration: '৪০ মিনিট',
    description: 'ডিপ পোর ক্লিনজিং, ডি-ট্যান স্ক্রাব এবং ব্রাইটেনিং ফেস মাস্ক।',
    priceField: 'facialPrice',
    titleField: 'facialTitle',
    titleBnField: 'facialTitleBn',
  },
  {
    key: 'combo',
    number: '06',
    title: 'Full Grooming Combo',
    bengaliTitle: 'ফুল গ্রুমিং কম্বো প্যাক',
    duration: '৬০ মিনিট',
    description: 'হেয়ারকাট + দাড়ি ট্রিম/শেভ + শ্যাম্পু ওয়াশ + হেড ও ফেস ম্যাসাজ।',
    priceField: 'comboPrice',
    titleField: 'comboTitle',
    titleBnField: 'comboTitleBn',
  },
];

export const SALON_TIME_SLOTS: string[] = [
  '09:30 AM',
  '10:30 AM',
  '11:30 AM',
  '12:30 PM',
  '02:00 PM',
  '03:30 PM',
  '05:00 PM',
  '06:30 PM',
  '08:00 PM',
  '09:15 PM',
];

export function formatSalonPrice(amount: number, currencySymbol: string): string {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
  const sym = (currencySymbol || '৳').trim();
  if (sym === '৳' || sym === '$' || sym === '₹') {
    return `${sym}${safeAmount}`;
  }
  return `${safeAmount} ${sym}`;
}

export function sanitizeSalonConfig(raw: any): SalonConfig {
  const safeNum = (val: unknown, fallback: number): number => {
    if (typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 50000) {
      return Math.round(val);
    }
    return fallback;
  };
  const safeTitle = (val: unknown): string | undefined => {
    if (typeof val === 'string') {
      const trimmed = val.trim().slice(0, 100);
      if (trimmed.length >= 2) return trimmed;
    }
    return undefined;
  };
  return {
    salonName:
      typeof raw?.salonName === 'string' && raw.salonName.trim()
        ? raw.salonName.trim().slice(0, 100)
        : DEFAULT_SALON_CONFIG.salonName,
    currencySymbol:
      typeof raw?.currencySymbol === 'string' && raw.currencySymbol.trim()
        ? raw.currencySymbol.trim().slice(0, 10)
        : DEFAULT_SALON_CONFIG.currencySymbol,
    haircutPrice: safeNum(raw?.haircutPrice, DEFAULT_SALON_CONFIG.haircutPrice),
    beardTrimPrice: safeNum(raw?.beardTrimPrice, DEFAULT_SALON_CONFIG.beardTrimPrice),
    shavePrice: safeNum(raw?.shavePrice, DEFAULT_SALON_CONFIG.shavePrice),
    hairColorPrice: safeNum(raw?.hairColorPrice, DEFAULT_SALON_CONFIG.hairColorPrice),
    facialPrice: safeNum(raw?.facialPrice, DEFAULT_SALON_CONFIG.facialPrice),
    comboPrice: safeNum(raw?.comboPrice, DEFAULT_SALON_CONFIG.comboPrice),
    haircutTitle: safeTitle(raw?.haircutTitle),
    beardTrimTitle: safeTitle(raw?.beardTrimTitle),
    shaveTitle: safeTitle(raw?.shaveTitle),
    hairColorTitle: safeTitle(raw?.hairColorTitle),
    facialTitle: safeTitle(raw?.facialTitle),
    comboTitle: safeTitle(raw?.comboTitle),
    haircutTitleBn: safeTitle(raw?.haircutTitleBn),
    beardTrimTitleBn: safeTitle(raw?.beardTrimTitleBn),
    shaveTitleBn: safeTitle(raw?.shaveTitleBn),
    hairColorTitleBn: safeTitle(raw?.hairColorTitleBn),
    facialTitleBn: safeTitle(raw?.facialTitleBn),
    comboTitleBn: safeTitle(raw?.comboTitleBn),
    bookingFee: safeNum(raw?.bookingFee, DEFAULT_SALON_CONFIG.bookingFee),
    address:
      typeof raw?.address === 'string'
        ? raw.address.slice(0, 200)
        : DEFAULT_SALON_CONFIG.address,
    phone:
      typeof raw?.phone === 'string'
        ? raw.phone.slice(0, 30)
        : DEFAULT_SALON_CONFIG.phone,
    openHours:
      typeof raw?.openHours === 'string' && raw.openHours.trim()
        ? raw.openHours.slice(0, 80)
        : DEFAULT_SALON_CONFIG.openHours,
    isBookingOpen:
      typeof raw?.isBookingOpen === 'boolean'
        ? raw.isBookingOpen
        : DEFAULT_SALON_CONFIG.isBookingOpen,
  };
}

export function normalizeWhatsAppNumber(rawPhone: string): string | null {
  let digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (/^01\d{9}$/.test(digits)) {
    digits = `88${digits}`;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function calculateSalonDiscount(servicePrice: number, discountPercent: number): number {
  const safePrice = Number.isFinite(servicePrice) ? Math.max(0, Math.round(servicePrice)) : 0;
  const safePercent = Number.isFinite(discountPercent)
    ? Math.min(30, Math.max(0, Math.round(discountPercent)))
    : 0;
  return Math.min(safePrice, Math.round((safePrice * safePercent) / 100));
}

export interface WhatsAppBookingPayload {
  salonName: string;
  adminPhone: string;
  customerName: string;
  customerPhone?: string;
  serviceTitle: string;
  bookingDate: string;
  timeSlot: string;
  bookedAtLabel?: string;
  couponCode?: string;
  discountLabel?: string;
  totalPriceLabel?: string;
  notes?: string;
  lang?: AppLanguage;
}

export function buildSalonWhatsAppUrl(payload: WhatsAppBookingPayload): string | null {
  const waNumber = normalizeWhatsAppNumber(payload.adminPhone);
  if (!waNumber) return null;

  const lines =
    payload.lang === 'pt'
      ? [
          `Olá, enviando uma nova solicitação de agendamento para *${payload.salonName}*:`,
          '',
          `• Nome do Cliente: ${payload.customerName.trim() || 'Convidado'}`,
          ...(payload.customerPhone?.trim() ? [`• Celular: ${payload.customerPhone.trim()}`] : []),
          `• Serviço: ${payload.serviceTitle}`,
          `• Data do Horário: ${payload.bookingDate}`,
          `• Horário: ${payload.timeSlot}`,
          ...(payload.bookedAtLabel ? [`• Reservado em: ${payload.bookedAtLabel}`] : []),
          ...(payload.couponCode
            ? [`• Cupom IA: ${payload.couponCode}${payload.discountLabel ? ` (${payload.discountLabel})` : ''}`]
            : []),
          ...(payload.totalPriceLabel ? [`• Total: ${payload.totalPriceLabel}`] : []),
          ...(payload.notes?.trim() ? [`• Observações: ${payload.notes.trim()}`] : []),
        ]
      : payload.lang === 'en'
      ? [
          `Hello, sending a new booking request for *${payload.salonName}*:`,
          '',
          `• Customer Name: ${payload.customerName.trim() || 'Guest'}`,
          ...(payload.customerPhone?.trim() ? [`• Mobile Number: ${payload.customerPhone.trim()}`] : []),
          `• Service: ${payload.serviceTitle}`,
          `• Slot Date: ${payload.bookingDate}`,
          `• Slot Time: ${payload.timeSlot}`,
          ...(payload.bookedAtLabel ? [`• Booked At: ${payload.bookedAtLabel}`] : []),
          ...(payload.couponCode
            ? [`• AI Coupon: ${payload.couponCode}${payload.discountLabel ? ` (${payload.discountLabel})` : ''}`]
            : []),
          ...(payload.totalPriceLabel ? [`• Total Bill: ${payload.totalPriceLabel}`] : []),
          ...(payload.notes?.trim() ? [`• Notes: ${payload.notes.trim()}`] : []),
        ]
      : [
          `নমস্কার, *${payload.salonName}*-এ একটি নতুন বুকিং রিকোয়েস্ট পাঠাচ্ছি:`,
          '',
          `• কাস্টমারের নাম: ${payload.customerName.trim() || 'Guest'}`,
          ...(payload.customerPhone?.trim() ? [`• মোবাইল নম্বর: ${payload.customerPhone.trim()}`] : []),
          `• সার্ভিস: ${payload.serviceTitle}`,
          `• নির্ধারিত তারিখ: ${payload.bookingDate}`,
          `• নির্ধারিত সময়: ${payload.timeSlot}`,
          ...(payload.bookedAtLabel ? [`• বুকিং করার সময়: ${payload.bookedAtLabel}`] : []),
          ...(payload.couponCode
            ? [`• AI কুপন: ${payload.couponCode}${payload.discountLabel ? ` (${payload.discountLabel})` : ''}`]
            : []),
          ...(payload.totalPriceLabel ? [`• মোট বিল: ${payload.totalPriceLabel}`] : []),
          ...(payload.notes?.trim() ? [`• নোট: ${payload.notes.trim()}`] : []),
        ];

  return `https://wa.me/${waNumber}?text=${encodeURIComponent(lines.join('\n'))}`;
}

export const SALON_LATE_GRACE_MINUTES = 10;
export const SALON_TURN_ALERT_MINUTES = 5;

export function parseTimeSlotToMinutes(timeSlot: string): number {
  const match = (timeSlot || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 12 * 60;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return Math.min(1439, Math.max(0, hours * 60 + minutes));
}

export function getSlotDateTime(bookingDate: string, timeSlot: string): Date | null {
  const dateMatch = (bookingDate || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;
  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10) - 1;
  const day = parseInt(dateMatch[3], 10);
  const totalMinutes = parseTimeSlotToMinutes(timeSlot);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const dt = new Date(year, month, day, hours, mins, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function getMsUntilSlot(
  bookingDate: string,
  timeSlot: string,
  nowMs: number = Date.now()
): number | null {
  const slotDt = getSlotDateTime(bookingDate, timeSlot);
  if (!slotDt) return null;
  return slotDt.getTime() - nowMs;
}

export function isBookingTimeExpired(
  bookingDate: string,
  timeSlot: string,
  nowMs: number = Date.now(),
  graceMinutes: number = SALON_LATE_GRACE_MINUTES
): boolean {
  const diffMs = getMsUntilSlot(bookingDate, timeSlot, nowMs);
  if (diffMs === null) return false;
  return diffMs < -graceMinutes * 60_000;
}

export function getSlotCutoffLabel(
  timeSlot: string,
  graceMinutes: number = SALON_LATE_GRACE_MINUTES
): string {
  const totalMins = Math.min(1439, parseTimeSlotToMinutes(timeSlot) + graceMinutes);
  const h24 = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

export function playTurnAlertChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [587.33, 880, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      gain.gain.setValueAtTime(0.001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.14 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.26);
    });
    window.setTimeout(() => {
      if (ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }
    }, 1200);
  } catch {
    // Audio playback may be blocked prior to user gesture
  }
}

export async function requestTurnNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function sendTurnNotification(title: string, body: string, tag?: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      tag: tag || 'srabon-salon-turn',
    });
  } catch {
    // Ignore environments restricting Notification constructor
  }
}


