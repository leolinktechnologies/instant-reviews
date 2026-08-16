import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// Category-specific keywords and realistic service context (e.g., Dental, Tech, Dining)
function getCategoryContext(category: string) {
  const cat = (category || '').toLowerCase();

  if (cat.includes('dental') || cat.includes('dentist') || cat.includes('teeth')) {
    return {
      keywords: ["braces", "aligners", "orthodontic treatment", "dental care", "consultation", "root canal", "teeth cleaning", "checkup"],
      angles: [
        "was a bit anxious before the procedure but felt okay during the visit",
        "came in with my daughter for her routine teeth checkup",
        "doctor took time during consultation to review X-rays and options",
        "cleared all my doubts regarding treatment duration and cost"
      ]
    };
  }

  if (cat.includes('clinic') || cat.includes('health') || cat.includes('hospital') || cat.includes('doctor')) {
    return {
      keywords: ["consultation", "prescribed medicine", "reports checkup", "routine visit", "treatment plan", "medical checkup"],
      angles: [
        "brought my dadu here for his routine checkup",
        "doctor listened to the symptoms patiently without rushing",
        "came with my masi ji for a second opinion",
        "reception process was straightforward and reports came on time"
      ]
    };
  }

  if (cat.includes('it') || cat.includes('tech') || cat.includes('software') || cat.includes('web') || cat.includes('agency')) {
    return {
      keywords: ["website redesign", "bug fixes", "UI cleanup", "SEO audit", "app development", "hosting setup", "domain transfer"],
      angles: [
        "got our business website redesigned and speed improved noticeably",
        "team was responsive on WhatsApp whenever we requested small changes",
        "fair pricing for the technical work delivered",
        "handled our project updates smoothly over the last two months"
      ]
    };
  }

  if (cat.includes('restaur') || cat.includes('food') || cat.includes('cafe') || cat.includes('bakery')) {
    return {
      keywords: ["family dinner", "cold coffee", "thali", "evening snack", "seating area", "table booking", "freshly prepared"],
      angles: [
        "went with family on Sunday evening, food was fresh",
        "portion sizes were generous and taste was balanced",
        "took around 20 mins for food to arrive as it was crowded",
        "casual atmosphere, good option for dinner with friends"
      ]
    };
  }

  // General Retail / Service fallback
  return {
    keywords: ["service charge", "in-store visit", "billing", "product demo", "work quality", "delivery time"],
    angles: [
      "visited for a quick service inquiry last week",
      "straightforward billing and helpful guidance",
      "got the job done without unnecessary delays",
      "came on recommendation from a family friend"
    ]
  };
}

// Scenarios to inject realistic variety into each review batch
function getRandomScenarios() {
  const pool = [
    { type: "First-time visit", instruction: "Customer visiting for the first time, mentioning how they found out or initial hesitation." },
    { type: "Family visit (Indian context)", instruction: "Occasionally reference family naturally (e.g., 'brought my son', 'came with my masi ji', 'took dadu for checkup')." },
    { type: "Consultation & Questions", instruction: "Customer asking questions or getting advice/opinions before deciding on treatment/service." },
    { type: "Regular/Follow-up Customer", instruction: "Mentions a second or third visit, or ongoing treatment/service experience." },
    { type: "Nervous to comfortable journey", instruction: "Was slightly nervous or skeptical at first, but had a normal/reassuring experience." },
    { type: "Short casual reviewer", instruction: "Brief 12-18 words Indian English review. Practical and direct." }
  ];

  return [...pool].sort(() => 0.5 - Math.random()).slice(0, 3);
}

export async function POST(req: Request) {
  try {
    const { businessName, rating = 5, category = '' } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY missing in Environment Variables');
      return NextResponse.json({ error: 'Groq API Key not configured' }, { status: 500 });
    }

    const { keywords, angles } = getCategoryContext(category);
    const selectedKeywords = [...keywords].sort(() => 0.5 - Math.random()).slice(0, 3).join(", ");
    const selectedAngles = [...angles].sort(() => 0.5 - Math.random()).slice(0, 2).join("; ");
    const scenarios = getRandomScenarios();

    const starNuance = rating <= 4 
      ? "RATING IS 4 STARS: Include 1 minor realistic detail or tiny limitation (e.g., 'parking was slightly tight', 'had a 10-min wait during peak hours', 'billing counter was a bit busy')." 
      : "RATING IS 5 STARS: Genuinely positive experience. Do NOT sound exaggerated, promotional, or fake.";

    const prompt = `Generate 3 completely organic, human-sounding Google reviews for "${businessName}" (Business Category: ${category}).

Selected Rating: ${rating} Stars.
${starNuance}

CATEGORY KEYWORDS TO USE NATURALLY (Do NOT force all into one review, spread across batch):
${selectedKeywords}

CONTEXT & ANGLES TO DRAW INSPIRATION FROM:
${selectedAngles}

MANDATORY REVIEW SCENARIOS FOR THIS BATCH:
- Review 1 (${scenarios[0].type}): ${scenarios[0].instruction}
- Review 2 (${scenarios[1].type}): ${scenarios[1].instruction}
- Review 3 (${scenarios[2].type}): ${scenarios[2].instruction}

STRICT INDIAN ENGLISH & HUMAN AUTHENTICITY RULES:
1. INDIAN ENGLISH CONTEXT:
   - Use natural Indian English vocabulary and phrasing (e.g., "came for checkup", "got the work done", "staff was humble", "took my parents", "masi ji", "dadu", "son").
   - Avoid Americanized phrases like "super excited", "blown away", "world-class", "game changer".

2. ABSOLUTELY BANNED REPETITIVE AI PHRASES (STRICTLY FORBIDDEN):
   - Do NOT use: "staff was nice", "explained everything", "overall satisfied", "highly recommended", "best experience", "smooth experience", "comfortable environment", "excellent service", "top-notch".

3. ENDINGS MUST BE NATURAL:
   - Do NOT end every review with a recommendation or advertisement.
   - Real humans end with simple statements: "Got my work done on time", "Left within 45 mins", "Glad we opted for this clinic", "Will visit again if needed".

4. VARIETY IN STRUCTURE:
   - Mix short (12-22 words) and medium (25-45 words) lengths.
   - Vary sentence starting words. Do NOT start all reviews with "I".

5. NO KEYWORD STUFFING:
   - Integrate relevant service keywords naturally like a customer sharing a real story.

Return ONLY a valid raw JSON array containing exactly 3 strings. Example: ["Review 1 text...", "Review 2 text...", "Review 3 text..."]`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You write raw, realistic Indian customer Google reviews. Output ONLY a valid JSON array of strings without markdown syntax or intro text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.88,
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
          return `${rev.trim()} Decent experience overall during my visit.`;
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