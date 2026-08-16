import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// Category-Specific Context, Keywords & Real Customer Angles
function getCategoryProfile(category: string) {
  const cat = (category || '').toLowerCase();

  // 1. IT / TECH / SOFTWARE / DIGITAL AGENCIES / B2B
  if (cat.includes('it') || cat.includes('tech') || cat.includes('software') || cat.includes('digital') || cat.includes('web') || cat.includes('agency') || cat.includes('solution') || cat.includes('developer')) {
    return {
      type: 'b2b_tech',
      keywords: ["website redesign", "software development", "SEO campaign", "bug fixes", "cloud setup", "UI redesign", "project delivery", "technical support"],
      angles: [
        "delivered our project updates on time and communicated clearly",
        "fixed critical bugs on our portal without breaking other features",
        "helped automate our workflow and explained technical details simply",
        "pricing was transparent with no hidden charges at the end of the project"
      ],
      perspectives: [
        { role: "Business Owner / Client", guide: "Writing as a company/client who hired them for a project or IT support." },
        { role: "First-time project client", guide: "Mentions initial discussion, clear scope definition, and getting work started." },
        { role: "Long-term client", guide: "Mentions ongoing maintenance, regular support calls, or smooth monthly coordination." },
        { role: "Short direct client review", guide: "Brief (12-20 words). Practical feedback on project completion and communication." }
      ]
    };
  }

  // 2. HEALTHCARE / CLINIC / DENTAL / HOSPITAL
  if (cat.includes('dental') || cat.includes('dentist') || cat.includes('clinic') || cat.includes('health') || cat.includes('hospital') || cat.includes('doctor')) {
    return {
      type: 'healthcare',
      keywords: ["consultation", "treatment plan", "routine checkup", "braces", "aligners", "prescribed medicine", "reports checkup"],
      angles: [
        "doctor answered questions patiently without rushing the appointment",
        "brought my son/daughter for a routine checkup, staff made them feel at ease",
        "came in with my parents for consultation, clean premises and organized billing"
      ],
      perspectives: [
        { role: "First-time patient", guide: "Mentions initial hesitation or finding the clinic." },
        { role: "Family member / Parent", guide: "Brought son, daughter, or parents for checkup or treatment." },
        { role: "Follow-up patient", guide: "Going through an ongoing procedure or routine review." }
      ]
    };
  }

  // 3. RESTAURANTS / CAFES / FOOD
  if (cat.includes('restaur') || cat.includes('food') || cat.includes('cafe') || cat.includes('bakery')) {
    return {
      type: 'food',
      keywords: ["dine-in", "family dinner", "cold coffee", "thali", "seating area", "freshly prepared", "quick bite"],
      angles: [
        "went for dinner on a weekend, food served hot and fresh",
        "portion sizes were decent and taste was well balanced",
        "clean seating area, took around 15 mins for order during peak rush"
      ],
      perspectives: [
        { role: "First-time visitor", guide: "Tried a couple of dishes based on local recommendations." },
        { role: "Group / Family diner", guide: "Went out with friends or family for a meal." },
        { role: "Quick casual visitor", guide: "Brief review about food quality, pricing, and vibe." }
      ]
    };
  }

  // 4. GENERAL / RETAIL / LOCAL SERVICES (ALL OTHER CATEGORIES)
  return {
    type: 'general',
    keywords: ["in-store visit", "billing", "product demo", "work quality", "delivery time", "service inquiry"],
    angles: [
      "straightforward inquiry and clear explanation from staff",
      "got the work completed on schedule without unnecessary delays",
      "fair pricing and transparent communication throughout"
    ],
    perspectives: [
      { role: "First-time customer", guide: "Visited for service inquiry or purchase." },
      { role: "Regular customer", guide: "Consistently good service over multiple visits." },
      { role: "Short reviewer", guide: "Brief, direct feedback on speed and pricing." }
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
    const selectedKeywords = [...profile.keywords].sort(() => 0.5 - Math.random()).slice(0, 3).join(", ");
    const selectedAngles = [...profile.angles].sort(() => 0.5 - Math.random()).slice(0, 2).join("; ");
    const selectedPerspectives = [...profile.perspectives].sort(() => 0.5 - Math.random()).slice(0, 3);

    // Business context guardrails
    let contextConstraint = "Write from the perspective of a real customer or client.";
    if (profile.type === 'b2b_tech') {
      contextConstraint = "CRITICAL: This is an IT / Tech / Software Agency. Write strictly from a CLIENT, BUSINESS OWNER, or PROJECT MANAGER perspective. DO NOT mention family, kids, doctors, or healthcare. Focus on projects, IT support, deadlines, or communication.";
    }

    const starNuance = rating <= 4 
      ? "RATING IS 4 STARS: Include 1 minor realistic detail (e.g., 'parking was slightly tight', '10-min wait during peak hours', 'took a bit longer for final delivery')." 
      : "RATING IS 5 STARS: Positive, grounded experience without exaggerated fake praise.";

    const prompt = `Generate 3 organic, natural Google reviews for "${businessName}" (Category: ${category}).

Selected Rating: ${rating} Stars.
${starNuance}

CONTEXT GUARDRAILS:
${contextConstraint}

RELEVANT KEYWORDS (Spread naturally across reviews, do NOT stuff):
${selectedKeywords}

IDEAS & ANGLES:
${selectedAngles}

MANDATORY REVIEW PERSPECTIVES FOR THIS BATCH:
- Review 1 (${selectedPerspectives[0].role}): ${selectedPerspectives[0].guide}
- Review 2 (${selectedPerspectives[1].role}): ${selectedPerspectives[1].guide}
- Review 3 (${selectedPerspectives[2].role}): ${selectedPerspectives[2].guide}

STRICT WRITING RULES:
1. STRICTLY BANNED REPETITIVE AI PHRASES:
   - "staff was nice", "explained everything", "overall satisfied", "highly recommended", "world-class", "best experience", "smooth experience", "excellent service", "top-notch".

2. NO UNREALISTIC ADVERTISEMENT ENDINGS:
   - End naturally: "Got our work done on time", "Everything was completed as discussed", "Left satisfied", "Good service".

3. VARIETY & LENGTH:
   - Mix short (12-20 words) and medium (25-45 words) lengths. Avoid starting all reviews with "I".

Return ONLY a valid raw JSON array containing exactly 3 strings. Example: ["Review 1 text...", "Review 2 text...", "Review 3 text..."]`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You write raw, highly context-accurate Google reviews tailored strictly to the business category. Output ONLY a valid JSON array of strings.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.85,
    });

    const content = chatCompletion.choices[0]?.message?.content || '[]';
    
    const cleanedContent = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let reviews: string[] = JSON.parse(cleanedContent);

    // Fallback safety check
    if (Array.isArray(reviews)) {
      reviews = reviews.map((rev) => {
        const words = rev.trim().split(/\s+/);
        if (words.length < 8) {
          return `${rev.trim()} Decent experience with their service overall.`;
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