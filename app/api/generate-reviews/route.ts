import { NextResponse } from 'next/server';

// Agar aap OpenAI use kar rahe hain:
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function POST(req: Request) {
  try {
    const { businessName, rating, category } = await req.json();

    // Random topics & keywords to inject randomness on every API call
    const angles = [
      "staff friendliness and welcoming vibe",
      "speed of service and efficiency",
      "cleanliness, hygiene, and atmosphere",
      "value for money and top quality",
      "attention to detail and care",
      "overall experience and high recommendation"
    ];

    // Pick 3 random angles every time
    const shuffled = angles.sort(() => 0.5 - Math.random());
    const selectedAngles = shuffled.slice(0, 3).join(", ");

    const prompt = `Generate 3 completely unique, natural, and realistic Google customer reviews for a business named "${businessName}" (Category: ${category}).

Selected Rating: ${rating} Stars.
Focus areas for this request: ${selectedAngles}.

Guidelines:
- Each review must sound like it was written by a real person (different lengths, sentence structures, and tone).
- Do NOT use repetitive phrases like "Highly recommend!", "Great place!", or "Amazing experience!" in every review.
- Mix casual, enthusiastic, and detailed writing styles.
- Return ONLY a valid JSON array of 3 strings. Example: ["Review 1...", "Review 2...", "Review 3..."]`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // ya 'gpt-3.5-turbo'
      messages: [
        {
          role: 'system',
          content: 'You are an AI that generates diverse, non-repetitive, authentic customer reviews. Output ONLY a raw JSON array of strings.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.9, // 👈 Higher temperature = maximum randomness and variety
    });

    const content = response.choices[0]?.message?.content || '[]';
    
    // Clean response in case AI includes markdown wrappers
    const cleanedContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
    const reviews = JSON.parse(cleanedContent);

    return NextResponse.json({ reviews });
  } catch (error: any) {
    console.error('Error generating reviews:', error);
    return NextResponse.json(
      { error: 'Failed to generate reviews' },
      { status: 500 }
    );
  }
}