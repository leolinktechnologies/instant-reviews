'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

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
  const [copied, setCopied] = useState(false);
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

  const handleSlugChange = (rawSlug: string) => {
    const sanitizedSlug = rawSlug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    setSlug(sanitizedSlug);
  };

  const handleCopyLink = () => {
    if (!successLink) return;
    navigator.clipboard.writeText(successLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            business_name: businessName.trim(),
            category: category.trim(),
            google_review_url: googleReviewUrl.trim(),
            slug: slug.trim(),
          },
        ])
        .select();

      if (error) {
        console.error('Supabase Error:', error);
        setErrorMessage(error.message);
      } else if (data) {
        const generatedUrl = `${window.location.origin}/${slug.trim()}`;
        setSuccessLink(generatedUrl);
        
        // Reset form
        setBusinessName('');
        setCategory('');
        setGoogleReviewUrl('');
        setSlug('');
      }
    } catch (err: unknown) {
      console.error('Submission Error:', err);
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-slate-900 rounded-2xl border border-slate-800 p-6 md:p-8 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
            🏪 Add New Business
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Create a custom review funnel link for a business in seconds.
          </p>
        </div>

        {/* Success Alert Banner */}
        {successLink && (
          <div className="p-4 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs space-y-3">
            <p className="font-semibold text-emerald-400">🎉 Business Created Successfully!</p>
            <p className="text-[11px] text-emerald-300">Live Review Link:</p>
            <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
              <input
                type="text"
                readOnly
                value={successLink}
                className="bg-transparent w-full text-slate-200 outline-none text-xs"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold shrink-0 transition"
              >
                {copied ? 'Copied! ✨' : 'Copy'}
              </button>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <a
                href={successLink}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] underline text-emerald-400 hover:text-emerald-300 font-medium"
              >
                ↗ Open Funnel Page
              </a>
              <span className="text-slate-600">•</span>
              <Link
                href="/admin"
                className="text-[11px] underline text-slate-400 hover:text-slate-300 font-medium"
              >
                Go to Admin Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-xl text-red-200 text-xs">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Form */}
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Custom Slug (URL Path)
            </label>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-amber-500/50">
              <span className="text-xs text-slate-500 select-none">/</span>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                className="bg-transparent w-full text-xs text-slate-100 outline-none pl-1"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 rounded-xl text-xs transition shadow-lg disabled:opacity-50 active:scale-95"
          >
            {loading ? 'Creating Business...' : 'Generate Review Funnel Link 🚀'}
          </button>

        </form>

        <div className="pt-2 text-center border-t border-slate-800">
          <Link href="/admin" className="text-xs text-slate-400 hover:text-amber-400 transition">
            ← Back to Admin Dashboard
          </Link>
        </div>

      </div>
    </main>
  );
}