// Content for Dubrovnik: places, timeline, sieges, tour and sources.
// Construction years for ordinary houses are a modelled estimate (see README); dates for named
// works follow the sources listed at the bottom.
const W = 'https://en.wikipedia.org/wiki/';
const p = (file, credit, license) => ({ file, credit, license });

const meta = {
  id: 'dubrovnik',
  name: 'Dubrovnik',
  country: 'Croatia',
  coords: '42°38′29″N 18°06′23″E',
  tagline: 'The walls that kept a republic free for four hundred years',
  summary:
    'A continuous circuit of stone, 1,940 m long and up to 25 m high, wraps the old town of Dubrovnik. ' +
    'It grew from the 9th century to the 17th, was never breached by an enemy assault, and let a small merchant ' +
    'republic — Ragusa — stay independent between Venice and the Ottoman Empire until 1808.',
  credit: 'Map data © OpenStreetMap contributors (ODbL). Photos: Wikimedia Commons, credited under each image.',
};

const loadingSteps = [
  'Surveying the coast',
  'Quarrying limestone',
  'Raising the walls',
  'Arming the towers',
  'Roofing the town',
  'Lighting the lamps',
];

const features = [
  {
    id: 'minceta', name: 'Minčeta Tower', subtitle: 'The crown of the northern walls', kind: 'tower',
    era: '1319 · rebuilt 1461–1464', builders: 'Michelozzo di Bartolomeo; Juraj Dalmatinac',
    stats: [
      { label: 'First tower', value: '1319' }, { label: 'Round rebuild', value: '1461–64' },
      { label: 'Walls', value: 'up to 6 m thick' }, { label: 'Position', value: 'highest point' },
    ],
    description:
      'Minčeta stands at the highest, north-western corner of the circuit, where the land front meets the hill. ' +
      'It began in 1319 as a square tower. After Constantinople fell to the Ottomans in 1453, the Republic wrapped it in a ' +
      'massive round tower: the Florentine architect Michelozzo designed it in 1461, and Juraj Dalmatinac (Giorgio da Sebenico) ' +
      'completed it with the tall crowned top by 1464.',
    howItWorked:
      'From the top of Minčeta a gunner could see along the whole northern wall and down the western front towards Pile. ' +
      'Its broad lower drum carried guns at the level of the approaches; the round tower above gave plunging fire over the ' +
      'outer wall and the moat. A curved face deflects cannon shot that would punch through a flat one.',
    underFire:
      'Minčeta was never taken. Its real work was deterrence: the strongest point of the land front faced the only ' +
      'direction from which an army could come at the city on foot, and none ever tried a full assault on it.',
    trivia: [
      'It is named after the Menčetić family, who owned the land it was built on.',
      'The tower stood in for the House of the Undying in the second season of Game of Thrones.',
    ],
    photos: [
      p('Minčeta Fortress, Dubrovnik 01.jpg', 'Bernard Gagnon', 'CC BY-SA 4.0'),
      p('Minčeta Fortress, Dubrovnik 03.jpg', 'Bernard Gagnon', 'CC BY-SA 4.0'),
      p('Dubrovnik Old Town From Minčeta Tower.jpg', 'Sumitsurai', 'CC BY-SA 4.0'),
    ],
    wiki: W + 'Walls_of_Dubrovnik',
  },
  {
    id: 'bokar', name: 'Fort Bokar', subtitle: 'The casemated guardian of Pile', kind: 'fort',
    era: '1461–1570', builders: 'Michelozzo di Bartolomeo (design)',
    stats: [
      { label: 'Begun', value: '1461' }, { label: 'Completed', value: '1570' },
      { label: 'Type', value: 'casemate fort' }, { label: 'Partner', value: 'Lovrijenac' },
    ],
    description:
      'Bokar juts out from the south-western corner of the walls on a rock above the sea. Begun to Michelozzo’s design in 1461 ' +
      'and completed in 1570, it is among the oldest preserved casemate forts in Europe — guns fired from vaulted chambers ' +
      'inside the masonry rather than from an open platform.',
    howItWorked:
      'Bokar and Lovrijenac face each other across the little Pile bay. Between them they cross their fire over the bay, the ' +
      'Pile Gate and its bridge, so a boat landing or a column on the bridge is hit from two sides at once.',
    underFire:
      'No enemy ever got close enough to test it. Its casemates were built for an age of artillery that the Republic watched ' +
      'arriving in Italy and the Ottoman wars, and they were kept armed for three centuries.',
    trivia: ['Its other name, Zvjezdan, means “starry”.'],
    photos: [
      p('Bokar Fortress, Dubrovnik 01.jpg', 'Bernard Gagnon', 'CC BY-SA 4.0'),
      p('Croatia-01665 - Bokar Fortress (10088566825).jpg', 'Dennis G. Jarvis', 'CC BY-SA 2.0'),
      p('Cannon on Bokar Fortress, Dubrovnik 01.jpg', 'Bernard Gagnon', 'CC BY-SA 4.0'),
    ],
    wiki: W + 'Walls_of_Dubrovnik',
  },
  {
    id: 'lovrijenac', name: 'Fort Lovrijenac', subtitle: 'Gibraltar of Dubrovnik, outside the walls', kind: 'fort',
    era: 'recorded 1301; rebuilt 16th c.', builders: 'Republic of Ragusa',
    stats: [
      { label: 'Recorded', value: '1301' }, { label: 'Rock', value: '37 m above sea' },
      { label: 'Seaward walls', value: 'up to 12 m' }, { label: 'City-facing wall', value: '~60 cm' },
    ],
    description:
      'Lovrijenac (St Lawrence) stands alone on a 37 m rock just west of the city, outside the walls. It is first recorded in ' +
      '1301; local legend says it was raised in three months to beat the Venetians to the site. It was rebuilt and enlarged ' +
      'in the 16th century as three stepped tiers on a triangular plan.',
    howItWorked:
      'It commands the western sea approach and the Pile bay, and crosses fire with Bokar. Its walls facing the sea and the ' +
      'enemy are up to 12 m thick; the wall facing the city is only about 60 cm, so that a garrison that turned traitor could ' +
      'be shot out of it from the town.',
    underFire:
      'Lovrijenac was never taken. Its commander, always a nobleman, served only a month at a time — another guard against the ' +
      'fort being sold to an enemy.',
    trivia: [
      'Over the gate: NON BENE PRO TOTO LIBERTAS VENDITUR AURO — “freedom is not to be sold for all the gold in the world”.',
      'Its courtyard is the stage for Hamlet at the Dubrovnik Summer Festival.',
    ],
    photos: [
      p('Fort Lovrijenac - Dubrovnik.jpg', 'Sumitsurai', 'CC BY-SA 4.0'),
      p('Lovrijenac Fort, Dubrovnik, early 16th century (13) (29815249480).jpg', 'Richard Mortel', 'CC BY 2.0'),
      p('City walls of Dubrovnik + Fort Lovrijenac, 2008 (01).jpg', 'Bahnfrend', 'CC BY-SA 4.0'),
    ],
    wiki: W + 'Lovrijenac',
  },
  {
    id: 'stjohn', name: 'St John’s Fortress', subtitle: 'Keeper of the harbour mouth', kind: 'fort',
    era: '1346 · unified 1552–1557', builders: 'Republic of Ragusa',
    stats: [
      { label: 'First tower', value: '1346' }, { label: 'Fortress', value: '1552–57' },
      { label: 'Guards', value: 'Old Port' }, { label: 'Today', value: 'Maritime Museum' },
    ],
    description:
      'At the south-eastern tip of the town, St John’s began as a single tower in 1346 guarding the entrance to the harbour. ' +
      'Over two centuries further works grew around it, and between 1552 and 1557 they were joined into one massive fortress.',
    howItWorked:
      'Two tiers of gunports look out to sea and across the harbour mouth. Any ship entering the Old Port passed under its ' +
      'guns at a few dozen metres, and at night the entrance could be closed off. Together with Kaše and Revelin it made ' +
      'the harbour a closed, defended basin.',
    underFire:
      'The harbour was never forced. In the 1991–92 siege the Old Port and the boats in it were shelled from the hills; ' +
      'the fortress itself survived.',
    trivia: ['It now houses the Maritime Museum, and an aquarium on the ground floor.'],
    photos: [
      p('St. John Fortress, Dubrovnik 01.jpg', 'Bernard Gagnon', 'CC BY-SA 4.0'),
      p('2011 Dubrownik, Fort św. Jana.jpg', 'Marcin Konsek', 'CC BY-SA 4.0'),
      p('Porporela 2011.jpg', 'Bracodbk', 'CC BY-SA 3.0'),
    ],
    wiki: W + 'Walls_of_Dubrovnik',
  },
  {
    id: 'revelin', name: 'Revelin', subtitle: 'The detached fort of the eastern gate', kind: 'fort',
    era: '1462 · rebuilt 1538–1551', builders: 'Antonio Ferramolino (rebuild)',
    stats: [
      { label: 'First fort', value: '1462' }, { label: 'Rebuilt', value: '1538–51' },
      { label: 'Engineer', value: 'A. Ferramolino' }, { label: 'Guards', value: 'Ploče Gate' },
    ],
    description:
      'Revelin was raised outside the eastern walls in 1462, when the Ottoman advance made the Ploče side the most exposed. ' +
      'When Venice threatened in the 1530s, the Republic had the engineer Antonio Ferramolino rebuild it as the strongest ' +
      'fort in the city; for the duration, work on all other buildings in Dubrovnik was stopped.',
    howItWorked:
      'It stands in front of the Ploče Gate like a shield: anyone approaching from the east met Revelin first, and the gate ' +
      'could only be reached by bridges under its guns. Its great vaulted interior was bomb-proof storage and barracks; ' +
      'the broad terrace on top carried the guns.',
    underFire:
      'Revelin was never attacked: the Venetian threat that prompted its rebuilding never came, which is the best result a fort can have.',
    trivia: ['Its vast roof terrace is a stage of the Dubrovnik Summer Festival.'],
    photos: [
      p('Fort Revelin, Dubrovnik.JPG', 'Joanbanjo', 'CC BY-SA 3.0'),
      p('View from Srđ to the fort Revelin.jpg', 'Ramón from Llanera, España', 'CC BY-SA 2.0'),
      p('Dubrovnik, Revelin 01.jpg', 'LBM1948', 'CC BY-SA 4.0'),
    ],
    wiki: W + 'Walls_of_Dubrovnik',
  },
  {
    id: 'pile', name: 'Pile Gate', subtitle: 'The western entrance and its bridge', kind: 'gate',
    era: '1460 · bridge 1471 · outer gate 1537', builders: 'Paskoje Miličević (bridge)',
    stats: [
      { label: 'Inner gate', value: '1460' }, { label: 'Stone bridge', value: '1471' },
      { label: 'Outer gate', value: '1537' }, { label: 'Drawbridge', value: 'raised nightly' },
    ],
    description:
      'Pile is the main way into the old town from the west. A stone bridge of three arches, built in 1471 to a design by ' +
      'Paskoje Miličević, crosses the moat to a wooden drawbridge and the outer gate of 1537, set in a round barbican. ' +
      'Inside, a bend leads to the Gothic inner gate of 1460 and the head of the Stradun.',
    howItWorked:
      'The approach is a chain of obstacles: the bridge under the guns of Bokar and Minčeta, the drawbridge, the outer gate, ' +
      'a turn that stops a battering ram building speed, and the inner gate. Both gates carry a statue of St Blaise, the ' +
      'city’s patron.',
    underFire:
      'The drawbridge was raised every night until the 19th century, and the keys handed to the Rector — a ritual of a ' +
      'city that was never taken by force.',
    trivia: ['The wooden drawbridge still hangs on its chains, though it no longer rises.'],
    photos: [
      p('Pile Gate, Dubrovnik 01.jpg', 'Bernard Gagnon', 'CC BY-SA 4.0'),
      p('Vrata od Pila-Dubrovnik.JPG', 'Bracodbk', 'CC BY-SA 3.0'),
      p('Pile Gate, Dubrovnik 02 (js).jpg', 'Jerzy Strzelecki', 'CC BY-SA 3.0'),
    ],
    wiki: W + 'Walls_of_Dubrovnik',
  },
  {
    id: 'ploce', name: 'Ploče Gate', subtitle: 'The eastern entrance through Asimon', kind: 'gate',
    era: '14th–15th c.', builders: 'Republic of Ragusa',
    stats: [
      { label: 'Inner gate', value: 'Asimon tower' }, { label: 'Bridges', value: 'two' },
      { label: 'Covered by', value: 'Revelin' }, { label: 'Road to', value: 'Ottoman lands' },
    ],
    description:
      'The eastern entrance mirrors Pile: an outer gate, a stone bridge and a drawbridge over the moat, and an inner gate ' +
      'that passes through the Asimon tower in the main wall. It opened on the road to the Ottoman hinterland, along which ' +
      'caravans brought the trade that made the Republic rich.',
    howItWorked:
      'Revelin stands between the gate and the open ground, so the gate can only be approached along a path enfiladed by the ' +
      'fort. The passage turns twice before it reaches the town.',
    underFire:
      'Trade, not war, came through Ploče — which is why the Lazareti quarantine stood just outside it.',
    trivia: ['A statue of St Blaise watches over this gate too.'],
    photos: [
      p('Ploče Gate, Dubrovnik 01.jpg', 'Bernard Gagnon', 'CC BY-SA 4.0'),
      p('Ploče Gate, Dubrovnik 02.jpg', 'Bernard Gagnon', 'CC BY-SA 4.0'),
    ],
    wiki: W + 'Walls_of_Dubrovnik',
  },
  {
    id: 'outerwall', name: 'Outer Wall, Bastions and Moat', subtitle: 'Defence in depth on the land front', kind: 'wall',
    era: 'from 1470', builders: 'Republic of Ragusa',
    stats: [
      { label: 'Outer wall', value: 'from 1470' }, { label: 'Moat', value: 'dry, rock-cut' },
      { label: 'Bastions', value: 'semicircular' }, { label: 'Layers', value: 'four' },
    ],
    description:
      'On the land side the main wall is not alone. In front of it runs a lower outer wall with semicircular bastions, ' +
      'begun around 1470, and between the two a dry moat. The western stretch between Pile and Minčeta survives most ' +
      'clearly; on the north side its line is modelled here from the main wall.',
    howItWorked:
      'An attacker had to cross ground swept by the towers, take the outer wall, drop into the moat and only then face the ' +
      'main wall — under fire from above and from the bastions behind him. Low walls also absorb cannon fire better than tall ones.',
    underFire:
      'The layered land front was built against the Ottoman threat after 1453. It was never tested by a siege army, which was ' +
      'exactly its purpose.',
    trivia: ['The outer wall’s line is modelled on the north side; its course on the west follows the surviving bastions.'],
    photos: [
      p('Croatia-01786 - Three Fortresses (10090671895).jpg', 'Dennis G. Jarvis', 'CC BY-SA 2.0'),
    ],
    wiki: W + 'Walls_of_Dubrovnik',
  },
  {
    id: 'landwalls', name: 'The Land Walls', subtitle: 'The northern front facing the hill', kind: 'wall',
    era: '13th–15th c.', builders: 'Republic of Ragusa',
    stats: [
      { label: 'Height', value: 'up to 25 m' }, { label: 'Thickness', value: '4–6 m' },
      { label: 'Towers', value: 'Barbara to Asimon' }, { label: 'Circuit', value: '1,940 m' },
    ],
    description:
      'The northern walls climb the slope from Pile to Minčeta and run east above the Prijeko quarter to the Ploče Gate. ' +
      'Facing the land — the only side from which a field army could come — they are the thickest part of the circuit, ' +
      '4 to 6 metres, and up to 25 metres high.',
    howItWorked:
      'Towers project from the wall every few dozen metres so their guns sweep the face of the wall between them. The wall ' +
      'walk runs right round the circuit, letting defenders move to any threatened point under cover.',
    underFire:
      'They were thickened through the 15th century as artillery improved and the Ottoman frontier came closer, until the ' +
      'land front could take a battering no medieval army could have delivered.',
    trivia: ['Walking the full circuit of the walls takes about an hour and a half.'],
    photos: [
      p('Croatia-01754 - Two Fortresses (10090410053).jpg', 'Dennis G. Jarvis', 'CC BY-SA 2.0'),
      p('Minčeta Fortress, Dubrovnik 02.jpg', 'Bernard Gagnon', 'CC BY-SA 4.0'),
    ],
    wiki: W + 'Walls_of_Dubrovnik',
  },
  {
    id: 'seawalls', name: 'The Sea Walls', subtitle: 'Cliff-top walls on the open Adriatic', kind: 'wall',
    era: '9th–16th c.', builders: 'Republic of Ragusa',
    stats: [
      { label: 'Thickness', value: '1.5–3 m' }, { label: 'Stands on', value: 'sea cliffs' },
      { label: 'Bastions', value: 'Margarita, Stjepan, Spasitelj' }, { label: 'Oldest part', value: 'the Laus rock' },
    ],
    description:
      'The southern and western walls follow the cliff edge of the rock where the first town, Laus, was founded. Here the ' +
      'sea does most of the work, so the wall is only 1.5 to 3 metres thick, with low bastions at the points of the coast.',
    howItWorked:
      'No ship could land under these cliffs. The bastions — St Margaret, St Stephen, St Saviour, St Peter — flank the wall ' +
      'face and watch the sea approaches, while Bokar and Lovrijenac guard the only beach on the west.',
    underFire:
      'In the 866–867 siege the Saracen fleet could ring the town but not climb it. In 1991–92 shells fell on the old town ' +
      'from the hills behind, not from the sea.',
    trivia: ['Two small doors in the sea wall, the “buže”, now lead to cafés on the rocks outside.'],
    photos: [
      p('City walls, Dubrovnik.jpg', 'Paavo01', 'CC BY-SA 4.0'),
      p('Dubrovnik City Walls And Adriatic Sea.jpg', 'RajashreeTalukdar', 'CC BY-SA 4.0'),
      p('Casco viejo de Dubrovnik, Croacia, 2014-04-14, DD 04.JPG', 'Diego Delso', 'CC BY-SA 3.0'),
    ],
    wiki: W + 'Walls_of_Dubrovnik',
  },
  {
    id: 'oldport', name: 'Old Port and Kaše', subtitle: 'A closed harbour inside the defences', kind: 'place',
    era: 'breakwater 1485', builders: 'Paskoje Miličević (Kaše)',
    stats: [
      { label: 'Kaše', value: '1485' }, { label: 'Arsenal', value: 'galley sheds' },
      { label: 'Guarded by', value: 'St John, Revelin' }, { label: 'Towers', value: 'Sv. Luka' },
    ],
    description:
      'The Old Port lies between St John’s Fortress and the Ploče side, sheltered by the Kaše breakwater, built in 1485. ' +
      'Behind the harbour wall stood the Arsenal, whose great arches opened straight onto the water so galleys could be ' +
      'built and hauled in under cover.',
    howItWorked:
      'Kaše narrowed the harbour entrance and broke the swell; St John’s guns covered the mouth at point-blank range and the ' +
      'entrance could be closed at night. Ships, stores and shipwrights all sat inside the circuit of defence.',
    underFire:
      'In 1991 boats in the port were set on fire by shells from the hills. The harbour itself was never entered by an enemy.',
    trivia: ['The Arsenal’s arches now front the City Café on Luža square.'],
    photos: [
      p('Old harbour, Dubrovnik 01.jpg', 'Bernard Gagnon', 'CC BY-SA 4.0'),
      p('Dubrovnik Old Port Panorama.jpg', 'Soska', 'CC BY-SA 3.0'),
      p('Old Port, Dubrovnik (4) (29855029500).jpg', 'Richard Mortel', 'CC BY 2.0'),
    ],
    wiki: W + 'Dubrovnik',
  },
  {
    id: 'stradun', name: 'Stradun', subtitle: 'The filled channel that became the main street', kind: 'place',
    era: 'filled 11th–12th c. · paved 1468', builders: 'Republic of Ragusa',
    stats: [
      { label: 'Length', value: '~300 m' }, { label: 'Paved', value: '1468' },
      { label: 'Fountain', value: '1438' }, { label: 'Bell tower', value: '31 m' },
    ],
    description:
      'The Stradun runs straight from the Pile Gate to Luža square. It was once a shallow channel separating the rocky islet ' +
      'of Laus from the mainland settlement on the slope; when the channel was filled, the two halves became one town. After ' +
      'the 1667 earthquake it was rebuilt with uniform stone houses and shops.',
    howItWorked:
      'A straight street from gate to gate lets troops cross the town fast. At its ends stand Onofrio’s Great Fountain (1438), ' +
      'fed by an aqueduct from the hills that also made the city able to survive a siege, and at Luža the City Bell Tower, ' +
      'Orlando’s Column and the Sponza Palace.',
    underFire:
      'Shells fell on the Stradun in December 1991; its polished limestone was pitted by shrapnel and later repaired.',
    trivia: [
      'Orlando’s Column (1418) marks where the Republic’s decrees were read out; the flag of Libertas flies from it.',
      'The bronze “green men” of the bell tower strike the hours.',
    ],
    photos: [
      p('Stradun, Dubrovnik - September 2017.jpg', 'Martin Falbisoner', 'CC BY-SA 4.0'),
      p('Main street-Dubrovnik-1.jpg', 'László Szalai (Beyond silence)', 'Public domain'),
      p('Dubrovnik Wartime Stradun (cropped).jpg', 'Peter Denton', 'CC BY-SA 2.5'),
    ],
    wiki: W + 'Stradun_(street)',
  },
  {
    id: 'srd', name: 'Mount Srđ and Fort Imperial', subtitle: 'The height that commands the city', kind: 'fort',
    era: 'fort 1806–1812', builders: 'French army (Napoleonic)',
    stats: [
      { label: 'Height', value: '412 m' }, { label: 'Fort Imperial', value: '1812' },
      { label: '1806', value: '~3,000 cannonballs' }, { label: '1991', value: 'held' },
    ],
    description:
      'Srđ rises 412 m straight behind the old town. Whoever holds it can see into every street — the walls were never built ' +
      'for an enemy above them. In 1806 Russian and Montenegrin guns on Srđ fired about 3,000 cannonballs into the city; ' +
      'the French, who held Dubrovnik, then built Fort Imperial on the summit, completed in 1812.',
    howItWorked:
      'The fort denies the summit to an attacker and looks down on every approach by land and sea. The great cross beside ' +
      'it is visible from the whole coast.',
    underFire:
      'On 6 December 1991, as the old town took its heaviest shelling, a small group of Croatian defenders in Fort Imperial ' +
      'held off an assault by the Yugoslav army. The fort now houses a museum of that war.',
    trivia: ['A cable car built in 1969 was destroyed in 1991 and reopened in 2010.'],
    photos: [
      p('Fort Imperial nearby Dubrovnik.jpg', 'trolvag', 'CC BY-SA 3.0'),
      p('Croatia-01734 - Fort Imperial (10089967466).jpg', 'Dennis G. Jarvis', 'CC BY-SA 2.0'),
    ],
    wiki: W + 'Sr%C4%91',
  },
  {
    id: 'lokrum', name: 'Lokrum', subtitle: 'The island across the bay', kind: 'place',
    era: 'monastery 11th c. · Fort Royal 1806', builders: 'Benedictines; French army',
    stats: [
      { label: 'Distance', value: '~600 m offshore' }, { label: 'Highest point', value: '96 m' },
      { label: 'Fort Royal', value: 'from 1806' }, { label: 'Forest', value: 'pine & holm oak' },
    ],
    description:
      'Lokrum lies across the bay from the old town, covered in pine and holm-oak forest. A Benedictine monastery stood ' +
      'here from the 11th century. In 1806 the French began Fort Royal on its summit, to stop any enemy from mounting guns ' +
      'within range of the harbour.',
    howItWorked:
      'An island this close is a threat as much as a shield: guns on Lokrum could reach the Old Port. Holding it closed the ' +
      'sea approach from the south-east.',
    underFire:
      'In 1859 the island was bought by Archduke Maximilian of Austria, later Emperor of Mexico, who laid out gardens that still ' +
      'grow there.',
    trivia: ['Legend says Richard the Lionheart was shipwrecked on Lokrum in 1192 on his way home from the crusade.'],
    photos: [
      p('Lokrum Island, Croatia.jpg', 'Bernard Gagnon', 'CC BY-SA 4.0'),
      p('Lokrum island, Benedictine monastery.jpg', 'Tlusťa', 'Public domain'),
    ],
    wiki: W + 'Lokrum',
  },
  {
    id: 'lazareti', name: 'Lazareti', subtitle: 'The quarantine outside the eastern gate', kind: 'place',
    era: 'quarantine law 1377 · complex 1590–1640s', builders: 'Republic of Ragusa',
    stats: [
      { label: 'Quarantine law', value: '27 July 1377' }, { label: 'Built', value: '1590–1640s' },
      { label: 'Plan', value: 'halls and courtyards' }, { label: 'Isolation', value: '30, later 40 days' },
    ],
    description:
      'On 27 July 1377 the Great Council of Ragusa decreed that travellers from plague-stricken places must spend a month ' +
      'in isolation before entering the city — the first known quarantine law. Between 1590 and the 1640s the Republic built ' +
      'the Lazareti, a row of long halls with courtyards on the shore outside the Ploče Gate, where caravans from the ' +
      'Ottoman lands stopped.',
    howItWorked:
      'Defence against disease, not armies: goods were aired and people waited out their quarantine outside the walls but ' +
      'close to the market, so trade could go on without letting the plague in.',
    underFire: 'Today the halls are used for concerts, workshops and exhibitions.',
    trivia: ['Ragusa’s isolation was 30 days, the “trentino”; the 40 days later adopted elsewhere — “quaranta giorni” — gave us the word quarantine.'],
    photos: [
      p('Lazareti LS1.JPG', 'Lasta', 'Public domain'),
      p('Lazareti LS2.JPG', 'Lasta', 'Public domain'),
    ],
    wiki: W + 'Lazzarettos_of_Dubrovnik',
  },
];

