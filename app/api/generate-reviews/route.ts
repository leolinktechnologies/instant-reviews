import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { businessName, category } = await req.json();

    // 1. Check API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reviews: [
          "❌ ERROR: GEMINI_API_KEY missing in Vercel Environment Variables!"
        ]
      });
    }

    const prompt = `Generate 3 completely unique, short 1-line Google reviews for a ${category || 'business'} named "${businessName || 'Business'}". Return ONLY a valid JSON array of 3 strings like ["Review 1", "Review 2", "Review 3"]. Do not include markdown codeblocks.`;

    // 2. Fetch Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
      }
    );

    const data = await response.json();

    // 3. Handle Gemini HTTP Error Response
    if (!response.ok) {
      const errMsg = data?.error?.message || `HTTP ${response.status} Error`;
      return NextResponse.json({
        reviews: [
          `❌ Gemini API Reject Error: ${errMsg}`
        ]
      });
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return NextResponse.json({
        reviews: ["❌ Error: Gemini returned empty text."]
      });
    }

    // 4. Parse JSON Cleanly
    const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const reviews = JSON.parse(cleanedText);

    return NextResponse.json({ reviews });

  } catch (error: any) {
    return NextResponse.json({
      reviews: [
        `❌ Server Error: ${error?.message || 'Parsing/Network error'}`
      ]
    });
  }
}