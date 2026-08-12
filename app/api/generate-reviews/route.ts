import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { businessName, category } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ GEMINI_API_KEY Missing in Environment Variables!");
      return NextResponse.json({
        reviews: [
          "Great experience and excellent service! ⭐",
          "Loved the quality, highly satisfied! 👍",
          "Super friendly staff, definitely coming back! 😊"
        ]
      });
    }

    // Modern Working Gemini Models (2026 Compatible)
    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-1.5-flash'
    ];

    let rawText = '';
    let success = false;

    for (const model of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Generate 3 completely unique, short, natural 1-line Google reviews for a ${category || 'Business'} named "${businessName || 'Business'}".
                      
                      Rules:
                      1. Keep them short (10-18 words max).
                      2. Write like a real customer on Google Maps (casual, friendly).
                      3. Mention realistic features of a ${category || 'business'}.
                      4. Include 1 emoji per review.
                      5. Return ONLY a valid JSON array of 3 strings. Example: ["Review 1...", "Review 2...", "Review 3..."]`
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 1.0,
                responseMimeType: "application/json" // Enforces pure JSON output from Gemini
              }
            }),
          }
        );

        const data = await response.json();

        if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          rawText = data.candidates[0].content.parts[0].text;
          success = true;
          break; // Stop loop on success
        } else {
          console.warn(`Model ${model} response failed:`, data?.error?.message || response.statusText);
        }
      } catch (err) {
        console.warn(`Fetch exception on ${model}:`, err);
      }
    }

    if (!success || !rawText) {
      throw new Error("All Gemini models failed or returned empty text.");
    }

    // Clean JSON String
    const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const reviews = JSON.parse(cleanedText);

    return NextResponse.json({ reviews });

  } catch (error) {
    console.error("❌ Gemini AI Final Catch Error:", error);
    
    // Dynamic Fallback so users get unique-looking options even if API breaks
    const name = businessName || 'this place';
    return NextResponse.json({
      reviews: [
        `Really loved the overall service at ${name}! Very polite staff and quick response. ⭐`,
        `Super clean environment and quality work by ${name}. Highly recommended! 👍`,
        `Had a wonderful experience here today. Will definitely visit again! 😊`
      ]
    });
  }
}