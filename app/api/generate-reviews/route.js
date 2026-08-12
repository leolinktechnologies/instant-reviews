import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { businessName, category } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("Gemini API Key missing in process.env");
      return NextResponse.json({
        reviews: [
          "Great experience and excellent service! ⭐",
          "Loved the quality, highly satisfied! 👍",
          "Super friendly staff, definitely coming back! 😊"
        ]
      });
    }

    const prompt = `Generate 3 distinct, natural, short 1-line Google reviews for a ${category || 'Business'} named "${businessName || 'Business'}".
Rules:
- Under 12 words per review.
- Sound like real human customers (casual, enthusiastic, simple).
- Vary sentence style across options.
- Add 1 relevant emoji per option.
- Return strictly a valid JSON array of strings, like this: ["Review 1", "Review 2", "Review 3"]
- Do not include markdown codeblocks or extra text.`;

    // Updated API call to standard Google Gemini Endpoint
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

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Gemini API HTTP Error:", response.status, errBody);
      throw new Error(`Gemini API failed with status ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("No text response from Gemini");
    }

    // Advanced JSON cleaning
    const cleanedText = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    let reviews;
    try {
      reviews = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error("JSON Parse Error on rawText:", rawText);
      // Fallback regex extract array items if JSON parsing fails
      const matches = cleanedText.match(/"([^"]+)"/g);
      if (matches && matches.length > 0) {
        reviews = matches.map(m => m.replace(/"/g, ''));
      } else {
        throw parseErr;
      }
    }

    return NextResponse.json({ reviews });

  } catch (error) {
    console.error("Gemini API Catch Handler Error:", error);
    
    // Always return safe 200 JSON fallback instead of failing with 500
    return NextResponse.json({
      reviews: [
        "Great experience and excellent service! ⭐",
        "Loved the quality, highly satisfied! 👍",
        "Super friendly staff, definitely coming back! 😊"
      ]
    });
  }
}