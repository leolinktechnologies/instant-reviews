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
      defaultKeywords: ["consultation", "treatment plan", "routine checkup", "braces", "aligners", "prescribed medicine", "reports review", "post-care guidance", "appointment booking"],
      customKeywords,
      perspectives: [
        { role: "Individual Patient (Self Visit)", guide: "Came in for personal checkup or symptom evaluation. Speaks purely from personal experience." },
        { role: "First-time Visitor", guide: "Mentions finding the place, smooth registration, or initial evaluation." },
        { role: "Follow-up / Ongoing Patient", guide: "Mentions returning for review, report analysis, or next step in treatment." },
        { role: "Random Family / Companion Visit", guide: "Occasional visit accompanied by someone (e.g., parent, child, or family member). Keep phrasing 100% natural and non-templated." },
        { role: "Short Casual Reviewer", guide: "Direct 12-18 word note about timing, doctor's explanation, and overall visit." }
      ]
    };
  }

  // SECURITY / CCTV / SURVEILLANCE
  if (cat.includes('cctv') || cat.includes('security') || cat.includes('biometric') || cat.includes('fire alarm') || cat.includes('surveillance')) {
    return {
      type: 'security_tech',
      defaultKeywords: ["CCTV camera setup", "biometric attendance machine", "fire alarm testing", "surveillance system", "wiring & installation", "door access control"],
      customKeywords,
      perspectives: [
        { role: "Office / Shop Owner", guide: "Installed security systems for business/store premises." },
        { role: "Home Client", guide: "CCTV or door security installed for home." },
        { role: "Service Client", guide: "Called for repair or extra camera addition." }
      ]
    };
  }

  // IT / TECH / AGENCIES
  if (cat.includes('it') || cat.includes('tech') || cat.includes('software') || cat.includes('digital') || cat.includes('web') || cat.includes('agency') || cat.includes('solution')) {
    return {
      type: 'b2b_tech',
      defaultKeywords: ["website redesign", "software development", "SEO campaign", "bug fixes", "cloud setup", "UI redesign", "project delivery"],
      customKeywords,
      perspectives: [
        { role: "Business Client", guide: "Hired them for a project or IT support." },
        { role: "First-time client", guide: "Mentions scope discussion and execution." },
        { role: "Ongoing client", guide: "Mentions regular maintenance and support." }
      ]
    };
  }

  // RESTAURANTS / CAFES / FOOD
  if (cat.includes('restaur') || cat.includes('food') || cat.includes('cafe') || cat.includes('bakery')) {
    return {
      type: 'food',
      defaultKeywords: ["dine-in", "family dinner", "seating area", "freshly prepared", "quick bite"],
      customKeywords,
      perspectives: [
        { role: "First-time visitor", guide: "Tried dishes based on local recommendations." },
        { role: "Group diner", guide: "Meal with friends or family." }
      ]
    };
  }

  // GENERAL SERVICES
  return {
    type: 'general',
    defaultKeywords: ["in-store visit", "billing", "work quality", "delivery time", "service inquiry"],
    customKeywords,
    perspectives: [
      { role: "First-time customer", guide: "Visited for inquiry or service." },
      { role: "Regular customer", guide: "Consistently good service over time." }
    ]
  };
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
    const selectedKeywords = allKeywords.sort(() => 0.5 - Math.random()).slice(0, 3).join(", ");
    const selectedPerspectives = [...profile.perspectives].sort(() => 0.5 - Math.random()).slice(0, 3);

    // Dynamic temperature seed to enforce maximum randomness
    const randomTemp = Number((0.85 + Math.random() * 0.12).toFixed(2));

    const starNuance = rating <= 4 
      ? "RATING IS 4 STARS: Include 1 minor realistic detail (e.g., 'parking was slightly tight', '10-min wait during peak hours', 'took a bit longer at the counter')." 
      : "RATING IS 5 STARS: Positive, grounded experience without exaggerated fake praise.";

    const prompt = `Generate 3 completely UNIQUE, organic, natural Google reviews for "${businessName}" (Category: ${category}).

Selected Rating: ${rating} Stars.
${starNuance}

SERVICE KEYWORDS TO MIX NATURALLY (Do NOT stuff or force into every review):
${selectedKeywords}

MANDATORY REVIEW PERSPECTIVES FOR THIS BATCH:
- Review 1 (${selectedPerspectives[0].role}): ${selectedPerspectives[0].guide}
- Review 2 (${selectedPerspectives[1].role}): ${selectedPerspectives[1].guide}
- Review 3 (${selectedPerspectives[2].role}): ${selectedPerspectives[2].guide}

STRICT ANTI-REPETITION & HUMAN DIVERSITY RULES:
1. BANNED CLONED PHRASES (STRICTLY FORBIDDEN):
   - DO NOT USE "found this team", "took my son", "took my daughter", "brought my son", "staff was nice", "explained everything", "overall satisfied", "highly recommended", "world-class", "best experience", "smooth experience", "excellent service", "top-notch".

2. VARY SENTENCE OPENINGS (DO NOT START WITH THE SAME WORDS):
   - Vary the start of each review! Examples of diverse starts:
     * Start with time: "Visited last Tuesday for...", "Had an appointment yesterday..."
     * Start with action/reason: "Needed a routine checkup...", "Got my reports reviewed here..."
     * Start with observation: "The clinic setup is clean...", "Booking an appointment was quick..."
     * Start with direct opinion: "Decent experience overall...", "Quite impressed with how..."
   - DO NOT start consecutive reviews with "I", "Took my...", or "Found this...".

3. ZERO TEMPLATED PATTERNS:
   - Do NOT construct reviews using the same formula [Person + Action + Praise]. Write each review in a completely different writing style, sentence length, and vocabulary.

4. NAME & CATEGORY FREQUENCY:
   - Mention "${businessName}" or "${category}" IN MAXIMUM 1 OUT OF 3 REVIEWS.
   - For others, use "here", "the doctor", "the clinic", "they", or no pronoun at all.

5. NATURAL ENDINGS:
   - Real humans end casually: "Got out in 30 mins", "No complaints", "Glad I got this checked", "Will return if needed".

Return ONLY a valid raw JSON array containing exactly 3 strings. Example: ["Review 1 text...", "Review 2 text...", "Review 3 text..."]`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You write completely distinct, non-repetitive, raw human Google reviews. NEVER reuse sentence structures or recurring phrases across outputs.',
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
      reviews = reviews.map((rev) => {
        const words = rev.trim().split(/\s+/);
        if (words.length < 8) {
          return `${rev.trim()} Decent experience with the consultation.`;
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