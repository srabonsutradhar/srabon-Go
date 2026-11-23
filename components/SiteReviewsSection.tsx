/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Star,
  MessageSquareHeart,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, OperationType, reportFirestoreError } from '../firebase';
import { SiteReview, SiteReviewPageTag } from '../types';
import { AppLanguage, useLanguage } from '../utils/i18n';

interface SiteReviewsSectionProps {
  user: User;
  isAdmin: boolean;
}

const PAGE_TAG_OPTIONS: {
  id: SiteReviewPageTag;
  labelBn: string;
  labelEn: string;
}[] = [
  { id: 'overall', labelBn: 'সম্পূর্ণ ওয়েবসাইট', labelEn: 'Overall Website' },
  { id: 'studio', labelBn: 'ভয়েস স্টুডিও', labelEn: 'Voice Studio' },
  { id: 'voice-clone', labelBn: 'ভয়েস ক্লোন (Pro)', labelEn: 'Voice Clone' },
  { id: 'ideas', labelBn: 'AI ট্রেন্ডিং আইডিয়া', labelEn: 'AI Ideas' },
  { id: 'salon', labelBn: 'সেলুন বুকিং', labelEn: 'Salon Booking' },
];

function getStarLabel(rating: number, lang: AppLanguage): string {
  const bn: Record<number, string> = {
    1: 'উন্নয়ন প্রয়োজন',
    2: 'মোটামুটি',
    3: 'ভালো লেগেছে',
    4: 'খুবই সুন্দর',
    5: 'অসাধারণ অভিজ্ঞতা!',
  };
  const en: Record<number, string> = {
    1: 'Needs work',
    2: 'Fair',
    3: 'Good',
    4: 'Great experience',
    5: 'Outstanding!',
  };
  return (lang === 'bn' ? bn : en)[rating] || '';
}

function getPageTagLabel(tag: SiteReviewPageTag, lang: AppLanguage): string {
  const found = PAGE_TAG_OPTIONS.find((item) => item.id === tag);
  if (!found) return lang === 'bn' ? 'ওয়েবসাইট' : 'Website';
  return lang === 'bn' ? found.labelBn : found.labelEn;
}

