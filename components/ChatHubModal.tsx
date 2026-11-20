/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  AudioLines,
  Crown,
  Loader2,
  MessageSquare,
  Scissors,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { reportAppIssue } from '../utils/appIssues';
import {
  AdminFeedbackMessage,
  AdminFeedbackThread,
  AppViewMode,
  ChatPageScope,
  CommunityMessage,
  CommunityRoomId,
} from '../types';

interface ChatHubModalProps {
  user: User;
  isAdmin: boolean;
  currentViewMode: AppViewMode;
  salonName: string;
  onClose: () => void;
}

type SelectedChat =
  | { kind: 'admin'; threadId: string; pageScope: ChatPageScope; customerUid: string; customerName: string }
  | { kind: 'community'; roomId: CommunityRoomId };

const COMMUNITY_ROOMS: {
  id: CommunityRoomId;
  title: string;
  subtitle: string;
  badge: string;
}[] = [
  {
    id: 'general',
    title: 'সবার মতামত',
    subtitle: 'অ্যাপের সব ইউজার একে অপরের সাথে মতামত শেয়ার করুন',
    badge: 'General',
  },
  {
    id: 'studio',
    title: 'Voice Studio আড্ডা',
    subtitle: 'ভয়েস স্টুডিও ইউজারদের অভিজ্ঞতা ও টিপস',
    badge: 'Voice Studio',
  },
  {
    id: 'salon',
    title: 'Jagannath Salon আড্ডা',
    subtitle: 'সেলুন সার্ভিস ও গ্রুমিং নিয়ে গ্রাহকদের মতামত',
    badge: 'Salon',
  },
];

