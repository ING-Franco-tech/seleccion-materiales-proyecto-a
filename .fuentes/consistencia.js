'use strict';

const {moduleFile} = require('./originales.js');

const a1 = {
  CS103: ['casing_api_5ct', 'CS-103', 'P 55, T 72, A 95 %, estallido 55, mojado anular 10 %'],
  TB101: ['Tubing_y_niple', 'TB-101', 'P fondo 112, P cabeza 45, T 68, A 98 %, intervención 6 a'],
  PK101: ['Packer', 'PK-101', 'P 55, T 72, A 98 %, vida 6 a'],
  VR101: ['varillas_de_bombeo', 'VR-101', 'P fondo 112, P cabeza 45, T 68, A 98 %, intervención 6 a'],
  WH101: ['cabezal', 'WH-101', 'P de diseño 55, T de diseño 85, A 98 %'],
  BS101: ['Bomba_subsuelo', 'BS-101', 'P fondo 112, descarga para carga de bomba 195, T 68, A 98 %, intervención 6 a'],
  XT101: ['Arbol_de_navidad', 'XT-101', 'P 45/55, T de diseño 85, H₂S 0,30 %, A 98 %. Choque y aguja usaban también 55 bar de cierre/máxima'],
  SSV101: ['valvula_de_seguridad', 'SSV-101', 'P 45/55, T de diseño 85, H₂S 0,30 %, A 98 %']
};
const a2 = {
  'FL-201':['Bayeh', 'A 90 %; C1 de referencia', 'A 95 %, 8 pozos y líneas'],
  'MF-201':['Bayeh', 'T llegada de trabajo 52, A 90 %', 'T 68, A 95 %, 8 ramales'],
  'MF-202':['Cano', 'P 38, T 52, A 90 %', 'P 45, T 68, A 95 %, 8 ramales'],
  'V-201':['Cano', 'P 38, T 52, A 90 % en el formulario compartido', 'P 45, T 68, A 95 %'],
  'PL-201':['Duque', 'P 45/50, T 68/85, BS&W 0,5 %', 'BS&W 1 %; 45/50 bar(g)'],
  'PL-202':['Duque', 'P 45/50, T 68/85, BS&W 0,5 %', 'BS&W 1 %; 45/50 bar(g)'],
  'TL-201':['Cortes / Navarro', 'Cortes: P 38, T salida 52, BS&W 78 %. Navarro: P 45, T 75, BS&W 0,5 %', 'P 45/50 bar(g), T 68/85, BS&W 1 %'],
  'CI-201':['Fajardo', 'Caudal de campo y presión de descarga sin valor acordado', '4 800 bbl/d de campo y descarga operativa de 60 bar(g)'],
  'P-301':['Navarro', 'Succión 3 bar(a), T 75, BS&W 0,5 %', 'T 68/85, BS&W 1 %. Descarga 45/50 bar(g). Succión indicada por separado'],
  'SP-201':['Cortes / Navarro', 'Geometría y protección de soportes', 'Sin entradas de fluido propias'],
  'EC-201':['Bayeh / Cortes / Navarro', 'Protección exterior', 'Sin entradas de fluido propias'],
  'EC-201-KA':['Bayeh', 'Aislamiento eléctrico', 'Sin entradas de fluido propias'],
  'XV-201':['Bayeh / Navarro', 'Trims y clases en fichas; sin formulario independiente', 'Ficha común de 45/50 bar(g) y 68/85 °C'],
  'FM-201':['Cano', 'Alcance de la instrumentación de prueba; sin formulario independiente', 'Ficha común de D']
};
const a1ByTag = Object.fromEntries(Object.values(a1).map(([file,tag,...info])=>[tag,[file,...info]]));
const missing = 'sin dato';
const number = value => value == null ? missing : new Intl.NumberFormat('es-CO').format(value);
const conditions = (e,G) => [
  [e.P,e.Pdis].map(number).join('/'), [e.T,e.Tdis].map(number).join('/'),
  number(e.A == null ? null : e.A*100), number(e.BSW), number(G.vida)
].join(' · ');

module.exports = function audit({D, read, write}) {
  const integrated = read('../../datos/Simulador_integrado-planta.html').match(/^const D=(.*);$/m);
  const old = JSON.parse(integrated[1]);
  const before = Object.fromEntries(old.eq.map(e=>[e.tag,e]));
  const rows = D.eq.map(e=>{
    const corrected = conditions(e,D.G);
    const raw = before[e.tag];
    const original = raw ? conditions(raw,old.G) : missing;
    const module = a1ByTag[e.tag];
    const student = a2[e.tag];
    const a1Status = module ? '[módulo](sim/originales/' + moduleFile(module[0]) + ') · ' + module[1] : '';
    return [e.tag,corrected,corrected,original,
      a1Status || student?.slice(0,2).join(' · ') || missing,
      [original === corrected ? '' : '**Integrado corregido**',
        module ? 'Campos equivalentes sincronizados desde D. Vida de intervención y cargas específicas según el alcance del módulo' : student?.[2]].filter(Boolean).join('. ') || 'Coincide el integrado'];
  });
  write('../CONSISTENCIA.md', [
    '# Consistencia de datos',
    '',
    'Base común de D.json · CO₂ 3,10 % molar, H₂S hoy 0,15 % y año 10 0,30 %, pH 4,6, ocho pozos productores, ocho líneas y ocho ramales. Corte de agua del campo 78 %. El BS&W de C5 y la disponibilidad de inhibidor se toman por equipo. La vida de diseño es de 20 años. Los intervalos de inspección o reemplazo por pieza se leen de la evaluación cuando el acta los fija.',
    '',
    'Cada celda numérica sigue el orden **P/Pdis · T/Tdis · inhibidor % · BS&W % · vida en años**. P y Pdis se presentan en bar(g) en los equipos de transferencia y A1. El cálculo de parciales usa presión absoluta. Se conserva la convención documentada de C1 donde el modelo toma directamente la referencia absoluta y las parciales fijadas por pieza, como C5. La succión de P-301 se indica en bar(a). El BS&W de equipo vacío tiene el significado «sin dato» y es distinto del corte de agua global.',
    '',
    '| Equipo | D.json | Uniforme e integrado corregido | Integrado original | Estudiante original | Resolución en la copia |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(row=>'| '+row.join(' | ')+' |'),
    '',
    'Las selecciones originales corresponden al veredicto, recomendación o clase del archivo entregado por el estudiante. Las copias usan la base de D para los campos equivalentes y conservan sus métodos de cálculo. Una pieza sin vínculo inequívoco con el original se muestra como «sin dato». A3 aparece con «—» en la columna Original.',
    '',
    'Los ocho escenarios, los resultados en JSON y la guía N se generan con el motor de la envolvente. El visor de planta usa esos mismos estados y el simulador uniforme permite pasar a un estado editado. Las fichas de clase y los cálculos de las copias originales sirven para la comparación por estudiante.',
    '',
    'Véase [Correcciones de los originales](sim/originales/CORRECCIONES.md) para las particularidades de cada módulo.',
    ''
  ].join('\n'));
};