function formatReviewDate(ts: any, lang: AppLanguage): string {
  const ms = typeof ts?.toMillis === 'function' ? ts.toMillis() : null;
  if (!ms) return lang === 'bn' ? 'এইমাত্র' : 'Just now';
  return new Date(ms).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function sanitizeHttpsPhotoUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (
    trimmed.length > 0 &&
    trimmed.length <= 512 &&
    /^https:\/\/[a-zA-Z0-9._~:/?#@!$&()*+,;=%-]+$/.test(trimmed)
  ) {
    return trimmed;
  }
  return undefined;
}

const SiteReviewsSection: React.FC<SiteReviewsSectionProps> = ({ user, isAdmin }) => {
  const { lang, bi } = useLanguage();
  const biRef = useRef(bi);
  biRef.current = bi;
  const [reviews, setReviews] = useState<SiteReview[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedPageTag, setSelectedPageTag] = useState<SiteReviewPageTag>('overall');
  const [commentText, setCommentText] = useState<string>('');
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [starFilter, setStarFilter] = useState<'all' | '5' | '4' | 'low'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [brokenAvatarIds, setBrokenAvatarIds] = useState<Record<string, boolean>>({});

  const safeUid = user.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);

  useEffect(() => {
    if (!user?.uid) {
      setReviews([]);
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    setLoadError(null);

    const reviewsQuery = query(
      collection(db, 'siteReviews'),
      where('rating', '>=', 1),
      limit(100)
    );
    const unsubscribe = onSnapshot(
      reviewsQuery,
      (snapshot) => {
        const list: SiteReview[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (
            typeof d?.uid === 'string' &&
            typeof d?.authorName === 'string' &&
            typeof d?.rating === 'number' &&
            d.rating >= 1 &&
            d.rating <= 5 &&
            typeof d?.comment === 'string'
          ) {
            list.push({
              id: docSnap.id,
              uid: d.uid,
              authorName: d.authorName,
              authorPhotoUrl: typeof d.authorPhotoUrl === 'string' ? d.authorPhotoUrl : undefined,
              rating: d.rating,
              pageTag:
                d.pageTag === 'studio' ||
                d.pageTag === 'voice-clone' ||
                d.pageTag === 'ideas' ||
                d.pageTag === 'salon'
                  ? d.pageTag
                  : 'overall',
              comment: d.comment,
              createdAt: d.createdAt,
              updatedAt: d.updatedAt,
            });
          }
        });

        list.sort((a, b) => {
          const msA =
            typeof a.updatedAt?.toMillis === 'function'
              ? a.updatedAt.toMillis()
              : typeof a.createdAt?.toMillis === 'function'
              ? a.createdAt.toMillis()
              : 0;
          const msB =
            typeof b.updatedAt?.toMillis === 'function'
              ? b.updatedAt.toMillis()
              : typeof b.createdAt?.toMillis === 'function'
              ? b.createdAt.toMillis()
              : 0;
          return msB - msA;
        });

        setReviews(list);
        setLoadingList(false);
      },
      (error) => {
        setLoadingList(false);
        setLoadError(
          biRef.current(
            'রিভিউগুলো লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।',
            'Unable to load reviews right now. Please try again.'
          )
        );
        reportFirestoreError(error, OperationType.LIST, 'siteReviews');
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const myReview = useMemo(
    () => reviews.find((r) => r.uid === safeUid || r.id === safeUid) || null,
    [reviews, safeUid]
  );

  const stats = useMemo(() => {
    const total = reviews.length;
    const counts: Record<1 | 2 | 3 | 4 | 5, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    for (const r of reviews) {
      const clamped = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
      counts[clamped] += 1;
      sum += clamped;
    }
    const avg = total > 0 ? sum / total : 0;
    return { total, avg, counts };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (starFilter === '5') return r.rating === 5;
      if (starFilter === '4') return r.rating === 4;
      if (starFilter === 'low') return r.rating <= 3;
      return true;
    });
  }, [reviews, starFilter]);

  const handleStartEditMyReview = () => {
    if (!myReview) return;
    setSelectedRating(myReview.rating);
    setSelectedPageTag(myReview.pageTag);
    setCommentText(myReview.comment);
    setIsEditingExisting(true);
    setFormError(null);
    setFormSuccess(null);
  };

  const handleCancelEdit = () => {
    setIsEditingExisting(false);
    setFormError(null);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setFormError(null);
    setFormSuccess(null);

    if (!user.emailVerified) {
      setFormError(
        bi(
          'রিভিউ দেওয়ার জন্য অনুগ্রহ করে ভেরিফাইড Google অ্যাকাউন্ট দিয়ে সাইন ইন করুন।',
          'Please sign in with a verified Google account to submit a review.'
        )
      );
      return;
    }

    if (!safeUid) {
      setFormError(bi('ব্যবহারকারীর আইডি পাওয়া যায়নি।', 'Invalid user account ID.'));
      return;
    }

    const cleanComment = commentText.trim().slice(0, 600);
    if (cleanComment.length < 4) {
      setFormError(
        bi(
          'অন্তত ৪ অক্ষরের একটি রিভিউ বা মতামত লিখুন।',
          'Please write a review of at least 4 characters.'
        )
      );
      return;
    }

    const rawAuthorName = (
      user.displayName ||
      user.email?.split('@')[0] ||
      ''
    ).trim();
    const cleanAuthorName = (rawAuthorName || 'Srabon Go User').slice(0, 80);
    const safePhoto = sanitizeHttpsPhotoUrl(user.photoURL);
    const clampedRating = Math.min(5, Math.max(1, Math.round(selectedRating)));

    setSubmitting(true);
    const reviewRef = doc(db, 'siteReviews', safeUid);
    const reviewPath = `siteReviews/${safeUid}`;

    try {
      if (myReview) {
        const updatePayload: Record<string, any> = {
          authorName: cleanAuthorName,
          rating: clampedRating,
          pageTag: selectedPageTag,
          comment: cleanComment,
          updatedAt: serverTimestamp(),
        };
        if (safePhoto) {
          updatePayload.authorPhotoUrl = safePhoto;
        }
        await updateDoc(reviewRef, updatePayload);
        setIsEditingExisting(false);
        setFormSuccess(
          bi('আপনার রিভিউ আপডেট করা হয়েছে! সবাই এখন এটি দেখতে পাবে।', 'Your review has been updated!')
        );
      } else {
        const createPayload: Record<string, any> = {
          uid: safeUid,
          authorName: cleanAuthorName,
          rating: clampedRating,
          pageTag: selectedPageTag,
          comment: cleanComment,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (safePhoto) {
          createPayload.authorPhotoUrl = safePhoto;
        }
        await setDoc(reviewRef, createPayload);
        setCommentText('');
        setFormSuccess(
          bi('আপনার মূল্যবান স্টার ও রিভিউ প্রকাশ করা হয়েছে!', 'Your star rating & review is now live!')
        );
      }
    } catch (error: any) {
      reportFirestoreError(error, myReview ? OperationType.UPDATE : OperationType.CREATE, reviewPath);
      setFormError(
        bi(
          'রিভিউ সংরক্ষণ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
          'Could not save your review right now. Please try again.'
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async (targetReviewId: string) => {
    if (deletingId) return;
    setDeletingId(targetReviewId);
    const targetPath = `siteReviews/${targetReviewId}`;
    try {
      await deleteDoc(doc(db, 'siteReviews', targetReviewId));
      setConfirmDeleteId(null);
      if (targetReviewId === safeUid) {
        setIsEditingExisting(false);
        setCommentText('');
        setSelectedRating(5);
      }
    } catch (error) {
      reportFirestoreError(error, OperationType.DELETE, targetPath);
      setFormError(
        bi('রিভিউটি মুছে ফেলা যায়নি।', 'Could not delete the review.')
      );
    } finally {
      setDeletingId(null);
    }
  };

  const activeStarPreview = hoverRating || selectedRating;
  const showForm = !myReview || isEditingExisting;

  return (
    <section
      id="site-reviews-section"
      aria-labelledby="site-reviews-heading"
      className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 space-y-8 shadow-sm"
    >
      {/* Header + Rating Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              <MessageSquareHeart size={15} />
              <span>{bi('ইউজার অভিজ্ঞতা ও মতামত', 'User Experience & Ratings')}</span>
            </div>
            <h3
              id="site-reviews-heading"
              className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-slate-900 dark:text-white"
              style={{ textWrap: 'balance' }}
            >
              {bi('পেজটি আপনার কেমন লেগেছে? স্টার ও রিভিউ দিন', 'How Did You Like the Site? Rate & Review')}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {bi(
                'ভয়েস স্টুডিও, এআই আইডিয়া বা সেলুন পেজ ব্যবহার করে কেমন লেগেছে তা জানান। আপনার স্টার রেটিং ও রিভিউ সাইটের সবাই দেখতে পাবে।',
                'Share your experience with our Voice Studio, AI Ideas, or Salon pages. Your star rating and review are visible to everyone.'
              )}
            </p>
          </div>

          {/* Aggregate Rating Card */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums">
                    {stats.total > 0 ? stats.avg.toFixed(1) : '0.0'}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                    / 5.0
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                  {bi(
                    `মোট ${stats.total}টি ইউজার রিভিউ`,
                    `Based on ${stats.total} user ${stats.total === 1 ? 'review' : 'reviews'}`
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1" aria-label={bi(`গড় রেটিং ${stats.avg.toFixed(1)}`, `Average rating ${stats.avg.toFixed(1)}`)}>
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = stats.avg >= star - 0.3;
                  return (
                    <Star
                      key={star}
                      size={20}
                      className={
                        filled
                          ? 'text-amber-500 fill-amber-400'
                          : 'text-slate-300 dark:text-slate-600'
                      }
                    />
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
              {([5, 4, 3, 2, 1] as const).map((starLevel) => {
                const count = stats.counts[starLevel];
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={starLevel} className="flex items-center gap-2.5 text-xs">
                    <span className="w-8 font-medium text-slate-600 dark:text-slate-300 tabular-nums">
                      {starLevel} ★
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-slate-500 dark:text-slate-400 tabular-nums">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Submit or Manage Own Review */}
        <div className="lg:col-span-7">
          {showForm ? (
            <form
              onSubmit={handleSubmitReview}
              className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/55 border border-slate-200 dark:border-slate-700/80 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-base sm:text-lg font-serif font-medium text-slate-900 dark:text-white">
                  {isEditingExisting
                    ? bi('আপনার রিভিউ সম্পাদনা করুন', 'Edit Your Review')
                    : bi('আপনার স্টার ও রিভিউ লিখুন', 'Write Your Review')}
                </h4>
                {isEditingExisting && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  >
                    {bi('বাতিল', 'Cancel')}
                  </button>
                )}
              </div>

              {/* Star Selector */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {bi('স্টার দিন (১ থেকে ৫)', 'Select Star Rating (1 to 5)')}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    className="inline-flex items-center gap-1"
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = star <= activeStarPreview;
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onClick={() => setSelectedRating(star)}
                          aria-label={bi(`${star} স্টার`, `${star} stars`)}
                          aria-pressed={selectedRating === star}
                          className="p-1.5 rounded-lg transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                        >
                          <Star
                            size={28}
                            className={
                              active
                                ? 'text-amber-500 fill-amber-400 transition-colors'
                                : 'text-slate-300 dark:text-slate-600 transition-colors'
                            }
                          />
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 tabular-nums">
                    {activeStarPreview}/5 · {getStarLabel(activeStarPreview, lang)}
                  </span>
                </div>
              </div>

              {/* Feature / Page Selector */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {bi('কোন অংশটির অভিজ্ঞতা জানাচ্ছেন?', 'Which Section Are You Reviewing?')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PAGE_TAG_OPTIONS.map((tag) => {
                    const active = selectedPageTag === tag.id;
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => setSelectedPageTag(tag.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {bi(tag.labelBn, tag.labelEn)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Comment Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="site-review-comment"
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    {bi('আপনার মতামত লিখুন', 'Your Review')}
                  </label>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {commentText.length} / 600
                  </span>
                </div>
                <textarea
                  id="site-review-comment"
                  rows={3}
                  maxLength={600}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={bi(
                    'যেমন: ভয়েসগুলো খুবই পরিষ্কার শোনায়, বাংলায় স্ক্রিপ্ট জেনারেট করতে দারুণ লেগেছে...',
                    'e.g. The studio voices sound crisp and natural, and the Bengali AI ideas work great...'
                  )}
                  className="w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 resize-none"
                />
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {bi('প্রকাশিত হবে:', 'Posting as:')}{' '}
                  <strong className="text-slate-700 dark:text-slate-200">
                    {user.displayName || user.email?.split('@')[0] || 'User'}
                  </strong>
                </span>
                <button
                  type="submit"
                  disabled={submitting || commentText.trim().length < 4}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  {submitting ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  <span>
                    {submitting
                      ? bi('সংরক্ষণ হচ্ছে...', 'Saving...')
                      : isEditingExisting
                      ? bi('রিভিউ আপডেট করুন', 'Update Review')
                      : bi('রিভিউ প্রকাশ করুন', 'Publish Review')}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            <div className="p-5 sm:p-6 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/70 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    {bi('আপনার দেওয়া রিভিউ (সবাই দেখতে পাচ্ছে)', 'Your Published Review (Visible to Everyone)')}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={16}
                        className={
                          s <= myReview.rating
                            ? 'text-amber-500 fill-amber-400'
                            : 'text-slate-300 dark:text-slate-600'
                        }
                      />
                    ))}
                    <span className="ml-1.5 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                      {myReview.rating}/5 · {getPageTagLabel(myReview.pageTag, lang)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleStartEditMyReview}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Pencil size={13} />
                    <span>{bi('সম্পাদনা', 'Edit')}</span>
                  </button>
                  {confirmDeleteId === myReview.id ? (
                    <button
                      type="button"
                      disabled={deletingId === myReview.id}
                      onClick={() => handleDeleteReview(myReview.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
                    >
                      {deletingId === myReview.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                      <span>{bi('নিশ্চিত মুছুন', 'Confirm Delete')}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(myReview.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <Trash2 size={13} />
                      <span>{bi('মুছুন', 'Delete')}</span>
                    </button>
                  )}
                </div>
              </div>

              <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
                "{myReview.comment}"
              </p>

              {formSuccess && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  <span>{formSuccess}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Public Reviews List */}
      <div className="pt-6 border-t border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h4 className="text-base sm:text-lg font-serif font-medium text-slate-900 dark:text-white">
            {bi('অন্যান্য ইউজারদের রিভিউ', 'Community User Reviews')}
            <span className="ml-2 text-xs font-sans font-normal text-slate-500 dark:text-slate-400 tabular-nums">
              ({filteredReviews.length})
            </span>
          </h4>

          {/* Star Filter Tabs */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 self-start sm:self-auto">
            {(
              [
                { id: 'all', bn: 'সবগুলো', en: 'All' },
                { id: '5', bn: '৫ ★', en: '5 ★' },
                { id: '4', bn: '৪ ★', en: '4 ★' },
                { id: 'low', bn: '৩ ★ বা কম', en: '≤ 3 ★' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStarFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  starFilter === f.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {bi(f.bn, f.en)}
              </button>
            ))}
          </div>
        </div>

        {loadingList ? (
          <div className="py-10 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            <span>{bi('ইউজারদের রিভিউ লোড হচ্ছে...', 'Loading community reviews...')}</span>
          </div>
        ) : loadError ? (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{loadError}</span>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="py-10 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 px-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {reviews.length === 0
                ? bi(
                    'এখনো কেউ রিভিউ দেয়নি—আপনিই প্রথম স্টার ও রিভিউ দিন!',
                    'No reviews yet — be the first to rate and review!'
                  )
                : bi(
                    'এই ফিল্টারে কোনো রিভিউ পাওয়া যায়নি।',
                    'No reviews match this rating filter.'
                  )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredReviews.map((item) => {
              const isMine = item.uid === safeUid;
              const canDelete = isMine || isAdmin;
              const showPhoto = Boolean(item.authorPhotoUrl && !brokenAvatarIds[item.id]);
              const initialLetter = item.authorName.trim().charAt(0).toUpperCase() || 'U';

              return (
                <article
                  key={item.id}
                  className="p-5 rounded-2xl bg-slate-50/75 dark:bg-slate-800/45 border border-slate-200/80 dark:border-slate-700/70 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {showPhoto ? (
                          <img
                            src={item.authorPhotoUrl}
                            alt={item.authorName}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setBrokenAvatarIds((prev) => ({ ...prev, [item.id]: true }))
                            }
                            className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-200 flex items-center justify-center text-xs font-bold shrink-0">
                            {initialLetter}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {item.authorName}
                            {isMine && (
                              <span className="ml-1.5 text-xs font-medium text-indigo-600 dark:text-amber-300">
                                ({bi('আপনি', 'You')})
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {getPageTagLabel(item.pageTag, lang)}
                            <span aria-hidden="true" className="mx-1.5">·</span>
                            <span>{formatReviewDate(item.updatedAt || item.createdAt, lang)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0" aria-label={`${item.rating}/5`}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={14}
                            className={
                              s <= item.rating
                                ? 'text-amber-500 fill-amber-400'
                                : 'text-slate-300 dark:text-slate-600'
                            }
                          />
                        ))}
                      </div>
                    </div>

                    <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed break-words">
                      {item.comment}
                    </p>
                  </div>

                  {canDelete && (
                    <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/60 flex items-center justify-end gap-2">
                      {isMine && (
                        <button
                          type="button"
                          onClick={handleStartEditMyReview}
                          className="text-xs font-medium text-indigo-600 dark:text-amber-300 hover:underline"
                        >
                          {bi('সম্পাদনা', 'Edit')}
                        </button>
                      )}
                      {confirmDeleteId === item.id ? (
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => handleDeleteReview(item.id)}
                          className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          {deletingId === item.id
                            ? bi('মুছছে...', 'Deleting...')
                            : bi('নিশ্চিত মুছুন', 'Confirm Delete')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="text-xs font-medium text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        >
                          {bi('মুছুন', 'Remove')}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default SiteReviewsSection;
