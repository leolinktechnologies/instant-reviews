'use client';

import { useState, useEffect, use } from 'react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function BusinessReviewPage({ params }: PageProps) {
  // Unwrap Next.js dynamic params
  const resolvedParams = use(params);
  
  // Convert URL slug (e.g. "apex-coffee-house") into readable text ("Apex Coffee House")
  const defaultName = resolvedParams?.slug
    ? decodeURIComponent(resolvedParams.slug).replace(/-/g, ' ')
    : '';

  const [businessName, setBusinessName] = useState(defaultName);
  const [category, setCategory] = useState('');
  const [reviews, setReviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Auto-fill business name if slug changes
  useEffect(() => {
    if (defaultName) {
      setBusinessName(defaultName);
    }
  }, [defaultName]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) return;

    setLoading(true);
    setReviews([]);

    try {
      const res = await fetch('/api/generate-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, category }),
      });

      const data = await res.json();
      if (data?.reviews && Array.isArray(data.reviews)) {
        setReviews(data.reviews);
      } else {
        setReviews(['❌ Something went wrong. Please try again!']);
      }
    } catch (err) {
      setReviews(['❌ Failed to connect to server.']);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
      {/* Background Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 sm:w-96 sm:h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-72 h-72 sm:w-96 sm:h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            ✨ AI Review Generator
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent capitalize">
            {businessName ? businessName : 'Google Review Generator'}
          </h1>
          <p className="text-sm sm:text-base text-slate-400">
            Generate authentic 5-star customer reviews in seconds.
          </p>
        </div>

        {/* Input Form Card */}
        <form
          onSubmit={handleGenerate}
          className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
              Business Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Apex Coffee House"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider mb-1.5">
              Category / Industry
            </label>
            <input
              type="text"
              placeholder="e.g. Cafe, Dental Clinic, Gym"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:scale-[0.98] text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Crafting Reviews...</span>
              </>
            ) : (
              <>
                <span>⚡ Generate Reviews</span>
              </>
            )}
          </button>
        </form>

        {/* Generated Reviews Container */}
        {reviews.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Generated Customer Reviews
              </span>
              <span className="text-xs text-indigo-400">Tap review to copy</span>
            </div>

            {reviews.map((review, idx) => (
              <div
                key={idx}
                onClick={() => copyToClipboard(review, idx)}
                className="group relative bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 transition-all duration-200 cursor-pointer active:scale-[0.99] shadow-md"
              >
                <p className="text-sm text-slate-200 leading-relaxed pr-8">
                  {review}
                </p>

                {/* Copy Status Badge */}
                <div className="absolute top-3.5 right-3.5 text-xs font-medium">
                  {copiedIndex === idx ? (
                    <span className="text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      ✓ Copied!
                    </span>
                  ) : (
                    <span className="text-slate-500 group-hover:text-slate-300 transition-colors">
                      📋
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