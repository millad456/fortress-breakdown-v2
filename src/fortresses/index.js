// Registry of fortresses. Each live entry lazy-loads its own folder of data + content.
// Adding a fortress = a new folder with geo.json, layout, content and a build() function.
export const FORTRESSES = [
  {
    id: 'dubrovnik',
    name: 'Dubrovnik',
    country: 'Croatia',
    era: '9th–17th c.',
    tagline: 'The walls that kept a republic free for four hundred years',
    live: true,
    accent: '#d9b77a',
    load: () => import('./dubrovnik/index.js'),
  },
  { id: 'carcassonne', name: 'Carcassonne', country: 'France', era: '4th–13th c.', tagline: 'A double ring of 52 towers above the Aude', live: false },
  { id: 'valletta', name: 'Valletta', country: 'Malta', era: '1566 onwards', tagline: 'A city built by and for the Knights of St John', live: false },
  { id: 'avila', name: 'Ávila', country: 'Spain', era: '11th–14th c.', tagline: '88 semicircular towers on an unbroken circuit', live: false },
];
