import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("📥 Received Feedback Payload:", body);

    const { businessName, rating, feedbackText } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("❌ ENV Error: Supabase keys missing on server!");
      return NextResponse.json(
        { error: 'Supabase environment variables missing on server' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Supabase 'feedbacks' table me data insert
    const { data, error } = await supabase
      .from('feedbacks')
      .insert([
        {
          business_name: businessName || 'Unknown Business',
          rating: Number(rating),
          feedback_text: feedbackText,
        },
      ])
      .select();

    if (error) {
      console.error("❌ Supabase Insert Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("✅ Successfully Saved in Supabase Table:", data);
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error("❌ Server Exception:", error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save feedback' },
      { status: 500 }
    );
  }
}