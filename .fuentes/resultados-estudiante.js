'use strict';

// Transcripciones abreviadas del veredicto original en su estado inicial.
// Las piezas ausentes del módulo quedan sin dato, aunque estén asignadas al estudiante.
const choices = {
  'CS-103-a':['J55 / K55','No','El acta exige L80 tipo 1'],
  'CS-103-b':['J55 / K55','No','El acta exige L80 tipo 1'],
  'CS-103-c':['J55 / K55','No','El acta exige L80 tipo 1'],
  'TB-101':['J55','No','El acta exige L80 tipo 1'],
  'TB-101-a':['Super 13Cr / 825 / 718 / L80 + ENP','No','El acta especifica niple 4130 con superficie de asiento endurecida'],
  'PK-101':['J55 / K55','Parcial','Acero en ambos, con distinta especificación del cuerpo'],
  'VR-101':['KD (46XX)','No','El acta pide grado C'],
  'VR-101-b':['API 11B clase SM','Sí','Acople con metal aspergido'],
  'BP-101':['4140 + Ni-Cr-B','Parcial','Coincide el metal aspergido, cambia el acero base'],
  'WH-101-a':['API 6A [E]','Parcial','El acta especifica el sustrato y el revestimiento 625'],
  'BS-101-a':['4130/4140 + Ni-P y Cr','Parcial','Coincide el cromo duro, cambia el acero base'],
  'BS-101-b':['Pistón N06625 aspergido','Parcial','Coincide la aspersión, el acta especifica núcleo 10XX'],
  'BS-101-c':['API 11AX C1 · WC-Ni','Sí','Coinciden carburo y ligante de níquel'],
  'BS-101-d':['Monel / 4130-4140 con recubrimiento','Parcial','El acta admite 4130 a 4145 y fija el estado del acero'],
  'SL-101-b':['Alloy 825 / 625, opción 316L','No','El acta elige un anillo de acero al carbono blando'],
  'SL-101-c':['B7M / L7M con 2HM / 7M','Sí','El acta fija la combinación B7M / 2HM'],
  'XT-101-a':['HH · clad 625','Parcial','Coincide el recubrimiento, el acta especifica forjado 4130'],
  'XT-101-b':['HH · trim CRA','Parcial','El acta especifica trim 13Cr y sus límites'],
  'XT-101-d':['F6NM + WC-Ni','No','El acta prevé operación sin choque y conserva WC-Ni como opción'],
  'SSV-101-a':['EE-13Cr','Parcial','Coincide el trim 13Cr, el alcance del 625 difiere'],
  'FL-201-a':['L360NS anexo H','Parcial','El acta añade revestimiento CRA en la entrada'],
  'FL-201-b':['L360NS anexo H','Sí','Misma designación del tubo'],
  'MF-201-a':['L360NS anexo H','Sí','Misma designación para el cabezal'],
  'MF-201-b':['WCB + AISI 410','Parcial','Coincide WCB, el acta añade condiciones de cuerpo y trim'],
  'XV-201-c':['WCB + AISI 410','Parcial','El acta exige 625 o CA6NM en zonas mojadas'],
  'EC-201-a':['Zinc + epoxi + poliuretano','Sí','Coincide el sistema Zn(R) + EP/PUR'],
  'EC-201-e':['Ánodos de magnesio','Sí','Coincide la protección catódica galvánica'],
  'MF-202-a':['L360NS anexo H','Parcial','El acta añade revestimiento 825/625'],
  'MF-202-b':['WCB + AISI 410','Parcial','El acta incorpora 625 y obturador CA6NM'],
  'V-201-a':['A516 Gr 70 HIC','Sí','Misma placa normalizada con ensayo HIC'],
  'V-201-d':['625 en partes mojadas','Sí','El acta admite también C-276'],
  'PL-201-a':['L360NS + CRA 625','Parcial','Coincide el tubo, el original añade CRA'],
  'PL-202-a':['L360NS + CRA 625','Parcial','El original usa CRA y el acta epoxi novolac'],
  'TL-201-a':['L360NS PSL 2','Sí','Misma especificación del tubo'],
  'TL-201-b':['L360NS PSL 2','Sí','El acta remite a TL-201-a'],
  'CI-201-c':['PRFV viniléster / 316L','Sí','El acta contempla ambas familias para tanque y bomba'],
  'TL-201-c':['L360NS anexo H','Parcial','El acta exige un escalón de espesor para el cruce'],
  'TL-201-d':['L360NS anexo H','Parcial','El acta añade brida y junta aislante'],
  'EC-201-c':['Im1 / 3LPE + PC','Parcial','El acta detalla Zn(R) + EP/PUR y protección mecánica'],
  'SP-201-b':['A36/A572 galvanizado + C4','Sí','Coinciden acero galvanizado y pintura'],
  'P-301-a':['Clase S-6 · acero C','Parcial','La clase admite carcasa de acero C, el acta detalla grado y protecciones'],
  'P-301-b':['Clase S-6 · CA6NM','Sí','Coinciden los internos CA6NM'],
  'P-301-d':['Sello API 682','sin dato','El original pide la norma y deja la especificación pendiente del PVT']
};

