import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let businessName = 'this place';
  let category = 'Business';

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.businessName) businessName = body.businessName;
    if (body?.category) category = body.category;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reviews: [`❌ GROQ_API_KEY missing in Vercel!`]
      });
    }

    const prompt = `Generate 3 completely unique, short 1-line Google reviews for a ${category} named "${businessName}".
Rules:
- Under 15 words per review.
- Sound like real everyday customers (casual, enthusiastic, simple).
- Include 1 relevant emoji per review.
- Return strictly a valid JSON array of 3 strings, e.g.: ["Review 1...", "Review 2...", "Review 3..."]
- Do NOT include markdown codeblocks or extra conversational text.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      cache: 'no-store',
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || `HTTP ${response.status} Error`;
      return NextResponse.json({
        reviews: [`❌ Groq API Error: ${errMsg}`]
      });
    }

    const rawText = data?.choices?.[0]?.message?.content;
    if (!rawText) {
      return NextResponse.json({ reviews: [`❌ Empty response from Groq`] });
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