import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { businessName, category } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ GEMINI_API_KEY missing in environment variables!");
      return NextResponse.json({
        reviews: [
          "Great experience and excellent service! ⭐",
          "Loved the quality, highly satisfied! 👍",
          "Super friendly staff, definitely coming back! 😊"
        ]
      });
    }

    // Only real, existing Gemini API models
    const modelsToTry = [
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];

    let rawText = '';
    let success = false;

    for (const model of modelsToTry) {
      try {
        const response = await fetch(
          `[https://generativelanguage.googleapis.com/v1beta/models/$](https://generativelanguage.googleapis.com/v1beta/models/$){model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Generate 3 short, realistic Google reviews for "${businessName || 'Business'}" which is a "${category || 'General'}".
                      
                      STRICT RULES TO SOUND LIKE A REAL HUMAN:
                      1. DO NOT use generic AI buzzwords like "Exceptional", "Outstanding", "A hidden gem".
                      2. Keep them short (10-20 words max per review).
                      3. Write in casual, natural everyday English.
                      4. Mention small, specific details typical for a ${category}.
                      
                      Return strictly a JSON array of 3 strings. Example:
                      ["Really nice fresh food, loved it.", "Quick service and clean space.", "Tasty snacks, will come back."]`,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.9,
              },
            }),
          }
        );

        const data = await response.json();

        if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          rawText = data.candidates[0].content.parts[0].text;
          success = true;
          break; // Stop loop if successfully generated
        } else {
          console.warn(`Model ${model} failed response:`, data?.error?.message || "Unknown error");
        }
      } catch (err) {
        console.warn(`Fetch error for model ${model}:`, err);
      }
    }

    // Fallback if AI calls fail
    if (!success || !rawText) {
      return NextResponse.json({
        reviews: [
          `Great experience at ${businessName || 'this place'}! Very happy with their service. ⭐`,
          `Very polite staff and clean space. Highly recommended! 👍`,
          `Quality is awesome, definitely visiting again! 😊`
        ]
      });
    }

    // Clean markdown and formatting safely
    const cleanedText = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();

    let reviews;
    try {
      reviews = JSON.parse(cleanedText);
    } catch (parseError) {
      // Fallback regex array extraction if JSON.parse fails
      const matches = cleanedText.match(/"([^"]+)"/g);
      if (matches && matches.length >= 3) {
        reviews = matches.slice(0, 3).map(m => m.replace(/"/g, ''));
      } else {
        reviews = [
          `Great experience at ${businessName || 'this place'}! ⭐`,
          `Very polite staff and quality service! 👍`,
          `Definitely visiting again soon! 😊`
        ];
      }
    }

    return NextResponse.json({ reviews });

  } catch (error) {
    console.error("❌ Backend Error:", error);
    return NextResponse.json({
      reviews: [
        "Great experience and excellent service! ⭐",
        "Loved the quality, highly satisfied! 👍",
        "Super friendly staff, definitely coming back! 😊"
      ]
    });
  }
}