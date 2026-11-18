'use strict';

const correctPipeGrades = text => text.replace(/\b(L\d{3}|X52)NE\b/g, '$1NS');

const fs = require('node:fs');
const path = require('node:path');

const master = 'simulador_maestro_integrado_sistema_a1.html';
const plant = 'Simulador_integrado-planta.html';
const moduleFile = name => 'modulo/simulador_parametrico_universal_' + name + '.html';
const assignments = {
  Baleta: [['casing_api_5ct', 'Casing API 5CT']],
  Pineda: [['Tubing_y_niple', 'Tubing y niple'], ['Packer', 'Packer']],
  Osorio: [['varillas_de_bombeo', 'Varillas de bombeo'], ['cabezal', 'Cabezal']],
  Britto: [['Bomba_subsuelo', 'Bomba de subsuelo']],
  Carrillo: [['Arbol_de_navidad', 'Árbol de navidad'], ['valvula_de_seguridad', 'Válvula de seguridad'],
    ['choque', 'Choque'], ['valvula_de_aguja', 'Válvula de aguja']]
};

const embedScript = `<script>
if (new URLSearchParams(location.search).get('embed') === '1') {
  document.documentElement.classList.add('embedded');
}
window.addEventListener('keydown', event => {
  if (parent === window || event.repeat || event.ctrlKey || event.altKey || event.metaKey ||
      event.key.toLowerCase() !== 'n' || event.target.closest('input,textarea,select,[contenteditable]')) return;
  event.preventDefault();
  parent.postMessage({projectAKey:'n'}, '*');
});
window.addEventListener('message', event => {
  if (parent === window || event.data?.projectAKey !== 'n') return;
  if ([...document.querySelectorAll('iframe')].some(frame => frame.contentWindow === event.source))
    parent.postMessage({projectAKey:'n'}, '*');
});
</script>`;
const embedStyle = `<style>
.a1-sim .app > *, .a1-sim .res > *, .a1-sim .card {min-width:0}
.embedded {color-scheme:light;--bg:#eeefed;--panel:#fff;--sunk:#f3f4f2;--line:#cdd3cf;--tx:#24312c;--mut:#55605b;--acc:#285d49;--ok:#1d7044;--warn:#865608;--bad:#a92d28;--head:"Segoe UI",system-ui,sans-serif}
.embedded header.top, .embedded .barra .marca, .embedded .barra .firma {display:none}
.embedded body {max-width:100%;padding-inline:10px}
.embedded .app, .embedded .app > *, .embedded .res, .embedded .res > *, .embedded .card {min-width:0}
.embedded .scroll table {min-width:0;overflow-wrap:anywhere}
.embedded .scroll th {white-space:normal}
.embedded .pestanas {flex-wrap:wrap}
@media(max-width:760px) {
  .embedded .app, .embedded .res {grid-template-columns:minmax(0,1fr)}
  .embedded .modal-body {grid-template-columns:minmax(0,1fr)}
}
</style>`;

// Los campos del formulario siguen siendo editables. El maestro sólo aporta
// valores iniciales mediante su enlace, también bajo file:// y en un iframe.
const moduleStateKeys = {
  y_co2:'y_co2_pct', y_h2s:'y_h2s_pct', ph:'pH', inhib_avail:'inhibitor_availability_pct',
  chlorides:'chlorides_mgL', p_op:'p_head_op_bar', p_up:'p_head_op_bar',
  p_head:'p_head_op_bar', p_wh:'p_head_op_bar', p_down:'p_out_a2_bar',
  p_max:'p_head_design_bar', p_shut:'p_head_design_bar',
  p_disch:'p_bottom_design_bar', p_burst_req:'p_bottom_design_bar',
  life_body:'design_life_yr', bsw:'bsw_pct', wet_factor:'bsw_pct',
  sand_lb:'solids_lb_1000bbl', sand_llb:'solids_lb_1000bbl',
  sand_ptb:'solids_lb_1000bbl', solids:'solids_lb_1000bbl',
  depth_pump:'depth_pump_m', depth_packer:'depth_packer_m',
  v_inhib:'v_inhibited_mm_yr'
};

