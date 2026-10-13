// js/sound.js
//
// A soft two-note chime on the first interaction, plus a small mute button.
//
// Browsers don't let a page start audio by itself when it opens, so the chime
// plays on the first tap, click or key press instead. It's synthesised with
// the Web Audio API, so there is no audio file to load.

const STORAGE_KEY_SOUND = 'fpl_dashboard_sound'; // 'off' when muted
const VOLUME = 0.07; // peak loudness (0 to 1). Raise or lower to taste.
const UNLOCK_EVENTS = ['pointerup', 'click', 'keydown', 'touchend'];

let audioCtx = null;
let introDone = false;

function readMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY_SOUND) === 'off';
  } catch {
    return false;
  }
}

function writeMuted(muted) {
  try {
    localStorage.setItem(STORAGE_KEY_SOUND, muted ? 'off' : 'on');
  } catch {
    /* storage unavailable (private mode, etc.) - the choice just won't persist */
  }
}

function getContext() {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioCtx = new Ctx();
  return audioCtx;
}

// Two soft sine notes (E5 then B5), each with a quieter octave above it for
// a gentle bell-like tone.
function playChime(ctx) {
  const start = ctx.currentTime + 0.02;
  const notes = [
    { freq: 659.25, at: 0 },
    { freq: 987.77, at: 0.16 },
  ];

  for (const { freq, at } of notes) {
    for (const [multiple, level, decay] of [[1, 1, 1.4], [2, 0.18, 0.6]]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = start + at;

      osc.type = 'sine';
      osc.frequency.value = freq * multiple;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(VOLUME * level, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + decay + 0.05);
    }
  }
}

function listen() {
  for (const type of UNLOCK_EVENTS) document.addEventListener(type, onFirstGesture, true);
}

function stopListening() {
  for (const type of UNLOCK_EVENTS) document.removeEventListener(type, onFirstGesture, true);
}

function finishIntro(ctx) {
  if (introDone) return;
  introDone = true;
  stopListening();
  playChime(ctx);
}

function onFirstGesture(event) {
  if (introDone) return;
  // The mute button handles its own clicks.
  if (event.target?.closest?.('#sound-toggle')) return;
  // Scrolling and similar gestures can't start audio. Wait for a real tap or key press.
  const activation = window.navigator.userActivation;
  if (activation && !activation.isActive) return;

  const ctx = getContext();
  if (!ctx) return;
  ctx
    .resume()
    .then(() => {
      if (ctx.state === 'running') finishIntro(ctx);
    })
    .catch(() => {});
}

function renderButton(button, muted) {
  button.classList.toggle('is-muted', muted);
  button.setAttribute('aria-pressed', String(!muted));
  button.setAttribute('aria-label', muted ? 'Sound off, press to turn on' : 'Sound on, press to turn off');
  button.title = muted ? 'Sound off' : 'Sound on';
}

export function initSound() {
  const button = document.getElementById('sound-toggle');
  let muted = readMuted();

  if (button) {
    renderButton(button, muted);
    button.addEventListener('click', () => {
      muted = !muted;
      writeMuted(muted);
      renderButton(button, muted);

      // They've taken control of the sound, so no opening chime after this.
      introDone = true;
      stopListening();

      if (!muted) {
        const ctx = getContext();
        if (!ctx) return;
        ctx
          .resume()
          .then(() => {
            if (ctx.state === 'running') playChime(ctx);
          })
          .catch(() => {});
      }
    });
  }

  if (!muted) listen();
}