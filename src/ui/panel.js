// Detail panel for a place: era, title, stats, photos, story sections, links.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const photoUrl = (file, width = 640) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
export const photoPage = (file) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`;

export function panelHTML(f) {
  const stats = (f.stats || []).map((s) => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('');
  const photos = (f.photos || []).map((p, i) => `
    <figure class="ph">
      <button class="ph-open" data-i="${i}" aria-label="Enlarge photo ${i + 1} of ${esc(f.name)}">
        <img loading="lazy" src="${photoUrl(p.file, 480)}" alt="${esc(f.name)} — photo ${i + 1}" width="240" height="160">
      </button>
      <figcaption><a href="${photoPage(p.file)}" target="_blank" rel="noopener">${esc(p.credit)}</a> · ${esc(p.license)}</figcaption>
    </figure>`).join('');
  const sec = (h, t) => (t ? `<section><h3>${h}</h3><p>${esc(t)}</p></section>` : '');
  const trivia = (f.trivia || []).length ? `<section><h3>Did you know</h3><ul>${f.trivia.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>` : '';
  return `
    <div class="panel-head">
      <p class="era">${esc(f.era)}</p>
      <button class="icon-btn panel-close" aria-label="Close panel (Esc)">✕</button>
    </div>
    <h2>${esc(f.name)}</h2>
    <p class="sub">${esc(f.subtitle)}</p>
    ${f.builders ? `<p class="builders">${esc(f.builders)}</p>` : ''}
    <div class="stats">${stats}</div>
    ${photos ? `<div class="gallery">${photos}</div>` : ''}
    ${sec('The story', f.description)}
    ${sec('How it worked', f.howItWorked)}
    ${sec('Under fire', f.underFire)}
    ${trivia}
    <div class="panel-actions">
      <button class="btn fly-again">Fly here again</button>
      ${f.wiki ? `<a class="btn ghost" href="${esc(f.wiki)}" target="_blank" rel="noopener">Wikipedia ↗</a>` : ''}
    </div>`;
}
