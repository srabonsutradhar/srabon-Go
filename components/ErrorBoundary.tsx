/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { auth } from '../firebase';
import { reportAppIssue } from '../utils/appIssues';

const ADMIN_EMAIL = 'srabon10010@gmail.com';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportAppIssue({
      source: 'ErrorBoundary',
      severity: 'error',
      message: error?.message || 'Unexpected UI render error',
      details: info?.componentStack ? info.componentStack.slice(0, 800) : undefined,
    });
  }

  render() {
    if (this.state.hasError) {
      const currentUser = auth.currentUser;
      const isAdmin = Boolean(
        currentUser?.emailVerified && currentUser?.email?.toLowerCase() === ADMIN_EMAIL
      );
      return (
        <div className="min-h-screen w-screen bg-[#FDFDFD] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-xl text-center space-y-5">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              <AlertCircle size={28} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-serif font-medium">
                {isAdmin ? 'Something went wrong' : 'পেজটি পুনরায় লোড করুন'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 break-words">
                {isAdmin
                  ? this.state.errorMessage
                  : 'অনুগ্রহ করে পেজটি রিলোড করে আবার ব্যবহার করুন।'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-zinc-900 dark:bg-indigo-600 text-white text-sm font-medium hover:bg-zinc-800 dark:hover:bg-indigo-500 transition-colors"
            >
              <RotateCcw size={15} />
              <span>Reload Page</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
