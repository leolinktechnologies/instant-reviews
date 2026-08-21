// Helper function to safely speak text in a natural Indian English accent (en-IN)
function speakInIndianAccent(text: string): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  try {
    // Cancel any ongoing speech so messages don't overlap
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN'; // Targets Indian English accent across iOS & Android
    utterance.rate = 0.95;    // Clear, natural pace
    utterance.pitch = 1.0;

    const speak = () => {
      const voices = window.speechSynthesis.getVoices();
      
      // Strict Indian Voice Matcher (Works reliably on iOS, macOS, Android, & Windows)
      const indianVoice = voices.find(
        (v) =>
          v.lang === 'en-IN' ||
          v.lang.toLowerCase().includes('en_in') ||
          v.name.toLowerCase().includes('india') ||
          v.name.toLowerCase().includes('rishi') || // iOS Indian Voice
          v.name.toLowerCase().includes('veena')   // iOS / macOS Indian Voice
      );

      if (indianVoice) {
        utterance.voice = indianVoice;
      }

      window.speechSynthesis.speak(utterance);
    };

    const availableVoices = window.speechSynthesis.getVoices();
    if (availableVoices.length > 0) {
      speak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        speak();
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  } catch (error) {
    console.warn('Speech synthesis error:', error);
  }
}

// 1. Called when user selects/clicks Star Rating
export function playSelectReviewInstruction(): void {
  speakInIndianAccent("Choose the review you find relevant.");
}

// 2. Called when user clicks/selects a Review card (to copy)
export function playPasteReviewInstruction(): void {
  speakInIndianAccent("Now just paste it to the comments.");
}

// 3. Backward compatibility (Prevents build crash if old name is imported)
export function playHindiVoiceInstruction(): void {
  playSelectReviewInstruction();
}