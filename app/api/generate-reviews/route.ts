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

    // 1. Automatically fetch available models for your specific API key
    const listModelsRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { cache: 'no-store' }
    );
    const listModelsData = await listModelsRes.json();

    if (!listModelsRes.ok) {
      const errMsg = listModelsData?.error?.message || 'Failed to list models';
      return NextResponse.json({ reviews: [`❌ API Key Error: ${errMsg}`] });
    }

    // Find the first available model that supports generateContent
    const validModel = listModelsData?.models?.find((m: any) =>
      m.supportedGenerationMethods?.includes('generateContent')
    );

    if (!validModel?.name) {
      return NextResponse.json({
        reviews: [`❌ No valid generateContent model found for this key.`]
      });
    }

    // Extract exact model name (e.g., 'models/gemini-...')
    const targetModel = validModel.name;

    const prompt = `Generate 3 completely unique, short 1-line Google reviews for a ${category} named "${businessName}".
Rules:
- Under 15 words per review.
- Sound like real everyday customers (casual, enthusiastic, simple).
- Include 1 relevant emoji per review.
- Return strictly a valid JSON array of 3 strings, e.g.: ["Review 1...", "Review 2...", "Review 3..."]
- Do NOT include markdown codeblocks or extra conversational text.`;

    // 2. Call the dynamically discovered model
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${targetModel}:generateContent?key=${apiKey}`,
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

    if (!response.ok) {
      const errMsg = data?.error?.message || `HTTP ${response.status} Error`;
      return NextResponse.json({ reviews: [`❌ API Error: ${errMsg}`] });
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return NextResponse.json({ reviews: [`❌ Empty response from Gemini`] });
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