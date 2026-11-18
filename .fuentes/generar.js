'use strict';

const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.dirname(path.resolve(process.argv[1]));
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
const write = (file, value) => fs.writeFileSync(path.join(root, file), value, 'utf8');
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const originals = require('./originales.js');
const D = JSON.parse(originals.correctPipeGrades(read('../../datos/D.json')));
const groups = JSON.parse(read('datos/asignaciones.json'));
originals.buildOriginals({D, read, write, root});
const original = read('../sim/originales/' + originals.plant);
const template = read('simulador.html');
const buildEquipment = require('./equipos.js');
const studentResults = require('./resultados-estudiante.js');
function extract(pattern, label) {
  const match = original.match(pattern);
  if (!match) throw Error('No se encontró ' + label);
  return match[1];
}
const motor = extract(/(\(function\(root\)\{[\s\S]*?\}\)\(typeof window!=='undefined'\?window:globalThis\);)/, 'Motor');
const presets = extract(/(const G0=[^\r\n]+[\s\S]*?)(?=function nivel\(s\))/, 'escenarios');
const baseCSS = extract(/<style>([\s\S]*?)<\/style>/, 'CSS base');
const envCSS = extract(/<style>(\s*#v-envolvente[\s\S]*?)<\/style>/, 'CSS de envolvente');
const scenarioFactory = '(D, render) => {\n' + presets +
  '\nreturn {PRE, aplicarPreset, get estado(){return st;}};\n}';

const glossary = 'datos/materiales_cortos.json';
const labels = JSON.parse(originals.correctPipeGrades(read('../../datos/materiales_cortos.json')));
const shorten = value => {
  const text = String(value ?? '—');
  if (text.length <= 28) return text;
  const cut = text.slice(0, 27);
  return (cut.lastIndexOf(' ') >= 18 ? cut.slice(0, cut.lastIndexOf(' ')) : cut) + '…';
};
const aliases = [
  [/grado (J55|K55)/i, '$1'],
  [/L80 tipo 1.*(625|CRA tipo 4|liner\))/i, (_, liner) => 'L80 tipo 1 + ' + (liner === '625' ? 'CRA 625' : liner.startsWith('CRA') ? 'CRA tipo 4' : 'GRE')],
  [/L80 tipo 1/i, 'L80 tipo 1'],
  [/L360NS.*intern[oa].*CRA.*825.*625/i, 'L360NS PSL2 + CRA 825/625'],
  [/L360NS.*PSL ?2/i, 'L360NS PSL2'],
  [/A516.*70.*HIC/i, 'A516-70 HIC'],
  [/^(?=.*WCB)(?=.*CA6NM)/i, 'WCB / CA6NM'],
  [/^(?=.*4130)(?=.*625)/i, '4130 + 625'],
  [/^.{0,60}GRP.*vinil/i, 'GRP viniléster'],
  [/^(?:Forjado.*|Acero.*)4130/i, 'Acero 4130'],
  [/^Igual a TL-201-a$/i, 'L360NS PSL2'],
  [/TP316L/i, 'A312 TP316L'],
  [/X42.*L290/i, 'X42 / L290 PSL2'],
  [/A106\s*(?:Gr\.?\s*)?B\b/i, 'ASTM A106 B'],
  [/^Chapa.*A36.*A516/i, 'A36 / A516-70'],
  [/^Chapa de acero al carbono/i, 'Chapa de acero al carbono'],
  [/^Tubería GRE|^GRE\b/i, 'GRE'],
  [/^Ánodos galvánicos de/i, 'Ánodos galvánicos'],
  [/^Corriente impresa/i, 'PC corriente impresa'],
  [/^Zn\(R\) \+ EP\/PUR/i, 'Zn(R) + EP/PUR']
];
const protectionAliases = [
  [/^Cemento a superficie/i, 'Cemento a superficie'],
  [/^Epoxi (fenólico|con escama de vidrio)|^EPGF/i, value =>
    /fenólico/i.test(value) ? 'Epoxi fenólico' : 'Epoxi con escama de vidrio'],
  [/^(?:Protección catódica galvánica|PC galvánica)/i, 'PC galvánica'],
  [/^PC por corriente impresa/i, 'PC corriente impresa'],
  [/^Revestimiento orgánico interno.*novolac/i, 'Epoxi novolaca interno'],
  [/^625 por soldadura.*pintura C4/i, '625 + pintura C4']
];
for (const p of D.piezas) {
  const rule = aliases.find(([pattern]) => pattern.test(p.material));
  const protection = protectionAliases.find(([pattern]) => pattern.test(p.proteccion));
  const defaults = {
    mat_corto: shorten(rule ? (typeof rule[1] === 'function' || rule[1].includes('$')
      ? p.material.match(rule[0])[0].replace(...rule) : rule[1]) : p.material),
    prot_corta: shorten(protection ? (typeof protection[1] === 'function'
      ? protection[1](p.proteccion.match(protection[0])[0]) : protection[1]) : p.proteccion)
  };
  labels[p.tag] = {...defaults, ...labels[p.tag]};
  Object.assign(p, labels[p.tag]);
}
write(glossary, JSON.stringify(labels, null, 2) + '\n');

const students = [];
const issues = [];
const assignments = new Map();
for (const [grupo, group] of Object.entries(groups)) {
  for (const person of group.integrantes) {
    const key = grupo + '_' + person.id;
    const tags = [];
    function assign(piece) {
      tags.push(piece.tag);
      if (!assignments.has(piece.tag)) assignments.set(piece.tag, []);
      assignments.get(piece.tag).push(key);
    }
    for (const tag of person.equipos) {
      const pieces = D.piezas.filter(p => p.eq === tag && p.sistema === grupo);
      if (!pieces.length) issues.push(key + ': equipo sin piezas en ' + grupo + ' · ' + tag);
      pieces.forEach(assign);
    }
    for (const tag of person.piezas) {
      const piece = D.piezas.find(p => p.tag === tag && p.sistema === grupo);
      if (piece) assign(piece);
      else issues.push(key + ': pieza desconocida en ' + grupo + ' · ' + tag);
    }
    const simuladores = person.simuladores?.map((sim, index) => {
      const equipmentTags = new Set(sim.equipos ?? []);
      const simTags = [...D.piezas.filter(p => tags.includes(p.tag) && equipmentTags.has(p.eq)).map(p => p.tag),
        ...(sim.piezas ?? [])];
      if (!simTags.length || simTags.some(tag => !tags.includes(tag)) ||
          [...equipmentTags].some(eq => !D.piezas.some(p => p.eq === eq && simTags.includes(p.tag)))) {
        issues.push(key + ': alcance inválido en ' + sim.titulo);
      }
      return {...sim, file:key + '_' + (index + 1), tags:[...new Set(simTags)]};
    });
    if (grupo === 'A2' && (simuladores?.length !== 2 || tags.some(tag =>
      !simuladores.some(sim => sim.tags.includes(tag))))) issues.push(key + ': faltan simuladores o piezas');
    students.push({...person, grupo, key, tags, simuladores});
  }
}
const seen = new Set();
for (const piece of D.piezas) {
  if (seen.has(piece.tag)) issues.push('Etiqueta repetida en D: ' + piece.tag);
  seen.add(piece.tag);
  const owners = assignments.get(piece.tag) || [];
  if (!owners.length) issues.push('Sin asignar: ' + piece.sistema + ' · ' + piece.tag);
  if (owners.length > 1) issues.push('Asignación repetida: ' + piece.tag + ' · ' + owners.join(', '));
  if (!D.eq.some(eq => eq.tag === piece.eq && eq.sistema === piece.sistema))
    issues.push('Equipo inexistente o de otro sistema: ' + piece.tag + ' · ' + piece.eq);
}
if (issues.length) throw Error(issues.join('\n'));
console.log(D.piezas.length + ' piezas asignadas una vez; EC-201-KA se asignó por etiqueta de pieza.');

function scopedData(roster) {
  const tags = new Set(roster.flatMap(person => person.tags));
  const piezas = D.piezas.filter(p => tags.has(p.tag));
  const equipment = new Set(piezas.map(p => p.eq));
  return {...D, piezas, eq: D.eq.filter(e => equipment.has(e.tag))};
}

const Motor = vm.runInNewContext(motor + '\nMotor');
const makeScenarios = vm.runInNewContext(scenarioFactory);
const m = Motor(D);
const scenarios = makeScenarios(D, () => {});
const results = {escenarios: Object.fromEntries(scenarios.PRE), conteos: {}, grupos: {}};
const scenarioStates = {};
function checkNumbers(value, context) {
  if (typeof value === 'number' && Number.isNaN(value)) throw Error('NaN: ' + context);
  if (value && typeof value === 'object') {
    for (const [field, child] of Object.entries(value)) checkNumbers(child, context + '.' + field);
  }
}
for (const [grupo, group] of Object.entries(groups)) {
  results.grupos[grupo] = {confirmada: group.confirmada, estudiantes: {}};
}
for (const student of students) {
  results.grupos[student.grupo].estudiantes[student.id] = {nombre: student.nombre, escenarios: {}};
}
for (const [key] of scenarios.PRE) {
  scenarios.aplicarPreset(key);
  const state = scenarios.estado;
  scenarioStates[key] = state;
  results.conteos[key] = Array.from(m.resumen(state).c).slice(0, 3);
  checkNumbers(m.planta(state), key + '.planta');
  for (const person of students) {
    const student = results.grupos[person.grupo].estudiantes[person.id];
    student.escenarios[key] = Object.fromEntries(person.tags.map(tag => {
      const r = m.evalPieza(state, tag);
      const context = key + '.' + tag;
      checkNumbers(r, context);
      checkNumbers(m.limites(state, tag), context + '.limites');
      const solutions = r.s > 0 ? m.sol(state, tag) : [];
      checkNumbers(solutions, context + '.sol');
      if (![0, 1, 2].includes(r.s) || (r.c && !Number.isFinite(r.c.life))) throw Error(context);
      const {eq, pieza, material, mat_corto, proteccion, prot_corta, familia, ca} = r.p;
      return [tag, {s: r.s, vida: r.c?.life ?? null, 'región': r.reg ?? null,
        eq, pieza, material, mat_corto, proteccion, prot_corta, familia, ca, vidaRequerida:r.c?.req ?? null,
        mecanismos:r.p.mec, checks:r.checks,
        medidas: solutions.filter(({apply}) => {
          if (!apply) return false;
          const {eq, ...fields} = apply;
          const changed = {...state, eq:{...state.eq, [eq]:{...state.eq[eq],...fields}}};
          return m.evalPieza(changed, tag).s === 0;
        }).map(x => x.tit),
        alternativas: solutions.filter(x => x.t === 'material').map(x => x.tit)}];
    }));
  }
}

for (const person of students) {
  const student = results.grupos[person.grupo].estudiantes[person.id];
  student.resultados = studentResults(person, student.escenarios, results.escenarios);
}

fs.mkdirSync(path.join(root, '../sim'), {recursive: true});
const presetList = scenarios.PRE.map(([key, name]) => ({key, name, state:scenarioStates[key]}));
const plantPath = '../sim/originales/' + originals.plant;
write(plantPath, original.replace(/^const PLANTA_HTML = (.*);$/m, (_, encoded) => {
  const page = buildEquipment.labelEquipment(buildEquipment.syncPresets(JSON.parse(encoded), presetList));
  return 'const PLANTA_HTML = ' + JSON.stringify(page).replace(/<\//g, '<\\/') + ';';
}));
const equipmentPage = buildEquipment(original);
function page(file, title, scope, roster, description, focus) {
  const group = roster[0].grupo;
  if (scope !== 'integrado') {
    const data = scopedData(roster);
    write('../sim/' + file + '.html', equipmentPage({
      title, color: groups[group].color, data: D, tags: data.eq.map(e => e.tag),
      pieces: data.piezas.map(p => p.tag), showWells: file === 'A2_grupo', focus,
      presets: presetList
    }));
    return;
  }
  const config = {title, scope, roster:roster.map(({simuladores, ...person}) => person), description, groups: Object.fromEntries(
    [...new Set(roster.map(p => p.grupo))].map(key => {
      const {color, confirmada} = groups[key];
      return [key, {color, confirmada}];
    })
  )};
  const replacements = {
    CSS: baseCSS + '\n' + envCSS, MOTOR: motor, PRESETS: scenarioFactory,
    DATA: json(scopedData(roster)), CONFIG: json(config),
    PROCESS: read('proceso.js'), MATRIX: json(Object.fromEntries(
      Object.keys(results.escenarios).map(key => [key, Object.assign({},
        ...roster.map(p => results.grupos[p.grupo].estudiantes[p.id].escenarios[key]))])
    ))
  };
  write('../sim/' + file + '.html', template.replace(/@@(\w+)@@/g, (_, key) => replacements[key]));
}
for (const person of students) {
  if (person.simuladores) {
    for (const sim of person.simuladores) {
      page(sim.file, sim.titulo, 'estudiante', [{...person, tags:sim.tags}], '', sim.enfoque);
    }
  }
  page(person.key, person.nombre, 'estudiante', [person],
    person.descripcion || [...person.equipos, ...person.piezas].join(' · '));
}
write('../COBERTURA.md', '# Cobertura de la presentación\n\n' +
  D.piezas.length + ' piezas asignadas exactamente una vez.\n\n' +
  '| Grupo | Estudiante | Equipos y piezas asociadas | Módulos |\n| --- | --- | --- | --- |\n' +
  students.map(person => {
    const data = scopedData([person]);
    const equipment = data.eq.map(e => e.tag + ' (' + data.piezas.filter(p => p.eq === e.tag).length + ')');
    return '| ' + [person.grupo, person.nombre, equipment.join(', '),
      person.simuladores?.map(sim => sim.titulo + ' (' + sim.tags.join(', ') + ')').join('<br>') ??
      (person.grupo === 'A3' ? 'Selector por equipo' : 'Módulos originales')].join(' | ') + ' |';
  }).join('\n') + '\n\n' +
  'CI-201-c se visualiza en los dos simuladores de Juan Fajardo y cuenta una vez en la cobertura.\n\n' +
  'Conteo base del motor compartido (en envolvente / atención / fuera): **' +
  results.conteos.base.join(' / ') + '**. ' +
  'El generador extrae el motor de la copia corregida que abre Integración.\n');
for (const group of Object.keys(groups)) {
  page(group + '_grupo', 'Grupo ' + group, 'grupo', students.filter(p => p.grupo === group), 'Selección de materiales del grupo');
}
page('integrado', 'Proyecto A', 'integrado', students, 'Selección de materiales de la planta');
require('./consistencia.js')({D, read, write});
write('../resultados.json', JSON.stringify(results, null, 2) + '\n');
if (process.argv.includes('--presentacion')) {
  const buildDeck = require('./presentacion.js');
  const presenter = {
    general: [
      ['Abra con el problema de integridad. Dedique 2 min a problema, condiciones y método, 60–90 s por estudiante y 3 min a integración y resultados.',
        'Siga el flujo desde A1 a A2 y A3. Cierre con el retorno de crudo y de agua. El material se selecciona para un servicio y una condición límite.'],
      [`Identifique los ${D.G.npozos} pozos productores y la continuidad de las corrientes. Lea las condiciones base y la vida de diseño de ${D.G.vida} años.`],
      ['Explique la presión parcial calculada con presión absoluta y la región SSC de la Figura 1. Compare pérdida de pared, protección e intervalo requerido.'],
      ['Identifique la condición que gobierna la selección y la acción si se supera el límite.']
    ],
    A1: ['Vaya de fondo a superficie. Identifique los sellos, el árbol y el límite con la primera línea de flujo.'],
    A2: ['Siga los ocho pozos hasta producción y prueba. Continúe a transferencia y dosificación.'],
    A3: ['Siga la separación, el tratamiento de crudo y gas y la reinyección de agua.'],
    'Grupo A1': ['Explique XT-101-c / FL-201-a y el aislamiento de protección catódica. Contraste la frontera del inyector con el servicio amargo de contraflujo.'],
    'Grupo A2': [`Siga los ocho ramales hacia MF-201 y MF-202. La línea de transferencia y la descarga de P-301 operan a ${D.eq.find(e => e.tag === 'TL-201').P} bar(g). Identifique el tubo L360NS (anexo H, servicio amargo).`],
    'Grupo A3': ['Explique la entrega de crudo tratado a P-301 y de agua a WI-101. Señale cómo el oxígeno condiciona la devolución de agua.'],
    'Integración': [`Ubique XT-101-c / FL-201-a, T-302 / P-301 y WH-301 / WI-101-a. En TL-201, muestre el tubo L360NS (anexo H, servicio amargo) y los ${D.eq.find(e => e.tag === 'TL-201').P} bar(g) de operación. Señale el contraflujo amargo al cierre del inyector.`],
    'Resultados globales': [`Lea el conteo base en orden: ${results.conteos.base.join(' / ')} para envolvente, atención y fuera. Compare el escenario con mayor pérdida de cobertura.`]
  };
  const controls = {base:'la presión', y10:'el H₂S', adv:'el H₂S', inh:'la disponibilidad de inhibidor',
    o2:'el oxígeno disuelto', bsw:'el BS&W', calor:'la temperatura', pres:'la presión'};
  for (const person of students) {
    const shortName = person.nombre.split(/\s+/)[0] + ' ' + person.nombre.split(/\s+/).at(-1);
    for (const sim of person.simuladores ?? [{tags: person.tags}]) {
      const data = results.grupos[person.grupo].estudiantes[person.id].escenarios;
      const scoped = Object.entries(data).map(([key, rows]) => [key,
        Object.fromEntries(sim.tags.map(tag => [tag, rows[tag]]))]);
      const score = rows => Object.values(rows).reduce((sum, row) => sum + (row.s === 2 ? sim.tags.length + 1 : row.s), 0);
      const [key, rows] = scoped.sort((a, b) => score(b[1]) - score(a[1]) ||
        Number(a[0] === 'base') - Number(b[0] === 'base'))[0];
      const [tag, row] = Object.entries(rows).sort((a, b) => b[1].s - a[1].s ||
        Number(b[1].vida != null || b[1]['región'] != null) - Number(a[1].vida != null || a[1]['región'] != null))[0];
      const piece = D.piezas.find(p => p.tag === tag);
      const equipment = scopedData([sim]).eq;
      const required = row.vidaRequerida;
      const metric = row['región'] != null ? `Región SSC ${row['región']} (ISO 15156-2, Figura 1).` :
        row.vida != null ? `Vida calculada ${Number(row.vida.toFixed(2))} años.${required != null ? ' Requerida: ' + required + ' años.' : ''}` :
          piece.ca != null ? `Sobreespesor especificado: ${piece.ca} mm.` : 'Muestre el criterio de aceptación en la ficha de la pieza.';
      presenter[sim.file ?? shortName] = [
        ...(sim.titulo ? [sim.titulo + (sim.enfoque === 'tanque' ? ' · Explique el almacenamiento de inhibidor en CI-201-c.' :
          sim.enfoque === 'inyeccion' ? ' · Explique las bombas en CI-201-c y los puntos de inyección.' : '')] : []),
        `Servicio. ${equipment.map(e => e.tag + ' · ' + e.nombre).join('; ')}. Para ${tag}: ${piece.servicio}`,
        `Mecanismos de ${tag}. ${piece.mec.slice(0, 3).join(' · ')}.`,
        `Demostración. Abra la ficha de ${tag}, seleccione «${results.escenarios[key]}» en la evaluación de equipos y varíe ${controls[key]}. Muestre el umbral o el criterio que limita la pieza.`,
        `Selección para ${tag}. ${piece.material}. Protección: ${piece.proteccion}. ${metric}`
      ];
    }
  }
  buildDeck({D, groups, students, results, presenter, read, write, root});
}
console.log('Verificadas ' + D.piezas.length * scenarios.PRE.length + ' evaluaciones con sus límites en Node.');
console.log('Generados ' + (students.reduce((n, person) => n + (person.simuladores?.length ?? 1), 0) +
  Object.keys(groups).length + 1) + ' simuladores y resultados.json.');
