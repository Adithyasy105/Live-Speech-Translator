const sourceTextEl = document.getElementById('sourceText');
const sourceLangEl = document.getElementById('sourceLang');
const targetLangEl = document.getElementById('targetLang');
const translateBtn = document.getElementById('translateBtn');
const translatedTextEl = document.getElementById('translatedText');
const speakBtn = document.getElementById('speakBtn');
const listenBtn = document.getElementById('listenBtn');
const statusEl = document.getElementById('status');

let recognition = null;
let listening = false;
let voices = [];

// Initialize Speech Recognition API
function initRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const rec = new SpeechRecognition();
  rec.interimResults = true;
  rec.continuous = true;
  rec.maxAlternatives = 1;
  return rec;
}

// Set status text with optional error coloring
function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? '#b91c1c' : 'var(--muted, #555)';
}

// Load available voices (async because voices can load late)
async function loadVoices() {
  return new Promise((resolve) => {
    voices = speechSynthesis.getVoices();
    if (voices.length) resolve(voices);
    else {
      speechSynthesis.onvoiceschanged = () => {
        voices = speechSynthesis.getVoices();
        resolve(voices);
      };
    }
  });
}

// Translate text by calling backend API
async function translateText() {
  const query = sourceTextEl.value.trim();
  if (!query) {
    alert('Please enter text or use live speech.');
    return;
  }

  const source = sourceLangEl.value === 'auto' ? 'en' : sourceLangEl.value;
  const target = targetLangEl.value;

  setStatus('Translating...');

  try {
    const res = await fetch('/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, source, target }),
    });

    const data = await res.json();

    if (!res.ok) {
      setStatus('Translation error: ' + (data.error || 'unknown'), true);
      return;
    }

    translatedTextEl.value = data.translatedText || '';
    setStatus('Translated.');
  } catch (err) {
    setStatus('Network/server error: ' + err.message, true);
  }
}

// Speak text with the best matching voice for the language
async function speakText(text, langCode) {
  if (!('speechSynthesis' in window)) {
    alert('SpeechSynthesis API not supported.');
    return;
  }
  if (!text) return;

  if (!voices.length) await loadVoices();

  const utter = new SpeechSynthesisUtterance(text);

  // Language map for Indian langs + English fallback
  const langMap = {
    kn: 'kn-IN',
    te: 'te-IN',
    ta: 'ta-IN',
    ml: 'ml-IN',
    hi: 'hi-IN',
    en: 'en-US',
  };

  const targetLang = langMap[langCode] || 'en-US';

  // Try exact voice match
  let voice = voices.find(v => v.lang.toLowerCase() === targetLang.toLowerCase());

  // If no exact match, try prefix match (e.g., "kn" matches "kn-IN")
  if (!voice) {
    voice = voices.find(v => v.lang.toLowerCase().startsWith(langCode));
  }

  // Fallback to Hindi, then English if no better match found
  if (!voice) voice = voices.find(v => v.lang.toLowerCase().startsWith('hi'));
  if (!voice) voice = voices.find(v => v.lang.toLowerCase().startsWith('en'));

  if (voice) utter.voice = voice;
  utter.lang = voice ? voice.lang : targetLang;

  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

// Event listeners

translateBtn.addEventListener('click', translateText);

speakBtn.addEventListener('click', () => {
  const text = translatedTextEl.value.trim() || sourceTextEl.value.trim();
  if (!text) {
    alert('Please enter or speak text first');
    return;
  }
  speakText(text, targetLangEl.value);
});

// Initialize recognition and set up handlers
recognition = initRecognition();

if (recognition) {
  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += transcript;
      else interimTranscript += transcript;
    }

    sourceTextEl.value = finalTranscript + interimTranscript;

    if (finalTranscript.trim()) {
      if (window._translateTimeout) clearTimeout(window._translateTimeout);
      window._translateTimeout = setTimeout(() => {
        translateText();
      }, 200);
    }
  };

  recognition.onerror = (e) => {
    setStatus('Speech recognition error: ' + (e.error || 'unknown'), true);
    listening = false;
    listenBtn.textContent = '🎤 Start Listening';
  };

  recognition.onend = () => {
    if (listening) {
      try {
        recognition.start();
        setStatus('Listening...');
      } catch (err) {
        setStatus('Error restarting recognition: ' + err.message, true);
        listening = false;
        listenBtn.textContent = '🎤 Start Listening';
      }
    } else {
      listenBtn.textContent = '🎤 Start Listening';
      setStatus('Ready');
    }
  };

  listenBtn.addEventListener('click', () => {
    if (listening) {
      recognition.stop();
      listening = false;
      listenBtn.textContent = '🎤 Start Listening';
      setStatus('Stopped listening');
    } else {
      recognition.lang = sourceLangEl.value === 'auto' ? 'en-IN' : sourceLangEl.value + '-IN';
      try {
        recognition.start();
        listening = true;
        listenBtn.textContent = '⏹ Stop Listening';
        setStatus('Listening...');
      } catch (err) {
        setStatus('Could not start listening: ' + err.message, true);
      }
    }
  });
} else {
  listenBtn.style.display = 'none';
  setStatus('SpeechRecognition not supported in this browser');
}

// Debug voices in console on load
if ('speechSynthesis' in window) {
  window.addEventListener('load', () => {
    loadVoices().then(() => {
      console.log('Available voices:', voices);
    });
  });
}
