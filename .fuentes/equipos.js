'use strict';

const escapeHTML = value => value.replace(/[&<>"]/g, char =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[char]));
const serialize = value => JSON.stringify(value).replace(/</g, '\\u003c');
const {wellsDiagram} = require('./originales.js');

function syncPresets(html, presets) {
  const declaration = `const ESC = ${serialize(presets)}.map(({key, name, state}) => ({
  k:key, n:name, f:target => Object.assign(target, {G:{...target.G,...state.G}, eq:JSON.parse(JSON.stringify(state.eq)), preset:true, bio:target.G.BIO})
}));`;
  return html
    .replace(/const ESC = \[[\s\S]*?\n\];/, () => declaration)
    .replaceAll("aplicarEsc('acta')", "aplicarEsc('base')")
    .replaceAll("this.esc === 'acta'", "this.esc === 'base'")
    .replace("esc: 'acta', play:", "esc: 'base', play:")
    .replace("if (!keepEsc) this.esc = '';", "if (!keepEsc) { this.esc = ''; delete ST.preset; }")
    .replace('const { E, her, S } = efectivo(st);',
      'const { E, her, S } = st.preset ? {E:st, her:{}, S:M.planta(st)} : efectivo(st);')
    .replace('let ST = estadoActa();','let ST = estadoActa(); ST.preset = true; ST.bio = ST.G.BIO;');
}

function labelEquipment(html) {
  return html
    .replace("12, H * .3 - 6", "12, H * .29")
    .replace("ci0 + 4, y0 - 14", "W * .48, H * (o.tag === 'FL-201' ? .72 : .29)")
    .replace("ci0 - 40, y0 - 46", "12, H * .19")
    .replace("DIB.etiquetas(c, W, H, asig, EQV.res, EQV.sel)", "[]")
    .replace(/const hit = EQV\.cajas\.some[^\r\n]+/, `const hit = Object.entries(EQV.zonas).find(([,z]) =>
      x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
    ev.target.title = hit ? hit[0] + ' · ' + EQV.res[hit[0]].p.pieza : '';`)
    .replace("c.fillText('pérdida de contención'", "c.fillText('Fuga'")
    .replace("lab: 'pérdida de contención'", "lab: ''")
    .replace('lab: ' + '\`vida de diseño \${vida} a\`', "lab: ''")
    .replace('lab: ' + '\`año \${fmt(E.G.anio, 1)}\`', "lab: ''")
    .replace('<canvas id="cvVida"', '<p id="vidaLeyenda" style="margin:6px 12px 0;font-size:12px"></p><canvas id="cvVida"')
    .replace("  let top = 1.25;", "  if ($('#cvVida').clientWidth < 180) return; $('#vidaLeyenda').textContent = 'Rojo · pérdida de contención al 100 %  |  Violeta · vida de diseño ' + vida + ' a  |  Azul · año ' + fmt(E.G.anio, 1);");
}

// PLANTA_HTML is the complete offline build of the user's “Simulador de planta”.
// Keep its drawing, physics, corrosion cards and equipment controls together.
module.exports = function buildEquipment(original) {
  const bundle = original.match(/^const PLANTA_HTML = (.*);$/m);
  if (!bundle) throw Error('No se encontró el simulador de planta incrustado');
  const source = JSON.parse(bundle[1]);
  const dataLine = source.match(/^const D=(.*);$/m);
  const embeddedData = JSON.parse(dataLine[1]);

  function replace(html, search, replacement) {
    if (typeof search === 'string' ? !html.includes(search) : !search.test(html))
      throw Error('Cambió el simulador de planta: ' + search);
    return html.replace(search, () => replacement);
  }

  return ({title, color, data = embeddedData, tags, pieces, showWells, focus, presets}) => {
    const eq = tags.map(tag => data.eq.find(e => e.tag === tag));
    const byTag = new Map(data.piezas.map(p => [p.tag, p]));
    const scopedPieces = pieces.map(tag => byTag.get(tag));
    if (eq.includes(undefined) || scopedPieces.includes(undefined))
      throw Error('Falta un equipo o pieza en el simulador de planta: ' + title);

    let html = replace(source, /<title>.*?<\/title>/, '<title>' + escapeHTML(title) + ' · Simulador de planta</title>');
    html = replace(html, /const D=.*?;\r?\n/, 'const D=' + serialize({...data, eq, piezas: scopedPieces}) + ';\n' +
      // The original process simulation needs upstream base conditions even when those
      // assets cannot be selected. The view and piece evaluations use the assigned scope.
      'const procesoEq=' + serialize(data.eq) + ';\n' +
      (focus ? 'const enfoque=' + serialize(focus) + ';\n' : ''));
    if (tags.some(tag => ['MF-201', 'MF-202'].includes(tag))) {
      const manifold = source.match(/  P\.multiple = [\s\S]*?(?=  P\.pozo = )/)[0];
      html = replace(html, manifold, manifold
        .replace('for (let i = 0; i < 5; i++)', 'for (let i = 0; i < D.G.npozos; i++)')
        .replaceAll('(x1 - x0 - 100) / 4', '(x1 - x0 - 100) / Math.max(1, D.G.npozos - 1)')
        .replace('x - 18, H * .1', 'x - 15, H * .1'));
    }
    if (tags.includes('FL-201')) {
      html = replace(html, '    // sección transversal', `
    if (o.tag === 'FL-201') {
      txt(c, D.G.npozos + ' pozos · ' + D.G.npozos + ' líneas de flujo', W * .35, H * .10);
      for (let i = 0; i < D.G.npozos; i++) {
        const x = W * (.36 + i * .06), y = H * .26, length = H * .10;
        c.fillStyle = met(c, x - 4, 0, 8, 0, true);
        rr(c, x - 4, y - length, 8, length, 3); c.fill();
        flujoV(c, 'fl' + i, x - 2, x + 2, y - length, y, 3, t, o.colF, o.vel);
        txt(c, String(i + 1), x - 4, y + 14);
      }
    }
    // sección transversal`);
    }
    if (focus === 'aereo') {
      html = replace(html, "['L-304', 'TL-201'].includes(o.tag)", "o.tag === 'L-304'");
    }
    if (focus === 'tanque' || focus === 'inyeccion') {
      const skid = source.match(/  P\.skid = [\s\S]*?(?=  P\.pc = )/)[0];
      html = replace(html, skid, skid
        .replace("bio ? 'biocida' : 'inhibidor'", "bio ? 'biocida' : 'tanque de inhibidor'")
        .replace("    return Z;", `    const zone = enfoque === 'tanque' ? Z[0] : Z[1];
    zone.forzar = 'CI-201-c';
    c.strokeStyle = '#27a9e1'; c.lineWidth = 2;
    rr(c, zone.x - 4, zone.y - 4, zone.w + 8, zone.h + 8, 8); c.stroke();
    return Z;`));
    }
    html = labelEquipment(html)
      .replace("aria-label=\"Material de ${p.tag}\"", "title=\"${esc(r.mat?.n ?? p.material)}\" aria-label=\"Material de ${p.tag}\"")
      .replace("p.material.replace(/\(.*?\)/g, '').slice(0, 60)", "p.mat_corto ?? p.material")
      .replace("Presión de operación, bar", "Presión de operación, bar(g)");
    html = html.replace("  $('#eqIzq').innerHTML = s;", `  const gFields = [
    ['CO2','CO₂ en gas, % mol',0,10,.1], ['H2Shoy','H₂S hoy, % mol',0,1.5,.01],
    ['H2S10','H₂S año 10, % mol',0,1.5,.01], ['pH','pH del agua',3.4,6.5,.05],
    ['bsw','Corte de agua del campo, %',5,98,1], ['vida','Vida de diseño, años',5,30,1]
  ];
  const globalOpen = $('#condicionesGlobales')?.open;
  s += '<details class="pnl" id="condicionesGlobales"' + (globalOpen ? ' open' : '') + '><summary>Condiciones globales</summary><div class="cu">' +
    gFields.map(([key,label,min,max,step]) => sliderH('global-'+key,label,ST.G[key],min,max,step,'',null,false)).join('') +
    '<p class="nota">La ficha de cada pieza indica su intervalo y si usa una presión parcial de H₂S propia.</p></div></details>';
  $('#eqIzq').innerHTML = s;
  gFields.forEach(([key]) => bindSl('global-'+key, value => { ST.G[key] = value; APP.cambio('Condiciones globales'); }));`);
    html = replace(html, 'const M = Motor(D)', 'const M = Motor({...D, eq: procesoEq})');
    html = syncPresets(html, presets);
    html = replace(html, /<nav class="nav"[\s\S]*?<\/nav>/,
      '<div class="equipment-picker"><span id="navEq" hidden></span>' +
      '<div id="equipmentTabs" role="group" aria-label="Equipos asignados"></div>' +
      '<select id="equipmentScenario" aria-label="Escenario"></select>' +
      (showWells ? '<details class="wells"><summary>8 pozos y ramales</summary>' + wellsDiagram(data.G.npozos) + '</details>' : '') + '</div>');
    html = replace(html, /if \(window.parent !== window\)/,
      "if (new URLSearchParams(location.search).get('embed') === '1' || window.parent !== window)");
    html = replace(html, 'PL.actualizar(this.R);', '');
    html = replace(html, '<button class="btn" id="eqVolver">Volver a la planta</button>', '');
    html = replace(html, "abrirEquipo('V-301')", 'abrirEquipo(D.eq[0].tag)');
    html = replace(html, 'EQV.tag = tag; EQV.sel = pieza || EQV.res && null;', `if (!D.eq.some(e => e.tag === tag)) return;
  EQV.tag = tag;
  document.querySelectorAll('#equipmentTabs button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.equipment === tag)));
  $('#eqCentro').scrollTop = 0;
  $('#eqIzq').scrollTop = 0;
  $('#eqDer').scrollTop = 0;`);
    html = replace(html, "APP.ir('equipo');\n  renderEquipo(true);", "APP.ir('equipo');");
    html = replace(html, "const up = LINKS.filter(l => l[1] === tag), dn = LINKS.filter(l => l[0] === tag);",
      "const up = LINKS.filter(l => l[1] === tag && R.eqs[l[0]]), dn = LINKS.filter(l => l[0] === tag && R.eqs[l[1]]);");
    html = replace(html, 'Primer equipo de la cadena.', 'Sin conexiones aguas arriba en esta vista.');
    html = replace(html, 'Último equipo de la cadena.', 'Sin conexiones aguas abajo en esta vista.');
    html = replace(html, "const M = Motor({...D, eq: procesoEq}), fmt = Motor.fmt;",
      "const M = Motor({...D, eq: procesoEq}), fmt = (value, digits) => value == null ? 'sin dato en el acta' : Motor.fmt(value, digits);");
    html = replace(html, /function datosPieza\(r\) \{[\s\S]*?\n\}/, source.match(/function datosPieza\(r\) \{[\s\S]*?\n\}/)[0]
      .replaceAll("'—'", "'sin dato en el acta'")
      .replace("['Temperatura',", "['Presión de diseño', k.Pdis == null ? 'sin dato en el acta' : \`\${fmt(k.Pdis)} bar\`], ['Temperatura',"));
    html = replace(html, "(p.mec || []).map(esc).join('<br>') || '—'", "(p.mec || []).map(esc).join('<br>') || 'sin dato en el acta'");
    html = replace(html, "(p.proteccion || '—')", "(p.proteccion || 'sin dato en el acta')");
    html = replace(html, '${!m && p.proteccion ? `<p class="nota" style="margin:4px 0">Protección: ${esc(p.proteccion)}</p>` : \'\'}',
      '${!m ? `<p class="nota" style="margin:4px 0">Protección: ${esc(p.proteccion || "sin dato en el acta")}</p>` : \'\'}');
    html = replace(html, "const ca = (r.c && (r.c.ca || r.p.ca)) || r.p.ca || 3, tm", "const caReal = r.c?.ca ?? r.p.ca;\n  const ca = caReal ?? 3, tm");
    html = replace(html, 'sobreespesor ${fmt(ca, 1)} mm`', "sobreespesor ${caReal == null ? 'sin dato en el acta' : fmt(ca, 1) + ' mm'}`");
    html = replace(html, "const nomet = r.mat && r.mat.cls === 'NOMET', rec = (r.mat && r.mat.rec) || (r.c && r.c.modo === 'rev');",
      `const nomet = r.mat && r.mat.cls === 'NOMET';
  const proteccionInterna = !r.mat && /(?:revestimiento|recubrimiento|barrera) (?:orgánico |CRA )?intern[oa]|epoxi fenólico interno/i.test((r.p.proteccion || '') + ' · ' + r.p.material);
  const rec = r.mat?.rec || r.c?.modo === 'rev' || proteccionInterna;`);
    html = replace(html, "c.fillRect(0, yI - 4, W, 4); }", "c.fillRect(0, yI - 4, W, 4); c.fillText('recubrimiento interior', 10, yI - 8); }");
    html = replace(html, 'renderEqDer(); renderTab(); vidaChart();\n}', 'renderEqDer(); renderTab(); vidaChart(); lecturas();\n}');
    html = replace(html, 'EQV.sel = d.dataset.pz; renderEqIzq(); renderEqDer(); renderTab();',
      'EQV.sel = d.dataset.pz; renderEqIzq(); renderEqDer(); renderTab(); vidaChart(); lecturas();');
    html = replace(html, "APP.vista === 'equipo' && EQV.tag && EQV.res",
      "APP.vista === 'equipo' && EQV.tag && EQV.res && $('#cvEq').clientWidth >= 180");
    html = replace(html, /document\.querySelector\('\.nav'\)\.addEventListener[\s\S]*?initTiempo\(\);/, `
const equipmentTabs = $('#equipmentTabs');
equipmentTabs.innerHTML = D.eq.map(e =>
  '<button type="button" data-equipment="' + e.tag + '" title="' + esc(e.nombre) + '">' + e.tag + '</button>').join('');
equipmentTabs.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (button) abrirEquipo(button.dataset.equipment);
});
const scenarioSelect = $('#equipmentScenario');
scenarioSelect.innerHTML = ESC.map(e => '<option value="' + e.k + '">' + esc(e.n) + '</option>').join('')
  + '<option value="" disabled>Escenario modificado</option>';
scenarioSelect.onchange = () => APP.aplicarEsc(scenarioSelect.value);
ESC[0].f(ST);
APP.recalc();
const initialEquipment = new URLSearchParams(location.search).get('equipo');
abrirEquipo(D.eq.some(e => e.tag === initialEquipment) ? initialEquipment : D.eq[0].tag);
initEquipo();
initTiempo();
new ResizeObserver(() => {
  if ($('#cvEq').clientWidth >= 180) {
    vidaChart();
    renderTab();
  }
}).observe($('#cvEq'));`);
    html = replace(html, "$('#chipEsc').textContent", "$('#equipmentScenario').value = this.esc;\n    $('#chipEsc').textContent");
    html = replace(html, /<h1>Simulador de planta<\/h1>/, '<h1>' + escapeHTML(title) + '</h1>');
    html = replace(html, '</head>', `<style>
:root { --grupo: ${color}; --acc: color-mix(in srgb,var(--grupo),#102b41 38%); }
.app, .embebido .app { min-height:0; grid-template-rows:auto minmax(0,1fr); }
.top { flex-wrap:wrap; padding:7px 12px; gap:8px; border-top:4px solid var(--grupo); }
.top-der { display:none; }
.equipment-picker { display:flex; flex:1 1 680px; min-width:0; flex-wrap:wrap; gap:6px 12px; align-items:center; }
#equipmentTabs { display:flex; flex:1 1 480px; min-width:0; flex-wrap:wrap; gap:4px; }
#equipmentTabs button, #equipmentScenario { border:1px solid var(--line2); background:#fff; border-radius:6px; padding:4px 7px; font-weight:600; }
#equipmentTabs button[aria-pressed=true] { background:color-mix(in srgb,var(--grupo),#fff 72%); border-color:var(--grupo); }
#equipmentScenario { max-width:100%; font-size:12px; }
.pz select {width:100%;min-width:0;max-width:100%;text-overflow:ellipsis;}
#condicionesGlobales summary {cursor:pointer;padding:9px 12px;font-weight:650;}
.escena .hud {pointer-events:none;}
.wells svg {display:block;max-width:100%;height:auto}
.wells[open] {flex-basis:100%}
#v-equipo .equipo { grid-template-columns:minmax(0,22fr) minmax(0,55fr) minmax(0,23fr); height:100%; min-height:0; overflow:hidden; }
#v-equipo .lado { grid-column:auto; min-width:0; overflow:auto; overflow-wrap:anywhere; padding:8px; }
#v-equipo .lado > .pnl { flex-shrink:0; }
#eqDer { border-top:0; border-left:1px solid var(--line2); }
.eq-centro { padding:9px; gap:8px; }
.eq-cab h2 { font-size:21px; }
.eq-cab > div:not(.sis) { min-width:0; }
.escena canvas { height:clamp(215px,36vh,420px); position:relative; }
.escena .hud { z-index:1; }
.escena .tl input { min-width:0; }
#cvSec, #cvVida { height:clamp(135px,24vh,250px)!important; }
.tabs { flex-wrap:wrap; }
.tabs button { padding:5px 7px; font-size:12px; }
.pnl > header { flex-wrap:wrap; }
.chip { white-space:normal; }
.dos, .rej2 { grid-template-columns:repeat(2,minmax(0,1fr)); }
.rej3 { grid-template-columns:repeat(3,minmax(0,1fr)); }
.eq-centro, .tabc { overflow-wrap:anywhere; }
.stage-plane { position:absolute; width:100%; height:100%; inset:0; pointer-events:none; color:var(--grupo); }
@media(max-width:850px) {
  #v-equipo .equipo { grid-template-columns:minmax(0,31fr) minmax(0,69fr); overflow:auto; align-content:start; }
  #v-equipo #eqDer { grid-column:1/-1; }
  .eq-centro,.dos,.rej2,.rej3 { grid-template-columns:minmax(0,1fr); }
}
@media(max-width:530px) {
  #v-equipo .equipo { grid-template-columns:minmax(0,1fr); }
  .eq-centro { grid-row:1; }
}
</style></head>`);
    return replace(html, '<canvas id="cvEq"></canvas>', `<svg class="stage-plane" viewBox="0 0 800 370" preserveAspectRatio="none" aria-hidden="true">
      <defs><radialGradient id="floor-shadow"><stop stop-color="#26415b" stop-opacity=".16"/><stop offset="1" stop-color="#26415b" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="400" cy="271" rx="330" ry="46" fill="url(#floor-shadow)"/>
      <path d="M310 216H490L755 295H45Z M257 232H543 M198 249H602 M127 270H673 M346 216L184 295 M382 216L328 295 M418 216L472 295 M454 216L616 295" fill="none" stroke="currentColor" opacity=".22"/>
    </svg><canvas id="cvEq" aria-label="Corte animado del equipo"></canvas>`);
  };
};

module.exports.syncPresets = syncPresets;

module.exports.labelEquipment = labelEquipment;
