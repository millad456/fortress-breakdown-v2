// Landing page: title and one card per fortress.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const SKYLINE = `<svg class="landing-art" viewBox="0 0 1200 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs><linearGradient id="lg-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d3346"/><stop offset="1" stop-color="#0e1620"/></linearGradient></defs>
  <path d="M0 150 L80 150 L80 120 L92 120 L92 112 L104 112 L104 120 L116 120 L116 150 L240 150 L240 132 L300 132 L300 150
    L380 150 L380 96 C380 80 440 80 440 96 L440 150 L520 150 L520 124 L532 124 L532 116 L544 116 L544 124 L556 124 L556 150
    L660 150 L660 140 L760 140 L760 112 L820 112 L820 140 L900 140 L900 128 L960 128 L960 150 L1060 150 L1060 118 L1110 118 L1110 150 L1200 150 L1200 220 L0 220Z"
    fill="#16222e"/>
  <rect y="168" width="1200" height="52" fill="url(#lg-sea)"/>
</svg>`;

export function renderLanding(root, fortresses) {
  const el = document.createElement('main');
  el.className = 'landing';
  el.innerHTML = `
    <header class="landing-head">
      <p class="eyebrow">Fortress Breakdown</p>
      <h1>Great walls, taken apart</h1>
      <p class="lede">Fly around real fortifications built from survey data. See what every tower was for,
        how the works covered each other, how the town grew inside them — and how they held up under fire.</p>
    </header>
    <section class="cards" aria-label="Fortresses">
      ${fortresses.map((f) => `
        <a class="card ${f.live ? 'live' : 'soon'}" ${f.live ? `href="#/${f.id}"` : 'aria-disabled="true" tabindex="-1"'}>
          <span class="card-tag">${f.live ? 'Explore in 3D' : 'Coming soon'}</span>
          <h2>${esc(f.name)}</h2>
          <p class="card-meta">${esc(f.country)} · ${esc(f.era)}</p>
          <p class="card-line">${esc(f.tagline)}</p>
          ${f.live ? '<span class="card-go" aria-hidden="true">Enter →</span>' : ''}
        </a>`).join('')}
    </section>
    <footer class="landing-foot">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> (ODbL).
      Photos from Wikimedia Commons, credited where shown.</footer>
    ${SKYLINE}`;
  root.appendChild(el);
  return { dispose: () => el.remove() };
}
