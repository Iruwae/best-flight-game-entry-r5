// Ember Fjord — keyboard and mouse input.
// Arrow keys fly the jet (Up climbs, Down descends, Left/Right bank),
// Shift / W adds throttle, Ctrl / S cuts it, C swaps the camera, R
// restarts the mission, 1/2/3 pick a mission from the menu.

export function createInput() {
  const keys = new Set();
  const pressed = new Set();

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Mouse: hold the left button and drag to steer, wheel for throttle.
  let mouseDown = false;
  let mouseX = 0;
  let mouseY = 0;
  window.addEventListener('mousedown', (e) => {
    mouseDown = true;
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    mouseDown = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!mouseDown) return;
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  window.addEventListener('wheel', (e) => {
    wheelDelta += e.deltaY > 0 ? -0.05 : 0.05;
  });
  let wheelDelta = 0;

  function axis(neg, pos) {
    return (keys.has(pos) ? 1 : 0) - (keys.has(neg) ? 1 : 0);
  }

  return {
    // -1..1, +1 is nose up / bank right.
    pitch() {
      let p = axis('ArrowDown', 'ArrowUp') + axis('KeyS', 'KeyW') * 0;
      if (mouseDown) p += Math.max(-1, Math.min(1, (window.innerHeight / 2 - mouseY) / 220));
      return Math.max(-1, Math.min(1, p));
    },
    roll() {
      let r = axis('ArrowLeft', 'ArrowRight') + axis('KeyA', 'KeyD');
      if (mouseDown) r += Math.max(-1, Math.min(1, (mouseX - window.innerWidth / 2) / 260));
      return Math.max(-1, Math.min(1, r));
    },
    throttleUp() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyW');
    },
    throttleDown() {
      return keys.has('ControlLeft') || keys.has('ControlRight');
    },
    wheel() {
      const d = wheelDelta;
      wheelDelta = 0;
      return d;
    },
    // True once on the frame the key goes down.
    justPressed(code) {
      return pressed.has(code);
    },
    endFrame() {
      pressed.clear();
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
}
