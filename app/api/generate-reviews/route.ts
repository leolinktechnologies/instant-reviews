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
        console.warn(`Groq 429 Rate Limit hit. Retrying in ${delay}ms...`);
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
    .map(item => item.trim())
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
    if (parsed.reviews && Array.isArray(parsed.reviews)) return parsed.reviews;
  } catch {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        console.error('Regex array parse failed');
      }
    }
  }
  return [];
}

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY missing in Environment Variables');
      return NextResponse.json({ error: 'GROQ_API_KEY is not configured on the server environment.' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { businessName = 'Business', rating = 5, category = 'Business' } = body;

    const profile = getCategoryProfile(category);
    const allCategoryKeywords = [...new Set([...profile.parsedKeywords, ...profile.defaultKeywords])].sort(() => 0.5 - Math.random());
    const singleSelectedKeyword = allCategoryKeywords.length > 0 ? allCategoryKeywords[0] : "";
    const selectedPerspectives = [...profile.perspectives].sort(() => 0.5 - Math.random()).slice(0, 3);

    const prompt = `Generate 3 completely UNIQUE, natural Google reviews for "${businessName}" (Category: ${category}).

Rating: ${rating} Stars.
Category Type: "${profile.type.toUpperCase()}".

PERSPECTIVES:
1. ${selectedPerspectives[0]?.guide || 'General note'}
2. ${selectedPerspectives[1]?.guide || 'Service quality'}
3. ${selectedPerspectives[2]?.guide || 'Overall impression'}

STRICT RULES:
1. 100% PURE ENGLISH ONLY (No Hindi/Hinglish/transliterated words like bohot, accha, hai, gaya).
2. NO cliché starters like "Great experience" or "I visited". Vary all sentence starts.
3. Keep sentences short and daily-conversational. Avoid fancy words (seamless, impeccable).
4. Keyword to use once overall (optional): "${singleSelectedKeyword}".

Return a JSON object with a key "reviews" containing an array of 3 strings.
Example format: { "reviews": ["Review 1...", "Review 2...", "Review 3..."] }`;

    const chatCompletion = await createGroqCompletionWithRetry(groq, {
      messages: [
        {
          role: 'system',
          content: 'You generate short, realistic English Google reviews. Return output exclusively in JSON object format containing a "reviews" array.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.9,
      response_format: { type: "json_object" },
    });

    const content = chatCompletion?.choices[0]?.message?.content || '{}';
    let reviews = extractJsonArray(content);

    if (Array.isArray(reviews) && reviews.length > 0) {
      reviews = sanitizeReviewContent(reviews, profile.type);
    } else {
      reviews = [
        "Overall smooth experience with clear instructions.",
        "Quick service and helpful staff members.",
        "Satisfied with the overall experience here."
      ];
    }

    return NextResponse.json({ reviews });
  } catch (error: any) {
    console.error('Groq API Execution Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error generating reviews' },
      { status: 500 }
    );
  }
}