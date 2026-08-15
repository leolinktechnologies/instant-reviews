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
  event_type: 'generated' | 'copied_redirect' | 'visited' | 'rated';
  rating?: number;
  created_at?: string;
}

interface IssueCategory {
  name: string;
  terms: string[];
}

// Subscription Status Helper
function getPlanStatus(expiryDateStr?: string) {
  if (!expiryDateStr) {
    return {
      status: 'UNKNOWN',
      isExpired: false,
      isExpiringSoon: false,
      daysLeft: 0,
      badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
      label: 'Plan status unavailable',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    const formattedDate = expiry.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return {
      status: 'EXPIRED',
      isExpired: true,
      isExpiringSoon: false,
      daysLeft,
      badgeClass: 'bg-red-500/10 text-red-400 border-red-500/30',
      label: `Plan expired on ${formattedDate}`,
    };
  }

  if (daysLeft <= 15) {
    return {
      status: 'EXPIRING_SOON',
      isExpired: false,
      isExpiringSoon: true,
      daysLeft,
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse',
      label: `Expires in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`,
    };
  }

  return {
    status: 'ACTIVE',
    isExpired: false,
    isExpiringSoon: false,
    daysLeft,
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    label: `Active - ${daysLeft} days remaining`,
  };
}

// Industry Category Issue Mappings
const CATEGORY_ISSUES_MAP: Record<string, IssueCategory[]> = {
  restaurant: [
    { name: 'Food Quality', terms: ['food', 'taste', 'raw', 'cold', 'flavour', 'quality', 'dish'] },
    { name: 'Service Speed', terms: ['slow', 'delay', 'wait', 'time', 'late', 'order'] },
    { name: 'Cleanliness', terms: ['dirty', 'clean', 'hygiene', 'table', 'fly', 'washroom'] },
    { name: 'Staff Behaviour', terms: ['staff', 'waiter', 'behavior', 'rude', 'attitude', 'service'] },
    { name: 'Ambience', terms: ['noise', 'music', 'ac', 'heating', 'crowded', 'seat', 'ambience'] },
  ],
  dental: [
    { name: 'Waiting Time', terms: ['wait', 'delay', 'time', 'late', 'queue', 'waiting'] },
    { name: 'Treatment Explanation', terms: ['explain', 'treatment', 'doctor', 'clear', 'info', 'understand'] },
    { name: 'Staff Behaviour', terms: ['staff', 'behavior', 'rude', 'reception', 'nurse', 'attitude'] },
    { name: 'Appointment Scheduling', terms: ['appointment', 'booking', 'schedule', 'slot', 'reschedule'] },
    { name: 'Pricing Concern', terms: ['price', 'cost', 'expensive', 'charge', 'bill', 'fee'] },
  ],
  salon: [
    { name: 'Service Quality', terms: ['hair', 'cut', 'nails', 'facial', 'patchy', 'quality', 'style'] },
    { name: 'Waiting Time', terms: ['wait', 'delay', 'time', 'queue', 'sitting'] },
    { name: 'Staff Experience', terms: ['stylist', 'staff', 'experience', 'rough', 'behavior', 'attitude'] },
    { name: 'Pricing', terms: ['price', 'cost', 'expensive', 'charge', 'rate', 'package'] },
    { name: 'Appointment Availability', terms: ['appointment', 'slot', 'booking', 'busy', 'schedule'] },
  ],
  retail: [
    { name: 'Product Quality', terms: ['product', 'quality', 'damaged', 'defect', 'item', 'size'] },
    { name: 'Checkout / Billing Speed', terms: ['billing', 'checkout', 'counter', 'queue', 'line', 'slow'] },
    { name: 'Staff Behaviour', terms: ['staff', 'salesperson', 'rude', 'help', 'attitude', 'behavior'] },
    { name: 'Stock Availability', terms: ['stock', 'available', 'out of stock', 'item', 'size'] },
    { name: 'Return & Exchange', terms: ['return', 'exchange', 'refund', 'policy', 'bill'] },
  ],
  default: [
    { name: 'Service Quality', terms: ['quality', 'service', 'poor', 'bad', 'disappointed', 'work'] },
    { name: 'Response / Wait Time', terms: ['wait', 'delay', 'time', 'slow', 'late', 'response'] },
    { name: 'Staff Behaviour', terms: ['staff', 'behavior', 'rude', 'attitude', 'personnel', 'team'] },
    { name: 'Pricing & Value', terms: ['price', 'cost', 'expensive', 'charge', 'bill', 'rate', 'value'] },
    { name: 'Overall Experience', terms: ['experience', 'overall', 'issue', 'problem', 'process'] },
  ],
};

const getCategoryIssues = (categoryString?: string): IssueCategory[] => {
  if (!categoryString) return CATEGORY_ISSUES_MAP.default;

  const cat = categoryString.toLowerCase();

  if (cat.includes('food') || cat.includes('restaurant') || cat.includes('cafe') || cat.includes('dining') || cat.includes('bakery')) {
    return CATEGORY_ISSUES_MAP.restaurant;
  }
  if (cat.includes('dental') || cat.includes('clinic') || cat.includes('doctor') || cat.includes('health') || cat.includes('hospital')) {
    return CATEGORY_ISSUES_MAP.dental;
  }
  if (cat.includes('salon') || cat.includes('spa') || cat.includes('beauty') || cat.includes('parlour') || cat.includes('hair')) {
    return CATEGORY_ISSUES_MAP.salon;
  }
  if (cat.includes('retail') || cat.includes('shop') || cat.includes('store') || cat.includes('fashion') || cat.includes('mart')) {
    return CATEGORY_ISSUES_MAP.retail;
  }

  return CATEGORY_ISSUES_MAP.default;
};

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

  // Auth States
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Check login state on mount
  useEffect(() => {
    if (slug) {
      const authKey = `admin_auth_${slug}`;
      const savedAuth = localStorage.getItem(authKey);
      if (savedAuth === 'true') {
        setIsAuthenticated(true);
      }
    }
  }, [slug]);

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

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!business) return;

    const validUsername = business.admin_username || slug;
    const validPassword = business.admin_password || 'admin123';

    if (usernameInput.trim() === validUsername && passwordInput.trim() === validPassword) {
      setIsAuthenticated(true);
      localStorage.setItem(`admin_auth_${slug}`, 'true');
    } else {
      setLoginError('Invalid Username or Password');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem(`admin_auth_${slug}`);
    setUsernameInput('');
    setPasswordInput('');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-amber-400 font-medium text-base bg-slate-900/80 px-6 py-4 rounded-2xl border border-slate-800 shadow-2xl">
          <svg className="animate-spin h-5 w-5 text-amber-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Loading Business Analytics...</span>
        </div>
      </main>
    );
  }

  if (error || !business) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 text-center max-w-md shadow-2xl space-y-3">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-red-400">Business Not Found</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            No business matching slug <span className="text-amber-400 font-mono">"{slug}"</span> exists.
          </p>
        </div>
      </main>
    );
  }

  // 🔒 LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 selection:bg-amber-500 selection:text-slate-950">
        <div className="bg-slate-900/90 border border-slate-800 p-8 rounded-3xl w-full max-w-md shadow-2xl space-y-6 backdrop-blur-xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-2xl flex items-center justify-center mx-auto">
              🔒
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Admin Portal Access</h1>
            <p className="text-xs text-slate-400">
              Enter login credentials for <span className="text-amber-400 font-semibold">{business.business_name}</span>
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl text-center font-medium">
                ⚠️ {loginError}
              </div>
            )}

            <div className="space-y-1 text-left">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Username</label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Enter Username"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div className="space-y-1 text-left">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter Password"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-slate-950 font-bold py-3 rounded-xl shadow-lg transition text-sm mt-2"
            >
              Login to Dashboard →
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Plan Status Details
  const planInfo = getPlanStatus(business?.plan_expiry_date);

  // 🔓 AUTHENTICATED DASHBOARD METRICS
  const totalFeedbacks = feedbacks.length;

  const customerRatings = analytics
    .filter((a) => a.rating !== undefined && a.rating !== null && !isNaN(Number(a.rating)) && Number(a.rating) >= 1 && Number(a.rating) <= 5)
    .map((a) => Number(a.rating));

  const totalRatingSum = customerRatings.reduce((sum, curr) => sum + curr, 0);
  const totalRatingCount = customerRatings.length;

  const avgRating = totalRatingCount > 0
    ? (totalRatingSum / totalRatingCount).toFixed(1)
    : '5.0';

  const totalGenerated = analytics.filter((a) => a.event_type === 'generated').length;
  const totalRedirects = analytics.filter((a) => a.event_type === 'copied_redirect').length;
  
  // Real DB Analytics Event Counts
  const dbVisitedCount = analytics.filter((a) => a.event_type === 'visited').length;
  const dbRatedCount = analytics.filter((a) => a.event_type === 'rated').length;

  // Actual Dynamic Visitor Calculation
  const totalVisitors = dbVisitedCount > 0 
    ? dbVisitedCount 
    : Math.max(analytics.length, totalFeedbacks);

  const ratingsSelected = dbRatedCount > 0 ? dbRatedCount : totalRatingCount;
  const reviewsGenerated = totalGenerated;
  const reviewsCopied = totalRedirects;
  const googleAttempts = totalRedirects;
  const privateFeedbackCount = totalFeedbacks;

  const targetCategoryIssues = getCategoryIssues(business?.category);

  // Common Issues Calculations
  const dynamicCommonIssues = targetCategoryIssues.map((issue) => {
    const count = feedbacks.filter((f) =>
      issue.terms.some((term) => f.feedback_text?.toLowerCase().includes(term))
    ).length;
    return { name: issue.name, count };
  });

  // Filter themes that actually have mentions (>0)
  const activeFeedbackThemes = dynamicCommonIssues.filter((item) => item.count > 0);

  const topIssue = [...dynamicCommonIssues].sort((a, b) => b.count - a.count)[0];

  // Dynamic AI logic generation based on mentions
  let dynamicAiAnalysis = '';
  let dynamicSuggestedAction = '';

  if (feedbacks.length === 0) {
    dynamicAiAnalysis = 'No customer concerns or negative feedback have been recorded recently. Overall customer experience is positive.';
    dynamicSuggestedAction = 'Encourage happy customers to share their feedback on Google to build more positive reviews.';
  } else if (topIssue && topIssue.count > 1) {
    dynamicAiAnalysis = `Multiple customers have mentioned concerns regarding ${topIssue.name}. Paying attention to this area will help improve customer satisfaction.`;
    dynamicSuggestedAction = `Review customer interactions related to ${topIssue.name.toLowerCase()} and consider minor operational adjustments to avoid further complaints.`;
  } else if (topIssue && topIssue.count === 1) {
    dynamicAiAnalysis = `One customer mentioned concerns regarding ${topIssue.name}. Most other areas show minimal friction.`;
    dynamicSuggestedAction = `Some customers mentioned ${topIssue.name.toLowerCase()}. Consider improving communication and service handling to enhance their experience.`;
  } else {
    dynamicAiAnalysis = 'Feedback is generally stable. Some minor notes were shared without a clear recurring pattern.';
    dynamicSuggestedAction = 'Keep maintaining service quality and monitor future feedback for emerging patterns.';
  }

  // Sentiment indicator logic
  const numericAvg = parseFloat(avgRating);
  let sentimentBadge = { label: '🟢 Mostly Positive', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };

  if (totalFeedbacks > 3 || numericAvg < 4.0) {
    sentimentBadge = { label: '🟡 Needs Attention', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
  } else if (numericAvg < 3.0) {
    sentimentBadge = { label: '🔴 Urgent Care Required', color: 'text-red-400 bg-red-500/10 border-red-500/20' };
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 selection:bg-amber-500 selection:text-slate-950">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                <span>Your Google Reputation Dashboard</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Track reviews, feedback & customer experience in one place.
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl transition flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>🔒</span> Logout
            </button>
          </div>

          {/* Business Info Banner */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/80 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-slate-800/80 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-lg">
                {business.business_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-lg font-bold text-white capitalize">{business.business_name}</h2>
                  
                  {/* Plan Status Badge */}
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${planInfo.badgeClass}`}>
                    <span className="w-2 h-2 rounded-full bg-current"></span>
                    {planInfo.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Public Funnel: <span className="text-slate-300 font-mono">/{slug}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <a
                href={`/${slug}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-initial text-center px-4 py-2 bg-slate-800 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold rounded-xl transition border border-slate-700/60"
              >
                🔗 Open Public Funnel
              </a>
              <button
                onClick={fetchBusinessAndFeedbacks}
                className="flex-1 sm:flex-initial text-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition shadow-lg active:scale-95"
              >
                🔄 Sync Latest Data
              </button>
            </div>
          </div>
        </div>

        {/* Plan Expiry / Renewal Alert Banner */}
        {(planInfo.isExpiringSoon || planInfo.isExpired) && (
          <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            planInfo.isExpired 
              ? 'bg-red-500/10 border-red-500/30 text-red-300' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{planInfo.isExpired ? '🚨' : '⚠️'}</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">
                  {planInfo.isExpired ? 'Subscription Expired' : 'Plan Expiring Soon'}
                </p>
                <p className="text-xs opacity-90 mt-0.5">
                  Your plan is valid until{' '}
                  <span className="font-semibold underline">
                    {business.plan_expiry_date 
                      ? new Date(business.plan_expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      : 'N/A'}
                  </span>
                  . Renew your plan to continue using the service without interruption.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 self-stretch sm:self-auto mt-2 sm:mt-0">
              <a
                href={`https://wa.me/918279687131?text=${encodeURIComponent(
                  `Hello Admin, I would like to renew the subscription plan for "${business?.business_name || slug || 'my business'}". Please guide me with the next steps.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-md active:scale-95"
              >
                <span>💬</span> WhatsApp
              </a>

              <a
                href="tel:+918279687131"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700 font-bold text-xs rounded-xl transition shadow-md active:scale-95"
              >
                <span>📞</span> Call Us
              </a>
            </div>
          </div>
        )}

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-lg hover:border-slate-700/80 transition space-y-1">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">PRIVATE FEEDBACK RECEIVED</span>
              <span className="text-red-400 text-base">📩</span>
            </div>
            <p className="text-3xl font-extrabold text-red-400">{totalFeedbacks}</p>
            <p className="text-[11px] text-slate-500">Customer concerns shared privately</p>
          </div>

          <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-lg hover:border-slate-700/80 transition space-y-1">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">AVERAGE CUSTOMER RATING</span>
              <span className="text-amber-400 text-base">⭐</span>
            </div>
            <p className="text-3xl font-extrabold text-amber-400">
              {avgRating} <span className="text-lg">★</span>
            </p>
            <p className="text-[11px] text-slate-500">Based on all customer ratings collected</p>
          </div>

          <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-lg hover:border-slate-700/80 transition space-y-1">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">AI Review Suggestions</span>
              <span className="text-blue-400 text-base">✨</span>
            </div>
            <p className="text-3xl font-extrabold text-blue-400">{totalGenerated}</p>
            <p className="text-[11px] text-slate-500">AI drafts created for 4-5★</p>
          </div>

          <div className="bg-slate-900/90 p-5 rounded-2xl border border-slate-800 shadow-lg hover:border-slate-700/80 transition space-y-1">
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Google Review Attempts</span>
              <span className="text-emerald-400 text-base">🚀</span>
            </div>
            <p className="text-3xl font-extrabold text-emerald-400">{totalRedirects}</p>
            <p className="text-[11px] text-slate-500">Copy & Google redirect clicks</p>
          </div>

        </div>

        {/* Last 30 Days Activity Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              Last 30 Days Activity
            </h2>
            <span className="text-xs text-slate-500 font-medium">Real-time metrics</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 shadow-md space-y-1">
              <div className="text-slate-400 text-base mb-1">👁️</div>
              <p className="text-2xl font-bold text-white">{totalVisitors}</p>
              <p className="text-[11px] font-medium text-slate-300">Total Visitors</p>
              <p className="text-[10px] text-slate-500">Funnel page views</p>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 shadow-md space-y-1">
              <div className="text-amber-400 text-base mb-1">🎯</div>
              <p className="text-2xl font-bold text-white">{ratingsSelected}</p>
              <p className="text-[11px] font-medium text-slate-300">Ratings Selected</p>
              <p className="text-[10px] text-slate-500">Star selections</p>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 shadow-md space-y-1">
              <div className="text-blue-400 text-base mb-1">🤖</div>
              <p className="text-2xl font-bold text-white">{reviewsGenerated}</p>
              <p className="text-[11px] font-medium text-slate-300">Reviews Generated</p>
              <p className="text-[10px] text-slate-500">AI option triggers</p>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 shadow-md space-y-1">
              <div className="text-purple-400 text-base mb-1">📋</div>
              <p className="text-2xl font-bold text-white">{reviewsCopied}</p>
              <p className="text-[11px] font-medium text-slate-300">Reviews Copied</p>
              <p className="text-[10px] text-slate-500">Text copied to buffer</p>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 shadow-md space-y-1">
              <div className="text-emerald-400 text-base mb-1">↗️</div>
              <p className="text-2xl font-bold text-white">{googleAttempts}</p>
              <p className="text-[11px] font-medium text-slate-300">Google Attempts</p>
              <p className="text-[10px] text-slate-500">Redirects triggered</p>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800/80 shadow-md space-y-1">
              <div className="text-red-400 text-base mb-1">💬</div>
              <p className="text-2xl font-bold text-white">{privateFeedbackCount}</p>
              <p className="text-[11px] font-medium text-slate-300">Private Feedback</p>
              <p className="text-[10px] text-slate-500">Direct complaints</p>
            </div>
          </div>
        </div>

        {/* Needed Action Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>⚡ Needed Action</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Column: Common Issues */}
            <div className="bg-slate-900/90 p-6 rounded-2xl border border-slate-800/90 shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Common Issues</h3>
                </div>
                <span className="text-xs text-slate-500 font-mono">Mentions</span>
              </div>

              <div className="space-y-2.5">
                {dynamicCommonIssues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 hover:border-slate-700/80 transition"
                  >
                    <span className="text-xs font-medium text-slate-300 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80"></span>
                      {issue.name}
                    </span>
                    <span className="text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-lg">
                      {issue.count} {issue.count === 1 ? 'mention' : 'mentions'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: AI CUSTOMER INSIGHTS */}
            <div className="bg-slate-900/90 p-6 rounded-2xl border border-slate-800/90 shadow-xl space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                {/* 1. Header with updated title */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <span>✨ AI CUSTOMER INSIGHTS</span>
                  </h3>
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md font-semibold">
                    Category AI
                  </span>
                </div>

                {/* 2. Customer Sentiment Indicator */}
                <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer Sentiment</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${sentimentBadge.color}`}>
                    {sentimentBadge.label}
                  </span>
                </div>

                {/* 3. Dynamic Analysis & Key Feedback Themes */}
                <div className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {dynamicAiAnalysis}
                  </p>

                  {/* Confidence Level Badge / Text */}
                  <p className="text-[10px] text-slate-500 font-medium italic">
                    {feedbacks.length < 5 ? '• Based on limited customer feedback' : '• Based on recent customer feedback trends'}
                  </p>

                  {/* Key Feedback Themes */}
                  {activeFeedbackThemes.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Key Feedback Themes:</p>
                      <div className="flex flex-wrap gap-2">
                        {activeFeedbackThemes.map((theme, i) => (
                          <span key={i} className="text-[11px] bg-slate-900 text-slate-300 border border-slate-800 px-2.5 py-1 rounded-md">
                            {theme.name}: <span className="text-amber-400 font-bold">{theme.count}</span> {theme.count === 1 ? 'mention' : 'mentions'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. AI Recommendations (Suggested Action) */}
              <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <span>💡 AI Recommendations</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {dynamicSuggestedAction}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Customer Feedback Stream Section */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800/90 overflow-hidden shadow-xl space-y-0">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span>💬 Customer Feedback Stream</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">{feedbacks.length} items</span>
          </div>

          {feedbacks.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="text-3xl text-slate-600">📊</div>
              <p className="text-sm font-medium text-slate-400">
                Customer feedback insights will appear here.
              </p>
              <p className="text-xs text-slate-600">
                When customers submit private feedback through the 1-3 star funnel, entries will populate in real time.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {feedbacks.map((item, index) => (
                <div key={item.id || index} className="p-5 hover:bg-slate-800/40 transition space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex text-amber-400 text-xs gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star}>
                          {star <= item.rating ? '★' : '☆'}
                        </span>
                      ))}
                    </div>

                    <span className="text-[10px] text-slate-500 font-mono">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleString()
                        : 'Recent'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 leading-relaxed">
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