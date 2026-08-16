import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// Helper to extract custom sub-keywords if category string contains commas/slashes
function extractKeywordsFromCategory(category: string): string[] {
  if (!category) return [];
  // Split by comma, slash, or pipe
  const items = category.split(/[,/|]+/).map(item => item.trim()).filter(Boolean);
  return items;
}

// Category-Specific Profile, Guardrails & Context
function getCategoryProfile(rawCategory: string) {
  const cat = (rawCategory || '').toLowerCase();
  const customKeywords = extractKeywordsFromCategory(rawCategory);

  // 1. SECURITY SYSTEMS / CCTV / FIRE ALARM / BIOMETRIC
  if (cat.includes('cctv') || cat.includes('security') || cat.includes('biometric') || cat.includes('fire alarm') || cat.includes('surveillance')) {
    return {
      type: 'security_tech',
      defaultKeywords: ["CCTV camera setup", "biometric attendance machine", "fire alarm testing", "surveillance system", "wiring & installation", "door access control"],
      customKeywords,
      angles: [
        "installed the cameras neatly without visible messy wiring around the premises",
        "configured the mobile app for remote monitoring and explained how to check live footage",
        "came on time for the site survey and suggested proper camera placement spots",
        "biometric machine setup was completed smoothly and staff was trained on how to add users"
      ],
      perspectives: [
        { role: "Office / Shop Owner", guide: "Hired them to install security systems for business/store premises." },
        { role: "Home / Residential Client", guide: "Got CCTV or door security installed for home/apartment." },
        { role: "Maintenance / Service Client", guide: "Called them for repair, sensor check, or adding extra cameras." }
      ]
    };
  }

  // 2. IT / TECH / SOFTWARE / DIGITAL AGENCIES / B2B
  if (cat.includes('it') || cat.includes('tech') || cat.includes('software') || cat.includes('digital') || cat.includes('web') || cat.includes('agency') || cat.includes('solution') || cat.includes('developer')) {
    return {
      type: 'b2b_tech',
      defaultKeywords: ["website redesign", "software development", "SEO campaign", "bug fixes", "cloud setup", "UI redesign", "project delivery"],
      customKeywords,
      angles: [
        "delivered our project updates on time and communicated clearly",
        "fixed critical bugs on our portal without breaking other features",
        "helped automate our workflow and explained technical details simply"
      ],
      perspectives: [
        { role: "Business Client", guide: "Hired them for a project or IT support." },
        { role: "First-time project client", guide: "Mentions initial scope discussion and clear execution." },
        { role: "Ongoing client", guide: "Mentions regular maintenance and smooth support calls." }
      ]
    };
  }

  // 3. HEALTHCARE / CLINIC / DENTAL / HOSPITAL
  if (cat.includes('dental') || cat.includes('dentist') || cat.includes('clinic') || cat.includes('health') || cat.includes('hospital') || cat.includes('doctor')) {
    return {
      type: 'healthcare',
      defaultKeywords: ["consultation", "treatment plan", "routine checkup", "braces", "aligners", "prescribed medicine"],
      customKeywords,
      angles: [
        "doctor answered questions patiently without rushing",
        "brought my family member for a checkup, organized process",
        "clean premises and straightforward billing"
      ],
      perspectives: [
        { role: "First-time patient", guide: "Initial consultation or finding the clinic." },
        { role: "Family visit", guide: "Brought son, daughter, or parents for checkup." },
        { role: "Follow-up patient", guide: "Ongoing procedure or routine review." }
      ]
    };
  }

  // 4. RESTAURANTS / CAFES / FOOD
  if (cat.includes('restaur') || cat.includes('food') || cat.includes('cafe') || cat.includes('bakery')) {
    return {
      type: 'food',
      defaultKeywords: ["dine-in", "family dinner", "seating area", "freshly prepared", "quick bite"],
      customKeywords,
      angles: [
        "went for dinner, food was served hot and fresh",
        "portion sizes were decent and taste was balanced",
        "clean seating area, normal waiting time during rush"
      ],
      perspectives: [
        { role: "First-time visitor", guide: "Tried dishes based on local recommendations." },
        { role: "Group / Family diner", guide: "Meal with friends or family." }
      ]
    };
  }

  // 5. GENERAL SERVICES / RETAIL FALLBACK
  return {
    type: 'general',
    defaultKeywords: ["in-store visit", "billing", "work quality", "delivery time", "service inquiry"],
    customKeywords,
    angles: [
      "straightforward inquiry and clear explanation from staff",
      "got the work completed on schedule without unnecessary delays"
    ],
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
    
    // Combine custom keywords (from comma separated category) with default profile keywords
    const allKeywords = [...new Set([...profile.customKeywords, ...profile.defaultKeywords])];
    const selectedKeywords = allKeywords.sort(() => 0.5 - Math.random()).slice(0, 3).join(", ");
    const selectedAngles = [...profile.angles].sort(() => 0.5 - Math.random()).slice(0, 2).join("; ");
    const selectedPerspectives = [...profile.perspectives].sort(() => 0.5 - Math.random()).slice(0, 3);

    // Business context guardrails
    let contextConstraint = "Write from the perspective of a real customer or client.";
    if (profile.type === 'b2b_tech' || profile.type === 'security_tech') {
      contextConstraint = "CRITICAL: This is a B2B / Technical Service business. Write from a CLIENT, SHOP OWNER, or OFFICE MANAGER perspective. DO NOT mention doctors, patients, or family members. Focus on installation quality, technical work, service speed, or communication.";
    }

    const starNuance = rating <= 4 
      ? "RATING IS 4 STARS: Include 1 minor realistic detail (e.g., 'parking was slightly tight', '10-min wait during peak hours', 'took a bit longer for final setup')." 
      : "RATING IS 5 STARS: Positive, grounded experience without exaggerated fake praise.";

    const prompt = `Generate 3 organic, natural Google reviews for "${businessName}" (Category: ${category}).

Selected Rating: ${rating} Stars.
${starNuance}

CONTEXT GUARDRAILS:
${contextConstraint}

SERVICE KEYWORDS TO DISTRIBUTE NATURALLY (Do NOT force all into one review):
${selectedKeywords}

IDEAS & ANGLES:
${selectedAngles}

MANDATORY REVIEW PERSPECTIVES FOR THIS BATCH:
- Review 1 (${selectedPerspectives[0].role}): ${selectedPerspectives[0].guide}
- Review 2 (${selectedPerspectives[1].role}): ${selectedPerspectives[1].guide}
- Review 3 (${selectedPerspectives[2].role}): ${selectedPerspectives[2].guide}

STRICT FREQUENCY & NAME RULES:
1. BUSINESS NAME & CATEGORY FREQUENCY RULE:
   - Mention the exact business name ("${businessName}") or category name ("${category}") IN ONLY 1 REVIEW OUT OF THE 3.
   - For the remaining 2 reviews, DO NOT mention the business name or category word. Use natural words like "this team", "they", "this company", "the technicians", or "here".

2. STRICTLY BANNED REPETITIVE AI PHRASES:
   - "staff was nice", "explained everything", "overall satisfied", "highly recommended", "world-class", "best experience", "smooth experience", "excellent service", "top-notch".

3. ENDINGS MUST BE NATURAL:
   - End naturally like real humans: "Got the work completed on time", "Everything was setup properly", "No complaints", "Satisfied with the service".

4. VARIETY & LENGTH:
   - Mix short (12-20 words) and medium (25-40 words) lengths. Avoid starting all reviews with "I".

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
          return `${rev.trim()} Decent service quality overall.`;
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