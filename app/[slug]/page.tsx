import { createClient } from '@supabase/supabase-js';
import ReviewPageClient from './ReviewPageClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BusinessReviewPage({ params }: PageProps) {
  const { slug } = await params;

  // ⚡ Fast Server-Side Fetching
  const { data } = await supabase
    .from('businesses')
    .select('business_name, category, google_review_url, plan_expiry_date')
    .eq('slug', slug)
    .single();

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 max-w-md space-y-4 shadow-2xl">
          <div className="text-5xl">🔍</div>
          <h1 className="text-2xl font-bold text-red-400">Business Not Found</h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            The business page <span className="text-amber-400 font-mono">/{slug}</span> does not exist in our database.
          </p>
        </div>
      </main>
    );
  }

  // Check Expiry Date
  if (data.plan_expiry_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(data.plan_expiry_date);
    expiry.setHours(0, 0, 0, 0);

    if (expiry.getTime() < today.getTime()) {
      return (
        <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 max-w-md space-y-4 shadow-2xl">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-2xl font-bold text-amber-400">Service Temporarily Inactive</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              The feedback page for <span className="text-white font-semibold">{data.business_name}</span> is currently unavailable.
            </p>
          </div>
        </main>
      );
    }
  }

  return <ReviewPageClient slug={slug} businessData={data} />;
}