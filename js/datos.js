/* =====================================================================
   datos.js
   Datos fijos de Cracks1201, registro de ventas (guardado en el
   navegador), análisis estadístico de las ventas e importación de Excel.
   ===================================================================== */

/* ---------------------- Datos fijos del negocio ---------------------- */
const CONFIG = {
  productos: [
    { clave: 'jugador', nombre: 'Jugador', costo: 250, precio: 450 },
    { clave: 'fan',     nombre: 'Fan',     costo: 200, precio: 420 },
    { clave: 'retro',   nombre: 'Retro',   costo: 200, precio: 400 }
  ],
  envioCliente: 25,            // envío gratis que absorbe Cracks1201 por playera
  capacidadBodega: 100,        // playeras que caben en bodega
  tallas: ['S', 'M', 'L', 'XL', 'XXL'],
  presupuestoNormal: 3000,     // inversión mensual en stock
  presupuestoEspecial: 7000,   // inversión en temporada especial (cada ~7 meses)
  costoCaja: 100,              // costo de hacer un pedido al proveedor (envío de la caja)
  playerasPorCaja: 20,
  entregaMin: 45,              // días que tarda el proveedor
  entregaMax: 50,
  tasaMantener: 0.25           // costo anual de tener una playera guardada (% de su costo)
};
// Mínimo de Jugador en stock: una de cada talla
CONFIG.minimoJugador = CONFIG.tallas.length;

/* ---------------------- Parámetros editables ----------------------
   Los valores de arriba son los de Cracks1201. El usuario los puede
   cambiar en Plan de compra y en Cuándo pedir para probar escenarios;
   se guardan en el navegador y se pueden restaurar con un botón.
   ------------------------------------------------------------------ */
const CAMPOS_PARAMETROS = ['envioCliente', 'capacidadBodega', 'minimoJugador', 'presupuestoNormal', 'presupuestoEspecial',
  'costoCaja', 'playerasPorCaja', 'entregaMin', 'entregaMax', 'tasaMantener'];
const CLAVE_PARAMETROS = 'cracks1201.parametros.v1';

function parametrosDe(cfg) {
  const p = { productos: cfg.productos.map(x => ({ costo: x.costo, precio: x.precio })) };
  CAMPOS_PARAMETROS.forEach(k => { p[k] = cfg[k]; });
  return p;
}
const PARAMETROS_ORIGINALES = parametrosDe(CONFIG);

function aplicarParametros(p) {
  CONFIG.productos.forEach((prod, i) => {
    if (p.productos && p.productos[i]) { prod.costo = Number(p.productos[i].costo); prod.precio = Number(p.productos[i].precio); }
  });
  CAMPOS_PARAMETROS.forEach(k => { if (p[k] !== undefined) CONFIG[k] = Number(p[k]); });
}

function guardarParametros(p) {
  aplicarParametros(p);
  try { localStorage.setItem(CLAVE_PARAMETROS, JSON.stringify(parametrosDe(CONFIG))); } catch (e) { }
}

function restaurarParametros() {
  aplicarParametros(PARAMETROS_ORIGINALES);
  try { localStorage.removeItem(CLAVE_PARAMETROS); } catch (e) { }
}

function parametrosModificados() {
  return JSON.stringify(parametrosDe(CONFIG)) !== JSON.stringify(PARAMETROS_ORIGINALES);
}

// Al abrir la app se cargan los parámetros guardados, si hay
try { const g = JSON.parse(localStorage.getItem(CLAVE_PARAMETROS)); if (g) aplicarParametros(g); } catch (e) { }

const gananciaPorPlayera = (p) => p.precio - p.costo - CONFIG.envioCliente;
const envioProveedorPorPlayera = () => CONFIG.costoCaja / CONFIG.playerasPorCaja;

