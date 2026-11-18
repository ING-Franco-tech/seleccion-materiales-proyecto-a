# Selección de materiales · Proyecto A

Presentación final del curso de Selección de Materiales (UIS): campo de crudo pesado, Magdalena Medio. Incluye los tres grupos (A1, A2, A3), un simulador por estudiante, uno por grupo y el simulador integrado de planta.

Abra `presentacion/index.html`. Use las flechas para navegar y **N** para abrir o cerrar la guía del presentador.

Las diapositivas de A1 y A2 abren los simuladores originales corregidos y ofrecen una ficha interactiva del alcance asignado. En A2, la pestaña de Navarro incluye la evaluación de la bomba P-301. Después de cada simulador individual hay una diapositiva de resultados. Consulte [la consistencia por equipo](CONSISTENCIA.md), [la cobertura](COBERTURA.md) y [el registro de correcciones](sim/originales/CORRECCIONES.md).

El escenario base registra 141 piezas en envolvente, 4 en atención y 0 fuera, según el motor de la planta.

Los simuladores son una herramienta de tamizaje, no software certificado.

Para regenerar el sitio desde `publicar`, ejecute `node --preserve-symlinks --preserve-symlinks-main .fuentes/generar.js --presentacion`. La verificación en Chrome se ejecuta con `node --preserve-symlinks-main .fuentes/verificar-chrome.cjs` y guarda las capturas en la carpeta `.capturas` del directorio padre cuando hay permiso de escritura.
