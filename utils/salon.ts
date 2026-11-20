/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import { SalonConfig, SalonServiceKey } from '../types';

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
  },
  {
    key: 'beard',
    number: '02',
    title: 'Beard Trim & Line-Up',
    bengaliTitle: 'দাড়ি সেট ও ট্রিম',
    duration: '২০ মিনিট',
    description: 'নিখুঁত রেজর লাইন-আপ, শেপিং এবং বিয়ার্ড অয়েল ম্যাসাজ।',
    priceField: 'beardTrimPrice',
  },
  {
    key: 'shave',
    number: '03',
    title: 'Royal Hot Towel Shave',
    bengaliTitle: 'হট টাওয়েল ক্লাসিক শেভ',
    duration: '২৫ মিনিট',
    description: 'স্টিম টাওয়েল, ডাবল-ব্লেড স্মুথ শেভ এবং আফটার-শেভ কুলিং জেল।',
    priceField: 'shavePrice',
  },
  {
    key: 'color',
    number: '04',
    title: 'Hair Color & Wash',
    bengaliTitle: 'হেয়ার কালার ও শ্যাম্পু ওয়াশ',
    duration: '৪৫ মিনিট',
    description: 'প্রাকৃতিক কালো বা স্টাইলিশ শেড হেয়ার কালার এবং কন্ডিশনিং ওয়াশ।',
    priceField: 'hairColorPrice',
  },
  {
    key: 'facial',
    number: '05',
    title: 'Gents Facial & Cleanup',
    bengaliTitle: 'জেন্টস ফেসিয়াল ও স্কিন কেয়ার',
    duration: '৪০ মিনিট',
    description: 'ডিপ পোর ক্লিনজিং, ডি-ট্যান স্ক্রাব এবং ব্রাইটেনিং ফেস মাস্ক।',
    priceField: 'facialPrice',
  },
  {
    key: 'combo',
    number: '06',
    title: 'Full Grooming Combo',
    bengaliTitle: 'ফুল গ্রুমিং কম্বো প্যাক',
    duration: '৬০ মিনিট',
    description: 'হেয়ারকাট + দাড়ি ট্রিম/শেভ + শ্যাম্পু ওয়াশ + হেড ও ফেস ম্যাসাজ।',
    priceField: 'comboPrice',
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
  couponCode?: string;
  discountLabel?: string;
  totalPriceLabel?: string;
  notes?: string;
}

export function buildSalonWhatsAppUrl(payload: WhatsAppBookingPayload): string | null {
  const waNumber = normalizeWhatsAppNumber(payload.adminPhone);
  if (!waNumber) return null;

  const lines = [
    `নমস্কার, *${payload.salonName}*-এ একটি নতুন বুকিং রিকোয়েস্ট পাঠাচ্ছি:`,
    '',
    `• কাস্টমারের নাম: ${payload.customerName.trim() || 'Guest'}`,
    ...(payload.customerPhone?.trim() ? [`• মোবাইল নম্বর: ${payload.customerPhone.trim()}`] : []),
    `• সার্ভিস: ${payload.serviceTitle}`,
    `• তারিখ: ${payload.bookingDate}`,
    `• সময়: ${payload.timeSlot}`,
    ...(payload.couponCode ? [`• AI কুপন: ${payload.couponCode}${payload.discountLabel ? ` (${payload.discountLabel})` : ''}`] : []),
    ...(payload.totalPriceLabel ? [`• মোট বিল: ${payload.totalPriceLabel}`] : []),
    ...(payload.notes?.trim() ? [`• নোট: ${payload.notes.trim()}`] : []),
  ];

  return `https://wa.me/${waNumber}?text=${encodeURIComponent(lines.join('\n'))}`;
}

