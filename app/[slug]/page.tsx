'use client';

import { use, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const getSupabaseClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("❌ Supabase credentials missing in .env.local!");
    return null;
  }

  return createClient(url, key);
};

export default function ReviewFunnel({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const slug = resolvedParams?.slug;

  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [envError, setEnvError] = useState(false);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submittedFeedback, setSubmittedFeedback] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedStatus, setCopiedStatus] = useState('');

  const [reviews, setReviews] = useState<string[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    async function fetchBusinessData() {
      if (!slug) return;

      const supabase = getSupabaseClient();
      if (!supabase) {
        setEnvError(true);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('slug', slug)
          .single();

        if (error || !data) {
          console.error("Supabase Error:", error);
          setError(true);
        } else {
          setBusiness(data);
        }
      } catch (err) {
        console.error("Fetch Exception:", err);
        setError(true);
      } fontFinally: {
        setLoading(false);
      }
    }

    fetchBusinessData();
  }, [slug]);

  const fetchAiReviews = async () => {
    if (!business) return;
    setLoadingAi(true);
    try {
      const res = await fetch('/api/generate-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: business.business_name,
          category: business.category,
        }),
      });
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch (err) {
      console.error("AI Fetch Error:", err);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleStarClick = (star: number) => {
    setRating(star);
    setSubmittedFeedback(false);
    if (star >= 4) {
      fetchAiReviews();
    }
  };

  const handleReviewCopy = (reviewText: string) => {
    navigator.clipboard.writeText(reviewText);
    setCopiedStatus("Copied! Opening Google... Just long-press & Paste!");

    setTimeout(() => {
      window.open(business.google_review_url, '_blank');
      setCopiedStatus('');
    }, 1200);
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/save-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: business.business_name,
          rating,
          feedbackText: feedback,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSubmittedFeedback(true);
      } else {
        alert(`Failed to save feedback: ${data.error || 'Unknown error'}`);
        console.error("❌ Save Error:", data);
      }
    } catch (err) {
      console.error("Feedback submission failed:", err);
      alert("Network Error: Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 font-medium animate-pulse">
          Loading Business Profile...
        </p>
      </main>
    );
  }

  if (envError) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-md text-center max-w-md border border-red-200">
          <h2 className="text-lg font-bold text-red-600 mb-2">⚠️ Missing Environment Variables</h2>
          <p className="text-xs text-slate-600 mb-4">
            Next.js ko `.env.local` se Supabase Keys nahi mil rahe hain.
          </p>
          <div className="text-left bg-slate-900 text-slate-100 text-xs p-3 rounded-lg overflow-x-auto">
            <p className="text-emerald-400">// `.env.local` me ye hona zaroori hai:</p>
            <p>NEXT_PUBLIC_SUPABASE_URL=your_url</p>
            <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !business) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-md text-center max-w-sm border border-slate-100">
          <h2 className="text-xl font-bold text-red-500 mb-2">Business Not Found</h2>
          <p className="text-sm text-slate-500">
            The review link you opened seems to be invalid or expired.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 text-center border border-slate-100">
        
        {/* Business Header */}
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold text-2xl">
            {business.business_name.charAt(0)}
          </div>
          <h1 className="text-xl font-bold text-slate-800">{business.business_name}</h1>
          <p className="text-xs bg-slate-100 text-slate-600 inline-block px-3 py-1 rounded-full mt-1 font-medium">
            {business.category}
          </p>
        </div>

        {/* Alert Banner */}
        {copiedStatus && (
          <div className="mb-4 p-3 bg-emerald-100 text-emerald-800 rounded-xl text-sm font-semibold animate-pulse">
            {copiedStatus}
          </div>
        )}

        {/* Star Rating */}
        <div className="mb-6">
          <p className="text-slate-700 font-medium mb-3">How was your experience today?</p>
          <div className="flex justify-center space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="text-4xl focus:outline-none transition-transform hover:scale-125"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => handleStarClick(star)}
              >
                <span className={(hoverRating || rating) >= star ? "text-amber-400" : "text-slate-200"}>
                  ★
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 1-3 Stars (Private Feedback) */}
        {rating > 0 && rating <= 3 && !submittedFeedback && (
          <form onSubmit={handleFeedbackSubmit} className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              We are sorry to hear that. Please let us know how we can improve.
            </div>
            <textarea
              required
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what went wrong..."
              className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-slate-800 text-white py-3 rounded-xl font-medium text-sm hover:bg-slate-900 transition disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Submit Private Feedback"}
            </button>
          </form>
        )}

        {/* Thank You State for 1-3 Stars */}
        {submittedFeedback && (
          <div className="p-4 bg-blue-50 rounded-xl text-blue-900 text-sm font-medium">
            Thank you for helping us improve! Your feedback has been sent directly to management. 🙏
          </div>
        )}

        {/* 4-5 Stars (AI Options) */}
        {rating >= 4 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Tap any review to Copy & Post on Google:
            </p>

            {loadingAi ? (
              <div className="p-6 text-sm text-blue-600 font-medium animate-pulse">
                ⚡ Generating AI reviews...
              </div>
            ) : (
              <div className="space-y-2">
                {reviews.map((rev, index) => (
                  <button
                    key={index}
                    onClick={() => handleReviewCopy(rev)}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition group flex justify-between items-center"
                  >
                    <span className="text-sm text-slate-700 group-hover:text-blue-900 font-medium pr-2">
                      "{rev}"
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-semibold shrink-0">
                      Tap & Go ➔
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}