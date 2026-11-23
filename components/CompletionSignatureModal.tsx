/**
 * © 2026 Srabon Go — All Rights Reserved.
 */

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Eraser, Loader2, PenTool, X } from 'lucide-react';
import { useLanguage } from '../utils/i18n';

interface Point {
  x: number;
  y: number;
}

interface CompletionSignatureModalProps {
  title: string;
  subtitle?: string;
  defaultSignerName?: string;
  signerLabel?: string;
  namePlaceholder?: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (data: { signaturePath: string; signerName: string }) => Promise<void>;
}

const LOGICAL_WIDTH = 480;
const LOGICAL_HEIGHT = 170;

function serializeStrokesToSvgPath(strokes: Point[][]): string {
  const buildPath = (step: number): string => {
    const parts: string[] = [];
    for (const stroke of strokes) {
      if (stroke.length === 0) continue;
      const first = stroke[0];
      parts.push(`M${Math.round(first.x)},${Math.round(first.y)}`);

      if (stroke.length === 1) {
        const nx = Math.min(LOGICAL_WIDTH, Math.round(first.x) + 2);
        const ny = Math.round(first.y);
        parts.push(`L${nx},${ny}`);
        continue;
      }

      for (let i = 1; i < stroke.length; i += step) {
        const pt = stroke[i];
        parts.push(`L${Math.round(pt.x)},${Math.round(pt.y)}`);
      }
      const last = stroke[stroke.length - 1];
      if ((stroke.length - 1) % step !== 0) {
        parts.push(`L${Math.round(last.x)},${Math.round(last.y)}`);
      }
    }
    return parts.join(' ');
  };

  for (const step of [1, 2, 3, 4, 6, 8, 12]) {
    const candidate = buildPath(step);
    if (candidate.length <= 1450) {
      return candidate;
    }
  }

  // Fallback compact representation of first & last points per stroke
  const minimal: string[] = [];
  for (const stroke of strokes.slice(0, 40)) {
    if (stroke.length === 0) continue;
    const first = stroke[0];
    const last = stroke[stroke.length - 1];
    minimal.push(`M${Math.round(first.x)},${Math.round(first.y)}`);
    const lx =
      Math.round(last.x) === Math.round(first.x) && Math.round(last.y) === Math.round(first.y)
        ? Math.min(LOGICAL_WIDTH, Math.round(last.x) + 2)
        : Math.round(last.x);
    minimal.push(`L${lx},${Math.round(last.y)}`);
  }
  return minimal.join(' ').slice(0, 1490).trim();
}

