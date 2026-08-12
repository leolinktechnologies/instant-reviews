import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { businessName, category } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key missing' }, { status: 500 });
    }

    const modelsToTry = [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-3.1-flash-lite'
    ];

    let rawText = '';
    let success = false;

    for (const model of modelsToTry) {
      try {
        const timestamp = new Date().getTime();
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
                      text: `Generate 3 short, realistic Google reviews for "${businessName}" which is a "${category}".
                      
                      STRICT RULES TO SOUND LIKE A REAL HUMAN:
                      1. DO NOT use generic AI buzzwords like "Exceptional", "Outstanding", "A hidden gem", "Top-notch", or "Must-visit".
                      2. Keep them short (10-20 words max per review).
                      3. Write in casual, natural everyday English (how real people write on Google Maps).
                      4. Mention small, specific details typical for a ${category} (e.g., taste, seating, quick service, friendly staff, clean space).
                      5. Use minor natural variations (e.g., one short sentence, another with lowercase starting or casual punctuation).
                      
                      Return strictly a JSON array of 3 strings. Example:
                      ["Really nice fresh sweets, loved the gulab jamun. Good place to visit with family.", "Quick service and clean space. Staff was very polite.", "Tried their snacks today, tasty and hygienic. Will definitely come back."]
                      
                      Request Time ID: ${timestamp}`,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 1.0,
              },
            }),
          }
        );

        const data = await response.json();

        if (!data.error && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          rawText = data.candidates[0].content.parts[0].text;
          success = true;
          break;
        }
      } catch (err) {
        console.warn(`Fetch failed for model ${model}`);
      }
    }

    if (!success || !rawText) {
      throw new Error("All Gemini models are currently busy.");
    }

    const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const reviews = JSON.parse(cleanedText);

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("❌ Backend Error:", error);
    return NextResponse.json(
      { error: 'Failed to generate reviews' },
      { status: 500 }
    );
  }
}