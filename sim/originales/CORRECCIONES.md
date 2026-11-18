# Correcciones de los simuladores originales

## Observaciones de estudiantes

- Cortes, Navarro, Bayeh y Cano. Los tubos para servicio amargo se identifican como L360NS y L290NS conforme a ISO 3183 / API 5L PSL 2 (anexo H, servicio amargo). Corrección aplicada a las fichas, las tablas y las copias generadas.
- Cortes. La presión de operación de TL-201, PL-201, PL-202, XV-201 y la descarga de P-301 es de 45 bar(g). La presión de diseño permanece en 50 bar(g). Fuente: Informe A2, base de diseño del escenario A, pág. 3.

| Archivo | Problema | Corrección | Fuente o razón |
| --- | --- | --- | --- |
| `modulo/simulador_parametrico_universal_casing_api_5ct.html` | Valores y estado de entrada | CS-103: P/Pdis 45/112 bar(g), T/Tdis 68/85 °C, A 90 %. Cada campo toma el dato correspondiente a su etiqueta. | `D.eq` y `D.G` |
| `modulo/simulador_parametrico_universal_Tubing_y_niple.html` | Valores y estado de entrada | TB-101: P/Pdis 45/112 bar(g), T/Tdis 68/85 °C, A 90 %. Cada campo toma el dato correspondiente a su etiqueta. | `D.eq` y `D.G` |
| `modulo/simulador_parametrico_universal_Packer.html` | Valores y estado de entrada | PK-101: P/Pdis 45/112 bar(g), T/Tdis 68/85 °C, A 90 %. Cada campo toma el dato correspondiente a su etiqueta. | `D.eq` y `D.G` |
| `modulo/simulador_parametrico_universal_varillas_de_bombeo.html` | Valores y estado de entrada | VR-101: P/Pdis 45/112 bar(g), T/Tdis 68/85 °C, A 90 %. Cada campo toma el dato correspondiente a su etiqueta. | `D.eq` y `D.G` |
| `modulo/simulador_parametrico_universal_cabezal.html` | Valores y estado de entrada | WH-101: P/Pdis 45/50 bar(g), T/Tdis 68/85 °C, A 90 %. Cada campo toma el dato correspondiente a su etiqueta. | `D.eq` y `D.G` |
| `modulo/simulador_parametrico_universal_Bomba_subsuelo.html` | Valores y estado de entrada | BS-101: P/Pdis 45/112 bar(g), T/Tdis 68/85 °C, A 90 %. Cada campo toma el dato correspondiente a su etiqueta. | `D.eq` y `D.G` |
| `modulo/simulador_parametrico_universal_Arbol_de_navidad.html` | Valores y estado de entrada | XT-101: P/Pdis 45/50 bar(g), T/Tdis 68/85 °C, A 90 %. Cada campo toma el dato correspondiente a su etiqueta. | `D.eq` y `D.G` |
| `modulo/simulador_parametrico_universal_valvula_de_seguridad.html` | Valores y estado de entrada | SSV-101: P/Pdis 45/50 bar(g), T/Tdis 68/85 °C, A 90 %. Cada campo toma el dato correspondiente a su etiqueta. | `D.eq` y `D.G` |
| `modulo/simulador_parametrico_universal_choque.html` | Valores y estado de entrada | XT-101: P/Pdis 45/50 bar(g), T/Tdis 68/85 °C, A 90 %. Cada campo toma el dato correspondiente a su etiqueta. | `D.eq` y `D.G` |
| `modulo/simulador_parametrico_universal_valvula_de_aguja.html` | Valores y estado de entrada | XT-101: P/Pdis 45/50 bar(g), T/Tdis 68/85 °C, A 90 %. Cada campo toma el dato correspondiente a su etiqueta. | `D.eq` y `D.G` |
| Diez módulos A1 y maestro | Las presiones parciales usaban bar(g); en dos evaluadores se comparaban con 0,05 psi como cifra exacta. | Se usa presión absoluta para CO₂ y H₂S, 100 kPa/bar y umbral exacto de 0,3 kPa. | ISO 15156-2:2020, anexo C y §7.2.1.3. |
| Diez módulos A1 y maestro | La región 1 se truncaba a 100 kPa y algunos textos fijaban el resultado del escenario. | Se comparten los límites log-lineales, sus tramos horizontales y el umbral de la región 0. El maestro muestra las regiones calculadas y conserva región 3 como criterio conservador por encima de 1 MPa. | [ISO 15156-2:2020, Figura 1](https://cdn.standards.iteh.ai/samples/79659/4dd6188bfa6e45baac32183b9eb0fb36/ISO-15156-2-2020.pdf). |
| Cabezal y válvula de seguridad | El filtro preliminar de clase se presentaba como dictamen de conformidad normativa. | Los mensajes atribuyen el descarte al modelo y remiten a la calificación de materiales por ambiente. | ISO 15156-2 §7; clase de equipo y calificación metalúrgica son verificaciones distintas. |
| `simulador_maestro_integrado_sistema_a1.html` | El visor y el enlace directo no transferían el estado con nombres compatibles. El corte de agua se confundía con el factor de mojado anular. | Los enlaces llevan una instantánea de `window.wellStreamState`. Los módulos importan campos por significado, incluidos ceros válidos, distinguen ambos porcentajes y fuera del maestro arrancan con la ficha del proyecto. | El estado debe funcionar también con archivos locales en Chrome. |
| Todos | Cabeceras duplicadas al incrustarse y tablas que ensanchaban la página de los módulos sueltos. | Se ajusta el ancho de las tarjetas y `?embed=1` compacta las cabeceras y neutraliza tonos y tipografía. | Se conservan controles y diagramas originales. |
| `Simulador_integrado-planta.html` | Dependencia de fuentes de Google en la página y documentos internos. Los límites de la envolvente extrapolaban las diagonales, las presiones parciales de A1 usaban bar(g) y se atribuía el tope de sobreespesor a la norma. | Se usan fuentes locales, se sincronizan la clasificación SSC y la envolvente con la Figura 1, se usa presión absoluta para gases de A1 y se identifica el tope como criterio del proyecto. | ISO 15156-2:2020, Figura 1 y anexo C; `D.G.tope`. |

## Dudas no corregidas

- El proyecto indica 20 años de diseño. Los 6 años entre intervenciones de bomba, tubing y varillas y los 2 años mínimos del trim son supuestos distintos que requieren confirmación.
- El diferencial de colapso, cargas, arena, cloruros, pulsación, presión de salida del choque y tiempos de intervención no tienen un equivalente inequívoco en `D.eq`. Se conservaron sus supuestos. Choque y aguja toman el entorno de XT-101 por su ubicación en el árbol.
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
