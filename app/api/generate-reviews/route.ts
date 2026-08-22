import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// Cache available model IDs in memory per container runtime
let cachedModelId: string | null = null;

// 10 Universal Fallback Reviews suitable for ALL business types
const UNIVERSAL_FALLBACK_REVIEWS = [
  "Fantastic experience with {BUSINESS_NAME}! The entire process was smooth, highly professional, and stress-free. The team genuinely cares about delivering top-notch quality. Highly recommended!",
  "Exceptional quality and outstanding customer service at {BUSINESS_NAME}. Everyone was extremely welcoming, knowledgeable, and attentive to every detail. Will definitely be returning!",
  "I am extremely impressed with the level of service provided by {BUSINESS_NAME}. They exceeded my expectations in every way. Prompt, reliable, and super friendly team!",
  "Hands down one of the best experiences I've had! {BUSINESS_NAME} operates with absolute honesty and professionalism. You can tell they take true pride in their work. 10/10!",
  "From start to finish, working with {BUSINESS_NAME} was an absolute pleasure. Great communication, clear guidance, and unmatched quality. Five stars all the way!",
  "A truly reliable and top-tier establishment! {BUSINESS_NAME} consistently delivers excellence with a warm and friendly attitude. I wouldn't hesitate to recommend them to family and friends.",
  "Remarkable attention to detail and customer care at {BUSINESS_NAME}. They went above and beyond to ensure everything was handled perfectly. Very satisfied with the result!",
  "Quick, seamless, and completely hassle-free experience with {BUSINESS_NAME}. The entire staff was courteous and incredibly skilled. So glad I chose them!",
  "First-class service from a wonderful team at {BUSINESS_NAME}! They answered all my questions patiently and ensured I was 100% satisfied. Truly a standard for excellence.",
  "Consistently amazing service from {BUSINESS_NAME}! Every single interaction has been pleasant, efficient, and thoroughly professional. Truly deserving of a 5-star rating!"
];

// Helper function to pick 3 random fallback reviews formatted with business name
function getFallbackReviews(businessName: string): string[] {
  const shuffled = [...UNIVERSAL_FALLBACK_REVIEWS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3).map((review) =>
    review.replace(/{BUSINESS_NAME}/g, businessName || 'this business')
  );
}

async function getAvailableModel(): Promise<string> {
  if (cachedModelId) return cachedModelId;

  // Strict list of allowed standard text LLM models on Groq
  const allowedTextModels = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama-3.1-70b-versatile',
    'mixtral-8x7b-32768',
    'gemma2-9b-it'
  ];

  try {
    const modelsList = await groq.models.list();
    const availableIds = modelsList.data.map((m: any) => m.id);

    // 1. Pick first matching preferred text model
    for (const model of allowedTextModels) {
      if (availableIds.includes(model)) {
        cachedModelId = model;
        return model;
      }
    }

    // 2. Strict Filter out non-text models (audio, vision, guard, orpheus, tts, etc.)
    const dynamicModel = availableIds.find((id: string) => {
      const lower = id.toLowerCase();
      return (
        !lower.includes('whisper') &&
        !lower.includes('vision') &&
        !lower.includes('guard') &&
        !lower.includes('orpheus') &&
        !lower.includes('tts') &&
        !lower.includes('audio') &&
        !lower.includes('embed')
      );
    });

    if (dynamicModel) {
      cachedModelId = dynamicModel;
      return dynamicModel;
    }
  } catch (err) {
    console.warn('Failed to fetch dynamic model list from Groq:', err);
  }

  // Safe default fallback model
  return 'llama-3.1-8b-instant';
}

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
      defaultKeywords: ["checkup", "medicine", "reports", "consultation", "treatment", "doctor advice", "blood test", "health check"],
      parsedKeywords,
      perspectives: [
        { role: "Symptom checkup", guide: "Focus on getting a clear health diagnosis or medical advice." },
        { role: "Report discussion", guide: "Discuss getting test reports explained in detail by the staff." },
        { role: "Routine follow up", guide: "Mention returning for a quick routine follow-up check." },
        { role: "Polite staff experience", guide: "Focus on how polite, patient, and welcoming the staff/doctors were." },
        { role: "First visit experience", guide: "Talk about finding the clinic easily and having a smooth registration process." }
      ]
    };
  }

  // 2. SECURITY / CCTV / SURVEILLANCE
  if (cat.includes('cctv') || cat.includes('security') || cat.includes('biometric') || cat.includes('fire alarm') || cat.includes('surveillance')) {
    return {
      type: 'security_tech',
      defaultKeywords: ["CCTV setup", "biometric attendance", "fire alarm", "wiring work", "camera angle", "security check"],
      parsedKeywords,
      perspectives: [
        { role: "Shop or Office Owner", guide: "Got security cameras or attendance system setup for shop/office." },
        { role: "Home client", guide: "Focus on installing security cameras for home safety." },
        { role: "Service & Repair", guide: "Called for fixing camera feed or upgrading an old security setup." }
      ]
    };
  }

  // 3. IT / TECH / AGENCIES
  if (cat.includes('it') || cat.includes('tech') || cat.includes('software') || cat.includes('digital') || cat.includes('web') || cat.includes('agency')) {
    return {
      type: 'b2b_tech',
      defaultKeywords: ["website work", "software setup", "bug fixing", "project delivery", "UI design", "tech support"],
      parsedKeywords,
      perspectives: [
        { role: "Business Client", guide: "Detail how they solved a complex technical issue or website layout." },
        { role: "Project update", guide: "Focus on clear communication and on-time project milestones." }
      ]
    };
  }

  // 4. RESTAURANTS / FOOD
  if (cat.includes('restaur') || cat.includes('food') || cat.includes('cafe') || cat.includes('bakery')) {
    return {
      type: 'food',
      defaultKeywords: ["food taste", "dinner", "seating", "fresh food", "ambiance", "friendly service"],
      parsedKeywords,
      perspectives: [
        { role: "Diner", guide: "Comment on food freshness, taste, and serving speed." },
        { role: "Casual visitor", guide: "Mention seating ambiance, cleanliness, and parking accessibility." }
      ]
    };
  }

  // 5. GENERAL SERVICES
  return {
    type: 'general',
    defaultKeywords: ["in-store visit", "billing", "work quality", "delivery time", "customer support"],
    parsedKeywords,
    perspectives: [
      { role: "Customer", guide: "Simple review about general service quality, timing, and ease of transaction." },
      { role: "First Time Visitor", guide: "Highlight how easy it was to deal with them and overall satisfaction." }
    ]
  };
}

