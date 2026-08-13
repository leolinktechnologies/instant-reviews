'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function BusinessReviewPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const slug = resolvedParams?.slug || '';

  const [businessData, setBusinessData] = useState<{
    business_name: string;
    category: string;
    google_review_url: string;
  } | null>(null);

  const [loadingBusiness, setLoadingBusiness] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rating, setRating] = useState<number | null>(null);

  // 4-5 Stars States
  const [reviews, setReviews] = useState<string[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // 1-3 Stars Feedback States
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Fetch Business Details strictly from Supabase
  useEffect(() => {
    async function fetchBusiness() {
      if (!slug) {
        setNotFound(true);
        setLoadingBusiness(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('business_name, category, google_review_url')
          .eq('slug', slug)
          .single();

        if (data && !error) {
          setBusinessData(data);
          setNotFound(false);
        } else {
          setBusinessData(null);
          setNotFound(true);
        }
      } catch (err) {
        console.error('Error fetching business:', err);
        setNotFound(true);
      } finally {
        setLoadingBusiness(false);
      }
    }

    fetchBusiness();
  }, [slug]);

  // AI Reviews Trigger
  useEffect(() => {
    if (rating !== null && rating >= 4 && businessData) {
      generateReviewsAuto(rating, businessData.business_name, businessData.category);
    }
  }, [rating, businessData]);

  const generateReviewsAuto = async (
    selectedRating: number,
    bName: string,
    cat: string
  ) => {
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
      }
    } catch (err) {
      console.error('Error generating reviews:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleCopyAndRedirect = (reviewText: string, index: number) => {
    navigator.clipboard.writeText(reviewText);
    setCopiedIndex(index);

    const redirectUrl = businessData?.google_review_url || 'https://google.com';

    setTimeout(() => {
      window.open(redirectUrl, '_blank');
    }, 600);
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim() || rating === null) return;

    setSubmittingFeedback(true);

    try {
      const { error } = await supabase.from('feedbacks').insert([
        {
          business_name: businessData?.business_name || slug,
          business_slug: slug,
          rating,
          feedback_text: feedbackText,
        },
      ]);

      if (error) {
        console.error('Supabase Insert Error:', error);
        alert('Could not save feedback: ' + error.message);
      } else {
        setFeedbackSubmitted(true);
      }
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      alert('System Error while saving feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Loading Screen
  if (loadingBusiness) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-amber-400 font-medium text-lg">
          <svg className="animate-spin h-7 w-7 text-amber-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Loading Business...</span>
        </div>
      </main>
    );
  }

  // 404 - Business Not Found Screen
  if (notFound || !businessData) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 max-w-md space-y-4 shadow-2xl">
          <div className="text-5xl">🔍</div>
          <h1 className="text-2xl font-bold text-red-400">Business Not Found</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            The business page <span className="text-amber-400 font-mono">/{slug}</span> does not exist in our database. Please check the URL or contact support.
          </p>
        </div>
      </main>
    );
  }

  const businessName = businessData.business_name;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start pt-8 pb-12 px-4 sm:px-6">
      <div className="relative w-full max-w-lg space-y-8 text-center">
        
        {/* Header */}
        <div className="space-y-3 pt-2">
          <p className="text-xs sm:text-sm font-semibold text-amber-400 uppercase tracking-widest">
            Rate Your Experience
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white capitalize leading-tight">
            {businessName}
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
                    setRating(star);
                    setFeedbackSubmitted(false);
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

          {/* 🔴 1-3 STARS FORM */}
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

          {/* 🟢 4-5 STARS LOADING SPINNER */}
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

        {/* 🟢 4-5 STARS REVIEWS LIST */}
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
                {/* Review Text */}
                <p className="text-base text-slate-200 leading-relaxed">
                  "{review}"
                </p>

                {/* Bottom Action Bar */}
                <div className="flex items-center justify-end pt-1 border-t border-slate-800/60">
                  {copiedIndex === idx ? (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                      ✓ Copied! Opening Google...
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