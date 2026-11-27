// Ember Fjord — the title screen.
// Big type, three mission cards, the controls, and the dusk valley behind
// it. It is the first thing a player sees and the fourth screenshot, so
// it has to look designed, not like a debug panel.

export function buildMenu(onSelect) {
  const root = document.createElement('div');
  root.id = 'menu';
  root.innerHTML = `
    <div class="menu-inner">
      <div class="menu-kicker">MAKE.FUN · BEST FLIGHT GAME</div>
      <h1 class="menu-title">EMBER<br>FJORD</h1>
      <p class="menu-sub">A dusk flight through the fjord — rings, slalom, runway 18.</p>
      <div class="menu-cards"></div>
      <p class="menu-controls">Arrows fly · Shift throttle · Ctrl cut throttle · C camera · R restart · Mouse drag steers</p>
      <p class="menu-foot">Ember Fjord — an original flight game. No two sorties fly the same.</p>
    </div>`;
  const cards = root.querySelector('.menu-cards');
  const missions = [
    { id: 'fjord-run', name: 'Fjord Run', tag: '8 rings down the channel', desc: 'Thread the glowing rings in order, low over the water.' },
    { id: 'peak-slalom', name: 'Peak Slalom', tag: '6 gates between the peaks', desc: 'Weave the gates left and right through the high valley.' },
    { id: 'precision-landing', name: 'Precision Landing', tag: 'Runway 18, PAPI guided', desc: 'Come home to runway 18. Slow, steady, on the centreline.' },
  ];
  for (const m of missions) {
    const card = document.createElement('button');
    card.className = 'menu-card';
    card.innerHTML = `<span class="menu-card-name">${m.name}</span><span class="menu-card-tag">${m.tag}</span><span class="menu-card-desc">${m.desc}</span><span class="menu-card-go">FLY →</span>`;
    card.addEventListener('click', () => onSelect(m.id));
    cards.appendChild(card);
  }
  document.body.appendChild(root);
  return {
    root,
    show() {
      root.style.display = 'flex';
    },
    hide() {
      root.style.display = 'none';
    },
  };
}
