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
  rating: number;
  feedback_text: string;
  created_at?: string;
}

export default function AdminDashboard() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBusiness, setSelectedBusiness] = useState<string>('ALL');

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    setLoading(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch Error:', error);
      } else if (data) {
        setFeedbacks(data);
      }
    } catch (err) {
      console.error('Exception fetching feedbacks:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get unique business names for filtering
  const businesses = Array.from(
    new Set(feedbacks.map((f) => f.business_name).filter(Boolean))
  );

  // Filter feedbacks based on dropdown selection
  const filteredFeedbacks =
    selectedBusiness === 'ALL'
      ? feedbacks
      : feedbacks.filter((f) => f.business_name === selectedBusiness);

  // Stats calculation
  const totalCount = filteredFeedbacks.length;
  const avgRating = totalCount
    ? (
        filteredFeedbacks.reduce((acc, f) => acc + f.rating, 0) / totalCount
      ).toFixed(1)
    : '0.0';

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              📊 Admin Feedback Dashboard
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Review and manage private feedback submitted by unhappy customers.
            </p>
          </div>
          
          <button
            onClick={fetchFeedbacks}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition shadow"
          >
            🔄 Refresh Data
          </button>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <p className="text-xs font-semibold uppercase text-slate-400">Total Feedbacks</p>
            <p className="text-3xl font-extrabold text-blue-400 mt-2">{totalCount}</p>
          </div>

          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <p className="text-xs font-semibold uppercase text-slate-400">Average Rating</p>
            <p className="text-3xl font-extrabold text-amber-400 mt-2">
              {avgRating} <span className="text-lg">★</span>
            </p>
          </div>

          <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
            <p className="text-xs font-semibold uppercase text-slate-400">Critical 1-Stars</p>
            <p className="text-3xl font-extrabold text-red-400 mt-2">
              {filteredFeedbacks.filter((f) => f.rating === 1).length}
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        {businesses.length > 0 && (
          <div className="flex items-center gap-3 bg-slate-800 p-4 rounded-xl border border-slate-700">
            <label className="text-xs font-medium text-slate-300">Filter by Business:</label>
            <select
              value={selectedBusiness}
              onChange={(e) => setSelectedBusiness(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Businesses ({feedbacks.length})</option>
              {businesses.map((b, i) => (
                <option key={i} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Feedbacks List */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-lg">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-slate-200">Customer Complaints & Suggestions</h2>
            <span className="text-xs text-slate-400">
              Showing {filteredFeedbacks.length} items
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm animate-pulse">
              Loading customer feedback...
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              🎉 No private feedback submissions found!
            </div>
          ) : (
            <div className="divide-y divide-slate-700/60">
              {filteredFeedbacks.map((item, index) => (
                <div key={item.id || index} className="p-5 hover:bg-slate-700/30 transition">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-blue-400 text-sm">
                        {item.business_name}
                      </span>
                      <div className="flex text-amber-400 text-xs">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star}>
                            {star <= item.rating ? '★' : '☆'}
                          </span>
                        ))}
                      </div>
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