/* ---------------------- Historial de ventas de Cracks1201 ----------------------
   Sacado de la hoja "Ventas" del Excel de cuentas (sep 2024 a jun 2026), contando
   cuántas playeras de cada versión se vendieron por mes. Los montos se calculan
   con los precios actuales (CONFIG), no con los de cada venta.
   - Productos sin versión: temporada vieja o manga corta/larga = Retro;
     mujer, niño y otros = Fan; chumpas, polo y similares no se cuentan.
   - Ventas sin fecha: se les asignó la fecha de la orden más cercana.
   - Dic 2025 y mar 2026 no tienen registro: se estimaron con el promedio
     de los meses vecinos (estimado = true).
   - May 2026: problemas con el proveedor; no entra en los cálculos (excluir = true).
   Columnas: mes, jugador, fan, retro, especial, estimado, excluir, nota
   ------------------------------------------------------------------------------ */
const HISTORIAL_CRACKS = [
  ['2024-09', 4, 0, 1, false, false, false, ''],
  ['2024-10', 0, 4, 0, false, false, false, ''],
  ['2024-11', 10, 1, 0, false, false, false, ''],
  ['2024-12', 11, 0, 0, false, false, false, ''],
  ['2025-01', 11, 3, 10, false, false, false, ''],
  ['2025-02', 1, 1, 4, false, false, false, ''],
  ['2025-03', 7, 3, 15, false, false, false, ''],
  ['2025-04', 18, 9, 18, false, false, false, ''],
  ['2025-05', 25, 19, 8, true, false, false, 'Final de Champions'],
  ['2025-06', 31, 27, 14, true, false, false, 'Mundial de Clubes'],
  ['2025-07', 23, 21, 20, true, false, false, 'Mundial de Clubes'],
  ['2025-08', 23, 7, 11, true, false, false, 'Nueva temporada 25/26'],
  ['2025-09', 15, 8, 10, false, false, false, ''],
  ['2025-10', 17, 2, 7, false, false, false, ''],
  ['2025-11', 20, 6, 9, false, false, false, ''],
  ['2025-12', 16, 4, 7, false, true, false, 'Sin registro: promedio de nov 2025 y ene 2026'],
  ['2026-01', 11, 2, 5, false, false, false, ''],
  ['2026-02', 10, 6, 7, false, false, false, ''],
  ['2026-03', 9, 7, 7, false, true, false, 'Sin registro: promedio de feb y abr 2026'],
  ['2026-04', 8, 8, 6, false, false, false, ''],
  ['2026-05', 0, 0, 0, false, false, true, 'Problemas con el proveedor: no entra en los cálculos'],
  ['2026-06', 7, 13, 8, true, false, false, 'Mundial 2026']
].map(([mes, jugador, fan, retro, especial, estimado, excluir, nota]) => ({ mes, jugador, fan, retro, especial, estimado, excluir, nota }));

/* ---------------------- Guardar y leer ventas ---------------------- */
const CLAVE_VENTAS = 'cracks1201.ventas.v2';
const CLAVE_ORIGEN = 'cracks1201.origenVentas.v2';

function leerVentas() {
  try {
    const guardado = localStorage.getItem(CLAVE_VENTAS);
    if (guardado) return JSON.parse(guardado);
  } catch (e) { /* si el navegador no deja guardar, se usa el historial original */ }
  return HISTORIAL_CRACKS.map(v => ({ ...v }));
}

function guardarVentas(ventas, origen = 'usuario') {
  ventas.sort((a, b) => a.mes.localeCompare(b.mes));
  try {
    localStorage.setItem(CLAVE_VENTAS, JSON.stringify(ventas));
    localStorage.setItem(CLAVE_ORIGEN, origen);
  } catch (e) { /* sin almacenamiento: los cambios duran mientras la página esté abierta */ }
}

function origenVentas() {
  try { return localStorage.getItem(CLAVE_ORIGEN) || 'historial'; } catch (e) { return 'historial'; }
}

function restaurarHistorial() {
  try { localStorage.removeItem(CLAVE_VENTAS); localStorage.removeItem(CLAVE_ORIGEN); localStorage.removeItem(CLAVE_NUEVAS); } catch (e) { }
}

