import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// Helper: Split and randomize comma-separated category keywords
function parseCategoriesAndKeywords(rawCategory: string) {
  if (!rawCategory) return { activeCategory: 'General Business', randomKeywords: [] };

  const parts = rawCategory
    .split(/[,/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  // Shuffle keywords dynamically on every call
  const shuffled = [...parts].sort(() => Math.random() - 0.5);
  const activeCategory = shuffled[0] || 'Business';
  const randomKeywords = shuffled.slice(0, 3);

  return { activeCategory, randomKeywords };
}

// Dynamic Niche Profiler
function getDynamicCategoryProfile(rawCategory: string) {
  const cat = rawCategory.toLowerCase();

  if (cat.includes('dental') || cat.includes('dentist') || cat.includes('clinic') || cat.includes('health') || cat.includes('hospital') || cat.includes('doctor') || cat.includes('physio') || cat.includes('eye') || cat.includes('skin')) {
    return {
      domain: 'Healthcare & Medical',
      nicheTerms: ['checkup', 'doctor', 'treatment', 'staff behavior', 'cleanliness', 'consultation'],
      styles: [
        'Routine checkup experience, short & neat',
        'Doctor explained the issue patiently without hurry',
        'Quick visit with family member, smooth overall process'
      ]
    };
  }

  if (cat.includes('cctv') || cat.includes('security') || cat.includes('biometric') || cat.includes('alarm') || cat.includes('surveillance') || cat.includes('camera')) {
    return {
      domain: 'Security & Tech Hardware',
      nicheTerms: ['camera setup', 'wiring', 'biometric unit', 'office installation', 'neat work'],
      styles: [
        'Installed at home/shop, clear video quality and quick fitting',
        'Technician came on time, clean wiring done',
        'Fair pricing for security setup'
      ]
    };
  }

  if (cat.includes('restaur') || cat.includes('food') || cat.includes('cafe') || cat.includes('bakery') || cat.includes('sweets') || cat.includes('hotel')) {
    return {
      domain: 'Food & Dining',
      nicheTerms: ['food taste', 'seating', 'service', 'fresh items', 'ambience'],
      styles: [
        'Went for dinner with friends, nice taste',
        'Tried their famous dish, totally worth it',
        'Quick bite, clean seating area'
      ]
    };
  }

  if (cat.includes('salon') || cat.includes('beauty') || cat.includes('spa') || cat.includes('hair') || cat.includes('parlour')) {
    return {
      domain: 'Salon & Grooming',
      nicheTerms: ['haircut', 'glowing skin', 'polite staff', 'relaxing setup', 'service'],
      styles: [
        'Got haircut done, very clean finish',
        'Friendly staff, took proper care',
        'Went for routine grooming, good prices'
      ]
    };
  }

  // Default fallback for any custom service/category
  return {
    domain: 'Local Business & Services',
    nicheTerms: ['service', 'response', 'work done', 'timely delivery', 'fair charges'],
    styles: [
      'Very helpful team, completed work smoothly',
      'Good experience, reasonable rates',
      'Quick response and polite nature'
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

    const { activeCategory, randomKeywords } = parseCategoriesAndKeywords(category);
    const profile = getDynamicCategoryProfile(category);

    // Combine custom keywords passed in input with standard domain keywords
    const keywordPool = [...new Set([...randomKeywords, ...profile.nicheTerms])]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .join(', ');

    // Randomize temperature slightly to break output predictability
    const randomTemp = Number((0.92 + Math.random() * 0.12).toFixed(2));
    const randomSeed = Math.floor(Math.random() * 100000);

    const starNuance = rating <= 4 
      ? "RATING IS 4 STARS: Mention 1 tiny practical observation (e.g., 'parking took 5 mins', 'had to wait short while', 'slightly crowded inside')." 
      : "RATING IS 5 STARS: Natural positive feedback without over-exaggerated praise.";

    const prompt = `Generate 3 completely UNIQUE, realistic Google reviews written by different Indian customers for "${businessName}" (${activeCategory}).

Context / Focus Keywords (Use lightly if relevant, do NOT force all):
${keywordPool}

Rating Context: ${rating} Stars.
${starNuance}

Target Vibe Profiles for the 3 Reviews:
- Review 1: Very short & direct (6 to 12 words max). Real human casual style.
- Review 2: Moderate detail (14 to 22 words). Focuses on staff behavior or work completion.
- Review 3: Natural conversational style (10 to 18 words). Focuses on overall satisfaction or recommendation.

HUMAN-LIKE ORGANIC RULES (CRITICAL):
1. LANGUAGE: Natural daily spoken Indian English.
   - Allowed terms: "good work", "doctor was nice", "proper checkup", "neat setup", "pricing reasonable", "came on time", "satisfied".
   - BANNED ADVANCED / FANCY WORDS: "premises", "exceptional", "impeccable", "paramount", "proficiency", "top-notch", "seamless", "exemplary", "consultation", "prescribed".
   
2. NO REPETITIVE PATTERNS:
   - DO NOT start reviews with identical phrases like "Visited here", "The appointment system", "I went to", "Took my daughter".
   - DO NOT end all reviews with "Highly recommended" or "Will visit again". Mix variations naturally (e.g., "Good job", "No hassle", "Nice overall", "Recommended.").

3. NAME MENTION RULE:
   - Mention "${businessName}" in ONLY 1 out of the 3 reviews (or skip it entirely in some calls). Use "they", "this place", "the team", "doctor", or direct sentences.

4. REALISTIC TEXT VARIATION:
   - Allow natural human writing quirks (e.g., lowercase start in short reviews, simple sentence structures, avoiding formal corporate tone).

Random Session ID: ${randomSeed}

Return ONLY a valid JSON array of 3 plain strings.
Example output format: ["Review 1...", "Review 2...", "Review 3..."]`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are an authentic Indian Google reviewer generator. You output ONLY a valid JSON array of 3 natural, human-like reviews using simple daily language.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: randomTemp,
      top_p: 0.95,
    });

    const content = chatCompletion.choices[0]?.message?.content || '[]';

    const cleanedContent = content
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let reviews: string[] = JSON.parse(cleanedContent);

    // Clean up whitespace without adding generic static footers
    if (Array.isArray(reviews)) {
      reviews = reviews.map((rev) => rev.trim());
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