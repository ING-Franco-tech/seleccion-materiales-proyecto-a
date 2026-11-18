'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {master, plant, moduleFile, assignments, a2Files} = require('./originales.js');
const esc = value => String(value ?? '—').replace(/[&<>"]/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const number = value => new Intl.NumberFormat('es-CO').format(value);
const areas = {
  A1: 'Extracción y completamiento',
  A2: 'Recolección y transferencia',
  A3: 'Tratamiento, agua e inyección, gas'
};
const table = (headers, rows) => '<table class="t"><thead><tr>' +
  headers.map(cell => '<th scope="col">' + cell + '</th>').join('') + '</tr></thead><tbody>' +
  rows.map(row => '<tr>' + row.map(cell => '<td>' + cell + '</td>').join('') + '</tr>').join('') +
  '</tbody></table>';
const title = (label, text) => `<span class="tag">${esc(label)}</span><h2>${esc(text)}</h2>`;
const compact = (label, full) => `<span title="${esc(full)}">${esc(label)}</span>`;
const shortName = name => {
  const words = name.trim().split(/\s+/);
  return words.length > 1 ? words[0] + ' ' + words.at(-1) : words[0];
};
const stateNames = ['En envolvente', 'Atención', 'Fuera de envolvente'];
const status = (result, scenario) => {
  const {s, alternativas} = result;
  return `<span class="state s${s}" title="${esc(scenario + ' · ' + stateNames[s] +
    (alternativas.length ? ' · Alternativas: ' + alternativas.join(', ') : ''))}" aria-label="${esc(stateNames[s])}">${['✓','!','×'][s]}</span>`;
};
const simulator = (file, label, heading, caption, content, modules = []) => {
  const original = file === 'A1_grupo' ? master : file === 'integrado' ? plant : modules[0]?.file;
  const url = modules[0]?.url ?? (original ? '../sim/originales/' + original : '../sim/' + encodeURIComponent(file) + '.html');
  const embedQuery = file === 'integrado' ? '?embed=1&amp;pestana=planta' : '?embed=1';
  const tabs = modules.length ? `<div class="sim-tabs" role="tablist" aria-label="Módulos de ${esc(label)}">${modules.map((mod, index) =>
    `<button type="button" role="tab" aria-controls="visor-${file}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}" data-module="${mod.url ?? '../sim/originales/' + mod.file}"${mod.original ? ' data-original' : ''}${mod.notes ? ` data-notes="${esc(JSON.stringify(mod.notes))}"` : ''}>${esc(mod.title)}</button>`).join('')}</div>` : '';
  return `<div class="sim-layout">
    <div class="sim-head">${heading}<div class="sim-actions">
      <button type="button" popovertarget="tabla-${file}">Tabla</button>
      <button type="button" class="sim-fullscreen">Pantalla completa</button>
      <a class="sim-open" href="${url}" target="_blank" rel="noopener">Abrir en pestaña nueva</a>
    </div></div>
    ${tabs}<figure class="fig sim"><div class="im"><iframe id="visor-${file}" title="${esc(modules[0]?.title ?? label)}" data-src="${url}${embedQuery}"${file === 'integrado' ? ' data-active-only' : ''} allowfullscreen></iframe></div></figure>
    <aside class="data sim-data" id="tabla-${file}" popover aria-labelledby="titulo-${file}">
      <button type="button" popovertarget="tabla-${file}" popovertargetaction="hide" aria-label="Cerrar tabla">×</button>
      <h3 id="titulo-${file}">${esc(caption)}</h3>${content}
    </aside>
  </div>`;
};

const familyRules = [
  ['Acero al carbono + sobreespesor', p => /^CS/.test(p.familia) && p.ca > 0],
  ['HIC', p => p.familia === 'HIC'],
  ['CRA / 625', p => ['CRA','NI'].includes(p.familia) || /\b625\b/.test(p.material)],
  ['13Cr', p => p.familia === '13CR'],
  ['Dúplex', p => p.familia === 'DUP'],
  ['GRP / GRE', p => /^(?:Tubería |Tubo de )?(?:GRP|GRE)\b|\b(?:revestimiento interno|liner) de GRE\b/i.test(p.material)],
  ['Recubrimientos', p => p.familia === 'CS-REV' || /pintura|recubrimiento|revestimiento|novolac|galvanizado/i.test(p.proteccion)],
  ['Protección catódica', p => p.familia === 'PC' ||
    /^(?:Recubrimiento \+ )?(?:PC (?:galvánica|continua|por corriente)|Protección catódica)/i.test(p.proteccion)]
];

module.exports = function buildDeck({D, groups, students, results, presenter, read, write, root}) {
  const keys = Object.keys(results.escenarios);
  const codes = {base:'B', y10:'10', adv:'AG', inh:'IN', o2:'O₂', bsw:'BS', calor:'T', pres:'P'};
  const roster = key => students.filter(p => p.grupo === key);
  const blocks = person => results.grupos[person.grupo].estudiantes[person.id].escenarios;
  const pieces = Object.fromEntries(Object.keys(groups).map(key =>
    [key, Object.assign({}, ...roster(key).map(person => blocks(person).base))]));
  const eq = Object.fromEntries(D.eq.map(e => [e.tag, e]));
  const slides = [];
  function add(content, {group, center = false, section = false, notes, resultId, part = 'Proyecto A', speaker = '', source = 'Simulador integrado Proyecto A · D.json'} = {}) {
    const accent = group && groups[group].color;
    const style = accent ? ` style="--accent:${esc(accent)}"` : '';
    const guide = notes ?? presenter[speaker] ?? presenter[part] ?? presenter.general[slides.length] ?? presenter.general.at(-1);
    slides.push(`<section class="slide${center ? ' center' : ''}${section ? ' sec' : ''}"${style} ${resultId ? ' data-result-id="' + esc(resultId) + '"' : ''} data-notes="${esc(JSON.stringify(guide))}" data-part="${esc(part)}" data-speaker="${esc(speaker)}" data-source="${esc(source)}" aria-label="${esc(speaker || part)}"><div class="content">${content}</div></section>`);
  }
  const chip = key => `<span class="chip" style="--accent:${esc(groups[key].color)}">${esc(key)}</span>`;
  const provisional = key => results.grupos[key].confirmada ? '' :
    '<span class="provisional">Reparto provisional</span>';
  add(`<div class="cover"><span class="tag">Universidad Industrial de Santander</span>
    <h1>Selección de materiales · Proyecto A <span>Campo de crudo pesado, Magdalena Medio</span></h1>
    <p>Curso de Selección de Materiales · Profesor Sergio Blanco</p>
    <div class="chips">${Object.keys(groups).map(chip).join('')}</div></div>`, {part:'Portada', source:'Universidad Industrial de Santander · Selección de Materiales'});
  const {G} = D;
  add(title('Proyecto A', 'El sistema completo') +
    `<div class="chain">${Object.entries(areas).map(([key, area]) =>
      `<div style="--accent:${esc(groups[key].color)}"><b>${esc(key)}</b><span>${esc(area)}</span></div>`).join('<span class="arrow">→</span>')}</div>
    <p class="caption">A3 devuelve crudo tratado a A2 y agua de inyección al pozo de A1.</p>` +
    table(['CO₂ en gas','H₂S hoy','H₂S año 10','pH','BS&amp;W','Vida de diseño'],
      [[number(G.CO2)+' % mol', number(G.H2Shoy)+' % mol', number(G.H2S10)+' % mol',
        number(G.pH), number(G.bsw)+' %', number(G.vida)+' años']]));
  add(title('Método', 'La envolvente decide la selección') +
    `<ul class="method">
      <li><b>Corrientes C1–C6.</b> Se parte de las tasas base y las condiciones de cada equipo.</li>
      <li><b>CO₂ y O₂.</b> Se estima pérdida de pared y se contrasta con el sobreespesor o el intervalo de inspección.</li>
      <li><b>H₂S / SSC.</b> Presión parcial y pH ubican la región de severidad de ISO 15156.</li>
      <li><b>Inhibidor A.</b> Se evalúa la disponibilidad junto con los límites de presión, temperatura y calidad del fluido.</li>
    </ul><p class="notes">ISO 15156 · ISO 21457 · API 5CT / ISO 11960 · ISO 3183</p>`);
  for (const key of Object.keys(groups)) {
    add(`<div class="divider"><div class="nbig">${esc(key)}</div>${provisional(key)}<h2>${esc(areas[key] ?? key)}</h2>
      <div class="who">${roster(key).map(p => esc(shortName(p.nombre))).join(' · ')}</div></div>`,
      {group:key, section:true, part:key});
    for (const person of roster(key)) {
      const data = blocks(person);
      const scope = person.descripcion || [...person.equipos, ...person.piezas].map(tag => eq[tag]?.nombre ?? tag).join(' · ');
      const matrix = tags => table(['Pieza','Material', ...keys.map(k => compact(codes[k] ?? k, results.escenarios[k]))],
        tags.map(tag => {
          const p = data.base[tag];
          return [compact(tag, p.pieza), compact(p.mat_corto, p.material),
            ...keys.map(k => status(data[k][tag], results.escenarios[k]))];
        }));
      const legend = '<p class="caption states"><span class="state s0">✓</span> En envolvente <span class="state s1">!</span> Atención <span class="state s2">×</span> Fuera</p>';
      const scenarioKey = '<p class="caption scenario-key">' + keys.map(k =>
        '<span title="' + esc(results.escenarios[k]) + '"><b>' + esc(codes[k] ?? k) + '</b> ' +
        esc(({base:'Base',y10:'Año 10',adv:'Agrio',inh:'Inhibidor',o2:'Oxígeno',bsw:'Agua en crudo',calor:'Calor',pres:'Presión'})[k] ?? results.escenarios[k]) + '</span>').join('') + '</p>';
      const modules = key === 'A1' ? assignments[person.nombre.split(/\s+/).at(-1)].map(([name, title]) =>
        ({file:moduleFile(name), title, original:true})) : person.simuladores?.map(sim =>
        ({url:'../sim/' + sim.file + '.html', title:sim.titulo, notes:presenter[sim.file]})) ?? [];
      if (key === 'A1') modules.unshift({url:'../sim/' + person.key + '.html', title:'Evaluación del acta'});
      if (key === 'A2') {
        const file = a2Files[person.key.slice('A2_'.length)];
        if (!file) throw Error('Falta el simulador original de ' + person.key);
        modules.push({file:'A2/' + file, title:'Simulador original', original:true});
      }
      const scenarioTables = person.simuladores ? person.simuladores.map((sim, index) =>
        `<section data-sim-matrix${index ? ' hidden' : ''}><h4>${esc(sim.titulo)}</h4>${matrix(sim.tags)}</section>`).join('') :
        matrix(Object.keys(data.base));
      add(simulator(person.key, person.nombre,
        `${chip(key)}${provisional(key)}<h2>${esc(shortName(person.nombre))}</h2><p title="${esc(scope)}">${esc(scope)}</p>`,
        'Estado en los ocho escenarios', legend + scenarioTables + scenarioKey,
        modules),
        {group:key, part:key + ' · ' + areas[key], speaker:shortName(person.nombre), source:'Motor SD-01 a SD-12 · resultados.json'});
      const {rows, reading} = results.grupos[person.grupo].estudiantes[person.id].resultados;
      const dato = value => value == null ? 'sin dato' : number(Number(value.toFixed(1)));
      const fit = (value, full = value) => compact(value.length > 42 ? value.slice(0, 39) + '…' : value, full);
      const details = table(['Equipo · pieza', 'Original', 'Acta / motor', '¿Coinciden?', 'ISO 15156-2 · B → 10', 'Mecanismos', 'Vida / req. (a)', 'Norma de producto', 'Escenarios'],
        rows.map(row => [
          compact(row.tag, row.equipo + ' · ' + row.pieza),
          esc(row.original), fit(row.materialCorto, row.material), fit(row.coincidencia + (row.nota ? ' · ' + row.nota : '')),
          row.regiones.map(dato).join(' → '), fit(row.mecanismos.slice(0, 2).join(' · ') || 'sin dato', row.mecanismos.join(' · ') || 'sin dato'),
          [row.vida, row.requerida].map(dato).join(' / '), fit(row.norma),
          '<div class="checks">' + keys.map(k => status(data[k][row.tag], results.escenarios[k])).join('') + '</div>'
        ]));
      add(`<article class="student-results">${title(key, 'Resultados · ' + person.nombre)}
        <div class="result-table" tabindex="0" aria-label="Comparación por pieza">${details}</div>
        ${legend}${scenarioKey}<section class="result-reading"><h3>Lectura de resultados</h3>
        <ul>${reading.map(item => '<li>' + esc(item) + '</li>').join('')}</ul></section></article>`,
        {group:key, part:key + ' · Resultados', speaker:shortName(person.nombre), resultId:person.id,
          source:'Original del estudiante · D.json · Motor SD-01 a SD-12',
          notes:['30–45 s. En 10 s, compare el material original y el del acta en una fila.',
            'En 15 s, recorra región ISO 15156-2 de base a año 10, vida frente al requisito y chips.',
            'En 15 s, señale el escenario y la medida, y cierre con el alcance del original.', ...reading]});
    }
    const byEquipment = new Map();
    for (const p of Object.values(pieces[key])) {
      if (!byEquipment.has(p.eq)) byEquipment.set(p.eq, new Map());
      byEquipment.get(p.eq).set(p.mat_corto, p.material);
    }
    const summary = table(['Equipo','Materiales seleccionados'], [...byEquipment].map(([tag, materials]) =>
      [compact(tag, eq[tag].nombre), [...materials].map(([label, full]) => compact(label, full)).join(' · ')]));
    const groupMatrix = table(['Escenario', ...stateNames], keys.map(k => {
      const states = roster(key).flatMap(person => Object.values(blocks(person)[k]));
      return [esc(results.escenarios[k]), ...stateNames.map((_, i) => states.filter(p => p.s === i).length)];
    }));
    add(simulator(key + '_grupo', 'Simulador del grupo ' + key,
      `${chip(key)}${provisional(key)}<h2>Simulador del grupo</h2><p>${esc(areas[key] ?? key)}</p>`,
      'Estado en los ocho escenarios', groupMatrix + '<h3>Materiales por equipo</h3>' + summary),
      {group:key, part:key + ' · ' + areas[key], speaker:'Grupo ' + key});
  }
  const notes = Object.fromEntries(D.piezas.map(p => [p.tag, p]));
  const interfaces = [
    ['A1 → A2', 'XT-101-c / FL-201-a', '625 contra 625. El quill de CI-201-a queda 1 m aguas abajo de la brida.', 'XT-101-c', 'FL-201-a'],
    ['A3 → A2', 'T-302 / P-301', 'Crudo tratado con BS&W ≤ 1 % (SD-10). P-301 distingue 2–4 bar en succión y 45 bar(g) de descarga para C5.', 'T-302-b', 'P-301-a'],
    ['A3 → A1', 'WH-301 / WI-101-a', 'Agua tratada a 70 / 120 bar(g), 60 / 85 °C y O₂ ≤ 50 µg/l. WI-101 registra contraflujo amargo al cierre (r07).', 'WH-301-a', 'WI-101-a']
  ];
  add(simulator('integrado', 'Simulador integrado',
    '<span class="chip">Integración</span><h2>Tres fronteras de diseño</h2>',
    'Interfaces documentadas',
      table(['Frontera','Condiciones y diferencias'], interfaces.filter(row => notes[row[3]] && notes[row[4]])
        .map(([direction, tags, summary, a, b]) => [
          '<b>' + esc(direction) + '</b><br>' + esc(tags),
          compact(summary, notes[a].servicio + ' / ' + notes[b].servicio)
        ]))), {part:'Integración'});
  const counts = familyRules.map(([family, rule]) => [family,
    ...Object.values(pieces).map(group => Object.values(group).filter(rule).length)]);
  const totals = Object.values(pieces).map(group => Object.keys(group).length);
  const total = totals.reduce((sum, n) => sum + n, 0);
  const bars = keys.map(key => {
    const n = students.flatMap(p => Object.values(blocks(p)[key])).filter(p => p.s === 0).length;
    return `<div class="bar"><span>${esc(results.escenarios[key])}</span><div class="track"><i style="width:${100 * n / total}%"></i></div><b>${n}/${total}</b></div>`;
  }).join('');
  add(title('Resultados globales', 'Materiales y envolvente por escenario') +
    `<div class="results"><div><h3>Piezas por familia y grupo</h3>${table(['Familia',...Object.keys(groups)], [...counts, ['Total de piezas', ...totals]])}
    <p class="caption">Una pieza puede sumar en varias familias cuando combina material y protección.</p></div>
    <div><h3>Piezas en envolvente</h3>${bars}</div></div>`, {part:'Resultados globales', source:'Motor SD-01 a SD-12 · resultados.json'});
  add(title('Trazabilidad', 'De dónde salen los resultados') +
    `<ul class="method"><li><b>Simulador integrado Proyecto A.</b> Condiciones base, piezas y corrientes de <code>D.json</code>.</li>
      <li><b>Motor SD-01 a SD-12.</b> Ocho escenarios evaluados por pieza y guardados en <code>resultados.json</code>.</li>
      <li><b>Normas.</b> ISO 15156, ISO 21457, API 5CT / ISO 11960 e ISO 3183.</li>
      <li><b>Actas de interfaz e informes por grupo.</b> Referencias r07, D-01 y SD-10 citadas en las fichas.</li></ul>
      <p class="notes">Tamizaje no certificado. Las alternativas del motor requieren validación antes de especificar.</p>`);
  add(`<div class="cover"><span class="tag">Proyecto A</span><h1>Discusión</h1>
    <p>¿Qué condición deja primero a cada material fuera de su envolvente?</p>
    <div class="chips">${Object.keys(groups).map(chip).join('')}</div></div>`, {center:true, part:'Cierre'});

  const folder = '../presentacion';
  fs.mkdirSync(path.join(root, folder, 'assets'), {recursive:true});
  for (const file of ['estilo.css', 'navegacion.js']) write(folder + '/assets/' + file, read('plantilla/' + file));
  write(folder + '/index.html', `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Selección de materiales · Proyecto A</title><link rel="stylesheet" href="assets/estilo.css"></head>
<body><main id="stage" aria-label="Presentación del Proyecto A">
${slides.join('\n')}
<div class="topline" aria-hidden="true"></div>
<header><img src="assets/logo_uis_bn.png" alt="Universidad Industrial de Santander"><span class="sep"></span><span id="part"></span><span id="speaker" hidden></span></header>
<footer><div id="source"></div><nav id="progress" aria-label="Diapositivas"></nav><output id="counter" aria-live="polite"></output></footer>
<button id="guide-toggle" type="button" aria-expanded="false" aria-controls="guide">Guía (N)</button>
</main><aside id="guide" aria-labelledby="guide-title" hidden><h2 id="guide-title">Guía del presentador</h2>
<button id="guide-close" type="button" aria-label="Cerrar guía">×</button><ol id="guide-notes"></ol></aside>
<script src="assets/navegacion.js"></script></body></html>\n`);
  console.log('Generadas ' + slides.length + ' diapositivas.');
};
