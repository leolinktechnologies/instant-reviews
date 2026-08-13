import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let businessName = 'this place';
  let category = 'Business';

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.businessName) businessName = body.businessName;
    if (body?.category) category = body.category;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reviews: [`❌ GEMINI_API_KEY missing in Vercel!`]
      });
    }

    const prompt = `Generate 3 completely unique, short 1-line Google reviews for a ${category} named "${businessName}".
Rules:
- Under 15 words per review.
- Sound like real everyday customers (casual, enthusiastic, simple).
- Include 1 relevant emoji per review.
- Return strictly a valid JSON array of 3 strings, e.g.: ["Review 1...", "Review 2...", "Review 3..."]
- Do NOT include markdown codeblocks or extra conversational text.`;

    // Candidate models to try in order
    const candidateModels = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash-latest'
    ];

    let lastErrorMessage = '';
    let rawText = '';

    // Loop through candidate models until one succeeds
    for (const model of candidateModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          }
        );

        const data = await response.json();

        if (response.ok) {
          rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (rawText) break; // Success! Exit loop
        } else {
          lastErrorMessage = data?.error?.message || `HTTP ${response.status} on ${model}`;
        }
      } catch (err: any) {
        lastErrorMessage = err?.message || 'Network fetch failed';
      }
    }

    if (!rawText) {
      return NextResponse.json({
        reviews: [`❌ Gemini API Error: ${lastErrorMessage}`]
      });
    }

    const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const reviews = JSON.parse(cleanedText);

    return NextResponse.json({ reviews });

  } catch (error: any) {
    return NextResponse.json({
      reviews: [`❌ System Error: ${error?.message || 'Unknown Error'}`]
    });
  }
}