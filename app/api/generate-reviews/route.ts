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
      "helped scale our business efficiency smoothly",
      "attentive project managers and clear reporting"
    ];
  }

  if (cat.includes('restaur') || cat.includes('food') || cat.includes('cafe') || cat.includes('bakery')) {
    return [
      "delicious taste, fresh quality, and great portion size",
      "quick service, polite staff, and welcoming ambiance",
      "clean, hygienic environment and wonderful vibe",
      "great value for money and tasty menu options",
      "consistent quality every single visit"
    ];
  }

  if (cat.includes('salon') || cat.includes('spa') || cat.includes('clinic') || cat.includes('health') || cat.includes('hospital')) {
    return [
      "extremely professional and caring staff",
      "clean, hygienic facility and comfortable experience",
      "great attention to detail and personalized care",
      "punctual appointment timing and great results",
      "felt completely at ease throughout the service"
    ];
  }

  // Default / Retail / General Businesses
  return [
    "prompt communication and polite behavior",
    "speed of service and professional team",
    "great quality work and value for money",
    "attention to detail and smooth overall experience",
    "exceeded expectations with their prompt support"
  ];
}

// Length Pattern Randomizer
function getRandomLengthConfigs() {
  const configs = [
    [
      "Slot 1: Concise & Crisp (12 - 20 words). MINIMUM 10 WORDS MANDATORY.",
      "Slot 2: Medium & Detailed (25 - 40 words). 2-3 natural sentences.",
      "Slot 3: Comprehensive & Detailed (45 - 75 words). 4-5 lines describing overall experience & recommendation."
    ],
    [
      "Slot 1: Medium & Natural (25 - 35 words). Focus on specific service experience.",
      "Slot 2: Extensive & Detailed Story (50 - 80 words). 4-5 lines explaining why they chose them and outcome.",
      "Slot 3: Quick & Positive (12 - 22 words). MINIMUM 10 WORDS MANDATORY."
    ],
    [
      "Slot 1: Detailed & In-depth (45 - 70 words). Full paragraph with 4+ lines of praise and details.",
      "Slot 2: Quick & Direct (12 - 20 words). MINIMUM 10 WORDS MANDATORY.",
      "Slot 3: Medium & Warm (25 - 40 words). Covers team behavior and final results."
    ]
  ];

  const randomIndex = Math.floor(Math.random() * configs.length);
  return configs[randomIndex];
}

export async function POST(req: Request) {
  try {
    const { businessName, rating, category } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY missing in Environment Variables');
      return NextResponse.json({ error: 'Groq API Key not configured' }, { status: 500 });
    }

    // Shuffle and pick 3 angles
    const availableAngles = getCategoryAngles(category);
    const shuffledAngles = [...availableAngles].sort(() => 0.5 - Math.random());
    const selectedAngles = shuffledAngles.slice(0, 3).join(", ");

    // Pick randomized length structure
    const lengthConfigs = getRandomLengthConfigs();

    // Randomize Writing Tones
    const tones = [
      "Tone 1: Friendly, warm and enthusiastic customer.",
      "Tone 2: Practical, result-driven and direct professional.",
      "Tone 3: Casual, everyday real person writing from a mobile phone."
    ].sort(() => 0.5 - Math.random());

    const prompt = `Generate 3 completely unique, natural, and authentic customer Google reviews for "${businessName}" (Business Category: ${category}).

Selected Rating: ${rating} Stars.
Key Highlights to distribute across reviews: ${selectedAngles}.

MANDATORY LENGTH & VARIETY RULES:
- ABSOLUTE MINIMUM WORD COUNT: NO review can be shorter than 10 words. 3-4 word reviews are STRICTLY FORBIDDEN!
- Review 1 (${lengthConfigs[0]}): Written with ${tones[0]}
- Review 2 (${lengthConfigs[1]}): Written with ${tones[1]}
- Review 3 (${lengthConfigs[2]}): Written with ${tones[2]}

CATEGORY CONTEXT:
- Must strictly fit services of a ${category} business.
- IT/Tech/Agency: Focus on communication, technical execution, deadlines, problem-solving, and ROI.
- Food/Cafe: Focus on flavor, service speed, cleanliness, and value.
- Salon/Health: Focus on care, hygiene, professionalism, and comfort.

STYLE & VOICE:
- Real humans writing naturally.
- Varied sentence structures, different starting words.
- DO NOT use cliché marketing jargon like "delighted to state", "exemplary endeavor", or "pinnacle of excellence".

Return ONLY a valid raw JSON array containing exactly 3 strings. Example: ["Review 1 text...", "Review 2 text...", "Review 3 text..."]`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You generate highly authentic, category-accurate customer reviews. Output ONLY a valid JSON array of strings without markdown syntax or conversational intro.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.95, // Higher temperature for increased variety
    });

    const content = chatCompletion.choices[0]?.message?.content || '[]';
    
    const cleanedContent = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let reviews: string[] = JSON.parse(cleanedContent);

    // Fallback safety check: ensure all reviews meet minimum word count
    if (Array.isArray(reviews)) {
      reviews = reviews.map((rev) => {
        const words = rev.trim().split(/\s+/);
        if (words.length < 8) {
          return `${rev.trim()} Overall a fantastic experience with ${businessName}, highly recommended for their great work!`;
        }
        return rev.trim();
      });
    }

    return NextResponse.json({ reviews });
  } catch (error: any) {
    console.error('Groq API Error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate reviews via Groq' },
      { status: 500 }
    );
  }
}