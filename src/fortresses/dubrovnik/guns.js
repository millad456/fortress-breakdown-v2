// Wall-side parameters and the gun positions for the fields of fire (shared by the site and tests).
export const SIDES = {
  land: { thick: 5.5, height: 20 },
  west: { thick: 4.5, height: 16 },
  harbour: { thick: 3, height: 12 },
  sea: { thick: 2.4, height: 14 },
};

/** Gun positions with ranges: forts 260–420 m, circuit towers ~150–170 m, outer bastions ~120 m */
export function fireGuns(works) {
  let i = 0;
  return works.guns.map((g) => {
    const range = g.kind === 'fort' ? g.range : g.kind === 'tower' ? 150 + (i++ % 3) * 10 : 120;
    return { ...g, range };
  });
}
