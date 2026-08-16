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
      defaultKeywords: ["consultation", "treatment plan", "routine checkup", "braces", "aligners", "prescribed medicine", "reports review", "post-care guidance"],
      customKeywords,
      perspectives: [
        { role: "Symptom / Health Concern", guide: "Discuss a specific concern or reason for consulting the doctor without standard clinic clichés." },
        { role: "First-hand Consultation", guide: "Focus purely on doctor interaction, diagnosis clarity, or medication guidance." },
        { role: "Routine Check", guide: "A casual, brief note on a regular follow-up or scheduled checkup." },
        { role: "Accompanying Someone", guide: "Came along with family or a friend. Talk casually about the atmosphere or overall experience." },
        { role: "Short Casual Reviewer", guide: "Direct, unpolished 10-18 word summary of the visit." }
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
        { role: "First-time diner", guide: "Tried dishes based on local recommendations." },
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

// Code-level post-processing filter to catch repetitive phrases
function sanitizeRepetitivePhrases(reviews: string[], businessName: string): string[] {
  const commonRepetitiveRegex = [
    { pattern: /^visited\b/i, replacement: 'Went in' },
    { pattern: /the appointment system was\b/i, replacement: 'Booking was' },
    { pattern: /the appointment system\b/i, replacement: 'the booking process' },
    { pattern: /found this team\b/i, replacement: 'came across them' },
    { pattern: /took my (son|daughter)\b/i, replacement: 'came with my kid' },
    { pattern: /staff was nice\b/i, replacement: 'everyone was helpful' },
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

    // Dynamic temperature up to 0.95 for maximum lexical diversity
    const randomTemp = Number((0.90 + Math.random() * 0.08).toFixed(2));

    const starNuance = rating <= 4 
      ? "RATING IS 4 STARS: Include 1 tiny realistic detail (e.g., 'parking spot was tight', 'waited 10 mins extra', 'counter was slightly crowded')." 
      : "RATING IS 5 STARS: Grounded positive experience without fake, dramatic praise.";

    const prompt = `Generate 3 completely DISTINCT, raw, organic Google reviews for "${businessName}" (${category}).

Selected Rating: ${rating} Stars.
${starNuance}

OPTIONAL CONTEXT KEYWORDS (Use at most 1 in the whole batch):
${selectedKeywords}

PERSPECTIVES:
- Review 1 (${selectedPerspectives[0].role}): ${selectedPerspectives[0].guide}
- Review 2 (${selectedPerspectives[1].role}): ${selectedPerspectives[1].guide}
- Review 3 (${selectedPerspectives[2].role}): ${selectedPerspectives[2].guide}

STRICT LEXICAL DIVERSITY & ANTI-REPETITION LAWS:
1. ABSOLUTE BAN ON REPEATED PHRASES (DO NOT USE ANY OF THESE AT ALL):
   - "visited", "visited here", "the appointment system", "appointment system", "found this team", "took my son", "took my daughter", "brought my son", "staff was nice", "explained everything", "overall satisfied", "highly recommended", "top-notch", "smooth experience", "excellent service".

2. VARY ALL OPENING WORDS:
   - Every single review MUST begin with a totally different word and grammar structure.
   - NEVER start two reviews with the same word ("I", "The", "Had", "Went").

3. UNPREDICTABLE SYNTAX:
   - Review 1: Focus on the actual issue/reason for visit.
   - Review 2: Focus on time spent, atmosphere, or report discussion.
   - Review 3: Short 12-word casual remark.

4. BUSINESS NAME RULES:
   - Mention "${businessName}" or "${category}" IN MAXIMUM 1 OUT OF 3 REVIEWS.
   - For others, use natural references like "here", "the doctor", "they", or no pronoun at all.

Return ONLY a valid raw JSON array containing exactly 3 strings. Example: ["Review 1 text...", "Review 2 text...", "Review 3 text..."]`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You generate human Google reviews with 100% unique vocabulary. You NEVER repeat multi-word phrases or stock template sentences across reviews. Output ONLY a valid JSON array of strings.',
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