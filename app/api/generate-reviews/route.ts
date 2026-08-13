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
      "overall experience and would visit again"
    ];

    const shuffled = angles.sort(() => 0.5 - Math.random());
    const selectedAngles = shuffled.slice(0, 3).join(", ");

    const prompt = `Generate 3 natural, human-like Google customer reviews for "${businessName}" (${category}).

Selected Rating: ${rating} Stars.
Focus areas: ${selectedAngles}.

LENGTH DISTRIBUTION & STYLE RULES:
- PRIORITIZE 2-3 LINE REVIEWS (Keep most reviews between 20 to 35 words).
- Randomize the 3 options like a real mix of customer posts:
  * Review 1: Standard 2-line review (approx 20-25 words).
  * Review 2: Solid 2-3 line review (approx 25-35 words).
  * Review 3: Either a quick 1-2 line review OR a slightly fuller 3-line review.
- Style: Everyday casual human writing. Natural flow, simple words, no corporate buzzwords.
- Avoid repetitive intros or cheesy template phrases like "delighted to say" or "exemplary".

Return ONLY a valid raw JSON array of 3 strings. Example: ["Review 1 text...", "Review 2 text...", "Review 3 text..."]`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You write realistic, casual human Google reviews with a natural mix of lengths, leaning mostly toward 2-3 lines. Output ONLY a valid JSON array of strings.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.95,
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