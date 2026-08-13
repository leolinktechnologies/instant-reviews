import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

export async function POST(req: Request) {
  try {
    const { businessName, rating, category } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY missing in Environment Variables');
      return NextResponse.json({ error: 'Groq API Key not configured' }, { status: 500 });
    }

    const angles = [
      "friendly staff and clean place",
      "fast service and polite team",
      "great work and good prices",
      "super polite staff and quick visit",
      "hygienic environment and helpful team",
      "definitely coming back again"
    ];

    const shuffled = angles.sort(() => 0.5 - Math.random());
    const selectedAngles = shuffled.slice(0, 3).join(", ");

    const prompt = `Generate 3 EXTREMELY SHORT, realistic Google reviews for "${businessName}" (${category}).

Selected Rating: ${rating} Stars.
Focus areas: ${selectedAngles}.

STRICT LENGTH & STYLE RULES:
- Maximum length per review: 10 to 25 words ONLY (1 to 2 lines max).
- Style: Casual, direct, everyday human writing. Use simple words.
- NO corporate jargon, NO long introductory sentences, NO repetitive buzzwords like "exemplary", "delighted", or "outstanding".
- Randomize lengths across options:
  * Review 1: Very short (1 short sentence, e.g., "Super friendly staff and very clean place. Loved the service!")
  * Review 2: Medium short (1-2 sentences, e.g., "Quick and smooth visit. The team was super helpful and polite. Highly recommended.")
  * Review 3: Short & sweet (2 simple sentences, e.g., "Great experience at ${businessName}! Good prices and awesome work.")

Return ONLY a valid raw JSON array of 3 strings. Example: ["Review 1...", "Review 2...", "Review 3..."]`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You write super short, casual, and authentic human Google reviews. Output ONLY a valid JSON array of strings.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.95, // Extra randomness for varied human style
    });

    const content = chatCompletion.choices[0]?.message?.content || '[]';
    
    const cleanedContent = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const reviews = JSON.parse(cleanedContent);

    return NextResponse.json({ reviews });
  } catch (error: any) {
    console.error('Groq API Error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate reviews via Groq' },
      { status: 500 }
    );
  }
}