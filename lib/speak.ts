export function playHindiVoiceInstruction(): void {
  // Safe check for Server-Side Rendering (SSR) and Browser Support
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  try {
    // Stop any currently playing audio to prevent overlapping or queued messages
    window.speechSynthesis.cancel();

    // Short, direct, and neutral script
    const text = "Aapko jo bhi review aapke experience se relevant lagta hai click kijiye, aur bas comment me paste karke post kar dijiye.";
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = 'hi-IN';
    utterance.rate = 0.9; // Clear, direct pace
    utterance.pitch = 1.0;

    const speakWithBestVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      
      // Target Indian accent voices (Hindi or English India fallback)
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

    // Handle asynchronous voice loading in browsers like Chrome
    const availableVoices = window.speechSynthesis.getVoices();
    if (availableVoices.length > 0) {
      speakWithBestVoice();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        speakWithBestVoice();
        window.speechSynthesis.onvoiceschanged = null; // Clean up listener
      };
    }
  } catch (error) {
    // Fail silently to ensure UI interaction is never interrupted
    console.warn('Speech synthesis non-fatal error:', error);
  }
}