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

export type PaymentMethod = 'bKash' | 'Nagad' | 'Rocket' | 'Bank / Other';

export type ProRequestStatus = 'pending' | 'approved' | 'rejected';

export interface BillingConfig {
  feeAmount: string;
  paymentMethod: string;
  paymentAccount: string;
  instructions: string;
  freeDailyLimit: number;
}

export interface ProUpgradeRequest {
  id: string;
  uid: string;
  userEmail?: string;
  userName?: string;
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
  dailyCount: number;
  lastUsageDate: string;
  favorites: string[];
  referralCode?: string;
  bonusCredits?: number;
  referralCount?: number;
}