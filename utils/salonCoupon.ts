/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { GoogleGenAI, Type } from '../genaiProxy';
import { db } from '../firebase';
import { SalonCoupon } from '../types';
import { checkBackendHealth } from './audio';

export interface GenerateSalonCouponInput {
  uid: string;
  emailVerified: boolean;
  userEmail?: string | null;
  userName?: string | null;
  salonName: string;
}

function sanitizeCouponCode(rawPrefix: unknown, uid: string): string {
  const cleanPrefix =
    typeof rawPrefix === 'string'
      ? rawPrefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
      : '';
  const prefix = cleanPrefix.length >= 4 ? cleanPrefix : 'JGNTAI';
  const uidSuffix = uid
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(-4)
    .padStart(4, '7');
  const combined = `${prefix}${uidSuffix}`.slice(0, 20);
  return combined.length >= 6 ? combined : `${combined}VIP1`;
}

export async function generateAiSalonCoupon(
  input: GenerateSalonCouponInput
): Promise<SalonCoupon> {
  if (!input.emailVerified) {
    throw new Error('কুপন পেতে অনুগ্রহ করে আগে Gmail দিয়ে ভেরিফাই করুন।');
  }

  const safeUid = input.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  if (!safeUid) {
    throw new Error('Invalid user ID.');
  }

  const couponRef = doc(db, 'salonCoupons', safeUid);
  const existingSnap = await getDoc(couponRef);
  if (existingSnap.exists()) {
    return existingSnap.data() as SalonCoupon;
  }

  const hasBackend = await checkBackendHealth();
  if (!hasBackend) {
    throw new Error('AI কুপন সার্ভারে সংযোগ পাওয়া যায়নি (Static Host)।');
  }

  const ai = new GoogleGenAI({ apiKey: 'server-side' });
  const customerFirstName = (input.userName || input.userEmail?.split('@')[0] || 'বন্ধু')
    .trim()
    .slice(0, 40);

  const prompt = `
You are the AI Concierge for "${input.salonName}".
A customer just verified their Gmail for the first time and unlocked their single lifetime welcome discount coupon.

Customer Name: "${customerFirstName}"

Create a unique, warm Bengali welcome coupon offer:
- codePrefix: 5 to 8 uppercase alphanumeric characters only (e.g. "JAGAWEL", "FIRSTCUT", "VIPGENT")
- title: Short catchy Bengali offer title (max 60 characters, e.g. "প্রথম ভিজিট AI স্পেশাল অফার")
- aiMessage: 1 warm Bengali sentence welcoming ${customerFirstName} and mentioning this special one-time haircut/grooming discount (max 180 characters)
- discountPercent: An integer between 15 and 25 (e.g. 15, 20, or 25)
  `.trim();

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          codePrefix: { type: Type.STRING },
          title: { type: Type.STRING },
          aiMessage: { type: Type.STRING },
          discountPercent: { type: Type.INTEGER },
        },
      },
    },
  });

  const rawText = (response.text || '{}')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const parsed = JSON.parse(rawText);

  const code = sanitizeCouponCode(parsed?.codePrefix, safeUid);
  const rawTitle = typeof parsed?.title === 'string' ? parsed.title.trim() : '';
  const title = (rawTitle.length >= 3 ? rawTitle : 'প্রথম ভিজিট AI স্পেশাল অফার').slice(0, 80);

  const rawMsg = typeof parsed?.aiMessage === 'string' ? parsed.aiMessage.trim() : '';
  const aiMessage = (
    rawMsg.length >= 5
      ? rawMsg
      : `স্বাগতম ${customerFirstName}! প্রথমবার Gmail ভেরিফিকেশনের জন্য আপনার এই বিশেষ AI ডিসকাউন্ট কুপন।`
  ).slice(0, 240);

  const parsedPct =
    typeof parsed?.discountPercent === 'number' && Number.isFinite(parsed.discountPercent)
      ? Math.round(parsed.discountPercent)
      : 20;
  const discountPercent = Math.min(25, Math.max(15, parsedPct));

  const payload: Record<string, any> = {
    uid: safeUid,
    code,
    title,
    aiMessage,
    discountPercent,
    status: 'available',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.userEmail) {
    payload.userEmail = input.userEmail.slice(0, 254);
  }
  if (input.userName) {
    payload.userName = input.userName.slice(0, 120);
  }

  await setDoc(couponRef, payload);

  return {
    uid: safeUid,
    userEmail: input.userEmail || undefined,
    userName: input.userName || undefined,
    code,
    title,
    aiMessage,
    discountPercent,
    status: 'available',
  };
}
