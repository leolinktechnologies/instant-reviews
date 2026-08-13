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

    const prompt = `Write 3 realistic, enthusiastic, positive Google reviews for "${businessName}" (a ${category}).

CRITICAL INSTRUCTIONS:
- Length: Each review MUST be between 10 to 22 words long (do NOT make them 2 or 3 words).
- Diversity: Make all 3 reviews sound completely different from each other:
  1. Review 1: Focus on friendly customer service or team attitude.
  2. Review 2: Focus on top-notch quality, atmosphere, or outcome.
  3. Review 3: Focus on value, overall experience, and recommending to friends.
- Tone: Natural, enthusiastic, written by real everyday customers.
- Emoji: Add 1 fitting emoji at the end of each review.
- Output Format: Return ONLY a valid JSON array of 3 strings. Example:
["The staff here goes above and beyond every single time. Super friendly experience! 😊", "Top tier quality and amazing atmosphere. Definitely coming back very soon! ⭐", "Honest service and great prices. Highly recommend them to anyone in the area! 👌"]`;

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
        temperature: 0.9, // Higher temperature for high variety & creativity
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