/* ---------------------- Ventas nuevas (registradas desde la app) ----------------------
   Cada venta nueva se guarda con sus datos y además suma 1 a su mes y versión
   en el historial, para que el modelo la tome en cuenta.
   -------------------------------------------------------------------------------------- */
const CLAVE_NUEVAS = 'cracks1201.ventasNuevas.v1';

function leerVentasNuevas() {
  try { return JSON.parse(localStorage.getItem(CLAVE_NUEVAS)) || []; } catch (e) { return []; }
}
function guardarVentasNuevas(lista) {
  try { localStorage.setItem(CLAVE_NUEVAS, JSON.stringify(lista)); } catch (e) { }
}

// Suma (o resta) playeras a un mes del historial; si el mes no existe, lo crea
function ajustarMes(mes, clave, cambio) {
  const lista = leerVentas();
  let m = lista.find(x => x.mes === mes);
  if (!m) { m = { mes, jugador: 0, fan: 0, retro: 0, especial: false, estimado: false, excluir: false, nota: '' }; lista.push(m); }
  m[clave] = Math.max(0, m[clave] + cambio);
  guardarVentas(lista);
}

function registrarVenta(venta) {
  const lista = leerVentasNuevas();
  venta.id = Date.now();
  lista.push(venta);
  guardarVentasNuevas(lista);
  ajustarMes(venta.fecha.slice(0, 7), venta.version.toLowerCase(), 1);
}

function quitarVentaNueva(id) {
  const lista = leerVentasNuevas();
  const v = lista.find(x => x.id === id);
  if (!v) return;
  guardarVentasNuevas(lista.filter(x => x.id !== id));
  ajustarMes(v.fecha.slice(0, 7), v.version.toLowerCase(), -1);
}

/* ---------------------- Análisis del historial ---------------------- */
const totalMes = (v) => v.jugador + v.fan + v.retro;

function promedio(lista) { return lista.length ? lista.reduce((s, v) => s + v, 0) / lista.length : 0; }

// Desviación estándar muestral
function desviacion(lista) {
  if (lista.length < 2) return 0;
  const m = promedio(lista);
  return Math.sqrt(lista.reduce((s, v) => s + (v - m) ** 2, 0) / (lista.length - 1));
}

function analizarVentas(todas) {
  // Los meses marcados para excluir (problemas de abastecimiento) no representan la demanda real
  const ventas = todas.filter(v => !v.excluir);
  const totales = { jugador: 0, fan: 0, retro: 0 };
  ventas.forEach(v => { totales.jugador += v.jugador; totales.fan += v.fan; totales.retro += v.retro; });
  const total = totales.jugador + totales.fan + totales.retro;

  const pct = {};
  CONFIG.productos.forEach(p => { pct[p.clave] = total ? (totales[p.clave] / total) * 100 : 0; });

  const normales = ventas.filter(v => !v.especial).map(totalMes);
  const especiales = ventas.filter(v => v.especial).map(totalMes);
  const todos = ventas.map(totalMes);

  const demandaNormal = promedio(normales.length ? normales : todos);
  const demandaEspecial = especiales.length ? promedio(especiales) : Math.max(...todos, 0);

  return {
    meses: ventas.length,
    excluidos: todas.length - ventas.length,
    estimados: ventas.filter(v => v.estimado).length,
    total, totales, pct,
    promedioMensual: promedio(todos),
    demandaNormal, demandaEspecial,
    sigmaNormal: desviacion(normales.length ? normales : todos),
    minNormal: normales.length ? Math.min(...normales) : 0,
    maxNormal: normales.length ? Math.max(...normales) : 0,
    mesesEspeciales: especiales.length,
    demandaAnual: promedio(todos) * 12
  };
}

/* ---------------------- Importar Excel / CSV ----------------------
   Acepta dos formatos:
   A) Una fila por mes:   Mes | Jugador | Fan | Retro | Especial (opcional)
   B) Una fila por venta: Fecha | Tipo (Jugador/Fan/Retro) | Cantidad (opcional)
   ------------------------------------------------------------------ */
