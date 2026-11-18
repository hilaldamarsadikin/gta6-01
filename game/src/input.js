// TELUK EMAS — input: the keyboard and mouse, read once a frame. Keys are
// tracked by their code (KeyW, never 'w') so layouts do not matter, and
// one-shot actions are edge-triggered bits the main loop consumes exactly
// once per press. A small table maps codes to actions, so adding a key is
// one line instead of a new branch. Losing focus clears everything, so a
// held key never sticks after the player alt-tabs away mid-drive.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_EXIT_CAR = 8;
export const ACTION_HORN = 16;
export const ACTION_RELOAD = 32;
export const ACTION_TAXI = 64;
export const ACTION_MUTE = 128;
export const ACTION_PUNCH = 256;

// One-shot keys: code -> action bit. Held keys (WASD, Shift, Space) are
// read from the live key set instead. Note Space does double duty: it is
// the confirm key on the title screens and the handbrake while driving —
// the main loop reads it from the right place for the current screen, so
// one key never fires both actions at once.
const ACTION_KEYS = {
  Space: ACTION_CONFIRM,
  Enter: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyE: ACTION_ENTER_CAR,
  KeyF: ACTION_EXIT_CAR,
  KeyH: ACTION_HORN,
  KeyR: ACTION_RELOAD,
  KeyT: ACTION_TAXI,
  KeyM: ACTION_MUTE,
  KeyQ: ACTION_PUNCH,
};

// Keys whose default the page must swallow (scrolling, mostly).
const SWALLOW = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

// Human-readable labels for key codes, for the controls list on the
// title screen: "KeyW" means nothing to a player, "W" does.
const KEY_LABELS = {
  KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D',
  Space: 'Spasi', Enter: 'Enter', Escape: 'Esc',
  ShiftLeft: 'Shift', ShiftRight: 'Shift',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};

export function keyLabel(code) {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('F') && /^F\d+$/.test(code)) return code;
  return code;
}

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseClicked = false;

  function keyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    const bit = ACTION_KEYS[event.code];
    if (bit !== undefined) actions |= bit;
    if (SWALLOW.includes(event.code)) event.preventDefault();
  }

  function keyUp(event) {
    keys.delete(event.code);
  }

  function onMouseDown(event) {
    if (event.button === 0) {
      mouseDown = true;
      mouseClicked = true;
    }
  }

  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
  }

  function onBlur() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', onBlur);

  // -1, 0 or 1 along one axis, from a negative and a positive key.
  function axis(neg, pos) {
    return (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0);
  }

  function held(code) {
    return keys.has(code);
  }

  // Forget every held key and queued action: the restart path calls this
  // so a key pressed during the game-over screen never fires in the new run.
  // The blur handler clears the same state on its own path, so both stay
  // in sync — one clears, the other clears too.
  function reset() {
    keys.clear();
    actions = 0;
    mouseDown = false;
    mouseClicked = false;
  }

  return {
    // on foot: y is forward (-1..1), x is strafe, run is the Shift key
    move() {
      return {
        y: axis('KeyS', 'KeyW') + axis('ArrowDown', 'ArrowUp'),
        x: axis('KeyA', 'KeyD') + axis('ArrowLeft', 'ArrowRight'),
        run: held('ShiftLeft') || held('ShiftRight'),
      };
    },
    // driving: throttle -1..1, steer -1..1, handbrake on Space
    drive() {
      return {
        throttle: axis('KeyS', 'KeyW') + axis('ArrowDown', 'ArrowUp'),
        steer: axis('KeyA', 'KeyD') + axis('ArrowLeft', 'ArrowRight'),
        handbrake: held('Space'),
      };
    },
    shooting() {
      return mouseDown;
    },
    // take the queued one-shot actions and clear the queue
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    // peek without consuming: is any one-shot action waiting?
    hasActions() {
      return actions !== 0;
    },
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    anyKey() {
      return keys.size > 0;
    },
    isDown(code) {
      return held(code);
    },
    reset,
  };
}
