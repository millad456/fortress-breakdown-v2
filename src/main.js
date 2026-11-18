// Hash router: #/ is the landing page, #/<fortress-id> opens the viewer.
import './ui/styles.css';
import './ui/viewer.css';
import { FORTRESSES } from './fortresses/index.js';
import { renderLanding } from './landing.js';

const app = document.getElementById('app');
let current = null; // { dispose() }

async function route() {
  const id = (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || '').toLowerCase();
  if (current) {
    current.dispose();
    current = null;
  }
  app.innerHTML = '';
  const f = FORTRESSES.find((x) => x.id === id && x.live);
  if (!f) {
    if (id) history.replaceState(null, '', '#/');
    document.title = 'Fortress Breakdown — explore great fortifications in 3D';
    current = renderLanding(app, FORTRESSES);
    return;
  }
  const { openViewer } = await import('./viewer.js');
  current = await openViewer(app, f);
}

window.addEventListener('hashchange', route);
route();