// Timeline: structures appear in their year (keys match the world's timeline objects)
const timeline = [
  { year: 700, label: 'Laus is founded', text: 'Refugees from Roman Epidaurum (Cavtat) settle on the rocky islet of Laus, the core of the later town.', structures: ['walls.sea', 'walls.west'] },
  { year: 866, label: 'The Saracen siege', text: 'An Aghlabid fleet besieges the town for 15 months until a Byzantine fleet lifts it.', siege: 'saracen', window: [855, 880] },
  { year: 1150, label: 'Two towns become one', text: 'The channel between Laus and the mainland settlement is filled: the Stradun is born and the walls are extended round both.', structures: ['walls.land'] },
  { year: 1272, label: 'The Statute', text: 'Ragusa codifies its laws; town planning rules fix the street pattern still seen today.' },
  { year: 1301, label: 'Lovrijenac recorded', text: 'The fort on its rock outside the western walls first appears in the records.', structures: ['lovrijenac'] },
  { year: 1319, label: 'Minčeta’s first tower', text: 'A square tower is built at the highest corner of the walls.', structures: ['mincetaSquare'] },
  { year: 1330, label: 'The harbour wall', text: 'The walls are closed along the Old Port.', structures: ['walls.harbour'] },
  { year: 1346, label: 'St John’s first tower', text: 'A tower is built at the harbour mouth.', structures: ['stjohnTower'] },
  { year: 1358, label: 'A free republic', text: 'The Treaty of Zadar ends Venetian rule; Ragusa becomes a republic under nominal Hungarian protection.' },
  { year: 1377, label: 'The first quarantine', text: 'On 27 July the Great Council orders isolation for travellers from plague areas.' },
  { year: 1453, label: 'Constantinople falls', text: 'With the Ottomans at the frontier, the Republic rebuilds its defences for the age of artillery.' },
  { year: 1461, label: 'Bokar begun', text: 'The casemate fort at the south-western corner is begun to Michelozzo’s design.', structures: ['bokar'] },
  { year: 1462, label: 'Revelin', text: 'A detached fort is raised in front of the Ploče Gate.', structures: ['revelin'] },
  { year: 1464, label: 'Minčeta rebuilt', text: 'The square tower disappears inside the great round tower of Michelozzo and Juraj Dalmatinac.', structures: ['mincetaRound'], remove: ['mincetaSquare'] },
  { year: 1470, label: 'The outer wall', text: 'A lower outer wall with bastions and a dry moat is built along the land front.', structures: ['outerwall'] },
  { year: 1471, label: 'Pile bridge', text: 'Paskoje Miličević’s stone bridge crosses the moat at Pile.', structures: ['pileBridge'] },
  { year: 1485, label: 'Kaše breakwater', text: 'The breakwater closes off the Old Port.', structures: ['kase'] },
  { year: 1551, label: 'Revelin rebuilt', text: 'Antonio Ferramolino completes the new Revelin; the city’s other building works had been halted for it.' },
  { year: 1557, label: 'St John’s unified', text: 'The works at the harbour mouth become one fortress.', structures: ['stjohnFort'], remove: ['stjohnTower'] },
  { year: 1570, label: 'Bokar complete', text: 'The round upper tier finishes Bokar after more than a century.', structures: ['bokarUpper'] },
  { year: 1647, label: 'The Lazareti', text: 'The quarantine halls outside the Ploče Gate are complete.', structures: ['lazareti'] },
  { year: 1667, label: 'The Great Earthquake', text: 'On 6 April an earthquake and fire destroy most of the town and kill about 2,000 people. The walls stand.', disaster: true, window: [1667, 1669] },
  { year: 1715, label: 'Rebuilt', text: 'The town is rebuilt in Baroque: the Cathedral (1713), St Blaise (1715) and the uniform houses of the Stradun.' },
  { year: 1806, label: 'Russian–Montenegrin siege', text: 'Guns on Srđ fire about 3,000 cannonballs into the French-held city.', siege: 'russian', window: [1803, 1809] },
  { year: 1808, label: 'The Republic ends', text: 'Napoleon’s Marshal Marmont abolishes the Republic of Ragusa.' },
  { year: 1812, label: 'Fort Imperial', text: 'The French complete Fort Imperial on the summit of Srđ, and Fort Royal on Lokrum.', structures: ['imperial', 'royal'] },
  { year: 1979, label: 'World Heritage', text: 'The old town is inscribed on UNESCO’s World Heritage List.' },
  { year: 1991, label: 'The Siege of Dubrovnik', text: 'From 1 October the Yugoslav army besieges the city; on 6 December the old town takes its heaviest shelling.', siege: 'jna', window: [1990, 1994] },
  { year: 1998, label: 'Restored', text: 'After repairs, the old town leaves the World Heritage in Danger list (1991–1998).' },
  { year: 2025, label: 'Today', text: 'Restored after 1991, the walls are walked by around a million visitors a year.' },
];

