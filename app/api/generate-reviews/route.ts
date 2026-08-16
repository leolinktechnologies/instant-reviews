import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// Real-world observational details based on category
function getCategoryAngles(category: string): string[] {
  const cat = (category || '').toLowerCase();

  if (cat.includes('it') || cat.includes('tech') || cat.includes('software') || cat.includes('digital') || cat.includes('web') || cat.includes('agency')) {
    return [
      "explained things simply without confusing jargon",
      "fixed our issue faster than expected",
      "clear communication on calls and messages",
      "fair pricing and transparent updates",
      "took time to understand what we actually needed"
    ];
  }

  if (cat.includes('restaur') || cat.includes('food') || cat.includes('cafe') || cat.includes('bakery')) {
    return [
      "food tasted fresh and portion size was decent",
      "didn't have to wait too long after ordering",
      "clean seating area and quiet vibe",
      "reasonably priced for the quality",
      "straightforward service, decent option"
    ];
  }

  if (cat.includes('salon') || cat.includes('spa') || cat.includes('clinic') || cat.includes('health') || cat.includes('hospital') || cat.includes('doctor') || cat.includes('dental')) {
    return [
      "staff answered my questions patiently",
      "clean waiting area with reasonable wait times",
      "explained treatment steps before starting",
      "straightforward process from check-in to leaving",
      "post-care guidance was simple to follow"
    ];
  }

  return [
    "quick response when reaching out",
    "straightforward process with clear answers",
    "good quality work done on schedule",
    "fair pricing and polite staff",
    "handled the work without unnecessary delay"
  ];
}

// 5 Specific Customer Perspectives requested
function getRandomPerspectives() {
  const pool = [
    {
      role: "First-time visitor",
      guide: "Focus on finding the location, initial impressions, or overcoming slight hesitation."
    },
    {
      role: "Regular patient/client",
      guide: "Mentions coming here regularly, routine visits, or consistency over time."
    },
    {
      role: "Parent of child patient/family member",
      guide: "Writing as someone who brought their child or family member (e.g., 'Brought my son here...', 'Took my mother...')."
    },
    {
      role: "Consultation visitor",
      guide: "Focus on asking questions, getting a second opinion, or reviewing reports before deciding."
    },
    {
      role: "Treatment / Main service patient",
      guide: "Describes going through a specific service/procedure, recovery, or post-care follow-up."
    },
    {
      role: "Short casual reviewer",
      guide: "Direct, brief (12-22 words). Speaks like sending a quick text message."
    }
  ];

  return [...pool].sort(() => 0.5 - Math.random()).slice(0, 3);
}

export async function POST(req: Request) {
  try {
    const { businessName, rating, category } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY missing in Environment Variables');
      return NextResponse.json({ error: 'Groq API Key not configured' }, { status: 500 });
    }

    const availableAngles = getCategoryAngles(category);
    const selectedAngles = [...availableAngles].sort(() => 0.5 - Math.random()).slice(0, 3).join(", ");
    const perspectives = getRandomPerspectives();

    const prompt = `Act as 3 REAL everyday customers writing organic Google reviews for "${businessName}" (Category: ${category}).

Selected Rating: ${rating} Stars.
Observation details to distribute naturally: ${selectedAngles}.

MANDATORY PERSPECTIVES TO USE:
- Review 1 (${perspectives[0].role}): ${perspectives[0].guide}
- Review 2 (${perspectives[1].role}): ${perspectives[1].guide}
- Review 3 (${perspectives[2].role}): ${perspectives[2].guide}

STRICT WRITING RULES:
1. STRICTLY BANNED WORDS/PHRASES (DO NOT USE):
   - "comfortable", "smooth", "excellent", "professional", "highly recommended", "world-class", "best experience", "pinnacle", "top-notch", "delighted".

2. AVOID PROMOTIONAL / ADVERTISEMENT ENDINGS:
   - DO NOT end reviews with fake praise or recommendations like "Must visit!", "I will definitely recommend to everyone!".
   - End naturally like real humans: "Everything was straightforward", "Glad to have this wrapped up finally", "Left within 30 minutes", "No issues".

3. REAL HUMAN IMPERFECTIONS & VARIATIONS:
   - Use simple everyday language with minor human details (e.g., "was a bit nervous at first", "10-15 min wait", "parking was a little tricky").
   - Do NOT use perfect marketing grammar or overly polished sentences.

4. DO NOT OVERUSE BUSINESS NAME:
   - Do NOT repeat "${businessName}" in every review. Real people usually write "this place", "the doctor", "they", "the team", or "here".

5. LENGTH MIX:
   - Mix short (12-20 words) and medium (25-45 words) length reviews.

Return ONLY a valid raw JSON array containing exactly 3 strings. Example: ["Review 1 text...", "Review 2 text...", "Review 3 text..."]`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You write unpolished, natural, raw human Google reviews based on realistic customer experiences. Output ONLY a valid JSON array of strings without markdown syntax or intro conversational text.',
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

    let reviews: string[] = JSON.parse(cleanedContent);

    // Fallback safety check: ensure all reviews meet minimum word count without clichés
    if (Array.isArray(reviews)) {
      reviews = reviews.map((rev) => {
        const words = rev.trim().split(/\s+/);
        if (words.length < 8) {
          return `${rev.trim()} Overall satisfied with my visit today.`;
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