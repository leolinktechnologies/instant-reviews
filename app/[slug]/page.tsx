'use client';

import { useState, useEffect, use } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client directly on Frontend
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function BusinessReviewPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const slug = resolvedParams?.slug || '';

  const businessName = slug
    ? decodeURIComponent(slug).replace(/-/g, ' ')
    : 'This Business';

  // 🔴 Apne Google Review Direct Link (Place ID / Google Maps write review URL) se replace karein
  const googleReviewUrl = `https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID`;

  const [rating, setRating] = useState<number>(5);

  // 4-5 Stars States
  const [reviews, setReviews] = useState<string[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // 1-3 Stars Feedback States
  const [feedbackText, setFeedbackText] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // 🟢 Auto-Generate Reviews when Star Rating is 4 or 5
  useEffect(() => {
    if (rating >= 4) {
      generateReviewsAuto(rating);
    }
  }, [rating]);

  const generateReviewsAuto = async (selectedRating: number) => {
    setLoadingReviews(true);
    setReviews([]);

    try {
      const res = await fetch('/api/generate-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          rating: selectedRating,
          category: businessName,
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

  // 🟢 4-5 Stars: Copy Review Text & Direct Redirect
  const handleCopyAndRedirect = (reviewText: string, index: number) => {
    navigator.clipboard.writeText(reviewText);
    setCopiedIndex(index);

    setTimeout(() => {
      window.open(googleReviewUrl, '_blank');
    }, 600);
  };

  // 🔴 1-3 Stars: Save Private Feedback directly to Supabase
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;

    setSubmittingFeedback(true);

    try {
      const { error } = await supabase.from('feedbacks').insert([
        {
          business_slug: slug,
          rating,
          feedback_text: feedbackText,
          customer_name: customerName || 'Anonymous',
          customer_contact: customerContact || '',
        },
      ]);

      if (error) {
        console.error('Supabase Error:', error);
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="relative w-full max-w-md space-y-6 text-center">
        
        {/* Header */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest">
            Rate Your Experience
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-white capitalize">
            {businessName}
          </h1>
          <p className="text-sm text-slate-400">
            How was your visit with us today?
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          
          {/* Star Rating Picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => {
                    setRating(star);
                    setFeedbackSubmitted(false);
                  }}
                  className="p-1 transition-transform active:scale-95 focus:outline-none"
                >
                  <span
                    className={`text-3xl sm:text-4xl transition-colors ${
                      star <= rating
                        ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                        : 'text-slate-700 hover:text-slate-500'
                    }`}
                  >
                    ★
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs font-medium text-amber-400">
              {rating === 5 && '⭐⭐⭐⭐⭐ Excellent!'}
              {rating === 4 && '⭐⭐⭐⭐ Very Good!'}
              {rating === 3 && '⭐⭐⭐ Average'}
              {rating === 2 && '⭐⭐ Below Expectations'}
              {rating === 1 && '⭐ Poor Experience'}
            </p>
          </div>

          {/* 🔴 PATH 1: 1-3 STARS (PRIVATE FEEDBACK FORM) */}
          {rating <= 3 && (
            <div className="text-left pt-2 border-t border-slate-800 space-y-4">
              {feedbackSubmitted ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl text-center space-y-1">
                  <p className="font-bold text-base">Thank you for your feedback! 🙏</p>
                  <p className="text-xs text-slate-300">
                    We appreciate your input and will work on improving.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      How can we improve? *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Tell us what went wrong..."
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Your Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Phone or Email (Optional)
                    </label>
                    <input
                      type="text"
                      value={customerContact}
                      onChange={(e) => setCustomerContact(e.target.value)}
                      placeholder="So management can reach out"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingFeedback}
                    className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-slate-950 font-bold py-3 px-4 rounded-xl shadow-md transition-all text-sm disabled:opacity-50"
                  >
                    {submittingFeedback ? 'Submitting...' : 'Send Private Feedback'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* 🟢 PATH 2: 4-5 STARS (AUTOMATIC REVIEWS DISPLAY) */}
          {rating >= 4 && loadingReviews && (
            <div className="pt-2 border-t border-slate-800 flex items-center justify-center gap-2 text-amber-400 text-sm">
              <svg className="animate-spin h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Generating review ideas for you...</span>
            </div>
          )}
        </div>

        {/* AI Generated Reviews List (Auto Pop-up) */}
        {rating >= 4 && !loadingReviews && reviews.length > 0 && (
          <div className="space-y-3 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
              Tap any review to copy & open Google:
            </p>

            {reviews.map((review, idx) => (
              <div
                key={idx}
                onClick={() => handleCopyAndRedirect(review, idx)}
                className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 transition-all duration-200 cursor-pointer active:scale-[0.99] shadow-lg"
              >
                <p className="text-sm text-slate-200 leading-relaxed pr-12">
                  "{review}"
                </p>

                <div className="absolute top-4 right-4">
                  {copiedIndex === idx ? (
                    <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                      ✓ Copied! Opening Google...
                    </span>
                  ) : (
                    <span className="text-xs bg-amber-500/20 text-amber-300 group-hover:bg-amber-500 group-hover:text-slate-950 px-2.5 py-1 rounded-lg font-medium transition-colors">
                      Copy & Post
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