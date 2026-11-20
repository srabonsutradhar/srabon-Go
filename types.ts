/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface VoiceAnalysis {
  gender: string;
  pitch: string;
  characteristics: string[];
  visualDescription: string;
}

export interface Voice {
  name: string;
  pitch: string;
  characteristics: string[];
  audioSampleUrl: string;
  fileUri: string;
  analysis: VoiceAnalysis;
  // Added for UI rendering
  imageUrl: string; 
}

export interface FilterState {
  gender: string | 'All';
  pitch: string | 'All';
  search: string;
}

export interface AiRecommendation {
  voiceNames: string[];
  systemInstruction: string;
  sampleText: string;
}

export type UserPlan = 'free' | 'pro';

export type ProPackageType = 'monthly' | 'yearly';

export type PaymentMethod = 'bKash' | 'Nagad' | 'Rocket' | 'Bank / Other';

export type ProRequestStatus = 'pending' | 'approved' | 'rejected';

export interface BillingConfig {
  feeAmount: string;
  monthlyFee?: string;
  yearlyFee?: string;
  paymentMethod: string;
  paymentAccount: string;
  instructions: string;
  freeDailyLimit: number;
  apiBaseUrl?: string;
}

export interface ProUpgradeRequest {
  id: string;
  uid: string;
  userEmail?: string;
  userName?: string;
  packageType?: ProPackageType;
  paymentMethod: PaymentMethod;
  senderNumber: string;
  transactionId: string;
  amountText: string;
  note?: string;
  status: ProRequestStatus;
  createdAt?: any;
  updatedAt?: any;
}

export interface UserAccountRecord {
  uid: string;
  displayName?: string;
  email?: string;
  photoURL?: string;
  plan: UserPlan;
  proPackageType?: ProPackageType;
  proExpiresAt?: any;
  dailyCount: number;
  lastUsageDate: string;
  favorites: string[];
  referralCode?: string;
  bonusCredits?: number;
  referralCount?: number;
}

export type AppViewMode =
  | 'home'
  | 'studio'
  | 'ideas'
  | 'salon'
  | 'carousel'
  | 'grid'
  | 'favorites';

export type SalonServiceKey =
  | 'haircut'
  | 'beard'
  | 'shave'
  | 'color'
  | 'facial'
  | 'combo';

export type SalonBookingStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled';

export interface SalonConfig {
  salonName: string;
  currencySymbol: string;
  haircutPrice: number;
  beardTrimPrice: number;
  shavePrice: number;
  hairColorPrice: number;
  facialPrice: number;
  comboPrice: number;
  bookingFee: number;
  address: string;
  phone: string;
  openHours: string;
  isBookingOpen: boolean;
}

export interface SalonBooking {
  id: string;
  uid: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  serviceKey: SalonServiceKey;
  serviceTitle: string;
  servicePrice: number;
  bookingFee: number;
  couponCode?: string;
  discountPercent?: number;
  discountAmount?: number;
  totalPrice: number;
  bookingDate: string;
  timeSlot: string;
  notes?: string;
  status: SalonBookingStatus;
  createdAt?: any;
  updatedAt?: any;
}

export type SalonCouponStatus = 'available' | 'used';

export interface SalonCoupon {
  uid: string;
  userEmail?: string;
  userName?: string;
  code: string;
  title: string;
  aiMessage: string;
  discountPercent: number;
  status: SalonCouponStatus;
  usedBookingId?: string;
  usedAt?: any;
  createdAt?: any;
  updatedAt?: any;
}

export type AppIssueSeverity = 'error' | 'warning';
export type AppIssueStatus = 'unread' | 'resolved';

export interface AppIssueRecord {
  id: string;
  uid: string;
  reporterEmail?: string;
  reporterName?: string;
  source: string;
  severity: AppIssueSeverity;
  message: string;
  details?: string;
  status: AppIssueStatus;
  origin?: 'firestore' | 'session';
  createdAt?: any;
  updatedAt?: any;
}

export type ChatPageScope = 'studio' | 'salon';
export type CommunityRoomId = 'general' | 'studio' | 'salon';
export type ChatSenderRole = 'user' | 'admin';

export interface AdminFeedbackThread {
  threadId: string;
  uid: string;
  userName: string;
  pageScope: ChatPageScope;
  lastMessage: string;
  lastSenderRole: ChatSenderRole;
  unreadByAdmin: boolean;
  unreadByUser: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface AdminFeedbackMessage {
  id: string;
  threadId: string;
  threadOwnerUid: string;
  uid: string;
  senderName: string;
  senderRole: ChatSenderRole;
  pageScope: ChatPageScope;
  text: string;
  createdAt?: any;
}

export interface CommunityMessage {
  id: string;
  roomId: CommunityRoomId;
  uid: string;
  senderName: string;
  senderRole: ChatSenderRole;
  originPage: 'home' | 'studio' | 'ideas' | 'salon' | 'library';
  text: string;
  createdAt?: any;
}