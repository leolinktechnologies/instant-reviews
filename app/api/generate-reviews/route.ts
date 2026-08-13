import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let businessName = 'this place';
  let category = 'Business';

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.businessName) businessName = body.businessName;
    if (body?.category) category = bodyCategory;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reviews: [`❌ GEMINI_API_KEY missing in Vercel!`]
      });
    }

    // Initialize SDK with your AQ key
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Generate 3 completely unique, short 1-line Google reviews for a ${category} named "${businessName}".
Rules:
- Under 15 words per review.
- Sound like real everyday customers (casual, enthusiastic, simple).
- Include 1 relevant emoji per review.
- Return strictly a valid JSON array of 3 strings, e.g.: ["Review 1...", "Review 2...", "Review 3..."]
- Do NOT include markdown codeblocks or extra conversational text.`;

    // Using active, stable gemini-2.0-flash model via SDK
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const rawText = response.text;

    if (!rawText) {
      return NextResponse.json({ reviews: [`❌ Empty response from Gemini`] });
    }

    const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const reviews = JSON.parse(cleanedText);

    return NextResponse.json({ reviews });

  } catch (error: any) {
    return NextResponse.json({
      reviews: [`❌ SDK Error: ${error?.message || 'Unknown Error'}`]
    });
  }
}