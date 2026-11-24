# Gascalc

Comparador funcional de gasóleo A en España, con cashback por litro solo en la opción de marca. React + TypeScript + Vite + Tailwind CSS 4, con un backend Express de solo lectura. **No hay precios simulados ni fallback a ejemplos en la aplicación.**

## Instalar y ejecutar

Requisitos: Node.js **22.12 o posterior de la rama 22**, npm y conexión a Internet.

```bash
npm ci
cp .env.example .env
npm run dev
```

Abre **http://127.0.0.1:5173**. Vite reenvía `/api` al backend, por defecto en `127.0.0.1:3001`. No necesitas claves de API, base de datos ni cuentas externas. La primera consulta puede tardar unos segundos.

### Compilación y ejecución con Express

```bash
npm run build
npm start
```

Abre **http://127.0.0.1:3001**: Express sirve tanto `dist/` como `/api/stations`. Debes desplegar frontend y backend, no solo `dist/`. Conserva el código de `server/`, los módulos compartidos de `src/` y las dependencias necesarias para `tsx`. El comando `npm start` usa `tsx`, incluido como dependencia de desarrollo: no instales con `--omit=dev` en este esquema de despliegue.

El servidor escucha solo en loopback. Para acceso público usa un proxy inverso con HTTPS, redirigiendo todo al puerto configurado. La geolocalización requiere un contexto seguro: HTTPS en producción; localhost/127.0.0.1 funciona durante desarrollo. No uses el servidor de desarrollo de Vite en Internet.

### Despliegue en Vercel

