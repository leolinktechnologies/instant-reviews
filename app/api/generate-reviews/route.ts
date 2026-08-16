import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

function extractKeywordsFromCategory(category: string): string[] {
  if (!category) return [];
  return category.split(/[,/|]+/).map(item => item.trim()).filter(Boolean);
}

function getCategoryProfile(rawCategory: string) {
  const cat = (rawCategory || '').toLowerCase();
  const customKeywords = extractKeywordsFromCategory(rawCategory);

  // HEALTHCARE / CLINIC / DENTAL / HOSPITAL
  if (cat.includes('dental') || cat.includes('dentist') || cat.includes('clinic') || cat.includes('health') || cat.includes('hospital') || cat.includes('doctor') || cat.includes('physio') || cat.includes('eye')) {
    return {
      type: 'healthcare',
      defaultKeywords: ["checkup", "doctor consultation", "medicine", "reports", "treatment"],
      customKeywords,
      perspectives: [
        { role: "Direct Checkup", guide: "Simple review about getting a checkup or medicine." },
        { role: "Doctor Guidance", guide: "Mentions doctor explaining the issue in simple terms." },
        { role: "Regular Visit", guide: "Short note on going for a routine check or follow-up." },
        { role: "Friend or Relative Visit", guide: "Went with someone, easy experience." },
        { role: "Quick Casual Review", guide: "Very short 10-15 word review about good timing and polite staff." }
      ]
    };
  }

  // SECURITY / CCTV / SURVEILLANCE
  if (cat.includes('cctv') || cat.includes('security') || cat.includes('biometric') || cat.includes('fire alarm') || cat.includes('surveillance')) {
    return {
      type: 'security_tech',
      defaultKeywords: ["CCTV installation", "camera setup", "biometric machine", "fire alarm", "wiring"],
      customKeywords,
      perspectives: [
        { role: "Shop/Office Owner", guide: "Got CCTV or biometric installed at office or shop." },
        { role: "Home Owner", guide: "Installed cameras at home." },
        { role: "Service Work", guide: "Called them for repair or adding extra cameras." }
      ]
    };
  }

  // IT / TECH / AGENCIES
  if (cat.includes('it') || cat.includes('tech') || cat.includes('software') || cat.includes('digital') || cat.includes('web') || cat.includes('agency') || cat.includes('solution')) {
    return {
      type: 'b2b_tech',
      defaultKeywords: ["website work", "software setup", "bug fix", "project delivery"],
      customKeywords,
      perspectives: [
        { role: "Business Client", guide: "Hired them for website or software work." },
        { role: "New Client", guide: "Simple review about clear talk and timely completion." }
      ]
    };
  }

  // RESTAURANTS / CAFES / FOOD
  if (cat.includes('restaur') || cat.includes('food') || cat.includes('cafe') || cat.includes('bakery')) {
    return {
      type: 'food',
      defaultKeywords: ["food taste", "dinner", "seating", "fresh food"],
      customKeywords,
      perspectives: [
        { role: "First Time Visitor", guide: "Tried food based on friend's suggestion." },
        { role: "Family/Friends Group", guide: "Simple dinner or lunch review." }
      ]
    };
  }

  // GENERAL SERVICES
  return {
    type: 'general',
    defaultKeywords: ["in-store visit", "billing", "work quality", "delivery time"],
    customKeywords,
    perspectives: [
      { role: "Customer", guide: "Normal daily review about service and timing." }
    ]
  };
}

// Code-level filter to catch repetitive phrases and hard English words
function sanitizeRepetitivePhrases(reviews: string[], businessName: string): string[] {
  const commonRepetitiveRegex = [
    { pattern: /^visited\b/i, replacement: 'Went to' },
    { pattern: /the appointment system was\b/i, replacement: 'Booking was' },
    { pattern: /the appointment system\b/i, replacement: 'booking' },
    { pattern: /found this team\b/i, replacement: 'got their contact' },
    { pattern: /took my (son|daughter)\b/i, replacement: 'went with my family' },
    { pattern: /staff was nice\b/i, replacement: 'everyone was polite' },
  ];

  return reviews.map((rev) => {
    let cleaned = rev.trim();

    commonRepetitiveRegex.forEach(({ pattern, replacement }) => {
      cleaned = cleaned.replace(pattern, replacement);
    });

    return cleaned;
  });
}

