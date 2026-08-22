'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { playSelectReviewInstruction, playPasteReviewInstruction } from '@/lib/speak';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface BusinessData {
  business_name: string;
  category: string;
  google_review_url: string;
  plan_expiry_date?: string;
}

interface ClientProps {
  slug: string;
  businessData: BusinessData;
}

export default function ReviewPageClient({ slug, businessData }: ClientProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [reviews, setReviews] = useState<string[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Prefetch Cache & Promise Refs
  const prefetchedReviewsRef = useRef<string[] | null>(null);
  const prefetchPromiseRef = useRef<Promise<string[] | null> | null>(null);

  // Feedback States
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Analytics Logger
  const logAnalytics = (
    eventType: 'visited' | 'rated' | 'generated' | 'copied_redirect',
    ratingVal?: number | null
  ) => {
    if (!slug) return;
    supabase
      .from('review_analytics')
      .insert([
        {
          business_slug: slug,
          event_type: eventType,
          rating: ratingVal !== undefined ? ratingVal : rating,
        },
      ])
      .then(({ error }) => {
        if (error) console.error('Analytics log error:', error);
      });
  };

  useEffect(() => {
    logAnalytics('visited', null);
    prefetchDefaultReviews(businessData.business_name, businessData.category);
  }, [slug]);

  // Silent Background Prefetch
  const prefetchDefaultReviews = (bName: string, cat: string) => {
    if (prefetchedReviewsRef.current || prefetchPromiseRef.current) return;

    prefetchPromiseRef.current = (async () => {
      try {
        const res = await fetch('/api/generate-reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessName: bName,
            rating: 5,
            category: cat || 'Business',
          }),
        });

        const data = await res.json();
        if (data?.reviews && Array.isArray(data.reviews) && data.reviews.length > 0) {
          prefetchedReviewsRef.current = data.reviews;
          return data.reviews;
        }
      } catch (err) {
        console.warn('Silent prefetch failed:', err);
      } finally {
        prefetchPromiseRef.current = null;
      }
      return null;
    })();
  };

  // Auto-Generate / Fetch Reviews
  useEffect(() => {
    if (rating !== null && rating >= 4) {
      handleHighRatingReviews(rating);
    }
  }, [rating]);

  const handleHighRatingReviews = async (selectedRating: number) => {
    // 1. Check if cached
    if (prefetchedReviewsRef.current && prefetchedReviewsRef.current.length > 0) {
      setReviews(prefetchedReviewsRef.current);
      logAnalytics('generated', selectedRating);
      prefetchedReviewsRef.current = null;
      return;
    }

    // 2. Check if prefetch request is currently in-flight
    if (prefetchPromiseRef.current) {
      setLoadingReviews(true);
      const prefetched = await prefetchPromiseRef.current;
      if (prefetched && prefetched.length > 0) {
        setReviews(prefetched);
        logAnalytics('generated', selectedRating);
        setLoadingReviews(false);
        prefetchedReviewsRef.current = null;
        return;
      }
    }

    // 3. Fallback to direct API call
    generateReviewsAuto(selectedRating, businessData.business_name, businessData.category);
  };

  const generateReviewsAuto = async (selectedRating: number, bName: string, cat: string) => {
    setLoadingReviews(true);
    setReviews([]);

    try {
      const res = await fetch('/api/generate-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: bName,
          rating: selectedRating,
          category: cat || 'Business',
        }),
      });

      const data = await res.json();
      if (data?.reviews && Array.isArray(data.reviews)) {
        setReviews(data.reviews);
        logAnalytics('generated', selectedRating);
      }
    } catch (err) {
      console.error('Error generating reviews:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const getDirectReviewUrl = (rawUrl: string): string => {
    if (!rawUrl) return 'https://google.com';
    let trimmed = rawUrl.trim();
    if (trimmed.includes('placeid=')) {
      const match = trimmed.match(/placeid=([^&]+)/);
      if (match && match[1]) {
        return `https://search.google.com/local/writereview?placeid=${match[1]}`;
      }
    }
    if (!trimmed.includes('writereview') && !trimmed.includes('/review')) {
      if (trimmed.endsWith('/')) {
        trimmed += 'review';
      } else if (!trimmed.includes('?')) {
        trimmed += '/review';
      }
    }
    return trimmed;
  };

  const handleCopyAndRedirect = async (reviewText: string, index: number) => {
    playPasteReviewInstruction();
    logAnalytics('copied_redirect', rating);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(reviewText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = reviewText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch (err) {
      console.error('Failed to copy review text:', err);
    }

    setCopiedIndex(index);
    const targetUrl = getDirectReviewUrl(businessData.google_review_url);

    setTimeout(() => {
      window.location.href = targetUrl;
    }, 1650);
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim() || rating === null) return;

    setSubmittingFeedback(true);

    try {
      const { error } = await supabase.from('feedbacks').insert([
        {
          business_name: businessData.business_name || slug,
          business_slug: slug,
          rating,
          feedback_text: feedbackText,
        },
      ]);

      if (error) {
        alert('Could not save feedback: ' + error.message);
      } else {
        setFeedbackSubmitted(true);
      }
    } catch (err) {
      alert('System Error while saving feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start pt-8 pb-12 px-4 sm:px-6">
      <div className="relative w-full max-w-lg space-y-8 text-center">

        {/* Header */}
        <div className="space-y-3 pt-2">
          <p className="text-xs sm:text-sm font-semibold text-amber-400 uppercase tracking-widest">
            Rate Your Experience
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white capitalize leading-tight">
            {businessData.business_name}
          </h1>
          <p className="text-base text-slate-400">
            How was your visit with us today?
          </p>
        </div>

        {/* Main Rating Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-7 shadow-2xl space-y-7">

          {/* Star Picker */}
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => {
                    if (rating === star) return;
                    setRating(star);
                    setFeedbackSubmitted(false);
                    logAnalytics('rated', star);
                    if (star >= 4) playSelectReviewInstruction();
                  }}
                  className="p-1.5 transition-transform active:scale-95 focus:outline-none"
                >
                  <span
                    className={`text-5xl transition-all duration-200 ${
                      rating !== null && star <= rating
                        ? 'text-amber-400 drop-shadow-[0_0_14px_rgba(251,191,36,0.65)] scale-110'
                        : 'text-slate-700 hover:text-slate-500'
                    }`}
                  >
                    ★
                  </span>
                </button>
              ))}
            </div>

            <p className="text-sm font-medium text-amber-400 h-5">
              {rating === null && <span className="text-slate-500">Tap stars to rate</span>}
              {rating === 5 && '⭐⭐⭐⭐⭐ Excellent!'}
              {rating === 4 && '⭐⭐⭐⭐ Very Good!'}
              {rating === 3 && '⭐⭐⭐ Average'}
              {rating === 2 && '⭐⭐ Below Expectations'}
              {rating === 1 && '⭐ Poor Experience'}
            </p>
          </div>

          {/* 1-3 STARS FORM */}
          {rating !== null && rating <= 3 && (
            <div className="text-left pt-3 border-t border-slate-800 space-y-4">
              {feedbackSubmitted ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-5 rounded-2xl text-center space-y-1">
                  <p className="font-bold text-lg">Thank you for your feedback! 🙏</p>
                  <p className="text-sm text-slate-300">
                    We appreciate your input and will work on improving.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      How can we improve? *
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Tell us what went wrong..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingFeedback}
                    className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all text-base disabled:opacity-50"
                  >
                    {submittingFeedback ? 'Submitting...' : 'Send Private Feedback'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* 4-5 STARS LOADING SPINNER */}
          {rating !== null && rating >= 4 && loadingReviews && (
            <div className="pt-3 border-t border-slate-800 flex items-center justify-center gap-3 text-amber-400 text-base font-medium">
              <svg className="animate-spin h-6 w-6 text-amber-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Crafting review options...</span>
            </div>
          )}
        </div>

        {/* 4-5 STARS REVIEWS LIST */}
        {rating !== null && rating >= 4 && !loadingReviews && reviews.length > 0 && (
          <div className="space-y-4 text-left">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              Tap any review to copy & open Google:
            </p>

            {reviews.map((review, idx) => (
              <div
                key={idx}
                onClick={() => handleCopyAndRedirect(review, idx)}
                className="group bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-5 transition-all duration-200 cursor-pointer active:scale-[0.99] shadow-xl space-y-3"
              >
                <p className="text-base text-slate-200 leading-relaxed">
                  "{review}"
                </p>

                <div className="flex items-center justify-end pt-1 border-t border-slate-800/60">
                  {copiedIndex === idx ? (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 flex items-center gap-1.5 animate-pulse">
                      <span>✓ Copied! Opening Google... Tap & hold to Paste</span>
                    </span>
                  ) : (
                    <span className="text-xs font-semibold bg-amber-500/20 text-amber-300 group-hover:bg-amber-500 group-hover:text-slate-950 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                      <span>Copy & Post</span>
                      <span>→</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}