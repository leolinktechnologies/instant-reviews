import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { businessName, category } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("Gemini API Key Missing");
    }

    const prompt = `
    Generate 3 distinct, natural, short 1-line Google reviews for a ${category || 'Business'} named "${businessName || 'Business'}".
    Rules:
    - Under 12 words per review.
    - Sound like real human customers (casual, enthusiastic, simple).
    - Vary sentence style across options.
    - Add 1 relevant emoji per option.
    - Return strictly a valid JSON array of strings, like this: ["Review 1", "Review 2", "Review 3"]
    - Do not include markdown codeblocks or extra text.
    `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();
    const rawText = data.candidates[0].content.parts[0].text;
    
    // Clean JSON formatting if Gemini adds markdown tags
    const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const reviews = JSON.parse(cleanedText);

    return NextResponse.json({ reviews });

  } catch (error) {
    console.error("Gemini API Error:", error);
    // Safe Fallback
    return NextResponse.json({
      reviews: [
        "Great experience and excellent service! ⭐",
        "Loved the quality, highly satisfied! 👍",
        "Super friendly staff, definitely coming back! 😊"
      ]
    });
  }
}