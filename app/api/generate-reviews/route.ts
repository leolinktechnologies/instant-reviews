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
      "staff friendliness and welcoming vibe",
      "speed of service and efficiency",
      "cleanliness, hygiene, and atmosphere",
      "value for money and top quality",
      "attention to detail and care",
      "overall experience and high recommendation"
    ];

    const shuffled = angles.sort(() => 0.5 - Math.random());
    const selectedAngles = shuffled.slice(0, 3).join(", ");

    const prompt = `Generate 3 completely unique, natural, and realistic Google customer reviews for a business named "${businessName}" (Category: ${category}).

Selected Rating: ${rating} Stars.
Focus areas: ${selectedAngles}.

CRITICAL LENGTH & FORMAT RULES:
- Keep the reviews concise and short! 
- Randomize the length across the 3 options:
  * Review 1: Very short (1-2 lines, approx 12-25 words)
  * Review 2: Medium (2-3 lines, approx 25-40 words)
  * Review 3: Detailed (3-4 lines max, approx 40-55 words)
- Sound authentic and natural like real human feedback. Avoid long essay-like paragraphs.
- Return ONLY a valid JSON array of 3 strings. Example format: ["Review 1 text", "Review 2 text", "Review 3 text"]`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an AI that generates authentic, natural, and concise customer reviews. Return ONLY a valid raw JSON array of strings without markdown syntax.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.9,
    });

    const content = chatCompletion.choices[0]?.message?.content || '[]';
    
    // Clean JSON formatting
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