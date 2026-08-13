import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // 1. Declare variables OUTSIDE try block so catch block can see them
  let businessName = '';
  let category = '';

  try {
    const body = await req.json().catch(() => ({}));
    businessName = body.businessName || '';
    category = body.category || '';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ GEMINI_API_KEY missing");
      return NextResponse.json({
        reviews: [
          `Great experience at ${businessName || 'this place'}! ⭐`,
          `Very polite staff and quality service! 👍`,
          `Definitely visiting again soon! 😊`
        ]
      });
    }

    const prompt = `Generate 3 completely unique, short 1-line Google reviews for a ${category || 'Business'} named "${businessName || 'Business'}".
Rules:
- Under 15 words per review.
- Sound like real everyday customers (casual, enthusiastic, simple).
- Include 1 relevant emoji per review.
- Return strictly a valid JSON array of 3 strings, e.g.: ["Review 1...", "Review 2...", "Review 3..."]
- Do NOT include markdown codeblocks or extra conversational text.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error("Gemini HTTP Error:", errData);
      throw new Error(errData?.error?.message || "Gemini API failed");
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) throw new Error("No response from Gemini");

    const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const reviews = JSON.parse(cleanedText);

    return NextResponse.json({ reviews });

  } catch (error: any) {
    console.error("❌ Route Catch Error:", error?.message || error);
    
    // 2. Line 62 fixed: businessName is safely defined above
    const name = businessName || 'this place';
    return NextResponse.json({
      reviews: [
        `Really loved the overall service at ${name}! Very polite staff. ⭐`,
        `Super clean environment and quality work by ${name}. Highly recommended! 👍`,
        `Had a wonderful experience here today. Will definitely visit again! 😊`
      ]
    });
  }
}