const sieges = [
  {
    id: 'saracen', name: 'The Saracen Siege', years: '866–867', attacker: 'Aghlabid fleet from Africa',
    summary: 'A fleet of 36 Aghlabid ships raided the Dalmatian coast and laid siege to Ragusa. The town held out for 15 months behind its walls on the rock until a Byzantine fleet of about 100 ships, sent by Emperor Basil I, came to its relief.',
    outcome: 'Siege lifted by the Byzantine fleet; the town was never taken.',
    stats: [{ label: 'Ships', value: '36' }, { label: 'Duration', value: '15 months' }, { label: 'Relief fleet', value: '~100 ships' }],
    beats: [
      { t: 0.0, title: 'The fleet arrives', text: 'Thirty-six galleys ring the islet of Laus, cutting it off from the sea.' },
      { t: 0.22, title: 'Blockade', text: 'The town lives on its cisterns and stores; the attackers cannot climb the cliffs.' },
      { t: 0.5, title: 'Fifteen months', text: 'Assaults on the walls fail. The town sends word to Constantinople.' },
      { t: 0.72, title: 'Relief', text: 'A Byzantine fleet of about a hundred ships appears on the horizon.' },
      { t: 0.9, title: 'Lifted', text: 'The Aghlabid fleet withdraws. Ragusa has survived its first great test.' },
    ],
  },
  {
    id: 'russian', name: 'The Russian–Montenegrin Bombardment', years: '1806', attacker: 'Russian and Montenegrin forces',
    summary: 'In May 1806 French troops occupied the neutral Republic. Russian and Montenegrin forces besieged them, and from the heights of Srđ fired about 3,000 cannonballs into the city before a French relief army arrived in July.',
    outcome: 'Siege lifted by French relief; the French then fortified Srđ and abolished the Republic in 1808.',
    stats: [{ label: 'Cannonballs', value: '~3,000' }, { label: 'From', value: 'Mount Srđ' }, { label: 'Duration', value: 'June–July 1806' }],
    beats: [
      { t: 0.0, title: 'Guns on Srđ', text: 'The besiegers haul cannon onto the mountain behind the city.' },
      { t: 0.25, title: 'Bombardment', text: 'Shot falls into the streets; the medieval walls give no cover from above.' },
      { t: 0.6, title: 'Three thousand rounds', text: 'Roofs burn across the town; the walls themselves are untouched.' },
      { t: 0.85, title: 'Relief', text: 'A French army breaks the siege. Fort Imperial will make sure Srđ is never left open again.' },
    ],
  },
  {
    id: 'jna', name: 'The Siege of Dubrovnik', years: '1991–1992', attacker: 'Yugoslav People’s Army (JNA) and Montenegrin forces',
    summary: 'On 1 October 1991 the JNA attacked the Dubrovnik area. The city was cut off by land and sea and shelled from the surrounding hills for months. On 6 December more than 600 shells struck the old town. About 56% of its buildings were damaged; 82–88 civilians were killed in the siege.',
    outcome: 'The city held; the siege was lifted in 1992 and the old town restored. UNESCO listed it as World Heritage in Danger from 1991 to 1998.',
    stats: [{ label: 'Began', value: '1 Oct 1991' }, { label: '6 Dec', value: '600+ shells' }, { label: 'Buildings hit', value: '~56%' }, { label: 'Civilians killed', value: '82–88' }],
    beats: [
      { t: 0.0, title: '1 October 1991', text: 'The JNA advances on Dubrovnik; the city is cut off by land and sea.' },
      { t: 0.2, title: 'Gunboats', text: 'Navy vessels blockade the coast and shell the harbour.' },
      { t: 0.45, title: '6 December', text: 'The heaviest day: more than 600 shells fall on the old town. Fires burn across the roofs.' },
      { t: 0.68, title: 'Fort Imperial holds', text: 'On Srđ a handful of defenders turn back the assault on the fort.' },
      { t: 0.86, title: 'Aftermath', text: 'About 56% of the old town’s buildings are damaged. Restoration with original materials begins.' },
    ],
  },
];

