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
  business_slug?: string;
  rating: number;
  feedback_text: string;
  created_at?: string;
}

interface AnalyticsItem {
  id?: string | number;
  business_slug: string;
  event_type: 'generated' | 'copied_redirect';
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
  const [analytics, setAnalytics] = useState<AnalyticsItem[]>([]);
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

      // 2. Sirf is specific business ki private feedbacks fetch karein
      const { data: feedbackData, error: fbError } = await supabase
        .from('feedbacks')
        .select('*')
        .or(`business_slug.eq.${slug},business_name.eq.${businessData.business_name}`)
        .order('created_at', { ascending: false });

      if (fbError) {
        console.error('Feedback Fetch Error:', fbError);
      } else {
        setFeedbacks(feedbackData || []);
      }

      // 3. Specific business analytics fetch karein
      const { data: analyticsData, error: analyticsErr } = await supabase
        .from('review_analytics')
        .select('*')
        .eq('business_slug', slug)
        .order('created_at', { ascending: false });

      if (analyticsErr) {
        console.error('Analytics Fetch Error:', analyticsErr);
      } else {
        setAnalytics(analyticsData || []);
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

  const totalGenerated = analytics.filter(
    (a) => a.event_type === 'generated'
  ).length;

  const totalRedirects = analytics.filter(
    (a) => a.event_type === 'copied_redirect'
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-amber-400 font-medium animate-pulse flex items-center gap-2">
          <span>🔄 Loading business analytics & feedback...</span>
        </p>
      </main>
    );
  }

  if (error || !business) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 text-center max-w-sm shadow-xl">
          <h2 className="text-xl font-bold text-red-400 mb-2">Business Not Found</h2>
          <p className="text-xs text-slate-400">
            No business matching slug <span className="text-amber-400 font-mono">"{slug}"</span> exists.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/90 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-extrabold text-white">
                {business.business_name}
              </h1>
              <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-semibold">
                {business.category || 'Business'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Private Analytics & Management Portal
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition border border-slate-700"
            >
              🔗 Open Public Funnel
            </a>
            <button
              onClick={fetchBusinessAndFeedbacks}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition shadow-lg active:scale-95"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Metrics Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-lg">
            <p className="text-xs font-semibold uppercase text-slate-400">Private Feedbacks</p>
            <p className="text-3xl font-extrabold text-red-400 mt-2">{totalCount}</p>
            <p className="text-[10px] text-slate-500 mt-1">1-3 Star submissions</p>
          </div>

          <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-lg">
            <p className="text-xs font-semibold uppercase text-slate-400">Average Rating</p>
            <p className="text-3xl font-extrabold text-amber-400 mt-2">
              {avgRating} <span className="text-xl">★</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-1">From private feedbacks</p>
          </div>

          <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-lg">
            <p className="text-xs font-semibold uppercase text-slate-400">AI Generated</p>
            <p className="text-3xl font-extrabold text-blue-400 mt-2">{totalGenerated}</p>
            <p className="text-[10px] text-slate-500 mt-1">4-5 Star review triggers</p>
          </div>

          <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-lg">
            <p className="text-xs font-semibold uppercase text-slate-400">Google Redirects</p>
            <p className="text-3xl font-extrabold text-emerald-400 mt-2">{totalRedirects}</p>
            <p className="text-[10px] text-slate-500 mt-1">Review copy & opens</p>
          </div>

        </div>

        {/* Feedback List Section */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-slate-200">Customer Issues & Feedback</h2>
            <span className="text-xs text-slate-400">{feedbacks.length} items found</span>
          </div>

          {feedbacks.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              🎉 Great job! No negative feedback submitted for <span className="text-slate-300 font-medium">{business.business_name}</span> yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {feedbacks.map((item, index) => (
                <div key={item.id || index} className="p-5 hover:bg-slate-800/40 transition">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex text-amber-400 text-xs">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star}>
                          {star <= item.rating ? '★' : '☆'}
                        </span>
                      ))}
                    </div>

                    <span className="text-[10px] text-slate-500">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString()
                        : 'Recent'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 leading-relaxed">
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