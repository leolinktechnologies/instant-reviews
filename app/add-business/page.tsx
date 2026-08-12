'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const getSupabaseClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  return createClient(url, key);
};

export default function AddBusiness() {
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [slug, setSlug] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [successLink, setSuccessLink] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Auto-generate slug when Business Name changes
  const handleNameChange = (name: string) => {
    setBusinessName(name);
    const autoSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    setSlug(autoSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessLink('');

    const supabase = getSupabaseClient();
    if (!supabase) {
      setErrorMessage('Supabase environment variables missing!');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('businesses')
        .insert([
          {
            business_name: businessName,
            category,
            google_review_url: googleReviewUrl,
            slug,
          },
        ])
        .select();

      if (error) {
        console.error('Supabase Error:', error);
        setErrorMessage(error.message);
      } else if (data) {
        const generatedUrl = `${window.location.origin}/${slug}`;
        setSuccessLink(generatedUrl);
        // Reset form
        setBusinessName('');
        setCategory('');
        setGoogleReviewUrl('');
        setSlug('');
      }
    } catch (err: any) {
      console.error('Submission Error:', err);
      setErrorMessage(err?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-slate-800 rounded-2xl border border-slate-700 p-6 md:p-8 shadow-xl">
        
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
            🏪 Add New Business
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Create a custom review funnel link for a business in seconds.
          </p>
        </div>

        {/* Success Alert Banner */}
        {successLink && (
          <div className="mb-6 p-4 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs space-y-2">
            <p className="font-semibold text-emerald-400">🎉 Business Created Successfully!</p>
            <p>Live Review Link:</p>
            <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700">
              <input
                type="text"
                readOnly
                value={successLink}
                className="bg-transparent w-full text-slate-200 outline-none text-xs"
              />
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(successLink)}
                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold shrink-0"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs">
            ⚠️ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Business Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Royal Sweets & Bakers"
              value={businessName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Category
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Bakery, Restaurant, Dental Clinic"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Google Review URL
            </label>
            <input
              type="url"
              required
              placeholder="https://g.page/r/..."
              value={googleReviewUrl}
              onChange={(e) => setGoogleReviewUrl(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Custom Slug (URL Path)
            </label>
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
              <span className="text-xs text-slate-500 select-none">/</span>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                className="bg-transparent w-full text-xs text-slate-100 outline-none pl-1"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl text-xs transition shadow-lg disabled:opacity-50"
          >
            {loading ? 'Creating Business...' : 'Generate Review Funnel Link 🚀'}
          </button>

        </form>

      </div>
    </main>
  );
}