// Guided tour: each stop sets a mode and a place or pose
const tour = [
  { title: 'Dubrovnik', text: 'A walled republic on a rock in the Adriatic: 1,940 m of wall, never breached. Use the arrows to walk the tour.', mode: 'explore', pose: 'overview' },
  { title: 'The land front', text: 'The thickest walls face the hill — 4 to 6 metres — with an outer wall and dry moat in front. The colours show each wall’s thickness.', mode: 'anatomy', pose: 'landfront' },
  { title: 'Minčeta', text: 'The round tower at the highest corner commands the whole land front.', mode: 'explore', feature: 'minceta' },
  { title: 'Pile and Bokar', text: 'The western gate sits between two forts that cross their fire over its bridge.', mode: 'explore', feature: 'pile' },
  { title: 'Lovrijenac', text: 'Alone on its rock, with a thin wall towards the city in case its garrison turned traitor.', mode: 'explore', feature: 'lovrijenac' },
  { title: 'The sea walls', text: 'On the cliffs the sea does the work: here the wall is only 1.5 to 3 metres thick.', mode: 'explore', feature: 'seawalls' },
  { title: 'The harbour', text: 'St John’s, Kaše and Revelin turn the Old Port into a closed, defended basin.', mode: 'explore', feature: 'oldport' },
  { title: 'Revelin', text: 'The detached fort that shields the eastern gate.', mode: 'explore', feature: 'revelin' },
  { title: 'Fields of fire', text: 'Computed from the plan: the ground each work could really cover. Nothing outside the walls was out of reach.', mode: 'fire', pose: 'fireOverview' },
  { title: 'The fifth wall', text: 'Ragusa’s best defence was diplomacy: tribute to the Ottoman Sultan, treaties with everyone, and a fleet of merchant ships that made it more useful free than conquered.', mode: 'explore', pose: 'diplomacy' },
  { title: '6 April 1667', text: 'An earthquake and fire destroy most of the town. The walls stand.', mode: 'timeline', year: 1667 },
  { title: 'December 1991', text: 'Shells from the hills fall on the old town; more than half of its buildings are hit.', mode: 'sieges', siege: 'jna' },
  { title: 'Today', text: 'Restored stone by stone, the city is again what its walls were built to protect.', mode: 'explore', pose: 'overview', hour: 18.6 },
];

