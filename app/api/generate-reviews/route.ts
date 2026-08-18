import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

async function createGroqCompletionWithRetry(groqClient: any, params: any, retries = 3, delay = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      return await groqClient.chat.completions.create(params);
    } catch (err: any) {
      if (err?.status === 429 && i < retries - 1) {
        console.warn(`Groq 429 Rate Limit hit. Retrying in ${delay}ms... (Attempt ${i + 1} of ${retries})`);
        await new Promise((res) => setTimeout(res, delay));
        delay *= 2;
      } else {
        throw err;
      }
    }
  }
}

function parseCategoriesAndKeywords(rawCategory: string): string[] {
  if (!rawCategory) return [];
  return rawCategory
    .split(/[,/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getCategoryProfile(rawCategory: string) {
  const cat = (rawCategory || '').toLowerCase();
  const parsedKeywords = parseCategoriesAndKeywords(rawCategory);

  if (cat.includes('dental') || cat.includes('dentist') || cat.includes('clinic') || cat.includes('health') || cat.includes('hospital') || cat.includes('doctor') || cat.includes('physio') || cat.includes('eye')) {
    return {
      type: 'healthcare',
      defaultKeywords: ["checkup", "medicine", "reports", "consultation", "treatment"],
      parsedKeywords,
      perspectives: [
        { role: "Symptom checkup", guide: "Simple note about asking for advice on health or pain." },
        { role: "Report discussion", guide: "Talking briefly about getting test results checked." },
        { role: "Routine follow up", guide: "Casual mention of coming back for a quick follow up." },
        { role: "Casual quick note", guide: "10 to 15 words about smooth process and quick departure." },
        { role: "First visit", guide: "Short review about finding the place easily and polite interaction." }
      ]
    };
  }

  if (cat.includes('cctv') || cat.includes('security') || cat.includes('biometric') || cat.includes('fire alarm') || cat.includes('surveillance')) {
    return {
      type: 'security_tech',
      defaultKeywords: ["CCTV setup", "biometric attendance", "fire alarm", "wiring work", "camera angle"],
      parsedKeywords,
      perspectives: [
        { role: "Shop or Office Owner", guide: "Got setup done for shop or office premises." },
        { role: "Home client", guide: "Simple note on installing security camera at home." },
        { role: "Service / Repair", guide: "Called for fixing camera or checking old system." }
      ]
    };
  }

  if (cat.includes('it') || cat.includes('tech') || cat.includes('software') || cat.includes('digital') || cat.includes('web') || cat.includes('agency')) {
    return {
      type: 'b2b_tech',
      defaultKeywords: ["website work", "software setup", "bug fixing", "project delivery"],
      parsedKeywords,
      perspectives: [
        { role: "Business Client", guide: "Simple feedback on website or tech task." },
        { role: "Project update", guide: "Note about on-time work delivery." }
      ]
    };
  }

  if (cat.includes('restaur') || cat.includes('food') || cat.includes('cafe') || cat.includes('bakery')) {
    return {
      type: 'food',
      defaultKeywords: ["food taste", "dinner", "seating", "fresh food"],
      parsedKeywords,
      perspectives: [
        { role: "Diner", guide: "Simple comment on taste and serving time." },
        { role: "Casual visitor", guide: "Quick review about seating space or parking." }
      ]
    };
  }

  return {
    type: 'general',
    defaultKeywords: ["in-store visit", "billing", "work quality", "delivery time"],
    parsedKeywords,
    perspectives: [
      { role: "Customer", guide: "Simple review about general service and timing." }
    ]
  };
}

function sanitizeReviewContent(reviews: string[], categoryType: string): string[] {
  const commonBannedPhrases = [
    { pattern: /^doctor was good\b/i, replacement: 'Clear advice provided' },
    { pattern: /^visited\b/i, replacement: 'Went for' },
    { pattern: /the appointment system\b/i, replacement: 'the booking' },
    { pattern: /found this team\b/i, replacement: 'got their number' },
    { pattern: /staff was nice\b/i, replacement: 'everyone was polite' },
  ];

  const hinglishCleaner = /\b(accha|achha|bohot|bahut|badiya|sahi|hai|ho|gaya|kar|diya|chahiye|wala|wali|wale|karo|plz)\b/gi;

  return reviews.map((rev) => {
    let cleaned = rev.trim();

    if (categoryType === 'healthcare') {
      cleaned = cleaned.replace(/\b(cctv|camera|biometric|wiring|installation)\b/gi, 'treatment');
    }

    commonBannedPhrases.forEach(({ pattern, replacement }) => {
      cleaned = cleaned.replace(pattern, replacement);
    });

    cleaned = cleaned.replace(hinglishCleaner, '').replace(/\s+/g, ' ').trim();

    return cleaned;
  });
}

function extractJsonArray(rawText: string): string[] {
  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.reviews)) return parsed.reviews;
  } catch {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsedArray = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsedArray)) return parsedArray;
      } catch {
        console.error('Regex JSON array extraction failed');
      }
    }
  }
  return [];
}

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY missing in Environment Variables');
      return NextResponse.json({ error: 'Groq API Key not configured' }, { status: 500 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { businessName = 'Business', rating = 5, category = 'Business' } = body;
    const profile = getCategoryProfile(category);
    
    const allCategoryKeywords = [...new Set([...profile.parsedKeywords, ...profile.defaultKeywords])].sort(() => 0.5 - Math.random());
    const singleSelectedKeyword = allCategoryKeywords.length > 0 ? allCategoryKeywords[0] : "";

    const selectedPerspectives = [...profile.perspectives].sort(() => 0.5 - Math.random()).slice(0, 3);
    const p1 = selectedPerspectives[0] ? `${selectedPerspectives[0].role}: ${selectedPerspectives[0].guide}` : "General feedback";
    const p2 = selectedPerspectives[1] ? `${selectedPerspectives[1].role}: ${selectedPerspectives[1].guide}` : "Service quality note";
    const p3 = selectedPerspectives[2] ? `${selectedPerspectives[2].role}: ${selectedPerspectives[2].guide}` : "Quick visitor note";

    const randomTemp = Number((0.70 + Math.random() * 0.15).toFixed(2));
    const uniqueSessionSeed = `session_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const starNuance = rating <= 4 
      ? "RATING IS 4 STARS: Include 1 small realistic detail (e.g. 'had to wait 10 mins extra', 'parking area was small', 'counter was a bit busy')." 
      : "RATING IS 5 STARS: Simple positive experience from a real customer.";

    const prompt = `Generate 3 completely UNIQUE, raw, organic Google reviews for "${businessName}" (Category: ${category}).
Batch Seed ID: ${uniqueSessionSeed}

Selected Rating: ${rating} Stars.
${starNuance}

STRICT CATEGORY ISOLATION RULE:
- Category Type is strictly: "${profile.type.toUpperCase()}".
- DO NOT mention terms from other industries! (e.g., in Healthcare, NEVER use words like CCTV, camera, software, website, installation, or biometric).

KEYWORD ROTATION RULE:
- Primary keyword selected for optional single-time use in batch: "${singleSelectedKeyword}".
- Use this keyword AT MOST ONCE in only 1 review out of 3. Do not put it in all 3 reviews!

REVIEW PERSPECTIVES FOR THIS BATCH:
- Review 1: ${p1}
- Review 2: ${p2}
- Review 3: ${p3}

STRICT LANGUAGE & HUMAN-WRITING RULES:
1. 100% PURE ENGLISH ONLY.
2. NATURAL OPENINGS & HIGH VARIETY.
3. SIMPLE CASUAL WRITING STYLE.
4. BUSINESS NAME RULE: Mention "${businessName}" IN MAXIMUM 1 OUT OF 3 REVIEWS.

OUTPUT REQUIREMENT:
You must respond using valid JSON. Format your response strictly as a JSON object containing a single key "reviews" with an array of 3 string items:
{"reviews": ["Review 1 text...", "Review 2 text...", "Review 3 text..."]}`;

    let chatCompletion;
    
    try {
      chatCompletion = await createGroqCompletionWithRetry(groq, {
        messages: [
          {
            role: 'system',
            content: 'You generate short casual English Google reviews. You must output valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        temperature: randomTemp,
        max_tokens: 1024,
      });
    } catch (primaryErr: any) {
      console.warn('Primary model error, attempting fallback to llama3-70b-8192:', primaryErr?.message || primaryErr);
      
      chatCompletion = await createGroqCompletionWithRetry(groq, {
        messages: [
          {
            role: 'system',
            content: 'You generate short casual English Google reviews. You must output valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: 'llama3-70b-8192',
        response_format: { type: 'json_object' },
        temperature: randomTemp,
        max_tokens: 1024,
      });
    }

    const content = chatCompletion?.choices[0]?.message?.content || '{"reviews":[]}';
    let reviews: string[] = extractJsonArray(content);

    if (Array.isArray(reviews) && reviews.length > 0) {
      reviews = sanitizeReviewContent(reviews, profile.type);

      reviews = reviews.map((rev) => {
        const words = rev.trim().split(/\s+/);
        if (words.length < 8) {
          return `${rev.trim()} Good experience overall.`;
        }
        return rev.trim();
      });
    } else {
      reviews = [
        "Overall simple and hassle-free experience here.",
        "Quick service and clear guidance provided.",
        "Satisfied with how everything was handled."
      ];
    }

    return NextResponse.json({ reviews });
  } catch (error: unknown) {
    console.error('Groq API Final Exception:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to generate reviews via Groq';
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}