Importa el repositorio `roninrojo/gascalc` desde [Vercel → New Project](https://vercel.com/new) con la raíz del repositorio como directorio del proyecto. `vercel.json` fija el preset Vite, la instalación con `npm ci`, la compilación con `npm run build` y la salida en `dist/`. `package.json` selecciona Node.js 22.x con mínimo 22.12. En los ajustes de Vercel, selecciona `main` como rama de producción y habilita los despliegues de vista previa para las demás ramas.

Vercel sirve el frontend y `/api/stations` bajo el mismo dominio. La función consulta al Ministerio bajo demanda y tiene un máximo de 35 segundos. La caché de 10 minutos pertenece a cada instancia.

Antes de fusionar, abre la vista previa y comprueba la portada, la fecha de publicación en `/api/stations`, la búsqueda por CP, los filtros y el cálculo de cashback. Mide el cuerpo JSON sin compresión frente al límite de 4,5 MB de Vercel. A partir de 4 MB, usa una respuesta en streaming con el mismo formato JSON. Tras fusionar en `main`, comprueba la URL de producción que asigna Vercel.

## Uso

1. Busca un municipio o CP y **selecciona una de las ubicaciones encontradas**, o pulsa «Usar mi ubicación» y concede permiso.
2. Selecciona la estación A en «Cerca de ti». Puedes ordenar por precio o proximidad.
3. Busca un rótulo, selecciónalo en el desplegable y elige la estación B.
4. Introduce litros y cashback. Cambiar €/L ↔ céntimos/L convierte el importe y conserva su valor económico.
5. Revisa coste efectivo, ahorro y cashback de equilibrio. El radio de 5/10/20/50 km se aplica a ambos listados.

Las preferencias de ubicación, marca, litros y cashback se guardan en `localStorage`. Las selecciones de estación son independientes, no persisten al recargar y no alteran los valores del comparador. Cambiar el radio u orden no elimina la selección; cambiar la ubicación sí. Se impide presentar como alternativas dos selecciones de la misma estación.

## Variables de entorno

| Variable | Valor inicial | Uso |
| --- | --- | --- |
| `PORT` | `3001` | Puerto del backend y destino del proxy de desarrollo |
| `CACHE_TTL_SECONDS` | `600` | Caché compartida en memoria; mínimo 1 segundo |
| `VITE_STALE_HOURS` | `24` | Umbral de antigüedad de la publicación para mostrar advertencia |

Express carga `.env` con Node; Vite carga variables `VITE_*` al arrancar/compilar. Reinicia desarrollo o recompila después de cambiarlas. No hay secretos. El endpoint oficial es fijo deliberadamente para no convertir el servidor en un proxy de URLs arbitrarias.

## Investigación técnica de la fuente

Verificado el **23 de noviembre de 2026**, mediante consulta HTTPS real:

- [Geoportal de Gasolineras](https://geoportalgasolineras.es/).
- [Documentación oficial de operaciones REST](https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help).
- Endpoint utilizado: `GET https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/`.
- También existen filtros por provincia, municipio, comunidad autónoma y producto, y catálogos `Listados/Municipios/`, `Listados/Provincias/` y `Listados/ProductosPetroliferos/`. Se usa el conjunto nacional para resolver CP, rótulos y distancias en el cliente sin consultas que revelen ubicación.
- La respuesta observada fue HTTP 200, JSON UTF-8, aproximadamente **12,3 MB y 11.537 registros** antes de filtrar. Es una observación, no un tamaño o número garantizados.
- Respuesta superior: `Fecha`, `ListaEESSPrecio`, `Nota`, `ResultadoConsulta`. El servicio declara en `Nota` actualización **cada media hora**, con los precios en vigor en ese momento. No se garantiza disponibilidad ni actualización individual de las estaciones.
- En la comprobación, la API respondió `Access-Control-Allow-Origin: *`: **no fue necesario un proxy por CORS**. Se incluye por caché compartida, timeout y normalización para descargar mucho menos al cliente.

### Campos y normalización

| Campo de origen | Uso |
| --- | --- |
| `IDEESS` | Identificador estable, deduplicación y validación de misma estación |
| `Rótulo` | Nombre comercial y marca, sin inferir afiliaciones |
| `Precio Gasoleo A` | Gasóleo A estándar; no Premium ni gasóleo B |
| `Dirección`, `Municipio`, `Localidad`, `Provincia`, `C.P.` | Dirección y búsqueda manual |
| `Latitud`, `Longitud (WGS84)` | Coordenadas; decimales con coma |
| `Tipo Venta` | Solo `P` (pública); se excluye venta restringida `R` o desconocida |
| `Fecha` del conjunto | Publicación, interpretada como hora peninsular Europe/Madrid |

Los precios vacíos, no numéricos o no positivos **se excluyen, nunca se sustituyen**. La falta de rótulo o dirección se indica con texto explícito. Sin coordenadas válidas se conserva el registro normalizado, pero no aparece en los listados geográficos. No se confunden coordenadas ausentes con una estación en (0,0).

### Limitaciones y alternativa mínima

- **Fecha de publicación, no actualización individual:** el endpoint no entrega una fecha de último cambio por estación. Cada tarjeta etiqueta su fecha como «Publicación»; no se inventa una fecha individual. Se muestran última consulta correcta y advertencias de antigüedad o fallo de renovación.
- **Municipio y CP sin centro geográfico:** para no depender de un geocodificador ni comunicar ubicación a terceros, la búsqueda manual usa la media de coordenadas de estaciones coincidentes. Se indica que es un punto aproximado. No es el centro oficial, ni la posición del usuario, y municipios extensos o CP dispersos pueden introducir diferencias grandes. Solo aparecen ubicaciones presentes en estaciones con datos utilizables. La alternativa para más precisión es geolocalización, ya incluida; una extensión posterior podría añadir geocodificación oficial IGN/CartoCiudad con atribución y revisión de sus condiciones.
- **Distancia en línea recta:** Haversine sobre WGS84, no kilómetros por carretera. No se calcula gasto de desplazamiento.
- **Marca = rótulo:** el listado disponible procede de los datos, no de una lista inventada. Variantes como franquicias o nombres compuestos se mantienen separadas; la búsqueda ignora acentos y mayúsculas, la selección filtra el rótulo completo.
- **Promociones no disponibles en la API:** el cashback se introduce manualmente. No se afirman promociones vigentes ni se consultan saldos, límites o condiciones comerciales.
- **Canarias, Ceuta y Melilla:** pueden incluirse si el conjunto oficial las publica con datos válidos. La fecha se muestra explícitamente en hora peninsular. Las comparaciones no ajustan fiscalidad ni condiciones particulares.

### Condiciones de reutilización

El [aviso legal de MITECO](https://www.miteco.gob.es/es/atencion-al-ciudadano/aviso-legal.html), consultado durante la investigación, permite reutilizar información citando la fuente, salvo derechos de terceros; exige conservar metadatos de fecha y condiciones aplicables, y no sugerir patrocinio o apoyo administrativo. También advierte que puede no haber información completa o actualizada y que pueden existir condiciones particulares de servicios.

La aplicación atribuye la fuente, conserva la fecha de publicación, enlaza el servicio y no usa logotipos ministeriales ni afirma afiliación. La normalización y los filtros están documentados; los importes efectivos son cálculos propios, no precios oficiales. No se ha identificado una licencia específica ni un SLA/cuota publicada en la página de operaciones; **no se presupone una licencia CC concreta ni disponibilidad ilimitada**. Antes de una explotación comercial, revisa de nuevo las condiciones específicas que publique el proveedor.

## Arquitectura

```text
src/
  components/       # Localización, listados, comparador e iconos SVG
  domain/           # Funciones puras: normalización, búsqueda, Haversine y cálculos
  hooks/            # Preferencias persistidas y validadas
  services/         # Cliente HTTP y geolocalización del navegador
  utils/            # Formatos Intl españoles y fecha peninsular
  types.ts          # Contratos compartidos
  App.tsx           # Composición, consulta, selección y filtros
  styles.css        # Tailwind 4, tokens y estilos responsive
api/
  stations.ts       # Entrada Node.js de Vercel para /api/stations
server/
  app.ts            # Aplicación Express y API de solo lectura
  cache.ts          # Caché, deduplicación de consultas concurrentes y fallback marcado
  index.ts          # Arranque local y archivos estáticos
tests/
  *.test.ts         # Unitarias de dominio y caché
  e2e/              # Playwright: recorrido real y regresiones aisladas
```

El backend consulta siempre el mismo endpoint nacional, nunca recibe coordenadas, CP o búsquedas. No hay telemetría, cookies, fuentes remotas, cuentas de usuario ni almacenamiento de ubicación en servidor. El navegador transmite inevitablemente su IP al servidor al solicitar la web, pero esta aplicación no la almacena ni incorpora logs de acceso; configura también la privacidad de tu proxy/hosting.

### Caché y fallos

- Una caché en memoria por proceso, TTL de 10 minutos. No necesita disco ni base de datos.
- Peticiones concurrentes comparten una sola consulta. Timeout oficial: 25 segundos.
- Al fallar la renovación, se conserva el último conjunto correcto **marcado como desactualizado** y con sus fechas originales. Reintentos limitados a uno por minuto (o TTL si es menor).
- Sin una consulta correcta previa, responde HTTP 502 y la interfaz muestra un error y botón para reintentar. No se recurre a fixtures, muestras, precios aleatorios ni archivos de prueba.
- El cliente intenta renovar cada 10 minutos si la pestaña está visible; incluye botón de actualización respetando caché. Un fallo de red del navegador también marca los datos retenidos como potencialmente antiguos.
- Tras reiniciar el servidor, la caché está vacía. En despliegues con varias instancias hay una caché por instancia; para el MVP no se añade Redis.

## Cálculos

Funciones puras en `src/domain/compare.ts`:

```text
Coste A              = P1 × L
Coste original B     = P2 × L
Cashback total B     = C × L
Coste efectivo B     = (P2 × L) − (C × L)
Precio efectivo B    = P2 − C
Diferencia           = Coste A − Coste efectivo B
Cashback equilibrio  = P2 − P1
```

`C` se convierte a euros/L antes del cálculo. No se redondean valores intermedios; se usa una tolerancia de escala de `Number.EPSILON` únicamente para empates afectados por coma flotante. Los importes se presentan con dos decimales y los precios con al menos tres (más si es necesario, hasta 12) usando `Intl.NumberFormat('es-ES')`. No es un sistema contable de liquidación de promociones.

Se rechazan litros no positivos, números no finitos, cashback negativo, desbordamientos de cálculo y cashback superior al precio B. Si el cashback iguala el precio se permite coste efectivo cero, siempre sujeto a las condiciones reales de la promoción. No se cambian precios ni se recortan costes negativos silenciosamente.

Ejemplo cubierto por las pruebas: A 1,621 €/L; B 1,835 €/L; 50 L; 0,30 €/L cashback → A **81,05 €**, B original **91,75 €**, cashback **15,00 €**, B efectivo **76,75 €**, ahorro **4,30 €**, precio efectivo **1,535 €/L**, equilibrio **0,214 €/L**.

## Pruebas

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

- Unitarias: cálculos y ejemplo, empate, validación, unidades, fechas verano/invierno, normalización, datos incompletos, deduplicación, búsqueda por CP/municipio, radio, ordenación, marca y caché con fallo/recuperación.
- Playwright ejecuta los casos en escritorio y emulación móvil de Chromium. **El primer caso consulta la API oficial real** y verifica búsqueda de Madrid, selección y ahorro, por lo que requiere Internet y disponibilidad del Ministerio. Los demás usan fixtures exclusivamente dentro de la prueba para reproducir errores y el ejemplo de forma estable.
- Axe comprueba reglas automáticas WCAG 2.2 AA, tanto en estado inicial como con una comparación. También se comprueban foco de teclado, desbordamiento horizontal y persistencia de preferencias.
- Para solo regresiones offline: `npm run test:e2e -- --grep-invert 'datos reales'`.

Se han diseñado etiquetas, contraste, estados `aria-pressed`, avisos `role=alert`, conclusión `aria-live`, salto al contenido, foco visible y respeto por movimiento reducido. **Una prueba automática no certifica conformidad completa WCAG**: para una publicación formal completa también una revisión manual con lector de pantalla, teclado, zoom al 200/400 % y dispositivos reales. La emulación móvil no equivale a probar Safari/iOS físico.

## Alcance del MVP

Aplicación ejecutable localmente y desplegable detrás de HTTPS, sin registro, mapas, rutas ni automatización de promociones. Requiere disponibilidad del servicio oficial y debe confirmarse el precio en el surtidor. No ofrece garantía de ahorro neto si existen costes adicionales o la promoción no se aplica al repostaje.
