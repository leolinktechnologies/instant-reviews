import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// Business Category Wise Smart Context Generator
function getCategoryAngles(category: string): string[] {
  const cat = (category || '').toLowerCase();

  if (cat.includes('it') || cat.includes('tech') || cat.includes('software') || cat.includes('digital') || cat.includes('web') || cat.includes('agency')) {
    return [
      "deep technical expertise and problem solving",
      "fast project delivery and great communication",
      "reliable IT support and smooth execution",
      "professional team, highly skilled and cooperative",
      "value for money services and top-notch quality",
      "helped scale our business efficiency smoothly"
    ];
  }

  if (cat.includes('restaur') || cat.includes('food') || cat.includes('cafe') || cat.includes('bakery')) {
    return [
      "delicious taste, fresh quality, and great portion size",
      "quick service, polite staff, and welcoming ambiance",
      "clean, hygienic environment and wonderful vibe",
      "great value for money and tasty menu options"
    ];
  }

  if (cat.includes('salon') || cat.includes('spa') || cat.includes('clinic') || cat.includes('health') || cat.includes('hospital')) {
    return [
      "extremely professional and caring staff",
      "clean, hygienic facility and comfortable experience",
      "great attention to detail and personalized care",
      "punctual appointment timing and great results"
    ];
  }

  // Default / Retail / General Businesses
  return [
    "prompt communication and polite behavior",
    "speed of service and professional team",
    "great quality work and value for money",
    "attention to detail and smooth overall experience"
  ];
}

export async function POST(req: Request) {
  try {
    const { businessName, rating, category } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY missing in Environment Variables');
      return NextResponse.json({ error: 'Groq API Key not configured' }, { status: 500 });
    }

    const availableAngles = getCategoryAngles(category);
    const shuffled = availableAngles.sort(() => 0.5 - Math.random());
    const selectedAngles = shuffled.slice(0, 3).join(", ");

    const prompt = `Generate 3 natural, authentic customer Google reviews for "${businessName}" (Business Category: ${category}).

Selected Rating: ${rating} Stars.
Key Highlights to use: ${selectedAngles}.

CRITICAL CATEGORY CONTEXT RULE:
- Reviews MUST strictly reflect the services offered by a ${category} business!
- Example: For IT/Tech/Services, focus on technical skill, communication, support, and results. DO NOT mention "clean place" or "hygiene" for non-physical/office services!

STRICT REVIEW LENGTH & VARIETY FORMAT:
- Review 1: VERY SHORT (1-2 lines, approx 12-20 words) - Crisp & direct.
- Review 2: SHORT & SWEET (2 lines, approx 20-30 words) - Natural human feedback.
- Review 3: LONGER & DETAILED (3-4 lines, approx 45-65 words) - Covers experience, problem solved, and recommendation.

STYLE:
- Everyday casual writing. 
- Sound like 3 different real humans writing from their own perspective.
- Avoid repetitive template jargon like "delighted to state", "exemplary", or "top-notch endeavor".

Return ONLY a valid raw JSON array of 3 strings. Example: ["Review 1 text", "Review 2 text", "Review 3 text"]`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You generate authentic, category-accurate customer reviews. Output ONLY a valid JSON array of strings without markdown styling.',
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