function formatChatTime(ts: any): string {
  const ms = typeof ts?.toMillis === 'function' ? ts.toMillis() : null;
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString('bn-BD', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mapViewToOriginPage(view: AppViewMode): CommunityMessage['originPage'] {
  if (view === 'studio') return 'studio';
  if (view === 'salon') return 'salon';
  if (view === 'ideas') return 'ideas';
  if (view === 'home') return 'home';
  return 'library';
}

function getOriginBadgeLabel(origin: CommunityMessage['originPage']): string {
  switch (origin) {
    case 'studio':
      return 'Voice Studio';
    case 'salon':
      return 'Salon';
    case 'ideas':
      return 'Ideas';
    case 'library':
      return 'Library';
    default:
      return 'Home';
  }
}

const ChatHubModal: React.FC<ChatHubModalProps> = ({
  user,
  isAdmin,
  currentViewMode,
  salonName,
  onClose,
}) => {
  const safeUid = user.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  const safeDisplayName =
    (user.displayName || user.email?.split('@')[0] || 'User')
      .trim()
      .slice(0, 80) || 'User';

  const initialScope: ChatPageScope = currentViewMode === 'salon' ? 'salon' : 'studio';

  const [mobileListTab, setMobileListTab] = useState<'admin' | 'community'>('admin');
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [adminScopeFilter, setAdminScopeFilter] = useState<'all' | ChatPageScope>('all');

  const [selectedChat, setSelectedChat] = useState<SelectedChat>(() =>
    isAdmin
      ? { kind: 'community', roomId: 'general' }
      : {
          kind: 'admin',
          threadId: `${safeUid}__${initialScope}`,
          pageScope: initialScope,
          customerUid: safeUid,
          customerName: safeDisplayName,
        }
  );

  const [adminThreads, setAdminThreads] = useState<AdminFeedbackThread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);

  const [adminMessages, setAdminMessages] = useState<AdminFeedbackMessage[]>([]);
  const [loadingAdminMessages, setLoadingAdminMessages] = useState(false);

  const [communityMessages, setCommunityMessages] = useState<CommunityMessage[]>([]);
  const [loadingCommunityMessages, setLoadingCommunityMessages] = useState(true);

  const [draftText, setDraftText] = useState('');
  const [sending, setSending] = useState(false);
  const [chatFeedback, setChatFeedback] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Subscribe to Admin Feedback Threads
  useEffect(() => {
    if (!safeUid) return;
    const threadsQuery = isAdmin
      ? collection(db, 'adminFeedbackThreads')
      : query(
          collection(db, 'adminFeedbackThreads'),
          where('uid', '==', safeUid)
        );

    const unsubscribe = onSnapshot(
      threadsQuery,
      (snapshot) => {
        const list: AdminFeedbackThread[] = snapshot.docs.map((d) => ({
          ...(d.data() as AdminFeedbackThread),
          threadId: d.id,
        }));
        list.sort((a, b) => {
          const at = a.updatedAt?.toMillis?.() ?? 0;
          const bt = b.updatedAt?.toMillis?.() ?? 0;
          return bt - at;
        });
        setAdminThreads(list);
        setLoadingThreads(false);
      },
      (error) => {
        setLoadingThreads(false);
        reportAppIssue({
          source: 'ChatHub:Threads',
          severity: 'error',
          message: error?.message || 'Failed to subscribe to admin feedback threads',
        });
      }
    );

    return () => unsubscribe();
  }, [safeUid, isAdmin]);

  // Subscribe to selected Admin Thread messages
  useEffect(() => {
    if (selectedChat.kind !== 'admin') {
      setAdminMessages([]);
      setLoadingAdminMessages(false);
      return;
    }

    const threadExists = adminThreads.some((t) => t.threadId === selectedChat.threadId);
    if (!threadExists) {
      setAdminMessages([]);
      setLoadingAdminMessages(false);
      return;
    }

    setLoadingAdminMessages(true);
    const msgRef = collection(db, 'adminFeedbackThreads', selectedChat.threadId, 'messages');
    const unsubscribe = onSnapshot(
      msgRef,
      (snapshot) => {
        const list: AdminFeedbackMessage[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AdminFeedbackMessage, 'id'>),
        }));
        list.sort((a, b) => {
          const at = a.createdAt?.toMillis?.() ?? 0;
          const bt = b.createdAt?.toMillis?.() ?? 0;
          return at - bt;
        });
        setAdminMessages(list);
        setLoadingAdminMessages(false);
      },
      (error) => {
        setLoadingAdminMessages(false);
        reportAppIssue({
          source: 'ChatHub:AdminMessages',
          severity: 'error',
          message: error?.message || 'Failed to load admin chat messages',
        });
      }
    );

    return () => unsubscribe();
  }, [selectedChat, adminThreads]);

  // Mark thread as read when opened
  useEffect(() => {
    if (selectedChat.kind !== 'admin') return;
    const thread = adminThreads.find((t) => t.threadId === selectedChat.threadId);
    if (!thread) return;

    const shouldClearAdmin = isAdmin && thread.unreadByAdmin;
    const shouldClearUser = !isAdmin && thread.unreadByUser;
    if (!shouldClearAdmin && !shouldClearUser) return;

    updateDoc(doc(db, 'adminFeedbackThreads', thread.threadId), {
      ...(shouldClearAdmin ? { unreadByAdmin: false } : {}),
      ...(shouldClearUser ? { unreadByUser: false } : {}),
      updatedAt: serverTimestamp(),
    }).catch((error: any) => {
      reportAppIssue({
        source: 'ChatHub:MarkRead',
        severity: 'warning',
        message: error?.message || 'Failed to clear unread chat flag',
      });
    });
  }, [selectedChat, adminThreads, isAdmin]);

  // Subscribe to active Community Room messages
  const activeCommunityRoomId: CommunityRoomId =
    selectedChat.kind === 'community' ? selectedChat.roomId : 'general';

  useEffect(() => {
    setLoadingCommunityMessages(true);
    const commQuery = query(
      collection(db, 'communityMessages'),
      where('roomId', '==', activeCommunityRoomId)
    );
    const unsubscribe = onSnapshot(
      commQuery,
      (snapshot) => {
        const list: CommunityMessage[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CommunityMessage, 'id'>),
        }));
        list.sort((a, b) => {
          const at = a.createdAt?.toMillis?.() ?? 0;
          const bt = b.createdAt?.toMillis?.() ?? 0;
          return at - bt;
        });
        setCommunityMessages(list.slice(-100));
        setLoadingCommunityMessages(false);
      },
      (error) => {
        setLoadingCommunityMessages(false);
        reportAppIssue({
          source: 'ChatHub:CommunityMessages',
          severity: 'error',
          message: error?.message || 'Failed to load community chat messages',
        });
      }
    );

    return () => unsubscribe();
  }, [activeCommunityRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [adminMessages.length, communityMessages.length, selectedChat]);

  const userAdminChannels = useMemo(() => {
    const scopes: { scope: ChatPageScope; label: string; subtitle: string }[] = [
      {
        scope: 'studio',
        label: 'Voice Studio → অ্যাডমিন',
        subtitle: 'ভয়েস স্টুডিও নিয়ে আপনার মতামত',
      },
      {
        scope: 'salon',
        label: `${salonName} → অ্যাডমিন`,
        subtitle: 'সেলুন বুকিং নিয়ে আপনার মতামত',
      },
    ];
    return scopes.map((item) => {
      const threadId = `${safeUid}__${item.scope}`;
      const existingThread = adminThreads.find((t) => t.threadId === threadId);
      return {
        ...item,
        threadId,
        existingThread,
      };
    });
  }, [safeUid, salonName, adminThreads]);

  const filteredAdminThreads = useMemo(() => {
    if (adminScopeFilter === 'all') return adminThreads;
    return adminThreads.filter((t) => t.pageScope === adminScopeFilter);
  }, [adminThreads, adminScopeFilter]);

  const totalAdminUnread = useMemo(
    () =>
      adminThreads.filter((t) => (isAdmin ? t.unreadByAdmin : t.unreadByUser)).length,
    [adminThreads, isAdmin]
  );

  const handleSelectAdminChannel = (
    threadId: string,
    pageScope: ChatPageScope,
    customerUid: string,
    customerName: string
  ) => {
    setChatFeedback(null);
    setSelectedChat({
      kind: 'admin',
      threadId,
      pageScope,
      customerUid,
      customerName,
    });
    setMobileShowThread(true);
  };

  const handleSelectCommunityRoom = (roomId: CommunityRoomId) => {
    setChatFeedback(null);
    setSelectedChat({ kind: 'community', roomId });
    setMobileShowThread(true);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;

    const cleanText = draftText.trim();
    if (!cleanText) return;

    if (!user.emailVerified) {
      setChatFeedback('মেসেজ পাঠাতে অনুগ্রহ করে ভেরিফাইড Google অ্যাকাউন্ট ব্যবহার করুন।');
      return;
    }

    setSending(true);
    setChatFeedback(null);

    try {
      if (selectedChat.kind === 'admin') {
        const { threadId, pageScope, customerUid, customerName } = selectedChat;
        const threadRef = doc(db, 'adminFeedbackThreads', threadId);
        const msgRef = doc(collection(db, 'adminFeedbackThreads', threadId, 'messages'));
        const existingThread = adminThreads.find((t) => t.threadId === threadId);
        const senderRole = isAdmin ? 'admin' : 'user';
        const snippet = cleanText.slice(0, 500);

        const batch = writeBatch(db);
        if (!existingThread) {
          if (isAdmin) {
            setChatFeedback('কোনো গ্রাহক আগে মেসেজ পাঠালে এখানে রিপ্লাই দেওয়া যাবে।');
            setSending(false);
            return;
          }
          batch.set(threadRef, {
            threadId,
            uid: safeUid,
            userName: safeDisplayName,
            pageScope,
            lastMessage: snippet,
            lastSenderRole: 'user',
            unreadByAdmin: true,
            unreadByUser: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.update(threadRef, {
            ...(isAdmin ? {} : { userName: safeDisplayName }),
            lastMessage: snippet,
            lastSenderRole: senderRole,
            unreadByAdmin: !isAdmin,
            unreadByUser: isAdmin,
            updatedAt: serverTimestamp(),
          });
        }

        batch.set(msgRef, {
          threadId,
          threadOwnerUid: customerUid,
          uid: safeUid,
          senderName: isAdmin ? 'Admin' : customerName || safeDisplayName,
          senderRole,
          pageScope,
          text: cleanText.slice(0, 1000),
          createdAt: serverTimestamp(),
        });

        await batch.commit();
        setDraftText('');
      } else {
        const msgRef = doc(collection(db, 'communityMessages'));
        await setDoc(msgRef, {
          roomId: selectedChat.roomId,
          uid: safeUid,
          senderName: isAdmin ? 'Admin' : safeDisplayName,
          senderRole: isAdmin ? 'admin' : 'user',
          originPage: mapViewToOriginPage(currentViewMode),
          text: cleanText.slice(0, 1000),
          createdAt: serverTimestamp(),
        });
        setDraftText('');
      }
    } catch (error: any) {
      const msg = error?.message || 'মেসেজ পাঠানো যায়নি।';
      reportAppIssue({
        source: 'ChatHub:Send',
        severity: 'error',
        message: msg,
      });
      setChatFeedback(
        isAdmin
          ? msg
          : 'এই মুহূর্তে মেসেজ পাঠানো যাচ্ছে না। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।'
      );
    } finally {
      setSending(false);
    }
  };

  const handleDeleteCommunityMessage = async (msgId: string) => {
    try {
      await deleteDoc(doc(db, 'communityMessages', msgId));
    } catch (error: any) {
      reportAppIssue({
        source: 'ChatHub:Delete',
        severity: 'warning',
        message: error?.message || 'Failed to delete community message',
      });
    }
  };

  const activeCommunityMeta =
    COMMUNITY_ROOMS.find((r) => r.id === activeCommunityRoomId) || COMMUNITY_ROOMS[0];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-hub-title"
    >
      <div
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div className="relative w-full max-w-6xl h-[90vh] sm:h-[84vh] flex flex-col bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-slide-up">
        {/* Top Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 bg-zinc-50/70 dark:bg-zinc-950/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <MessageSquare size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="chat-hub-title"
                  className="text-base sm:text-lg font-serif font-medium text-zinc-900 dark:text-white truncate"
                >
                  চ্যাট লিস্ট · মতামত ও আলোচনা
                </h2>
                {totalAdminUnread > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white tabular-nums">
                    {totalAdminUnread} নতুন
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 truncate">
                অ্যাডমিনের সাথে সরাসরি মতামত ও পাশেই ইউজারদের নিজেদের মধ্যে আলোচনা
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors shrink-0"
            aria-label="Close Chat"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Body: Side-by-Side Dual Chat List + Active Conversation */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* LEFT AREA: Dual Chat List (Admin List + User-to-User List side by side on md+, tabbed on mobile) */}
          <div
            className={`${
              mobileShowThread ? 'hidden md:flex' : 'flex'
            } w-full md:w-[430px] lg:w-[460px] shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/30 min-h-0`}
          >
            {/* Mobile Only Switcher between the two lists */}
            <div className="md:hidden grid grid-cols-2 gap-1.5 p-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setMobileListTab('admin')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-colors ${
                  mobileListTab === 'admin'
                    ? 'bg-zinc-900 dark:bg-indigo-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                }`}
              >
                <Shield size={13} />
                <span>অ্যাডমিন চ্যাট</span>
                {totalAdminUnread > 0 && (
                  <span className="px-1.5 rounded-full text-[10px] bg-rose-500 text-white">
                    {totalAdminUnread}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setMobileListTab('community')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-colors ${
                  mobileListTab === 'community'
                    ? 'bg-zinc-900 dark:bg-emerald-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                }`}
              >
                <Users size={13} />
                <span>ইউজার চ্যাট</span>
              </button>
            </div>

            {/* Dual Side-by-Side Chat List Columns */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800">
              {/* COLUMN 1: Admin Direct Feedback List (Customers of both pages -> Admin) */}
              <div
                className={`${
                  mobileListTab === 'admin' ? 'flex' : 'hidden md:flex'
                } flex-col min-h-0 overflow-hidden`}
              >
                <div className="px-3 py-2.5 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 space-y-2 shrink-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      <Shield size={12} />
                      <span>অ্যাডমিনের সাথে</span>
                    </span>
                    {totalAdminUnread > 0 && (
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                        {totalAdminUnread} unread
                      </span>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="grid grid-cols-3 gap-1">
                      {(['all', 'studio', 'salon'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setAdminScopeFilter(f)}
                          className={`py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                            adminScopeFilter === f
                              ? 'bg-indigo-600 text-white'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                          }`}
                        >
                          {f === 'all' ? 'All' : f === 'studio' ? 'Studio' : 'Salon'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {loadingThreads ? (
                    <div className="py-8 flex justify-center text-zinc-400">
                      <Loader2 size={18} className="animate-spin" />
                    </div>
                  ) : isAdmin ? (
                    filteredAdminThreads.length === 0 ? (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center py-6 px-2">
                        এখনও কোনো গ্রাহক অ্যাডমিনকে মতামত পাঠাননি।
                      </p>
                    ) : (
                      filteredAdminThreads.map((t) => {
                        const isSelected =
                          selectedChat.kind === 'admin' && selectedChat.threadId === t.threadId;
                        return (
                          <button
                            key={t.threadId}
                            type="button"
                            onClick={() =>
                              handleSelectAdminChannel(t.threadId, t.pageScope, t.uid, t.userName)
                            }
                            className={`w-full text-left p-2.5 rounded-xl border transition-all space-y-1 ${
                              isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-700'
                                : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                                {t.userName}
                              </span>
                              {t.unreadByAdmin && (
                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  t.pageScope === 'salon'
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                    : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                                }`}
                              >
                                {t.pageScope === 'salon' ? 'Salon' : 'Voice Studio'}
                              </span>
                              <span className="text-[10px] text-zinc-400 truncate">
                                {formatChatTime(t.updatedAt)}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
                              {t.lastMessage}
                            </p>
                          </button>
                        );
                      })
                    )
                  ) : (
                    userAdminChannels.map((item) => {
                      const isSelected =
                        selectedChat.kind === 'admin' && selectedChat.threadId === item.threadId;
                      return (
                        <button
                          key={item.threadId}
                          type="button"
                          onClick={() =>
                            handleSelectAdminChannel(
                              item.threadId,
                              item.scope,
                              safeUid,
                              safeDisplayName
                            )
                          }
                          className={`w-full text-left p-2.5 rounded-xl border transition-all space-y-1 ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-700'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 dark:text-white truncate">
                              {item.scope === 'salon' ? (
                                <Scissors size={12} className="text-amber-500 shrink-0" />
                              ) : (
                                <AudioLines size={12} className="text-indigo-500 shrink-0" />
                              )}
                              <span className="truncate">
                                {item.scope === 'salon' ? 'Salon → Admin' : 'Studio → Admin'}
                              </span>
                            </span>
                            {item.existingThread?.unreadByUser && (
                              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-snug">
                            {item.existingThread?.lastMessage || item.subtitle}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* COLUMN 2: User-to-User Community Chat List (Right beside Admin list inside the Chat List) */}
              <div
                className={`${
                  mobileListTab === 'community' ? 'flex' : 'hidden md:flex'
                } flex-col min-h-0 overflow-hidden`}
              >
                <div className="px-3 py-2.5 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 shrink-0">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <Users size={12} />
                    <span>ইউজারদের চ্যাট</span>
                  </span>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    ইউজার একে অপরের সাথে মতামত শেয়ার
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {COMMUNITY_ROOMS.map((room) => {
                    const isSelected =
                      selectedChat.kind === 'community' && selectedChat.roomId === room.id;
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => handleSelectCommunityRoom(room.id)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all space-y-1 ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                            {room.title}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0">
                            {room.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-snug">
                          {room.subtitle}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT AREA: Active Conversation Thread */}
          <div
            className={`${
              mobileShowThread ? 'flex' : 'hidden md:flex'
            } flex-1 flex-col min-w-0 min-h-0 bg-white dark:bg-zinc-900`}
          >
            {/* Active Conversation Header */}
            <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileShowThread(false)}
                  className="md:hidden p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0"
                  aria-label="Back to chat list"
                >
                  <ArrowLeft size={16} />
                </button>

                <div className="min-w-0">
                  {selectedChat.kind === 'admin' ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                          {isAdmin
                            ? `${selectedChat.customerName} ↔ অ্যাডমিন`
                            : selectedChat.pageScope === 'salon'
                            ? `${salonName} · অ্যাডমিন মতামত`
                            : 'Voice Studio · অ্যাডমিন মতামত'}
                        </h3>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                          প্রাইভেট অ্যাডমিন চ্যাট
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {isAdmin
                          ? 'এই গ্রাহকের সরাসরি মতামতে উত্তর দিন'
                          : 'এখানে পাঠানো মতামত সরাসরি অ্যাডমিনের কাছে পৌঁছাবে'}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                          {activeCommunityMeta.title}
                        </h3>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          ইউজার কমিউনিটি
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {activeCommunityMeta.subtitle}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-zinc-50/40 dark:bg-zinc-950/20">
              {selectedChat.kind === 'admin' ? (
                loadingAdminMessages ? (
                  <div className="py-12 flex justify-center text-zinc-400">
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                ) : adminMessages.length === 0 ? (
                  <div className="py-12 text-center space-y-2 max-w-sm mx-auto">
                    <Sparkles size={22} className="mx-auto text-indigo-500" />
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      এখনও কোনো মেসেজ নেই
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {selectedChat.pageScope === 'salon'
                        ? 'সেলুন বুকিং বা সার্ভিস নিয়ে আপনার মতামত লিখে অ্যাডমিনকে পাঠান।'
                        : 'ভয়েস স্টুডিও নিয়ে আপনার মতামত বা পরামর্শ লিখে অ্যাডমিনকে পাঠান।'}
                    </p>
                  </div>
                ) : (
                  adminMessages.map((msg) => {
                    const isMine = msg.uid === safeUid;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                            {msg.senderRole === 'admin' ? 'Admin' : msg.senderName}
                          </span>
                          {msg.senderRole === 'admin' && (
                            <Crown size={11} className="text-amber-500" />
                          )}
                          <span className="text-[10px] text-zinc-400">
                            {formatChatTime(msg.createdAt)}
                          </span>
                        </div>
                        <div
                          className={`max-w-[82%] sm:max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                            isMine
                              ? 'bg-indigo-600 text-white rounded-br-sm'
                              : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-bl-sm'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )
              ) : loadingCommunityMessages ? (
                <div className="py-12 flex justify-center text-zinc-400">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : communityMessages.length === 0 ? (
                <div className="py-12 text-center space-y-2 max-w-sm mx-auto">
                  <Users size={22} className="mx-auto text-emerald-500" />
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    আলোচনা শুরু করুন
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    অন্যান্য ইউজারদের সাথে আপনার অভিজ্ঞতা ও মতামত শেয়ার করতে নিচে লিখুন।
                  </p>
                </div>
              ) : (
                communityMessages.map((msg) => {
                  const isMine = msg.uid === safeUid;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1 flex-wrap">
                        <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
                          {msg.senderName}
                        </span>
                        {msg.senderRole === 'admin' && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                            <Crown size={9} />
                            Admin
                          </span>
                        )}
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {getOriginBadgeLabel(msg.originPage)}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {formatChatTime(msg.createdAt)}
                        </span>
                        {(isMine || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCommunityMessage(msg.id)}
                            className="p-0.5 text-zinc-400 hover:text-red-500 transition-colors"
                            title="Delete message"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                      <div
                        className={`max-w-[82%] sm:max-w-[75%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                          isMine
                            ? 'bg-emerald-600 text-white rounded-br-sm'
                            : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-bl-sm'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2 shrink-0"
            >
              {chatFeedback && (
                <p className="text-xs text-red-600 dark:text-red-400 px-1">
                  {chatFeedback}
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  maxLength={1000}
                  placeholder={
                    selectedChat.kind === 'admin'
                      ? 'অ্যাডমিনের কাছে আপনার মতামত লিখুন...'
                      : 'অন্য ইউজারদের সাথে আপনার মতামত শেয়ার করুন...'
                  }
                  className="flex-1 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900"
                />
                <button
                  type="submit"
                  disabled={sending || !draftText.trim()}
                  className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 shrink-0 ${
                    selectedChat.kind === 'admin'
                      ? 'bg-indigo-600 hover:bg-indigo-500'
                      : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  {sending ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  <span className="hidden sm:inline">পাঠান</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatHubModal;