const MESES_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function aMes(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date && !isNaN(valor)) {
    return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}`;
  }
  if (typeof valor === 'number') { // número de serie de Excel
    const d = new Date(Math.round((valor - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  const t = String(valor).trim().toLowerCase();
  let m;
  if ((m = t.match(/^(\d{4})[-/.](\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}`;          // 2025-01
  if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) return `${m[3]}-${m[2].padStart(2, '0')}`; // 15/01/2025
  if ((m = t.match(/^(\d{1,2})[-/.](\d{4})/))) return `${m[2]}-${m[1].padStart(2, '0')}`;          // 01/2025
  const i = MESES_ES.findIndex(n => t.startsWith(n));
  if (i >= 0 && (m = t.match(/(\d{4})/))) return `${m[1]}-${String(i + 1).padStart(2, '0')}`;     // enero 2025
  return null;
}

const esSi = (v) => /^(s[ií]|x|1|true|verdadero)$/i.test(String(v ?? '').trim());
const aNumero = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };

function importarLibro(libro) {
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: '' });

  // Buscar la fila de encabezados
  for (let f = 0; f < Math.min(filas.length, 15); f++) {
    const enc = filas[f].map(c => String(c).trim().toLowerCase());
    const col = (re) => enc.findIndex(c => re.test(c));

    const cJug = col(/jugador/), cFan = col(/^fan|fan$/), cRet = col(/retro/);
    const cMes = col(/mes|fecha|periodo|período/);

    // Formato A: por mes
    if (cJug >= 0 && cFan >= 0 && cRet >= 0 && cMes >= 0) {
      const cEsp = col(/especial|evento|temporada/);
      const cEst = col(/estimado/), cExc = col(/excluir|no contar/), cNota = col(/nota/);
      const porMes = {};
      filas.slice(f + 1).forEach(fila => {
        const mes = aMes(fila[cMes]);
        if (!mes) return;
        const v = porMes[mes] || (porMes[mes] = { mes, jugador: 0, fan: 0, retro: 0, especial: false, estimado: false, excluir: false, nota: '' });
        v.jugador += aNumero(fila[cJug]); v.fan += aNumero(fila[cFan]); v.retro += aNumero(fila[cRet]);
        if (cEsp >= 0 && esSi(fila[cEsp])) v.especial = true;
        if (cEst >= 0 && esSi(fila[cEst])) v.estimado = true;
        if (cExc >= 0 && esSi(fila[cExc])) v.excluir = true;
        if (cNota >= 0 && fila[cNota]) v.nota = String(fila[cNota]).trim();
      });
      return Object.values(porMes);
    }

    // Formato B: por venta
    const cTipo = col(/tipo|versi[oó]n|producto|categor/);
    if (cMes >= 0 && cTipo >= 0) {
      const cCant = col(/cantidad|unidades|cant/);
      const porMes = {};
      filas.slice(f + 1).forEach(fila => {
        const mes = aMes(fila[cMes]);
        const tipo = String(fila[cTipo]).toLowerCase();
        if (!mes) return;
        const clave = tipo.includes('jug') ? 'jugador' : tipo.includes('fan') ? 'fan' : tipo.includes('ret') ? 'retro' : null;
        if (!clave) return;
        const v = porMes[mes] || (porMes[mes] = { mes, jugador: 0, fan: 0, retro: 0, especial: false, estimado: false, excluir: false, nota: '' });
        v[clave] += cCant >= 0 ? aNumero(fila[cCant]) || 1 : 1;
      });
      return Object.values(porMes);
    }
  }
  throw new Error('No encontré las columnas. Usá: Mes, Jugador, Fan, Retro (y Especial opcional), o bien: Fecha, Tipo, Cantidad.');
}

function nombreMes(clave, corto = false) {
  const [a, m] = clave.split('-').map(Number);
  const largos = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const n = corto ? MESES_ES[m - 1] : largos[m - 1];
  return `${n} ${corto ? String(a).slice(2) : a}`;
}