export async function POST(req: Request) {
  try {
    const { businessName, rating = 5, category = 'Business' } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY missing in Environment Variables');
      return NextResponse.json({ error: 'Groq API Key not configured' }, { status: 500 });
    }

    const profile = getCategoryProfile(category);
    const allKeywords = [...new Set([...profile.customKeywords, ...profile.defaultKeywords])];
    const selectedKeywords = allKeywords.sort(() => 0.5 - Math.random()).slice(0, 2).join(", ");
    const selectedPerspectives = [...profile.perspectives].sort(() => 0.5 - Math.random()).slice(0, 3);

    const randomTemp = Number((0.90 + Math.random() * 0.08).toFixed(2));

    const starNuance = rating <= 4 
      ? "RATING IS 4 STARS: Mention 1 small normal thing like 'had to wait 10 mins extra' or 'parking was a bit small'." 
      : "RATING IS 5 STARS: Simple positive review like a normal happy customer.";

    const prompt = `Generate 3 completely DISTINCT, simple Indian English Google reviews for "${businessName}" (${category}).

Selected Rating: ${rating} Stars.
${starNuance}

OPTIONAL WORDS TO MIX (Do NOT force into all reviews):
${selectedKeywords}

PERSPECTIVES:
- Review 1 (${selectedPerspectives[0].role}): ${selectedPerspectives[0].guide}
- Review 2 (${selectedPerspectives[1].role}): ${selectedPerspectives[1].guide}
- Review 3 (${selectedPerspectives[2].role}): ${selectedPerspectives[2].guide}

STRICT LANGUAGE & STYLE RULES (INDIAN EASY ENGLISH):
1. USE SIMPLE DAILY INDIAN ENGLISH:
   - Use simple words like "doctor was very good", "proper checkup done", "no long wait", "camera setup done neatly", "price was fair", "good response".
   - DO NOT USE IELTS/ADVANCED WORDS like: "premises", "evaluation", "consultation", "prescribed", "accompanying", "exceptional", "seamless", "top-notch", "impeccable", "paramount", "proficiency".

2. ABSOLUTE BAN ON REPEATED PHRASES (DO NOT USE AT ALL):
   - "visited", "visited here", "the appointment system", "appointment system", "found this team", "took my son", "took my daughter", "brought my son", "staff was nice", "explained everything", "overall satisfied", "highly recommended", "top-notch", "smooth experience", "excellent service".

3. VARY ALL OPENING WORDS:
   - Start each review with completely different words.
   - NEVER start multiple reviews with "I", "The", "Went", "Had".

4. BUSINESS NAME RULES:
   - Mention "${businessName}" or "${category}" IN MAXIMUM 1 OUT OF 3 REVIEWS.
   - For others, use simple words like "here", "the doctor", "they", "this shop", or no pronoun at all.

5. CASUAL HUMAN ENDINGS:
   - End like real people: "Done in 20 mins", "No complaints", "Good experience", "Will go again if needed".

Return ONLY a valid raw JSON array containing exactly 3 strings. Example: ["Review 1 text...", "Review 2 text...", "Review 3 text..."]`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You write natural, simple Indian English Google reviews. You use simple daily spoken vocabulary and avoid fancy or high-level English words. Output ONLY a valid JSON array of strings.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: randomTemp,
    });

    const content = chatCompletion.choices[0]?.message?.content || '[]';
    
    const cleanedContent = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let reviews: string[] = JSON.parse(cleanedContent);

    if (Array.isArray(reviews)) {
      reviews = sanitizeRepetitivePhrases(reviews, businessName);

      reviews = reviews.map((rev) => {
        const words = rev.trim().split(/\s+/);
        if (words.length < 8) {
          return `${rev.trim()} Good experience overall.`;
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