function updateForm(html, fields, stateKeys = {}) {
  return html.replace(/(\["(\w+)",\s*"[^"]*",\s*"[^"]*",\s*)([^,\n]+)(,)/g,
    (entry, prefix, key, original, end) => {
      const value = fields[key];
      if (value == null && !stateKeys[key]) return entry;
      const fallback = value ?? original;
      const next = stateKeys[key] ? `incomingValue("${stateKeys[key]}", ${fallback})` : fallback;
      return prefix + next + end;
    });
}

const incomingState = `<script>
const incomingWellStream = (() => {
  try { return JSON.parse(new URLSearchParams(location.search).get('estado')) || {}; }
  catch { return {}; }
})();
window.wellStreamState = {fluidStream_C1_C2: incomingWellStream};
function incomingValue(key, fallback) {
  const value = incomingWellStream[key];
  return Number.isFinite(value) ? value : fallback;
}
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('has_packer');
  const installed = incomingWellStream.has_packer;
  if (!input || !['yes', 'no'].includes(installed) || input.value === installed) return;
  input.value = installed;
  input.dispatchEvent(new Event('input', {bubbles:true}));
  input.dispatchEvent(new Event('change', {bubbles:true}));
});
</script>`;

const regionFunction = `function getISO15156Region(pH2S_kPa, pH) {
  if (pH2S_kPa < 0.3) return 0;
  if (pH2S_kPa > 1000) return 3; // Extensión conservadora fuera de la gráfica.
  const logP = Math.log10(pH2S_kPa);
  const boundary1_2 = Math.min(6.5, 4.5 + logP);
  const boundary2_3 = Math.max(3.5, Math.min(5.5, 3.5 + logP));
  if (pH >= boundary1_2) return 1;
  if (pH >= boundary2_3) return 2;
  return 3;
}
function isoPressureLimit(pH, region) {
  const cap = region === 1 ? 6.5 : 5.5;
  const slope = region === 1 ? 4.5 : 3.5;
  if (pH >= cap) return 1000;
  if (region === 2 && pH < 3.5) return 0.3;
  return Math.max(0.3, Math.pow(10, pH - slope));
}`;

const a2Files = {
  bayeh: '1_bayeh_lineas_flujo_multiple_produccion.html',
  cano: '2_cano_multiple_prueba_separador_prueba.html',
  duque: '3_duque_trampa_envio_recibo.html',
  cortes: '4_cortes_linea_transferencia.html',
  fajardo: '5_fajardo_tanque_inhibidor_bomba_dosificadora.html',
  navarro: '6_navarro_cruces_quebrada_bomba_transferencia.html'
};

function wellsDiagram(count) {
  const branches = Array.from({length: count}, (_, i) => {
    const x = 34 + i * 78;
    return `<g><text x="${x}" y="17">P-${i + 1}</text><text x="${x}" y="33">FL-0${i + 1}</text>
    <path d="M${x} 37v20h-12v24m12-24h12v49"/><circle cx="${x - 12}" cy="81" r="3"/><circle cx="${x + 12}" cy="106" r="3"/></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="122" viewBox="0 0 780 122"
    role="img" aria-label="${count} pozos, líneas de flujo y ramales en cada múltiple">
    <rect width="780" height="122" rx="5" fill="#fff"/>
    <g font-family="system-ui" font-size="13" text-anchor="middle" fill="#243c46" stroke="#17657f" stroke-width="1.5">${branches.replaceAll('<text ', '<text stroke="none" ').replaceAll('<path ', '<path fill="none" ')}</g>
    <path d="M16 81H602m-586 25H602" stroke="#17657f" stroke-width="2"/>
    <text x="612" y="85" fill="#243c46">MF-201 · Producción</text><text x="612" y="110" fill="#243c46">MF-202 · Prueba</text>
    </svg>`;
}

function buildA2({D, read, write, root}, eq, out) {
  fs.mkdirSync(path.join(root, out, 'A2'), {recursive:true});
  const {G} = D;
  const numberField = (html, key, value, pattern) =>
    html.replace(pattern(key), (_, prefix) => prefix + value);
  for (const [id, file] of Object.entries(a2Files)) {
    let html = read('../../datos/A2_original/' + file)
      .replace(/<link\b[^>]*href=["']https?:[^>]*>/gi, '')
      .replace(/<script\b[^>]*src=["']https?:[^>]*><\/script>/gi, '')
      .replace(/@import\s+url\(["']?https?:[^;]*;/gi, '');
    if (id === 'bayeh') {
      const fl = eq['FL-201'], mf = eq['MF-201'];
      const values = {nWells:G.npozos, P_head:fl.P, P_arr:mf.P, T_in:fl.T, T_out:mf.T,
        T_max:fl.Tdis, co2:G.CO2, h2s_hoy:G.H2Shoy, h2s_y10:G.H2S10, pH:G.pH, wc:G.bsw,
        life:G.vida, crI:G.Vinh};
      for (const [key, value] of Object.entries(values))
        html = numberField(html, key, value, k => new RegExp('(\\b' + k + ': )\\d+(?:\\.\\d+)?'));
      html = html.replace(/Grado: ficha E1-03 recomienda[^']+/, 'Grado corregido: L360NS (anexo H, servicio amargo).')
        .replaceAll('extracto de ISO 3183 · ficha E1-03 propone L360NE', 'ISO 3183 / API 5L PSL 2 · L360NS (anexo H, servicio amargo)')
        .replace("'Tabla A.2 (L360NE)', 'Grado L360 con SMYS 360 MPa', 'L360NE presente; L360NS/Anexo H no está en el extracto'", "'Anexo H', 'Grado L360 con SMYS 360 MPa', 'L360NS para servicio amargo'")
        .replace('L360NE (X52NE), Anexo A (ficha E1-03)', 'Designación revisada a partir de la ficha E1-03')
        .replace('R.avail = a.avail90 ? 0.90', 'R.avail = a.avail90 ? ' + fl.A)
        .replace('R.T_mp = a.tmp52 ? 52 : 68;', 'R.T_mp = a.tmp52 ? 52 : S.T_out;')
        .replace('tmp52: true', 'tmp52: false')
        .replace(/, \['R3', 'Borde Región 3 \(acta, pH 4,6\)', 'kPa'\]/, '')
        .replace(/const reg = k => [^;]*;/, 'S.R3 = isoPressureLimit(S.pH, 2);\n  const reg = k => getISO15156Region(k, S.pH);')
        .replace('xl0 = -0.6, xl1 = 1.7', 'xl0 = -0.6, xl1 = 3')
        .replace(/  s \+= `<rect x="\$\{X\(S\.R3\)\}[^\n]+\n/, '')
        .replace(/  s \+= `<line x1="\$\{X\(S\.R3\)\}[^\n]+\n/, `  for (const [offset, floor, cap] of [[4.5,3,6.5],[3.5,3.5,5.5]]) {
    const points = Array.from({length:81}, (_, i) => 0.3 * Math.pow(1000 / 0.3, i / 80));
    const d = points.map((k, i) => (i ? 'L' : 'M') + X(k) + ' ' +
      Y(Math.max(floor, Math.min(cap, offset + Math.log10(k))))).join(' ');
    s += '<path fill="none" stroke="var(--crit)" stroke-width="2" d="' + d + '"/>';
  }
`)
        .replace(/<text[^>]*>Región 2 \(pH 4,6\)<\/text>/, '<text x="${W - m.r - 8}" y="${m.t + 31}" text-anchor="end" font-size="11">Fronteras SSC · Figura 1</text>')
        .replace(/>Región 3 \(≥ \$\{fmt\(S\.R3, 1\)\}\)<\/text>/, '>R2/R3 al pH actual</text>');
    }
    if (id === 'cano') {
      const e = eq['MF-202'];
      for (const [key, value] of Object.entries({P_op:e.P, P_des:e.Pdis, T_op:e.T, T_max:e.Tdis, DL:G.vida, wc:G.bsw, E_inh:e.A*100, y_co2:G.CO2, y_h2s_hoy:G.H2Shoy, y_h2s_ano10:G.H2S10, pH:G.pH}))
        html = numberField(html, key, value, k => new RegExp('(id:"' + k + '"[^}]*?value:)[\\d.]+'));
      html = html.replaceAll('tabla de propiedades L360NE/X52NE', 'tabla de propiedades mecánicas del grado L360')
        .replace('L360NE (X52NE) en el texto de ISO ', 'Propiedades mecánicas del grado L360 en el texto de ISO ')
        .replace('de L360NE.', 'del grado L360.')
        .replace(/function cB\(e,t\)\{[^}]+\}/, 'function cB(e,t){return getISO15156Region(t,e)}')
        .replace('f=i*c,y=i*l,x=s*c/1e3,_=s*l/1e3', 'f=i*c,y=i*(l+101325),x=s*c/1e3,_=s*(l+101325)/1e3')
        .replace('I=Math.pow(10,o-3.5),L=Math.pow(10,o-4.5)', 'I=isoPressureLimit(o,2),L=isoPressureLimit(o,1)')
        .replaceAll('MT-01 y V-201', 'MF-202 (MT-01) y V-201');
    }
    if (id === 'duque') {
      const e = eq['PL-201'];
      const defaults = {water_cut:e.BSW, temperature:e.T, design_temperature:e.Tdis, design_pressure:e.Pdis,
        inhibitor_availability:e.A*100, design_life:G.vida, co2:G.CO2, h2s:G.H2Shoy, ph:G.pH};
      for (const [key, value] of Object.entries(defaults))
        html = numberField(html, key, value, k => new RegExp('(key:"' + k + '"[^}]*?default:)[\\d.]+'));
      html = html.replace(/A\?r===null\?o="Sin pH:[\s\S]*?;let l=!1;return/, `if (!A || r !== null) s=getISO15156Region(i,r);
        o=s===null?"Sin pH para ubicar la región SSC.":"Figura 1 · Región "+s;
        let l=!1;return`)
        .replaceAll('pressure_reference:"absolute"', 'pressure_reference:"gauge"')
        .replace('choices:["absolute","gauge"],default:"absolute"', 'choices:["absolute","gauge"],default:"gauge"')
        .replace('margin_to_region3_kpa:lw.R3_start-i', 'margin_to_region3_kpa:r===null?null:isoPressureLimit(r,2)-i')
        .replace(/(key:"pressure",group:"inlet"[^}]*?default:)\d+(?:\.\d+)?/, (_, prefix) => prefix + eq['PL-201'].P)
        .replace(/(key:"pressure",group:"inlet"[^}]*?ref:)"[^"]*"/, '$1"Proyecto A · D.eq · PL-201 / PL-202"');
    }
    if (id === 'cortes') {
      const e = eq['TL-201'];
      const c5Limit = D.piezas.find(piece => piece.tag === 'TL-201-a').fix[1];
      html = html.replace(/<title>[^<]*<\/title>/, '<title>Simulador TL-201 · Línea de transferencia</title>')
        .replace('L360NE (E1-03) y L360NS (API 5L, Anexo H)', 'L360NS (anexo H, servicio amargo)')
        .replace(/<h1>[^<]*<\/h1>/, '<h1>Simulador TL-201 · Línea de transferencia</h1>')
        .replaceAll('FL-01', 'TL-201')
        .replace(/equipo:\{tag:"TL-201",nombre:[^}]*\}/, 'equipo:' + JSON.stringify({
          tag:e.tag, nombre:e.nombre, proyecto:'Proyecto A Magdalena Medio', sistema:'A2',
          responsable:'Equipo A2', funcion:'Transfiere el crudo tratado C5 por los tramos enterrados y aéreos.',
          aguas_arriba:'T-302 / P-301 / PL-201', aguas_abajo:'PL-202 / entrega'
        }))
        .replace(/\bt_salida:\{v:52/, 't_salida:{v:' + e.T)
        .replace('d_nominal:{v:4', 'd_nominal:{v:6')
        .replace(/\bod:\{v:114\.3[^}]+\}/, 'od:{v:168.3,u:"mm",src:"documento",ref:"D · TL-201-a"}')
        .replace(/\bespesor:\{v:8\.56[^}]+\}/, 'espesor:{v:5.7,u:"mm",src:"documento",ref:"Mínimo nominal de D · TL-201-a"}')
        .replace(/\blongitud:\{v:1850,u:"m",src:"documento",ref:"E1-03"\}/, 'longitud:{v:14000,u:"m",src:"documento",ref:"D · TL-201"}')
        .replace(/\bcorte_agua:\{v:78,u:"%",src:"documento",ref:"E1-03"\}/, 'corte_agua:{v:' + e.BSW + ',u:"%",src:"documento",ref:"D · C5 (SD-10)"}')
        .replace(/\bp_operacion:\{v:38,u:"bar",src:"documento",ref:"[^"]+"/,
          'p_operacion:{v:' + e.P + ',u:"bar",src:"documento",ref:"Informe A2 · escenario A, pág. 3 (presión manométrica)"')
        .replace('E1-03 dice 38 bar y E1-01 y E2 dicen 45 bar', 'Informe A2 · escenario A, pág. 3')
        .replace(/valores:"38 bar \(E1-03\)[^"]*",trabajo:"38 bar",porque:"[^"]*"/,
          `valores:"${e.P} bar(g) · Informe A2, escenario A, pág. 3",trabajo:"${e.P} bar(g)",porque:"Se aplica la presión operativa de la base de diseño para TL-201."`)
        .replace('a*r,"kPa","p_parcial"', 'a*(r+101325),"kPa","p_parcial"')
        .replace('let o=s.length?null:i*r;', 'const baseH2S=K0(e,"y_h2s")?.src!=="usuario";if(baseH2S)s=[];let o=baseH2S?' + c5Limit + ':s.length?null:i*(r+101325);')
        .replace('Ir(s.length?null:i*n,"kPa","p_parcial",s)', 'Ir(baseH2S?' + c5Limit + ':s.length?null:i*(n+101325),"kPa","p_parcial",baseH2S?[]:s)')
        .replace('presi\\xF3n tal como la da la ficha', 'presión absoluta; C5 usa 0,30 kPa salvo cambio de la fracción de H₂S')
        .replace(/h\.length\|\|\(o<l\?p=0:Math\.abs\(f-4\.6\)[^;]+\),t\.region_ssc=/,
          'h.length||(p=getISO15156Region(o,f)),t.region_ssc=')
        .replace('ISO 15156-2, Figura 1, le\\xEDda solo a pH 4,6', 'ISO 15156-2, Figura 1');
    }
    if (id === 'fajardo') {
      for (const [key, value] of Object.entries({flow:G.npozos * G.qliq, outletPressure:eq['CI-201'].P})) {
        html = html.replace(new RegExp('("' + key + '": \\{"value": )null(, "unit": "[^"]+", "source": )"[^"]+", "provenance": "[^"]+", "note": "[^"]+"'),
          (_, prefix, unit) => prefix + value + unit + '"Proyecto A · D.json", "provenance": "documento", "note": "Condición de diseño del proyecto"');
      }
    }
    if (id === 'navarro') {
      const line = eq['TL-201'], pump = eq['P-301'];
      html = html.replace(/(activeTab: 'inicio',[\s\S]*?bsw: )0\.5,\s*p53: 45,\s*p61: 3,\s*temp: 75/,
        (_, prefix) => prefix + `${pump.BSW},\n  p53: ${line.P},\n  p61: 3,\n  temp: ${pump.T}`)
        .replaceAll('bsw: 0.5, p53: 45, p61: 3, temp: 75', `bsw: ${pump.BSW}, p53: ${line.P}, p61: 3, temp: ${pump.T}`)
        .replaceAll('BSW 0,5% · Succión 3 bar', `BSW ${pump.BSW}% · Succión 3 bar(a)`)
        .replace('Caso base tratado (0,5% BSW)', `Caso base tratado (${pump.BSW}% BSW)`)
        .replaceAll('* params.p53;', '* (params.p53 + 1.01325);')
        .replace('* appState.p53 * 100', '* (appState.p53 + 1.01325) * 100')
        .replace('Math.min(100, kpa)', 'Math.min(1000, kpa)')
        .replace('((lk - (-1)) / 3)', '((lk + 1) / 4)')
        .replace(/      <polygon points="70,30[^\n]+\n      <polygon points=[^\n]+\n/, '')
        .replace(/      <polyline points="70,\$\{yKpa\(2\.5\)\}[^\n]+/, () =>
          '      ${[1,2].map(region => { const x0=region===1?3:3.5; const cap=region===1?6.5:5.5;' +
          ' const points=[x0,cap-.001,cap,7].map(ph => xPh(ph)+","+yKpa(isoPressureLimit(ph,region))).join(" ");' +
          ' return `<polyline points="${points}" fill="none" stroke="var(--error)" stroke-width="2"/>`; }).join("")}')
        .replace('>100 kPa</text>', '>100 kPa</text><text x="62" y="34" text-anchor="end" font-size="11">1000 kPa</text>')
        .replace(/function getIso15156Region\(ph, ph2sKpa\) \{[\s\S]*?\n\}/,
          `function getIso15156Region(ph, ph2sKpa) {
  const region = getISO15156Region(ph2sKpa, ph);
  return {region, label: 'Región ' + region, status: ['green','yellow','yellow','red'][region]};
}`)
        .replace(/(<button[^>]*id="tabbtn-informes")/, `<button type="button" class="tab-btn" id="tabbtn-bomba" role="tab" aria-selected="false" aria-controls="tab-bomba" onclick="switchTab('bomba')">Bomba P-301</button>$1`)
        .replace('<section id="tab-informes"', `<section id="tab-bomba" class="tab-panel" role="tabpanel" aria-labelledby="tabbtn-bomba">
        <h2>P-301 · Bombas de transferencia A/B</h2>
        <p>Succión de referencia de la simulación: 3 bar(a). Ficha de descarga C5: ${pump.P} bar(g) en operación,
        ${pump.Pdis} bar(g) de diseño, ${pump.T} °C en operación y ${pump.Tdis} °C de diseño.</p>
        <iframe title="Evaluación de P-301" loading="lazy" src="../../A2_navarro.html?embed=1&amp;equipo=P-301"
          style="width:100%;height:65vh;border:0"></iframe></section><section id="tab-informes"`);
    }
    write(out + 'A2/' + file, html.replace('<head>', '<head>' + embedScript + `<script>${regionFunction}</script>
      <style>.embedded body{margin-inline:0;max-width:100%}
      .embedded *{box-sizing:border-box}.embedded main,.embedded .app>*{min-width:0}
      .embedded svg,.embedded canvas,.embedded img{max-width:100%}
      .embedded .tw,.embedded .scrolltable{overflow:auto}
      </style>`));
  }
}

function correctA1(html, bootstrap = '') {
  return html.replace('<html lang="es">', '<html lang="es" class="a1-sim">')
    .replace('</head>', embedScript + bootstrap + embedStyle + '</head>')
    .replace(/function getISO15156Region\(pH2S_kPa, pH\) \{[\s\S]*?\n\}/, regionFunction)
    .replace(/(\(y_(?:co2|h2s) \/ 100\) \* )(p_\w+)/g, '$1($2 + 1.01325)')
    .replace(/pH2S_psi >= 0\.05;[^\n]*/g, 'pH2S_psi >= 0.3 * 14.5038 / 100;')
    .replace(/Las clases AA\/BB\/CC no cumplen ISO 15156\./g,
      'El modelo descarta AA/BB/CC para esta configuración. La calificación ISO 15156 se verifica por material y ambiente.')
    .replace(/No cumple ISO 15156 \/ NACE MR0175 para servicio amargo/g,
      'El modelo descarta esta configuración para servicio amargo');
}

function buildOriginals({D, read, write: writeFile, root}) {
  const write = (file, content) => writeFile(file, correctPipeGrades(content));
  const out = '../sim/originales/';
  fs.mkdirSync(path.join(root, out, 'modulo'), {recursive:true});
  const eq = Object.fromEntries(D.eq.map(e => [e.tag, e]));
  const {G} = D;
  buildA2({D, read, write, root}, eq, out);
  const common = {y_co2:G.CO2, y_h2s:G.H2Shoy, ph:G.pH, v_inhib:G.Vinh, bsw:G.bsw};
  const surface = eq['WH-101'];
  const bottom = eq['BS-101'];
  const mappings = {
    casing_api_5ct: ['CS-103', {p_burst_req:eq['CS-103'].Pdis}, 'bottom'],
    Tubing_y_niple: ['TB-101', {p_head:surface.P, p_burst_req:eq['TB-101'].Pdis}, 'bottom'],
    Packer: ['PK-101', {design_life:G.vida}, 'bottom'],
    varillas_de_bombeo: ['VR-101', {p_wh:surface.P}, 'bottom'],
    cabezal: ['WH-101', {p_int:surface.Pdis, temp_c:surface.Tdis, design_life:G.vida}, 'design'],
    Bomba_subsuelo: ['BS-101', {p_disch:bottom.Pdis}, 'bottom'],
    Arbol_de_navidad: ['XT-101', {p_int:eq['XT-101'].Pdis, temp_c:eq['XT-101'].Tdis, design_life:G.vida}, 'design'],
    valvula_de_seguridad: ['SSV-101', {p_int:eq['SSV-101'].Pdis, temp_c:eq['SSV-101'].Tdis, design_life:G.vida}, 'design'],
    choque: ['XT-101', {p_up:surface.P, p_shut:surface.Pdis, life_body:G.vida}, 'surface'],
    valvula_de_aguja: ['XT-101', {p_max:surface.Pdis, design_life:G.vida}, 'surface']
  };
  const rows = [];
  for (const [name, [tag, overrides, service]] of Object.entries(mappings)) {
    const e = eq[tag];
    const file = moduleFile(name);
    const keys = {...moduleStateKeys, p_int:service === 'design' ? 'p_head_design_bar' : 'p_bottom_op_bar',
      temp_c:service === 'design' ? 'temp_surface_design_c' : service === 'bottom' ? 'temp_bottom_c' : 'temp_surface_c'};
    if (name === 'casing_api_5ct') keys.wet_factor = 'wet_factor_pct';
    if (Object.hasOwn(overrides, 'design_life')) keys.design_life = 'design_life_yr';
    const fields = {...common, p_int:e.P, p_op:e.P, temp_c:e.T, inhib_avail:e.A * 100, ...overrides};
    if (keys.wet_factor === 'bsw_pct') fields.wet_factor = G.bsw;
    let html = read('../../datos/A1_original/' + file);
    // Varillas precargaba por su cuenta p_int y podía sustituir el formulario.
    if (name === 'varillas_de_bombeo') {
      html = html.replace(/if \(window\.wellStreamState && window\.wellStreamState\.fluidStream_C1_C2\) \{[\s\S]*?\n\}/, '');
    }
    html = updateForm(html, fields, keys).replace(/H₂S en gas \((?:Diseño[ /]?(?:Año 10)?|0\.30% año 10)[^"]*\)/gi,
      'H₂S en gas (hoy / año 10)');
    if (name === 'Bomba_subsuelo') html = html.replace(/<text[^>]*>Anclaje \(\$\{seating_type\}\)<\/text>/,
      '<title>Anclaje (${seating_type})</title>');
    if (name === 'Arbol_de_navidad') html = html.replace('x="324" y="21"', 'x="324" y="35"');
    if (name === 'valvula_de_aguja') html = html.replace('y="159" text-anchor="middle"', 'y="173" text-anchor="middle"');
    write(out + file, correctA1(html, incomingState));
    rows.push(`| \`${file}\` | Valores y estado de entrada | ${tag}: P/Pdis ${e.P}/${e.Pdis} bar(g), T/Tdis ${e.T}/${e.Tdis} °C, A ${e.A * 100} %. Cada campo toma el dato correspondiente a su etiqueta. | \`D.eq\` y \`D.G\` |`);
  }

  const masterFields = {...common, p_pump:bottom.P, p_pump_design:bottom.Pdis, p_head_des:surface.Pdis,
    p_head_op:surface.P, temp_bot:bottom.T, temp_surf:surface.T, temp_surf_design:surface.Tdis,
    inhib_avail:surface.A * 100, life_perm:G.vida};
  let masterHtml = updateForm(read('../../datos/A1_original/' + master), masterFields)
    .replace(/(\["p_pump",[^\n]+\n)/, '$1    ["p_pump_design", "Presión de diseño en fondo", "bar", ' + bottom.Pdis + ', 5, 400, 1],\n')
    .replace(/(\["temp_surf",[^\n]+\n)/, '$1    ["temp_surf_design", "Temperatura de diseño en superficie", "°C", ' + surface.Tdis + ', 10, 250, 1],\n')
    .replace('const moduleUrl = (m) => MODULES_DIR + m.file;', `function moduleUrl(m, embedded = false) {
  const params = new URLSearchParams({estado:JSON.stringify(window.wellStreamState.fluidStream_C1_C2)});
  if (embedded) params.set('embed', '1');
  return MODULES_DIR + encodeURIComponent(m.file) + '?' + params;
}`)
    .replace('iframe.src = moduleUrl(m);', 'iframe.src = moduleUrl(m, true);')
    .replace('p_pump_bar: inputs.p_pump,', `p_bottom_op_bar: inputs.p_pump,
      p_pump_bar: inputs.p_pump,
      p_bottom_design_bar: num('p_pump_design', ${bottom.Pdis}),
      temp_surface_design_c: num('temp_surf_design', ${surface.Tdis}),
      has_packer: inputs.has_packer,
      depth_pump_m: inputs.depth_pump,
      depth_packer_m: inputs.depth_packer,
      design_life_yr: inputs.life_perm,`)
    .replace(/(  renderModuleInspector\(activeModuleId\);)\s*\/\/ Exportar window\.wellStreamState y sincronizar con localStorage\s*(syncGlobalWellStreamState\(lastComputedSystem\);)/,
      '  $2\n$1')
    .replace('const linkedBlobUrls = {};', '')
    .replace('  const isLinked = Boolean(linkedBlobUrls[m.file]);', '')
    .replace(" ${isLinked ? '(Archivo local vinculado en memoria)' : ''}", '')
    .replace('A=98%', 'A=' + masterFields.inhib_avail + '%')
    .replace('A=92% · Liner HDPE Req.', 'A=92%')
    .replace(/setVal\("(\w+)", [\d.]+\)/g, (entry, field, index, source) => {
      const preset = source.slice(source.lastIndexOf('key ===', index), index);
      if (preset.includes('"base_today"') && masterFields[field] != null) return `setVal("${field}", ${masterFields[field]})`;
      if (preset.includes('"year_10"') && masterFields[field] != null) return `setVal("${field}", ${field === 'y_h2s' ? G.H2S10 : masterFields[field]})`;
      return entry;
    })
    .replace(/ · Reg\. 3(?=\))| · Región 2 en Cabezal y Región 3 en Bomba| · Todo el Sistema pasa a Región 3| · API 6A Clase BB/g, '')
    .replace('A = 92% < 97,5% → Exige Liner Interno PEAD en Tubing', 'A = 92% · revisar selección de tubing');
  masterHtml = masterHtml.replace('setVal("p_pump", ' + bottom.P + ');',
    `setVal("p_pump", ${bottom.P}); setVal("p_pump_design", ${bottom.Pdis}); setVal("temp_surf_design", ${surface.Tdis});`)
    .replace('} else if (key === "year_10") {', '} else if (key === "year_10") {\n    applyPreset("base_today");');
  write(out + master, correctA1(masterHtml));

  const removeFonts = html => html.replace(/<link\b[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*/g, '');
  const correctPlant = html => removeFonts(html)
    .replace(/^const D=.*;$/m, () => 'const D=' + JSON.stringify(D).replace(/</g, '\\u003c') + ';')
    .replace(/function region\(p,pH\)\{[^\n]+\}/, regionFunction.replace('getISO15156Region', 'region'))
    .replace('function yH2S(G,anio)', "const pressureForGas = (pressure, equipment) => pressure + (equipment.sistema === 'A1' ? 1.01325 : 0);\nfunction yH2S(G,anio)")
    .replace('fx[1]/Math.max(0.01,Pc)', 'fx[1]/pressureForGas(Pc,e)')
    .replace('k.yc/100*k.P', 'k.yc/100*pressureForGas(k.P,k.def)')
    .replaceAll('Pu=(p.m&&p.m.Pas&&k.def.Pas)?k.P:k.Phead', 'Pu=pressureForGas((p.m&&p.m.Pas&&k.def.Pas)?k.P:k.Phead,k.def)')
    .replaceAll('Pu=(m&&m.Pas&&k.def.Pas)?k.P:k.Phead', 'Pu=pressureForGas((m&&m.Pas&&k.def.Pas)?k.P:k.Phead,k.def)')
    .replace('pp = k.y2 * ((p.m && p.m.Pas && k.def.Pas) ? k.P : k.Phead)',
      "pp = k.y2 * ((p.m && p.m.Pas && k.def.Pas) ? k.P : k.Phead) + (k.def.sistema === 'A1' ? 1.01325 * k.y2 : 0)")
    .replace(/      const pb=0\.30\*[^\n]*\n/, '')
    .replace(/const pbase=0\.30\*[^\n]+/, 'const pbase=D.G.H2S10*pressureForGas((p.m&&p.m.Pas&&k.def.Pas)?k.def.Pas:(p.m?.P??k.def.P),k.def);')
    .replace('fx[1]*((p.m&&p.m.P)||k.def.P):fx[1]):pbase; const regB=region(pb2,4.6);',
      'fx[1]*pressureForGas(p.m?.P??k.def.P,k.def):fx[1]):pbase; const regB=region(pb2,D.G.pH);')
    .replace('const pmax=regB>=3?Infinity:Math.pow(10,pH-(regB>=2?3.5:4.5));', `const slope = regB >= 2 ? 3.5 : 4.5;
      const cap = regB >= 2 ? 5.5 : 6.5;
      const pmax = regB >= 3 ? Infinity : pH >= cap ? 1000 :
        regB === 2 && pH < 3.5 ? 0.3 : Math.max(0.3, Math.pow(10, pH - slope));`)
    .replace('lim:(regB>=3?-Infinity:(Math.log10(Math.max(k.y2*Pu,0.3))+(regB>=2?3.5:4.5)))',
      'lim:(regB>=3 || k.y2*Pu<0.3 ? -Infinity : regB===0 || k.y2*Pu>1000 ? null : Math.max(regB===2?3.5:0, Math.min(cap, Math.log10(k.y2*Pu)+slope)))')
    .replace("act:k.y2,lim:lim/Pu,kind:'max'", "act:k.y2,lim:lim/Pu,strict:lim===0.3 && region(0.3,pH)>regB,kind:'max'")
    .replace('r.act<=r.lim+1e-9', '(r.strict ? r.act<r.lim : r.act<=r.lim+1e-9)')
    .replace("(r.kind==='max'?'≤ ':'≥ ')", "(r.kind==='max'?(r.strict?'< ':'≤ '):'≥ ')")
    .replace('el tope de ${G.tope} mm de ISO 21457, 8.2', 'el tope de diseño del proyecto de ${G.tope} mm');
  const normalizeGas = html => html.replaceAll(" + (k.def.sistema === 'A1' ? 1.01325 * k.y2 : 0) + (k.def.sistema === 'A1' ? 1.01325 * k.y2 : 0)", " + (k.def.sistema === 'A1' ? 1.01325 * k.y2 : 0)");
  let plantHtml = correctPlant(read('../../datos/' + plant));
  plantHtml = plantHtml.replace("  document.querySelectorAll('.pestana').forEach(b=>b.addEventListener('click',()=>mostrar(b.dataset.tab)));", entry => entry + `
  if (new URLSearchParams(location.search).get('pestana') === 'planta') {
    window.__sim.ir('planta');
    mostrar('planta');
  }`);
  plantHtml = plantHtml.replace(/(const (?:PLANTA|DIAGRAMA)_HTML = )("(?:[^"\\]|\\.)*")(;)/g,
    (_entry, prefix, encoded, end) => {
      const diagram = wellsDiagram(G.npozos);
      const inset = (x, y) => `<g transform="translate(${x} ${y})">${diagram}</g>`;
      let html = normalizeGas(correctPlant(JSON.parse(encoded)))
        .replace("fondo() + tuberias() + equipos() + marcas()", () =>
          "fondo() + tuberias() + equipos() + marcas() + " + JSON.stringify(inset(400, 50)))
        .replace('function a2(){', () => 'function a2(){\n  h+=' + JSON.stringify(inset(350, 60)) + ';')
        .replace('8 pozos iguales; se muestra uno', 'Pozo productor · detalle constructivo');
      if (prefix.includes('PLANTA_HTML')) {
        html = html.replace(
          '<text class="lbl t" x="${lx}" y="${ly + 11}" text-anchor="${an}">${esc(corto)}</text>',
          '<title>${esc(e.t + " · " + E.nombre)}</title>');
      }
      if (prefix.includes('DIAGRAMA_HTML')) {
        html = html.replace("'WH-301',1866,516,'end'", "'WH-301',1908,508,'end'");
        html = correctPipeGrades(html).replaceAll('40 / 50 bar(g)', `${eq['TL-201'].P} / ${eq['TL-201'].Pdis} bar(g)`)
          .replace(/("material"\s*:\s*")((?:[^"\\]|\\.)*)"/g, (entry, key, material) =>
            /\bL(?:360|290)NS\b/.test(material) && !/anexo H/i.test(material) ?
              key + material + ' (anexo H, servicio amargo)"' : entry);
      }
      return prefix + JSON.stringify(html.includes('</head>') ? html.replace('</head>', embedScript + '</head>') :
        embedScript + html).replace(/<\//g, '<\\/') + end;
    });
  write(out + plant, plantHtml.replace('</head>', embedScript + embedStyle + '</head>'));

  write(out + 'CORRECCIONES.md', `# Correcciones de los simuladores originales

## Observaciones de estudiantes

- Cortes, Navarro, Bayeh y Cano. Los tubos para servicio amargo se identifican como L360NS y L290NS conforme a ISO 3183 / API 5L PSL 2 (anexo H, servicio amargo). Corrección aplicada a las fichas, las tablas y las copias generadas.
- Cortes. La presión de operación de TL-201, PL-201, PL-202, XV-201 y la descarga de P-301 es de 45 bar(g). La presión de diseño permanece en 50 bar(g). Fuente: Informe A2, base de diseño del escenario A, pág. 3.

| Archivo | Problema | Corrección | Fuente o razón |
| --- | --- | --- | --- |
${rows.join('\n')}
| Diez módulos A1 y maestro | Las presiones parciales usaban bar(g); en dos evaluadores se comparaban con 0,05 psi como cifra exacta. | Se usa presión absoluta para CO₂ y H₂S, 100 kPa/bar y umbral exacto de 0,3 kPa. | ISO 15156-2:2020, anexo C y §7.2.1.3. |
| Diez módulos A1 y maestro | La región 1 se truncaba a 100 kPa y algunos textos fijaban el resultado del escenario. | Se comparten los límites log-lineales, sus tramos horizontales y el umbral de la región 0. El maestro muestra las regiones calculadas y conserva región 3 como criterio conservador por encima de 1 MPa. | [ISO 15156-2:2020, Figura 1](https://cdn.standards.iteh.ai/samples/79659/4dd6188bfa6e45baac32183b9eb0fb36/ISO-15156-2-2020.pdf). |
| Cabezal y válvula de seguridad | El filtro preliminar de clase se presentaba como dictamen de conformidad normativa. | Los mensajes atribuyen el descarte al modelo y remiten a la calificación de materiales por ambiente. | ISO 15156-2 §7; clase de equipo y calificación metalúrgica son verificaciones distintas. |
| \`${master}\` | El visor y el enlace directo no transferían el estado con nombres compatibles. El corte de agua se confundía con el factor de mojado anular. | Los enlaces llevan una instantánea de \`window.wellStreamState\`. Los módulos importan campos por significado, incluidos ceros válidos, distinguen ambos porcentajes y fuera del maestro arrancan con la ficha del proyecto. | El estado debe funcionar también con archivos locales en Chrome. |
| Todos | Cabeceras duplicadas al incrustarse y tablas que ensanchaban la página de los módulos sueltos. | Se ajusta el ancho de las tarjetas y \`?embed=1\` compacta las cabeceras y neutraliza tonos y tipografía. | Se conservan controles y diagramas originales. |
| \`${plant}\` | Dependencia de fuentes de Google en la página y documentos internos. Los límites de la envolvente extrapolaban las diagonales, las presiones parciales de A1 usaban bar(g) y se atribuía el tope de sobreespesor a la norma. | Se usan fuentes locales, se sincronizan la clasificación SSC y la envolvente con la Figura 1, se usa presión absoluta para gases de A1 y se identifica el tope como criterio del proyecto. | ISO 15156-2:2020, Figura 1 y anexo C; \`D.G.tope\`. |

## Dudas no corregidas

- El proyecto indica 20 años de diseño. Los 6 años entre intervenciones de bomba, tubing y varillas y los 2 años mínimos del trim son supuestos distintos que requieren confirmación.
- El diferencial de colapso, cargas, arena, cloruros, pulsación, presión de salida del choque y tiempos de intervención no tienen un equivalente inequívoco en \`D.eq\`. Se conservaron sus supuestos. Choque y aguja toman el entorno de XT-101 por su ubicación en el árbol.
- Casing representa CS-103. Revestimientos CS-101/102 y el pozo inyector WI-101 tienen servicios distintos; el módulo original no ofrece modelos independientes para ellos. La barra pulida y los sellos siguen siendo subcomponentes de sus módulos.
- Las correlaciones de desgaste/corrosión, factores de diseño, rangos metalúrgicos y tablas API de los estudiantes requieren trazabilidad por material, producto y edición. Se mantienen como criterios del modelo.

## A2

- Bayeh y Cano conservan sus ocho ramales y el cálculo de severidad se alinea con la Figura 1. Se actualizan las condiciones base de flujo y prueba desde D.
- Duque conserva la conversión a presión absoluta según la base del formulario y evalúa la Figura 1 para el pH seleccionado.
- Cortes identifica TL-201 en títulos, ficha y exportaciones. La base toma diámetro, espesor mínimo, longitud y condiciones C5 de D. Evalúa la Figura 1 con 0,30 kPa de H₂S en C5 y con presión absoluta cuando se modifica la fracción de H₂S.
- Fajardo usa el caudal del campo y la presión operativa de CI-201. Navarro distingue el punto de succión de la ficha P-301 y ofrece evaluación de las piezas de la bomba.
- Los seis originales se copian con modo embebido y comunicación de la tecla N.

### Dudas no corregidas de A2

- El caudal nominal, rating y curva certificada de las bombas, el volumen del tanque y la temperatura de la solución requieren fichas del proveedor.
- La base de C1 conserva la convención absoluta que reproducen las parciales documentadas de 45 bar. La de C5 distingue el punto de burbuja, la succión y la descarga manométrica. Los ensayos de PVT y las condiciones de gas libre en succión siguen pendientes.
- Se conservan geometrías, correlaciones y supuestos propios de cada informe cuando D no identifica un equivalente inequívoco. La ficha de alcance permite consultar las condiciones y piezas de D.
`);
}

module.exports = {master, plant, moduleFile, assignments, a2Files, embedScript, wellsDiagram, buildOriginals, correctPipeGrades};