// Post-processing Sanitizer to remove leaks & any non-English/Hinglish remnants
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

// Robust JSON extraction helper supporting raw arrays or JSON objects
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
  let businessName = 'Business';

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    businessName = body.businessName || 'Business';
    const { rating = 5, category = 'Business' } = body;

    if (!process.env.GROQ_API_KEY) {
      console.warn('GROQ_API_KEY missing in Environment Variables. Using fallback reviews.');
      return NextResponse.json({ reviews: getFallbackReviews(businessName) });
    }

    const profile = getCategoryProfile(category);
    
    const allCategoryKeywords = [...new Set([...profile.parsedKeywords, ...profile.defaultKeywords])].sort(() => 0.5 - Math.random());
    const singleSelectedKeyword = allCategoryKeywords.length > 0 ? allCategoryKeywords[0] : "";

    const selectedPerspectives = [...profile.perspectives].sort(() => 0.5 - Math.random()).slice(0, 3);
    const p1 = selectedPerspectives[0] ? `${selectedPerspectives[0].role}: ${selectedPerspectives[0].guide}` : "Detailed experience with customer service";
    const p2 = selectedPerspectives[1] ? `${selectedPerspectives[1].role}: ${selectedPerspectives[1].guide}` : "Quick and enthusiastic recommendation";
    const p3 = selectedPerspectives[2] ? `${selectedPerspectives[2].role}: ${selectedPerspectives[2].guide}` : "Specific experience about timing and process";

    const randomTemp = Number((0.85 + Math.random() * 0.15).toFixed(2));
    const uniqueSessionSeed = `session_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const starNuance = rating <= 4 
      ? "RATING IS 4 STARS: Mention 1 tiny realistic detail (e.g. slight wait time or busy counter) but stay positive." 
      : "RATING IS 5 STARS: Full 5-star rating with enthusiastic, genuine feedback.";

    const prompt = `Generate 3 completely UNIQUE, realistic, human-written Google reviews for "${businessName}" (Category: ${category}).
Seed: ${uniqueSessionSeed}

Rating: ${rating} Stars.
${starNuance}

LENGTH REQUIREMENT:
- Each review MUST be between 20 to 40 words (2 to 3 full sentences).
- Do NOT generate 1-line or 5-word generic reviews.

DISTINCT FORMATTING FOR EACH REVIEW:
- Review 1: Focus on perspective -> ${p1}
- Review 2: Focus on perspective -> ${p2}
- Review 3: Focus on perspective -> ${p3}

VARIETY & REPETITION RULES:
- Each of the 3 reviews MUST start with a completely different sentence structure and word.
- NEVER start multiple reviews with "I had", "Great place", or "Visited".
- Mention business name "${businessName}" IN MAXIMUM 1 OUT OF THE 3 REVIEWS.
- Keyword "${singleSelectedKeyword}" can be used in AT MOST 1 review.

STRICT LANGUAGE & HUMAN-WRITING RULES:
1. 100% PURE ENGLISH ONLY (No Hinglish/Hindi words like 'bohot', 'accha', etc.).
2. Use casual everyday words. Avoid formal artificial jargon like "seamless", "impeccable", or "exceptional".

Return ONLY a valid JSON array of 3 strings. Example: ["Review 1...", "Review 2...", "Review 3..."]`;

    const activeModel = await getAvailableModel();

    const chatCompletion = await createGroqCompletionWithRetry(groq, {
      messages: [
        {
          role: 'system',
          content: 'You output only raw, valid JSON arrays containing 3 unique, detailed English reviews.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: activeModel,
      temperature: randomTemp,
      presence_penalty: 0.6,
      frequency_penalty: 0.5,
    });

    const content = chatCompletion?.choices[0]?.message?.content || '[]';
    
    const cleanedContent = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let reviews: string[] = extractJsonArray(cleanedContent);

    if (Array.isArray(reviews) && reviews.length > 0) {
      reviews = sanitizeReviewContent(reviews, profile.type);
    } else {
      reviews = getFallbackReviews(businessName);
    }

    return NextResponse.json({ reviews });
  } catch (error: unknown) {
    console.error('Groq API / Execution Error, switching to universal fallbacks:', error);
    cachedModelId = null;

    // Direct fallback response for Rate Limit / Restricted Model errors
    return NextResponse.json({ reviews: getFallbackReviews(businessName) });
  }
}