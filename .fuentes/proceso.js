// Rutas de proceso y ramales. Las capas de protección y los soportes se muestran aparte.
const routes = [
  ['producción', 'BS-101 TB-101 WH-101 XT-101 SSV-101 FL-201 MF-201 V-301 H-301 L-302 T-301 T-302'],
  ['prueba', 'FL-201 MF-202 V-201 FM-201'],
  ['crudo tratado', 'T-302 P-301 PL-201 XV-201 TL-201 PL-202'],
  ['agua', 'V-301 L-303 T-303 T-304 F-301 P-302 L-304 WH-301 WI-101'],
  ['gas', 'V-301 V-302 L-301 FL-301'],
  ['gas', 'V-301 V-302 L-301 FG-301'],
  ['química', 'CI-201 FL-201'],
  ['química', 'Q-301 L-304']
];
const lanes = [
  'CS-101 CS-102 CS-103 VR-101 BP-101 PK-101 SL-101',
  'BS-101 TB-101 WH-101 XT-101 SSV-101 FL-201 MF-201 V-301 H-301 L-302 T-301 T-302',
  'CI-201 MF-202 V-201 FM-201 V-302 L-301 FL-301 FG-301',
  'WI-101 WH-301 L-304 P-302 F-301 T-304 T-303 L-303',
  'PL-202 TL-201 XV-201 PL-201 P-301 Q-301',
  'SP-201 EC-201 EC-201-KA PC-A3 D-301 PC-301'
];
const symbols = {
  tube: '<path d="M-34-5H34M-34 5H34M-23-8V8M23-8V8"/>',
  buried: '<path class="terrain" d="M-36-11H36m-25 0-5 5m21-5-5 5m-35-5-5 5"/><path d="M-34 0H34M-34 8H34"/>',
  creek: '<path class="terrain" d="M-35 0H-22L-13 13H16L24 0H35"/><path class="water" d="M-18 7q4-4 9 0t9 0t9 0t9 0"/><path d="M-34-8H34M-34-3H34M-25-3V0M26-3V0"/>',
  vessel: '<rect x="-29" y="-13" width="58" height="26" rx="13"/><path d="M-17 13v6m34-6v6M-20 4h40M0-13v-6"/>',
  heater: '<rect x="-30" y="-14" width="60" height="28" rx="8"/><path d="M-20 14v5m40-5v5M-20 4h6l5-10 8 14 8-14 5 10h8M16-14v-8h7v8"/>',
  gasBoot: '<rect x="-13" y="-18" width="26" height="36" rx="11"/><path d="M0-18v-5m-13 14h-14m40 18h14M-8 6H8"/>',
  filter: '<rect x="-22" y="-16" width="17" height="32" rx="5"/><rect x="5" y="-16" width="17" height="32" rx="5"/><path d="M-14-16v-5H14v5M-14 16v5H14v-5M-21 4h15M6 4h15"/>',
  tank: '<path d="M-23-6 0-18l23 12v23h-46zM-23-6h46m-46 18h46"/>',
  pump: '<path d="M0-15h25v7H13M-14 0h-14m17 14-5 5h31l-5-5"/><circle r="15"/><path d="M-5-6 6 0-5 6z"/>',
  valve: '<path d="M-34 0h14m40 0h14m-54-11L20 11v-22l-40 22zM0 0v-19m-7 0H7"/>',
  safetyValve: '<path d="M-34 1h16m36 0h16m-52-8L18 9V-7L-18 9zM0 1v-10"/><rect x="-10" y="-21" width="20" height="12" rx="4"/>',
  wellhead: '<path d="M-8-19H8v8h9v9H-17v-9h9zM-20-2H20v8H-20zM-9 6v14m18-14v14m-26-26h-12m46 0h12"/>',
  tree: '<path d="M-4 20v-37h8v37M-9 16H9M-9-17H9M-4-8h-8l-10-6v12l10-6m16 13h8l10-6v12l-10-6h19"/>',
  trap: '<path d="M-34-10h47q7 0 7 9h14m-68 10h47q7 0 7-5h14m-54-17v25m-10-25v25m58-17v14M-17 9v10"/>',
  tubing: '<path d="M-5-20v40M5-20v40M-9-12H9v5H-9zM-9 7H9v5H-9z"/>',
  injector: '<path class="terrain" d="M-33-12H33"/><path d="M-20-18v36m40-36v36M-12-10v29m24-29v29"/><path class="water" d="M0-22v34m-6-6 6 6 6-6" stroke-width="3"/>',
  packer: '<path d="M-5-20v40m10-40v40M-5-10h-9l-10 6v8l10 6h9m10-20h9l10 6v8l-10 6H5M-24-4h19M5-4h19M-24 4h19M5 4h19"/>',
  seals: '<ellipse rx="22" ry="13"/><ellipse rx="13" ry="7"/><path d="M-22 0v5a22 13 0 0 0 44 0V0"/>',
  rod: '<path d="M-29 0h58m-46-5h9v10h-9zm24 0h9v10H7zm-36-5v10m58-10v10"/>',
  polishedRod: '<path d="M-32-3h64v6h-64zM-24-8v16m48-16v16M-9-11H9"/>',
  manifold: '<path d="M-33 1h66m-66 6h66m-22-7v-15m11 15v-15m11 15v-15m11 15v-15"/>',
  flare: '<path d="M-12 18h24M0 18V-5m0-3c-11-6 4-10 1-16 12 8 10 14-1 16z"/>',
  insulatedJoint: '<path d="M-32-4h21m22 0h21M-32 4h21m22 0h21M-11-12h7v24h-7zM4-12h7v24H4zM0-14v28" stroke-dasharray="none"/>',
  coating: '<rect x="-24" y="-9" width="48" height="18" rx="5"/><path d="M-33-4h66m-66 8h66m-45-13v18m24-18v18"/>',
  accessory: '<rect x="-17" y="-10" width="34" height="20" rx="3"/><path d="M-29 0h12m34 0h12"/>'
};
function casing(name) {
  const strings = [[27, 0], [19, 8], [11, 18]];
  const count = /superficie/i.test(name) ? 1 : /intermedio/i.test(name) ? 2 : 3;
  const profile = strings.slice(0, count).map(([radius, depth], i) =>
    `<path d="M-${radius} -17V${depth}h-4M${radius} -17V${depth}h4" ${i === count - 1 ? 'stroke-width="3"' : 'opacity=".55"'}/>`
  ).join('');
  return '<path class="terrain" d="M-36-12H36"/>' + profile;
}
function symbol(e, rows) {
  const tag = e.tag;
  if (tag === 'TL-201') {
    const parts = rows.filter(r => r.p.eq === tag).map(r => r.p.tag);
    if (parts.includes('TL-201-c') && parts.includes('TL-201-a')) {
      return '<g transform="translate(-16,0) scale(.48)">' + symbols.buried +
        '</g><g transform="translate(16,0) scale(.48)">' + symbols.creek + '</g>';
    }
    if (parts.includes('TL-201-c')) return symbols.creek;
    return parts.includes('TL-201-a') ? symbols.buried : symbols.tube;
  }
  if (tag === 'L-304') return symbols.buried;
  if (/^CS-/.test(tag)) return casing(e.nombre);
  if (/^WI-/.test(tag)) return symbols.injector;
  if (/^TB-/.test(tag)) return symbols.tubing;
  if (/^PK-/.test(tag)) return symbols.packer;
  if (/^SL-/.test(tag)) return symbols.seals;
  if (/^VR-/.test(tag)) return symbols.rod;
  if (/^BP-/.test(tag)) return symbols.polishedRod;
  if (/^(P|BS)-/.test(tag)) return symbols.pump;
  if (/^(T|CI)-/.test(tag)) return symbols.tank;
  if (/^PL-/.test(tag)) return symbols.trap;
  if (/^FL-301$/.test(tag)) return symbols.flare;
  if (/^H-/.test(tag)) return symbols.heater;
  if (/^F-/.test(tag)) return symbols.filter;
  if (tag === 'V-302') return symbols.gasBoot;
  if (/^V-/.test(tag)) return symbols.vessel;
  if (/^WH-/.test(tag)) return symbols.wellhead;
  if (/^XT-/.test(tag)) return symbols.tree;
  if (/^SSV-/.test(tag)) return symbols.safetyValve;
  if (/^XV-/.test(tag)) return symbols.valve;
  if (/^MF-/.test(tag)) return symbols.manifold;
  if (/^(L|FL)-/.test(tag)) return symbols.tube;
  if (tag === 'EC-201-KA') return symbols.insulatedJoint;
  if (tag === 'EC-201') return symbols.coating;
  return symbols.accessory;
}
function esquema(rows) {
  const byEq = new Map();
  for (const row of rows) {
    if (!byEq.has(row.p.eq)) byEq.set(row.p.eq, []);
    byEq.get(row.p.eq).push(row);
  }
  const shown = new Map();
  const lines = [...lanes.map(lane => lane.split(' ')),
    [...byEq.keys()].filter(tag => !lanes.some(lane => lane.split(' ').includes(tag)))];
  const active = lines.map(line => line.filter(tag => byEq.has(tag))).filter(line => line.length);
  const width = Math.max(330, Math.max(1, ...active.map(line => line.length)) * 104 + 18);
  const height = active.length * 82 + 14;
  active.forEach((line, j) => line.forEach((tag, i) => {
    shown.set(tag, {x: 9 + (width - 18) * (i + .5) / line.length, y: 32 + j * 82});
  }));
  const drawn = new Set();
  const pipes = [];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function pipe(d, tag, length, service, gap) {
    const pressure = M.condEq(scenario.estado, tag).P;
    const seconds = Math.max(.5, length / (32 + 2 * pressure));
    const motion = reduced ? '' : `<circle r="2.8" class="particle"><animateMotion dur="${seconds.toFixed(2)}s" repeatCount="indefinite" path="${d}"/></circle>`;
    pipes.push(`<g class="pipe ${gap ? 'gap' : ''} ${service === 'gas' ? 'gas' : service === 'agua' ? 'agua' : ''}"><title>${esc(service)}${gap ? ' · continuación fuera del alcance' : ''}</title><path d="${d}" marker-end="url(#arrow)"/>${motion}</g>`);
  }
  for (const [service, route] of routes) {
    const tags = route.split(' ');
    const visible = tags.filter(tag => shown.has(tag));
    if (visible.length === 1) {
      const [tag] = visible;
      const {x, y} = shown.get(tag);
      for (const [side, inRoute, d] of [
        ['in', tag !== tags[0], `M${x-62} ${y}h28`],
        ['out', tag !== tags.at(-1), `M${x+34} ${y}h28`]
      ]) {
        const id = tag + '/' + side;
        if (!inRoute || drawn.has(id)) continue;
        drawn.add(id);
        pipe(d, tag, 28, service, true);
      }
    }
    for (let i = 1; i < visible.length; i++) {
      const from = visible[i - 1], to = visible[i], id = from + '/' + to;
      if (drawn.has(id)) continue;
      drawn.add(id);
      const a = shown.get(from), b = shown.get(to);
      const gap = tags.indexOf(to) - tags.indexOf(from) > 1;
      const direction = Math.sign(b.x - a.x) || 1;
      const ax = a.x + direction * 35, bx = b.x - direction * 35;
      const bridge = b.y - 28;
      const elbow = bx - direction * 10;
      const d = a.y === b.y ? `M${ax} ${a.y}H${bx}` :
        `M${ax} ${a.y}h${direction * 9}V${bridge}H${elbow}V${b.y}H${bx}`;
      pipe(d, from, Math.abs(a.x - b.x) + Math.abs(a.y - b.y), service, gap);
    }
  }
  const nodes = [...shown].map(([tag, {x, y}]) => {
    const pieces = byEq.get(tag);
    const e = M.EQ[tag];
    const severity = Math.max(...pieces.map(r => r.s));
    const dots = pieces.map((r, i) => `<circle cx="${(i - (pieces.length - 1) / 2) * Math.min(7, 83 / pieces.length)}" cy="38" r="2.6" class="dot estado${r.s}"><title>${esc(r.p.tag + ' · ' + nombres[r.s])}</title></circle>`).join('');
    const damage = severity === 2 ? '<g class="damage"><circle r="23"/><circle cx="-7" cy="1" r="2.3"/><circle cx="3" cy="5" r="1.5"/><circle cx="10" cy="-5" r="1.6"/></g>' : '';
    return `<g tabindex="0" role="button" aria-pressed="${tag === equipo}" aria-label="${esc(tag + ' · ' + e.nombre)}" data-equipo="${esc(tag)}" class="node estado${severity}" transform="translate(${x} ${y})"><title>${esc(e.nombre + ' · ' + nombres[severity])}</title><rect class="hit" x="-47" y="-24" width="94" height="69" rx="6"/><g class="symbol">${symbol(e, rows)}</g>${damage}<text y="28" text-anchor="middle">${esc(tag)}</text>${dots}</g>`;
  });
  $('esquema').innerHTML = `<svg class="process" viewBox="0 0 ${width} ${height}" height="${height}" aria-label="Esquema de proceso por alcance"><defs><marker id="arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M0 0 5 2.5 0 5z" fill="#607d91"/></marker></defs>${pipes.join('')}${nodes.join('')}</svg>`;
}