const CompletionSignatureModal: React.FC<CompletionSignatureModalProps> = ({
  title,
  subtitle,
  defaultSignerName = '',
  signerLabel,
  namePlaceholder,
  submitLabel,
  onClose,
  onSubmit,
}) => {
  const { bi } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalRef = useRef<HTMLFormElement | null>(null);
  const isDrawingRef = useRef(false);
  const activeStrokeRef = useRef<Point[]>([]);

  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, submitting]);

  const redrawCanvas = (allStrokes: Point[][], liveStroke: Point[] = []) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Guide baseline
    ctx.save();
    ctx.strokeStyle = 'rgba(161, 161, 170, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, LOGICAL_HEIGHT - 32);
    ctx.lineTo(LOGICAL_WIDTH - 20, LOGICAL_HEIGHT - 32);
    ctx.stroke();
    ctx.restore();

    const drawList = liveStroke.length > 0 ? [...allStrokes, liveStroke] : allStrokes;
    ctx.save();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of drawList) {
      if (stroke.length === 0) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      if (stroke.length === 1) {
        ctx.lineTo(stroke[0].x + 1.5, stroke[0].y);
      } else {
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  useEffect(() => {
    redrawCanvas(strokes);
  }, [strokes]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = LOGICAL_WIDTH / (rect.width || LOGICAL_WIDTH);
    const scaleY = LOGICAL_HEIGHT / (rect.height || LOGICAL_HEIGHT);
    const x = Math.min(LOGICAL_WIDTH - 2, Math.max(2, (e.clientX - rect.left) * scaleX));
    const y = Math.min(LOGICAL_HEIGHT - 2, Math.max(2, (e.clientY - rect.top) * scaleY));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (submitting) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getCanvasPoint(e);
    isDrawingRef.current = true;
    activeStrokeRef.current = [pt];
    setError(null);
    redrawCanvas(strokes, activeStrokeRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || submitting) return;
    const pt = getCanvasPoint(e);
    const prev = activeStrokeRef.current[activeStrokeRef.current.length - 1];
    if (prev) {
      const dx = pt.x - prev.x;
      const dy = pt.y - prev.y;
      if (dx * dx + dy * dy < 9) return;
    }
    activeStrokeRef.current = [...activeStrokeRef.current, pt];
    redrawCanvas(strokes, activeStrokeRef.current);
  };

  const finishStroke = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const finished = activeStrokeRef.current;
    activeStrokeRef.current = [];
    if (finished.length > 0) {
      setStrokes((prev) => [...prev, finished]);
    }
  };

  const handleClear = () => {
    if (submitting) return;
    isDrawingRef.current = false;
    activeStrokeRef.current = [];
    setStrokes([]);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const cleanSigner = signerName.trim().slice(0, 80);
    if (cleanSigner.length < 2) {
      setError(
        bi(
          'অনুগ্রহ করে স্বাক্ষরকারীর নাম লিখুন (কমপক্ষে ২ অক্ষর)।',
          'Please enter the signer name (at least 2 characters).'
        )
      );
      return;
    }

    if (strokes.length === 0) {
      setError(
        bi(
          'অনুগ্রহ করে নিচের সিগনেচার প্যাডে স্বাক্ষর আঁকুন।',
          'Please draw a signature in the pad below.'
        )
      );
      return;
    }

    const svgPath = serializeStrokesToSvgPath(strokes);
    if (svgPath.length < 5 || !/^M[ML0-9., ]+$/.test(svgPath)) {
      setError(
        bi(
          'স্বাক্ষরটি সঠিকভাবে রেকর্ড হয়নি। অনুগ্রহ করে আবার স্বাক্ষর দিন।',
          'Signature could not be captured cleanly. Please sign again.'
        )
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ signaturePath: svgPath, signerName: cleanSigner });
    } catch (err: any) {
      setError(
        err?.message ||
          bi('সিগনেচার সেভ করা যায়নি। আবার চেষ্টা করুন।', 'Could not save signature. Please try again.')
      );
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-signature-title"
    >
      <div
        className="absolute inset-0 bg-zinc-950/65 backdrop-blur-sm animate-fade-in"
        onClick={() => !submitting && onClose()}
      />

      <form
        ref={modalRef}
        onSubmit={handleSave}
        className="relative w-full max-w-xl rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-slide-up"
      >
        <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <PenTool size={18} />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h3
                id="completion-signature-title"
                className="text-lg font-serif font-medium text-zinc-900 dark:text-white leading-snug"
              >
                {title}
              </h3>
              {subtitle && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-snug">{subtitle}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors shrink-0 min-h-[42px] min-w-[42px] flex items-center justify-center"
            aria-label={bi('বন্ধ করুন', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 sm:p-7 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-600 dark:text-red-300 leading-relaxed">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 mb-2">
              {signerLabel || bi('স্বাক্ষরকারীর নাম', 'Signer Name')}
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder={namePlaceholder || bi('আপনার বা দোকানদারের নাম লিখুন', 'Enter customer or shopkeeper name')}
              className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-base text-zinc-900 dark:text-white"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                {bi('কমপ্লিট সিগনেচার প্যাড (এখানে সাইন করুন)', 'Completion Signature Pad (Sign Here)')}
              </label>
              <button
                type="button"
                onClick={handleClear}
                disabled={submitting || strokes.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
              >
                <Eraser size={14} />
                <span>{bi('মুছুন', 'Clear')}</span>
              </button>
            </div>

            <div className="relative rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
              <canvas
                ref={canvasRef}
                width={LOGICAL_WIDTH}
                height={LOGICAL_HEIGHT}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishStroke}
                onPointerCancel={finishStroke}
                className="w-full h-[180px] block touch-none cursor-crosshair"
              />
              {strokes.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-400 dark:text-zinc-500 px-4 text-center">
                  {bi('আঙুল বা মাউস দিয়ে এখানে সিগনেচার করুন', 'Draw signature here with finger or mouse')}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-sm font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors min-h-[44px]"
            >
              {bi('বাতিল', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors disabled:opacity-60 min-h-[44px]"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              <span>
                {submitting
                  ? bi('সেভ হচ্ছে...', 'Saving...')
                  : submitLabel || bi('কমপ্লিট সিগনেচার জমা দিন', 'Confirm Completion Signature')}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CompletionSignatureModal;
