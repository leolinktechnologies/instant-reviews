export function playHindiVoiceInstruction(): void {
  // Safe check for Server-Side Rendering (SSR) and Browser Support
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  try {
    // Stop any currently playing audio to prevent overlapping or queued messages
    window.speechSynthesis.cancel();

    const text = "Kripya apne hisab se sahi review chuniye. Click karte hi yeh copy ho jayega, bas ise comment section me paste karke post kar dein.";
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = 'hi-IN';
    utterance.rate = 0.9; // Slightly slower speed for clearer pronunciation

    // Attempt to select an explicit Hindi voice if installed in user's browser/OS
    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find(
      (v) => v.lang === 'hi-IN' || v.lang.toLowerCase().startsWith('hi')
    );
    
    if (hindiVoice) {
      utterance.voice = hindiVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (error) {
    // Fail silently so it never interrupts the UI or review generation
    console.warn('Speech synthesis non-fatal error:', error);
  }
}