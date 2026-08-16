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
        { role: "Direct Symptom / Evaluation", guide: "Focus on coming in for a specific issue, symptom, or routine checkup. Speak naturally about the consultation." },
        { role: "Process / Appointment Experience", guide: "Focus on booking, waiting time, or getting reports/prescriptions explained clearly." },
        { role: "Solo Personal Care", guide: "Speaking strictly as an individual patient managing their own appointment." },
        { role: "Accompanying Family Member", guide: "Came along with family or a relative. Focus on clean clinic environment and clear guidance." },
        { role: "Short Practical Feedback", guide: "Direct 12-18 word feedback on doctor's explanation and overall visit." }
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

// Function to clean and sanitize repetitive opening words like "Visited"
function sanitizeReviewOpenings(reviews: string[], businessName: string): string[] {
  return reviews.map((rev) => {
    let cleaned = rev.trim();
    
    // Check if the review starts with "Visited" or "Visited here"
    if (/^visited\b/i.test(cleaned)) {
      // Replace starting "Visited [Business Name]" or "Visited here" with varied natural hooks
      cleaned = cleaned
        .replace(/^visited\s+here\s+(last\s+\w+|yesterday|recently)\b/i, 'Had an appointment $1')
        .replace(/^visited\s+here\b/i, 'Came in for a checkup')
        .replace(new RegExp(`^visited\\s+${businessName}\\b`, 'gi'), 'Had my appointment')
        .replace(/^visited\b/i, 'Went in');
    }

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
    const selectedKeywords = allKeywords.sort(() => 0.5 - Math.random()).slice(0, 3).join(", ");
    const selectedPerspectives = [...profile.perspectives].sort(() => 0.5 - Math.random()).slice(0, 3);

    // Highly randomized temperature to break repetition
    const randomTemp = Number((0.88 + Math.random() * 0.10).toFixed(2));

    const starNuance = rating <= 4 
      ? "RATING IS 4 STARS: Include 1 minor realistic detail (e.g., 'parking space was tight', 'a 10-minute wait during rush hour', 'reception counter was a bit busy')." 
      : "RATING IS 5 STARS: Grounded positive experience without fake exaggeration.";

    const prompt = `Generate 3 completely DISTINCT, organic Google reviews for "${businessName}" (Category: ${category}).

Selected Rating: ${rating} Stars.
${starNuance}

KEYWORDS TO DISTRIBUTE NATURALLY (Do NOT force into every review):
${selectedKeywords}

PERSPECTIVES FOR THIS BATCH:
- Review 1 (${selectedPerspectives[0].role}): ${selectedPerspectives[0].guide}
- Review 2 (${selectedPerspectives[1].role}): ${selectedPerspectives[1].guide}
- Review 3 (${selectedPerspectives[2].role}): ${selectedPerspectives[2].guide}

STRICT OPENING & SENTENCE VARIETY RULES (NEVER REPEAT OPENINGS):
1. ABSOLUTE BAN ON THE WORD "VISITED" AT THE START:
   - DO NOT START ANY REVIEW WITH "Visited...", "Visited here...", OR "Visited ${businessName}...". This word is STRICTLY BANNED as an opening word!

2. ROTATE OPENING STYLES ACROSS THE 3 REVIEWS:
   - Review 1 MUST start with a condition, issue, or reason (e.g., "Needed a second opinion on...", "Had a toothache since two days...", "Got my routine checkup done...")
   - Review 2 MUST start with an observation or clinic note (e.g., "The appointment system was smooth...", "Clean premises and polite reception...", "Dr. explained everything patiently...")
   - Review 3 MUST start directly with time or a short verdict (e.g., "Came in yesterday around...", "Decent experience overall...", "Quick 20-minute consultation...")

3. BANNED REPETITIVE PHRASES:
   - "found this team", "took my son", "took my daughter", "brought my son", "staff was nice", "explained everything", "overall satisfied", "highly recommended", "world-class", "best experience", "smooth experience", "excellent service", "top-notch".

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
          content: 'You write raw, non-repetitive, unpolished Google reviews. You NEVER start reviews with the word "Visited". Output ONLY a valid JSON array of strings.',
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

    // Apply safety sanitization filter to catch and convert any accidental "Visited" openings
    if (Array.isArray(reviews)) {
      reviews = sanitizeReviewOpenings(reviews, businessName);

      reviews = reviews.map((rev) => {
        const words = rev.trim().split(/\s+/);
        if (words.length < 8) {
          return `${rev.trim()} Decent experience with the doctor's consultation.`;
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