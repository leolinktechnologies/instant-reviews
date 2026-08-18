export function playHindiVoiceInstruction(): void {
  // Safe check for Server-Side Rendering (SSR) and Browser Support
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  try {
    // Stop any currently playing audio to prevent overlapping or queued messages
    window.speechSynthesis.cancel();

    // Neutral Script: Guides the user to pick whichever review matches their experience
    const text = "Aapko jo review sabse sahi lage, use chuniye. Click karte hi yeh copy ho jayega, phir comment section me paste karke post kar dein.";
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = 'hi-IN';
    utterance.rate = 0.88; // Slightly relaxed pace for clarity
    utterance.pitch = 1.0;

    const speakWithBestVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      
      // Look specifically for Hindi (India) or English (India) voices for a natural accent
      const indianVoice = voices.find(
        (v) =>
          v.lang === 'hi-IN' ||
          v.lang === 'en-IN' ||
          v.lang.toLowerCase().includes('hi_in') ||
          v.name.toLowerCase().includes('hindi') ||
          v.name.toLowerCase().includes('india')
      );

      if (indianVoice) {
        utterance.voice = indianVoice;
      }

      window.speechSynthesis.speak(utterance);
    };

    // Browsers like Chrome load voices asynchronously; handle this gracefully
    const availableVoices = window.speechSynthesis.getVoices();
    if (availableVoices.length > 0) {
      speakWithBestVoice();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        speakWithBestVoice();
        window.speechSynthesis.onvoiceschanged = null; // Clean up handler
      };
    }
  } catch (error) {
    // Fail silently so UI interaction is never interrupted
    console.warn('Speech synthesis non-fatal error:', error);
  }
}