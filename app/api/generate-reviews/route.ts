import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// Category-specific real human observational details
function getCategoryAngles(category: string): string[] {
  const cat = (category || '').toLowerCase();

  if (cat.includes('it') || cat.includes('tech') || cat.includes('software') || cat.includes('digital') || cat.includes('web') || cat.includes('agency')) {
    return [
      "explained the process simply without confusing technical jargon",
      "fixed our issue faster than expected",
      "smooth communication and easy to talk to",
      "fair pricing and transparent updates",
      "took the time to understand what we actually needed"
    ];
  }

  if (cat.includes('restaur') || cat.includes('food') || cat.includes('cafe') || cat.includes('bakery')) {
    return [
      "food tasted fresh and portion was good",
      "didn't have to wait too long for the order",
      "clean seating area and polite behavior",
      "reasonably priced for the quality",
      "nice relaxed vibe, good place to visit"
    ];
  }

  if (cat.includes('salon') || cat.includes('spa') || cat.includes('clinic') || cat.includes('health') || cat.includes('hospital') || cat.includes('doctor')) {
    return [
      "staff was calm and answered all my questions",
      "clean environment and zero rush",
      "felt comfortable throughout the appointment",
      "explained everything clearly before starting",
      "smooth experience with minimal wait time"
    ];
  }

  // Default / General Businesses
  return [
    "quick response when I reached out",
    "helpful team and straightforward service",
    "good quality work without any hassle",
    "fair pricing and polite staff",
    "overall happy with how everything was handled"
  ];
}

// Select 3 distinct customer personalities for the prompt
function getRandomPersonalities() {
  const pool = [
    {
      type: "First-Time Visitor",
      style: "Mentions initial hesitation or impression (e.g. 'I was a little nervous...', 'It was my first time visiting...')."
    },
    {
      type: "Short Casual Reviewer",
      style: "Brief, direct, uses simple everyday words (12 - 20 words). Gets straight to the point."
    },
    {
      type: "Simple Everyday Customer",
      style: "Normal practical customer focusing on staff behavior, timing, and ease of service (20 - 35 words)."
    },
    {
      type: "Detailed Experiential Customer",
      style: "Describes 2-3 step experience naturally without sounding promotional (35 - 55 words)."
    }
  ];

  // Shuffle pool and pick 3 distinct personalities
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
}

export async function POST(req: Request) {
  try {
    const { businessName, rating, category } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY missing in Environment Variables');
      return NextResponse.json({ error: 'Groq API Key not configured' }, { status: 500 });
    }

    // Pick 3 realistic observational angles
    const availableAngles = getCategoryAngles(category);
    const selectedAngles = [...availableAngles].sort(() => 0.5 - Math.random()).slice(0, 3).join(", ");

    // Pick 3 customer personalities
    const personalities = getRandomPersonalities();

    const prompt = `Act as 3 different REAL everyday people writing organic Google reviews for "${businessName}" (Category: ${category}).

Selected Rating: ${rating} Stars.
Key observation points to distribute: ${selectedAngles}.

MANDATORY PERSONALITIES & FORMAT:
- Review 1 (${personalities[0].type}): ${personalities[0].style}
- Review 2 (${personalities[1].type}): ${personalities[1].style}
- Review 3 (${personalities[2].type}): ${personalities[2].style}

STRICT WRITING RULES (HUMAN & UNPOLISHED):
1. AVOID MARKETING LANGUAGE & CLICHÉS:
   - STRICTLY FORBIDDEN PHRASES: "highly recommended", "world-class", "best experience", "exceeded expectations", "pinnacle of excellence", "top-notch", "delighted to state".
2. DO NOT REPEAT BUSINESS NAME/CATEGORY:
   - Do NOT force "${businessName}" or "${category}" in every review. Real people usually say "this place", "they", "the staff", "here", or "the team".
3. NATURAL HUMAN OPENINGS & PHRASING:
   - Use natural variations like: "I visited here...", "The staff explained...", "I was a little skeptical at first...", "Overall happy with my visit...", "Got my work done smoothly...".
4. IMPERFECT & CONVERSATIONAL:
   - Keep sentences simple. Avoid overly poetic or polished English. Write like someone typing on a phone in 1-2 minutes.
5. LENGTH RULE:
   - Each review MUST be at least 10 words long. Maximum 60 words.

Return ONLY a valid raw JSON array containing exactly 3 strings. Example: ["Review 1 text...", "Review 2 text...", "Review 3 text..."]`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You generate raw, human, unpolished, and realistic Google customer reviews. Output ONLY a valid JSON array of strings without markdown syntax or intro text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.9, // Balanced variety without becoming erratic
    });

    const content = chatCompletion.choices[0]?.message?.content || '[]';
    
    const cleanedContent = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let reviews: string[] = JSON.parse(cleanedContent);

    // Fallback safety check: ensure all reviews meet minimum word count with natural non-cliché text
    if (Array.isArray(reviews)) {
      reviews = reviews.map((rev) => {
        const words = rev.trim().split(/\s+/);
        if (words.length < 8) {
          return `${rev.trim()} Overall happy with my visit, glad I came here.`;
        }
        return rev.trim();
      });
    }

    return NextResponse.json({ reviews });
  } catch (error: unknown) {
    console.error('Groq API Error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to generate reviews via Groq';
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}