const comparison = {
  baleta:'El acta es más exigente en CS-103 al pasar de J55/K55 a L80 tipo 1.',
  pineda:'El acta es más exigente en el tubing al pasar de J55 a L80 tipo 1.',
  osorio:'El original sube de grado C a KD en varillas. La clase del cabezal exige cotejo por pieza.',
  britto:'Hay diferencias de sustrato y recubrimiento. Conservadurismo global sin dato.',
  carrillo:'El original propone choque. El acta solo especifica el trim si se instala.',
  bayeh:'El acta añade CRA en la entrada de FL-201.',
  cano:'El acta añade CRA al múltiple de prueba.',
  duque:'El original añade una barrera metálica CRA 625 a los barriles que evalúa.',
  cortes:'Coincide el grado de tubo. Diferencia de conservadurismo sin dato.',
  fajardo:'Las opciones son compatibles con el acta y dependen de la ficha química.',
  navarro:'El acta es más exigente en espesor en el tramo de cruce.'
};

const product = /(?:ISO (?:3183|11960|14310|14692)|API (?:5CT|5L|6A|6D|11AX|11B|610|675|682)|ASTM [ABDF]\d+)/g;

module.exports = function studentResults(person, data, scenarios) {
  const keys = Object.keys(scenarios);
  const out = keys.filter(k => k !== 'base');
  const hits = [...out, 'base'].flatMap(k => Object.entries(data[k])
    .filter(([tag, row]) => row.s === 2 && (k === 'base' || data.base[tag].s < 2))
    .map(([tag, row]) => ({k, tag, row})));
  const first = hits.find(hit => hit.k !== 'base' && hit.k !== 'pres') ?? hits[0];
  const reason = first?.row.checks.find(check => check.s === 2);
  const measure = first?.row.medidas[0];
  const reading = [
    first ? scenarios[first.k] + ' · ' + first.tag + '. ' + reason.txt : 'Ninguna pieza queda fuera en los ocho escenarios.',
    first ? first.tag + ' · ' + (measure ?? (reason.k === 'dis' ? 'Restablecer las condiciones dentro del diseño.' : first.row.alternativas[0] ? 'Alternativa a validar: ' + first.row.alternativas[0] + '.' : 'Medida verificada sin dato.')) : 'Mantener las condiciones evaluadas.',
    comparison[person.id] ?? '— · A3 no tiene simulador original.'
  ];
  const rows = person.tags.map(tag => {
    const p = data.base[tag], choice = choices[tag];
    return {tag, equipo:p.eq, pieza:p.pieza, original:choice?.[0] ?? (person.grupo === 'A3' ? '—' : 'sin dato'),
      coincidencia:choice?.[1] ?? 'sin dato', nota:choice?.[2] ?? '',
      material:p.material, materialCorto:p.mat_corto, mecanismos:p.mecanismos,
      norma:[...new Set(p.material.match(product) ?? [])].join(' / ') || 'sin dato',
      regiones:[p['región'], data.y10[tag]['región']], vida:p.vida, requerida:p.vidaRequerida,
      estados:Object.fromEntries(keys.map(k => [k,data[k][tag].s]))};
  });
  return {rows, reading};
};
