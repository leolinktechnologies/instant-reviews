import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// Retry helper for handling Groq 429 Rate Limit errors with exponential backoff
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

// Helper to extract and clean comma/slash separated keywords from category input
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

  // 1. HEALTHCARE / CLINIC / DENTAL / HOSPITAL
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

  // 2. SECURITY / CCTV / SURVEILLANCE
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

  // 3. IT / TECH / AGENCIES
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

  // 4. RESTAURANTS / FOOD
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

  // 5. GENERAL SERVICES
  return {
    type: 'general',
    defaultKeywords: ["in-store visit", "billing", "work quality", "delivery time"],
    parsedKeywords,
    perspectives: [
      { role: "Customer", guide: "Simple review about general service and timing." }
    ]
  };
}

// Post-processing Sanitizer to remove AI structural leaks & repetitive phrases
function sanitizeReviewContent(reviews: string[], categoryType: string): string[] {
  const commonBannedPhrases = [
    { pattern: /^doctor was good\b/i, replacement: 'Clear advice provided' },
    { pattern: /^visited\b/i, replacement: 'Went for' },
    { pattern: /the appointment system\b/i, replacement: 'the booking' },
    { pattern: /found this team\b/i, replacement: 'got their number' },
    { pattern: /staff was nice\b/i, replacement: 'everyone was polite' },
  ];

  return reviews.map((rev) => {
    let cleaned = rev.trim();

    if (categoryType === 'healthcare') {
      cleaned = cleaned.replace(/\b(cctv|camera|biometric|wiring|installation)\b/gi, 'treatment');
    }

    commonBannedPhrases.forEach(({ pattern, replacement }) => {
      cleaned = cleaned.replace(pattern, replacement);
    });

    return cleaned;
  });
}

// Robust JSON extraction helper
function extractJsonArray(rawText: string): string[] {
  try {
    return JSON.parse(rawText);
  } catch {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        console.error('Regex JSON array extraction failed');
      }
    }
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const { businessName, rating = 5, category = 'Business' } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY missing in Environment Variables');
      return NextResponse.json({ error: 'Groq API Key not configured' }, { status: 500 });
    }

    const profile = getCategoryProfile(category);
    
    const allCategoryKeywords = [...new Set([...profile.parsedKeywords, ...profile.defaultKeywords])].sort(() => 0.5 - Math.random());
    const singleSelectedKeyword = allCategoryKeywords.length > 0 ? allCategoryKeywords[0] : "";

    const selectedPerspectives = [...profile.perspectives].sort(() => 0.5 - Math.random()).slice(0, 3);

    const randomTemp = Number((0.98 + Math.random() * 0.12).toFixed(2));
    const uniqueSessionSeed = `session_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const starNuance = rating <= 4 
      ? "RATING IS 4 STARS: Include 1 small realistic detail (e.g. 'had to wait 10 mins extra', 'parking area was small', 'counter was a bit busy')." 
      : "RATING IS 5 STARS: Simple positive experience from a real everyday Indian customer.";

    // PROMPT WITH FREEDOM IN OPENINGS:
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
- Review 1 (${selectedPerspectives[0].role}): ${selectedPerspectives[0].guide}
- Review 2 (${selectedPerspectives[1].role}): ${selectedPerspectives[1].guide}
- Review 3 (${selectedPerspectives[2].role}): ${selectedPerspectives[2].guide}

STRICT HUMAN-WRITING & OPENING FREEDOM:
1. NATURAL OPENINGS & HIGH VARIETY:
   - Let each review start completely naturally in its own unique way.
   - DO NOT follow a fixed starting template. Each of the 3 reviews MUST start with a totally different word and sentence structure.
   - Avoid generic cliché starters like "Great experience", "I went to", or "Visited here".

2. NATURAL INDIAN ENGLISH STYLE:
   - Simple daily Indian English. Short sentences, unpolished human typing.
   - NO IELTS/fancy words (avoid: "seamless", "impeccable", "top-notch", "exceptional", "proficiency", "consultation").

3. BUSINESS NAME RULE:
   - Mention "${businessName}" IN MAXIMUM 1 OUT OF 3 REVIEWS.
   - For the other 2 reviews, use simple words like "here", "they", "this place", or no name at all.

Return ONLY a valid raw JSON array containing exactly 3 strings. Example: ["Review 1 text...", "Review 2 text...", "Review 3 text..."]`;

    const chatCompletion = await createGroqCompletionWithRetry(groq, {
      messages: [
        {
          role: 'system',
          content: 'You generate raw, casual, human-written Indian Google reviews. Output ONLY a valid JSON array of strings.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.1-8b-instant',
      temperature: randomTemp,
    });

    const content = chatCompletion?.choices[0]?.message?.content || '[]';
    
    const cleanedContent = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let reviews: string[] = extractJsonArray(cleanedContent);

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
    console.error('Groq API Error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Failed to generate reviews via Groq';
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}