const sources = [
  { title: 'Walls of Dubrovnik — Wikipedia', url: W + 'Walls_of_Dubrovnik' },
  { title: 'Old City of Dubrovnik — UNESCO World Heritage List (95)', url: 'https://whc.unesco.org/en/list/95/' },
  { title: 'Lovrijenac — Wikipedia', url: W + 'Lovrijenac' },
  { title: 'Siege of Dubrovnik (1991–92) — Wikipedia', url: W + 'Siege_of_Dubrovnik' },
  { title: 'Siege of Ragusa (866–868) — Wikipedia', url: W + 'Siege_of_Ragusa' },
  { title: 'Siege of Ragusa (1806) — Wikipedia', url: W + 'Siege_of_Ragusa_(1806)' },
  { title: '1667 Dubrovnik earthquake — Wikipedia', url: W + '1667_Dubrovnik_earthquake' },
  { title: 'Republic of Ragusa — Wikipedia', url: W + 'Republic_of_Ragusa' },
  { title: 'Lazzarettos of Dubrovnik — Wikipedia', url: W + 'Lazzarettos_of_Dubrovnik' },
  { title: 'Quarantine — Wikipedia (history: Ragusa 1377)', url: W + 'Quarantine' },
  { title: 'Stradun — Wikipedia', url: W + 'Stradun_(street)' },
  { title: 'Srđ — Wikipedia', url: W + 'Sr%C4%91' },
  { title: 'Lokrum — Wikipedia', url: W + 'Lokrum' },
  { title: 'City Walls — Society of Friends of Dubrovnik Antiquities', url: 'https://www.citywallsdubrovnik.hr/' },
  { title: 'Map data — OpenStreetMap contributors (ODbL)', url: 'https://www.openstreetmap.org/copyright' },
];

export default { meta, loadingSteps, features, timeline, sieges, tour, sources };
