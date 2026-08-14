'use client';

import { useState, useEffect } from 'react';
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
  event_type: 'generated' | 'copied_redirect' | 'visited' | 'rated';
  rating?: number;
  created_at?: string;
}

export default function AdminDashboard() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState<string>('ALL');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      // Fetch Private Feedbacks (used ONLY for private feedback list & counts)
      const { data: feedbackData, error: feedbackErr } = await supabase
        .from('feedbacks')
        .select('*')
        .order('created_at', { ascending: false });

      if (feedbackErr) {
        console.error('Feedback Fetch Error:', feedbackErr);
      } else if (feedbackData) {
        setFeedbacks(feedbackData);
      }

      // Fetch Review Analytics (used for public ratings, generations, & redirects)
      const { data: analyticsData, error: analyticsErr } = await supabase
        .from('review_analytics')
        .select('*')
        .order('created_at', { ascending: false });

      if (analyticsErr) {
        console.error('Analytics Fetch Error:', analyticsErr);
      } else if (analyticsData) {
        setAnalytics(analyticsData);
      }
    } catch (err) {
      console.error('Exception fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique businesses (slug or name)
  const businessSet = new Set<string>();
  feedbacks.forEach((f) => {
    if (f.business_name) businessSet.add(f.business_name);
    if (f.business_slug) businessSet.add(f.business_slug);
  });
  analytics.forEach((a) => {
    if (a.business_slug) businessSet.add(a.business_slug);
  });
  const businesses = Array.from(businessSet);

  // Filter Data
  const filteredFeedbacks =
    selectedBusiness === 'ALL'
      ? feedbacks
      : feedbacks.filter(
          (f) =>
            f.business_name === selectedBusiness ||
            f.business_slug === selectedBusiness
        );

  const filteredAnalytics =
    selectedBusiness === 'ALL'
      ? analytics
      : analytics.filter((a) => a.business_slug === selectedBusiness);

  // Metrics Calculations
  const totalFeedbacks = filteredFeedbacks.length;

  // STRICT PUBLIC RATING CALCULATION
  // Derived ONLY from star ratings logged in review_analytics (1 to 5 stars)
  const publicRatings = filteredAnalytics
    .filter(
      (a) =>
        a.rating !== undefined &&
        a.rating !== null &&
        !isNaN(Number(a.rating)) &&
        Number(a.rating) >= 1 &&
        Number(a.rating) <= 5
    )
    .map((a) => Number(a.rating));

  const totalRatingSum = publicRatings.reduce((acc, curr) => acc + curr, 0);
  const totalRatingCount = publicRatings.length;

  const avgRating =
    totalRatingCount > 0
      ? (totalRatingSum / totalRatingCount).toFixed(1)
      : '5.0';

  const totalGenerated = filteredAnalytics.filter(
    (a) => a.event_type === 'generated'
  ).length;

  const totalRedirects = filteredAnalytics.filter(
    (a) => a.event_type === 'copied_redirect'
  ).length;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/90 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              📊 Admin Analytics & Feedback
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Track AI review generations, Google redirects, and public rating analytics.
            </p>
          </div>
          
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition shadow-lg active:scale-95"
          >
            🔄 Refresh Data
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="text-xs font-semibold text-slate-300 whitespace-nowrap">
              Filter Business:
            </label>
            <select
              value={selectedBusiness}
              onChange={(e) => setSelectedBusiness(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50 w-full sm:w-64"
            >
              <option value="ALL">All Businesses</option>
              {businesses.map((b, i) => (
                <option key={i} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-slate-400">
            Showing records for: <span className="text-amber-400 font-medium">{selectedBusiness}</span>
          </span>
        </div>

        {/* Metrics Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-lg">
            <p className="text-xs font-semibold uppercase text-slate-400">Private Feedbacks</p>
            <p className="text-3xl font-extrabold text-red-400 mt-2">{totalFeedbacks}</p>
            <p className="text-[10px] text-slate-500 mt-1">1-3 Star submissions</p>
          </div>

          <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-lg">
            <p className="text-xs font-semibold uppercase text-slate-400">Average Customer Rating</p>
            <p className="text-3xl font-extrabold text-amber-400 mt-2">
              {avgRating} <span className="text-xl">★</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Based on all public funnel star ratings ({totalRatingCount})</p>
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

        {/* Feedbacks List Section */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <span>💬 Private Feedback Submissions</span>
            </h2>
            <span className="text-xs text-slate-400">
              {filteredFeedbacks.length} items
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm animate-pulse">
              Loading dashboard data...
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              🎉 No private feedback submissions found!
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {filteredFeedbacks.map((item, index) => (
                <div key={item.id || index} className="p-5 hover:bg-slate-800/40 transition">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-amber-400 text-sm">
                        {item.business_name || item.business_slug}
                      </span>
                      <div className="flex text-amber-400 text-xs">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star}>
                            {star <= item.rating ? '★' : '☆'}
                          </span>
                        ))}
                      </div>
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