'use client';

import { use, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const getSupabaseClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  return createClient(url, key);
};

interface Feedback {
  id?: string | number;
  business_name: string;
  rating: number;
  feedback_text: string;
  created_at?: string;
}

export default function DedicatedBusinessAdmin({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const slug = resolvedParams?.slug;

  const [business, setBusiness] = useState<any>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchBusinessAndFeedbacks();
  }, [slug]);

  const fetchBusinessAndFeedbacks = async () => {
    if (!slug) return;
    setLoading(true);
    setError(false);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // 1. Business details fetch karein using slug
      const { data: businessData, error: bizError } = await supabase
        .from('businesses')
        .select('*')
        .eq('slug', slug)
        .single();

      if (bizError || !businessData) {
        console.error('Business Fetch Error:', bizError);
        setError(true);
        setLoading(false);
        return;
      }

      setBusiness(businessData);

      // 2. Sirf is specific business ki feedbacks fetch karein
      const { data: feedbackData, error: fbError } = await supabase
        .from('feedbacks')
        .select('*')
        .eq('business_name', businessData.business_name)
        .order('created_at', { ascending: false });

      if (fbError) {
        console.error('Feedback Fetch Error:', fbError);
      } else {
        setFeedbacks(feedbackData || []);
      }
    } catch (err) {
      console.error('Exception:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Stats calculation for this specific business
  const totalCount = feedbacks.length;
  const avgRating = totalCount
    ? (feedbacks.reduce((acc, f) => acc + f.rating, 0) / totalCount).toFixed(1)
    : '0.0';

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <p className="text-slate-400 font-medium animate-pulse">
          Loading business feedbacks...
        </p>
      </main>
    );
  }

  if (error || !business) {
    return (
      <main className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center max-w-sm">
          <h2 className="text-xl font-bold text-red-400 mb-2">Business Not Found</h2>
          <p className="text-xs text-slate-400">
            No business matching slug <span className="text-amber-400 font-mono">"{slug}"</span> exists.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white">
                {business.business_name}
              </h1>
              <span className="text-[10px] bg-blue-900/60 text-blue-300 border border-blue-700 px-2.5 py-0.5 rounded-full font-semibold">
                {business.category}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Private Feedback Portal • Exclusive for Management
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl transition"
            >
              🔗 View Public Funnel
            </a>
            <button
              onClick={fetchBusinessAndFeedbacks}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition shadow"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <p className="text-xs font-semibold uppercase text-slate-400">Total Private Feedbacks</p>
            <p className="text-3xl font-extrabold text-blue-400 mt-2">{totalCount}</p>
          </div>

          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <p className="text-xs font-semibold uppercase text-slate-400">Average Rating</p>
            <p className="text-3xl font-extrabold text-amber-400 mt-2">
              {avgRating} <span className="text-lg">★</span>
            </p>
          </div>

          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <p className="text-xs font-semibold uppercase text-slate-400">Critical (1 Star)</p>
            <p className="text-3xl font-extrabold text-red-400 mt-2">
              {feedbacks.filter((f) => f.rating === 1).length}
            </p>
          </div>
        </div>

        {/* Feedback List */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-slate-200">Customer Issues & Feedback</h2>
            <span className="text-xs text-slate-400">{feedbacks.length} items found</span>
          </div>

          {feedbacks.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              🎉 Great job! No negative feedback submitted for {business.business_name} yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-700/60">
              {feedbacks.map((item, index) => (
                <div key={item.id || index} className="p-5 hover:bg-slate-700/30 transition">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex text-amber-400 text-xs">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star}>
                          {star <= item.rating ? '★' : '☆'}
                        </span>
                      ))}
                    </div>

                    <span className="text-[10px] text-slate-400">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString()
                        : 'Recent'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-700/50 leading-relaxed">
                    "{item.feedback_text}"
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}