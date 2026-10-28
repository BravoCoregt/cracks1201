/* =====================================================================
   simplex.js
   Método Simplex con técnica de la M Grande (Big M).
   Proyecto final - Investigación de Operaciones (026) - UMG
   Empresa: Cracks1201

   Este archivo NO toca la interfaz. Solo recibe un problema de
   programación lineal y devuelve la solución con todas las tablas
   de cada iteración, para poder mostrarlas en pantalla.
   ===================================================================== */

const EPS = 1e-9; // tolerancia para comparar números con decimales

/* ---------------------------------------------------------------------
   Números de la forma  k + m·M
   La M Grande la manejamos de forma simbólica (no como 1,000,000)
   para que las tablas muestren "195 - 2M" igual que en clase.
   --------------------------------------------------------------------- */
function numM(k, m = 0) { return { k: k, m: m }; }
function sumarM(a, b) { return numM(a.k + b.k, a.m + b.m); }
function escalarM(a, s) { return numM(a.k * s, a.m * s); }

// ¿El número es negativo? Primero manda la parte de M, luego la constante.
function esNegativoM(a) {
  if (a.m < -EPS) return true;
  if (Math.abs(a.m) <= EPS && a.k < -EPS) return true;
  return false;
}

// ¿a es menor que b?
function esMenorM(a, b) {
  if (Math.abs(a.m - b.m) > EPS) return a.m < b.m;
  return a.k < b.k - EPS;
}

/* ---------------------------------------------------------------------
   resolverSimplex(problema)

   problema = {
     tipo: 'max' | 'min',
     c: [175, 195, 175],                 // coeficientes de la función objetivo
     nombresVar: ['x1', 'x2', 'x3'],
     restricciones: [
       { nombre: 'Presupuesto', coef: [250, 200, 200], signo: '<=', rhs: 3000 },
       ...
     ]
   }
   --------------------------------------------------------------------- */
function resolverSimplex(problema) {
  const n = problema.c.length;
  // Si es minimización, maximizamos el negativo (min Z = -max(-Z))
  const sentido = problema.tipo === 'min' ? -1 : 1;
  const c = problema.c.map(v => v * sentido);

  // 1) Lado derecho siempre positivo: si es negativo, multiplicamos por -1
  const R = problema.restricciones.map(r => {
    let coef = r.coef.slice(), rhs = r.rhs, signo = r.signo, volteada = false;
    if (rhs < 0) {
      coef = coef.map(v => -v);
      rhs = -rhs;
      signo = signo === '<=' ? '>=' : (signo === '>=' ? '<=' : '=');
      volteada = true;
    }
    return { nombre: r.nombre, coef, rhs, signo, volteada, colHolgura: -1, colArtificial: -1 };
  });

  // 2) Armar columnas: variables de decisión, holguras/excesos y artificiales
  const columnas = [];
  for (let j = 0; j < n; j++) columnas.push({ nombre: problema.nombresVar[j], tipo: 'x' });

  R.forEach((r, i) => {
    if (r.signo === '<=') {            // holgura: lo que sobra del recurso
      r.colHolgura = columnas.length;
      columnas.push({ nombre: 'h' + (i + 1), tipo: 'h', fila: i });
    } else if (r.signo === '>=') {     // exceso: lo que se pasa del mínimo
      r.colHolgura = columnas.length;
      columnas.push({ nombre: 'e' + (i + 1), tipo: 'e', fila: i });
    }
  });
  R.forEach((r, i) => {                // artificiales para >= y =
    if (r.signo !== '<=') {
      r.colArtificial = columnas.length;
      columnas.push({ nombre: 'a' + (i + 1), tipo: 'a', fila: i });
    }
  });

  const N = columnas.length;

  // 3) Matriz de restricciones (tabla inicial)
  let filas = R.map(r => {
    const f = new Array(N).fill(0);
    r.coef.forEach((v, j) => { f[j] = v; });
    if (r.signo === '<=') f[r.colHolgura] = 1;
    if (r.signo === '>=') f[r.colHolgura] = -1;
    if (r.colArtificial >= 0) f[r.colArtificial] = 1;
    return f;
  });
  let rhs = R.map(r => r.rhs);
  let base = R.map(r => (r.signo === '<=' ? r.colHolgura : r.colArtificial));

  // 4) Fila Z:  Z - c·x + M·a = 0   (penalizamos las artificiales con M)
  let z = columnas.map((col, j) => {
    if (col.tipo === 'x') return numM(-c[j]);
    if (col.tipo === 'a') return numM(0, 1);
    return numM(0);
  });
  let zRhs = numM(0);

  // Quitamos las M de las columnas artificiales (deben quedar en 0 por estar en la base)
  R.forEach((r, i) => {
    if (r.colArtificial >= 0) {
      for (let j = 0; j < N; j++) z[j] = sumarM(z[j], numM(0, -filas[i][j]));
      zRhs = sumarM(zRhs, numM(0, -rhs[i]));
    }
  });

  // 5) Iteraciones del Simplex
  const iteraciones = [];
  let estado = 'optimo';
  const MAX_ITER = 60;

  const fotografia = (extra) => ({
    filas: filas.map(f => f.slice()),
    rhs: rhs.slice(),
    base: base.slice(),
    z: z.map(v => ({ ...v })),
    zRhs: { ...zRhs },
    ...extra
  });

  for (let it = 0; it <= MAX_ITER; it++) {
    // 5.1 Variable que entra: la más negativa de la fila Z
    let entra = -1;
    for (let j = 0; j < N; j++) {
      if (esNegativoM(z[j]) && (entra < 0 || esMenorM(z[j], z[entra]))) entra = j;
    }

    if (entra < 0) { // ya no hay negativos: es la tabla óptima
      iteraciones.push(fotografia({ entra: -1, sale: -1, razones: null, final: true }));
      break;
    }

    // 5.2 Variable que sale: prueba de la razón mínima (solución / columna pivote)
    const razones = filas.map((f, i) => (f[entra] > EPS ? rhs[i] / f[entra] : null));
    let sale = -1;
    razones.forEach((r, i) => {
      if (r === null) return;
      if (sale < 0 || r < razones[sale] - EPS) sale = i;
    });

    if (sale < 0) { // nadie limita el crecimiento
      estado = 'no_acotado';
      iteraciones.push(fotografia({ entra, sale: -1, razones, final: true }));
      break;
    }

    iteraciones.push(fotografia({ entra, sale, razones, final: false }));

    if (it === MAX_ITER) { estado = 'max_iteraciones'; break; }

    // 5.3 Pivoteo (Gauss-Jordan)
    const pivote = filas[sale][entra];
    filas[sale] = filas[sale].map(v => v / pivote);
    rhs[sale] = rhs[sale] / pivote;

    for (let i = 0; i < filas.length; i++) {
      if (i === sale) continue;
      const factor = filas[i][entra];
      if (Math.abs(factor) <= EPS) continue;
      filas[i] = filas[i].map((v, j) => v - factor * filas[sale][j]);
      rhs[i] = rhs[i] - factor * rhs[sale];
    }

    const fz = z[entra];
    z = z.map((v, j) => sumarM(v, escalarM(fz, -filas[sale][j])));
    zRhs = sumarM(zRhs, escalarM(fz, -rhs[sale]));

    base[sale] = entra;

    // limpiar ruido numérico tipo 1e-15
    filas = filas.map(f => f.map(limpiar));
    rhs = rhs.map(limpiar);
    z = z.map(v => numM(limpiar(v.k), limpiar(v.m)));
    zRhs = numM(limpiar(zRhs.k), limpiar(zRhs.m));
  }

  // 6) ¿Quedó alguna artificial con valor positivo? Entonces no hay solución factible
  if (estado === 'optimo') {
    base.forEach((col, i) => {
      if (columnas[col].tipo === 'a' && rhs[i] > 1e-7) estado = 'infactible';
    });
  }

  // 7) Leer la solución
  const x = new Array(n).fill(0);
  base.forEach((col, i) => { if (col < n) x[col] = rhs[i]; });
  const Z = zRhs.k * sentido;

  // Análisis de cada restricción: holgura y precio sombra
  const analisis = problema.restricciones.map((r, i) => {
    const usado = r.coef.reduce((s, a, j) => s + a * x[j], 0);
    const holgura = Math.abs(r.rhs - usado);
    const rr = R[i];
    let precioSombra = 0;
    if (rr.signo === '<=') precioSombra = z[rr.colHolgura].k;
    else if (rr.signo === '>=') precioSombra = -z[rr.colHolgura].k;
    else precioSombra = z[rr.colArtificial].k;
    precioSombra *= sentido * (rr.volteada ? -1 : 1);
    return {
      nombre: r.nombre, signo: r.signo, rhs: r.rhs,
      usado: limpiar(usado), holgura: limpiar(holgura),
      activa: holgura < 1e-6, precioSombra: limpiar(precioSombra)
    };
  });

  // Costos reducidos y soluciones alternativas
  const enBase = new Set(base);
  const costosReducidos = [];
  let hayAlternativas = false;
  for (let j = 0; j < n; j++) {
    costosReducidos.push(limpiar(z[j].k));
    if (!enBase.has(j) && Math.abs(z[j].k) < 1e-7 && Math.abs(z[j].m) < 1e-7) hayAlternativas = true;
  }

  return {
    estado, x: x.map(limpiar), Z: limpiar(Z), columnas, iteraciones,
    analisis, costosReducidos, hayAlternativas,
    nombresRestricciones: problema.restricciones.map(r => r.nombre)
  };
}

function limpiar(v) {
  if (Math.abs(v) < 1e-10) return 0;
  return Math.round(v * 1e7) / 1e7;
}

/* ---------------------------------------------------------------------
   mejorSolucionEntera(problema)
   No se pueden comprar 7.5 playeras. Con pocas variables (hasta 4)
   probamos todas las combinaciones enteras posibles y nos quedamos con
   la de mayor ganancia que cumpla todas las restricciones.
   --------------------------------------------------------------------- */
function mejorSolucionEntera(problema) {
  const n = problema.c.length;
  if (n > 4) return null;

  // Límite superior de cada variable usando restricciones <= con coeficientes positivos
  const limites = new Array(n).fill(Infinity);
  problema.restricciones.forEach(r => {
    if (r.signo !== '<=') return;
    if (r.coef.some(v => v < 0)) return;
    r.coef.forEach((a, j) => { if (a > 0) limites[j] = Math.min(limites[j], Math.floor(r.rhs / a + 1e-9)); });
  });
  if (limites.some(l => !isFinite(l))) return null;

  let combinaciones = 1;
  limites.forEach(l => { combinaciones *= (l + 1); });
  if (combinaciones > 3e6) return null;

  const sentido = problema.tipo === 'min' ? -1 : 1;
  let mejor = null;
  const x = new Array(n).fill(0);

  const cumple = () => problema.restricciones.every(r => {
    const lhs = r.coef.reduce((s, a, j) => s + a * x[j], 0);
    if (r.signo === '<=') return lhs <= r.rhs + 1e-9;
    if (r.signo === '>=') return lhs >= r.rhs - 1e-9;
    return Math.abs(lhs - r.rhs) < 1e-9;
  });

  const explorar = (j) => {
    if (j === n) {
      if (!cumple()) return;
      const valor = problema.c.reduce((s, cj, k) => s + cj * x[k], 0);
      if (mejor === null || valor * sentido > mejor.Z * sentido) mejor = { x: x.slice(), Z: valor };
      return;
    }
    for (let v = 0; v <= limites[j]; v++) { x[j] = v; explorar(j + 1); }
    x[j] = 0;
  };
  explorar(0);
  return mejor;
}

/* Formato para mostrar números con M:  "195 - 2M"  */
function formatoM(a, dec = 2) {
  const f = (v) => {
    const r = Math.round(v * 10 ** dec) / 10 ** dec;
    return Number.isInteger(r) ? String(r) : r.toFixed(dec).replace(/0+$/, '').replace(/\.$/, '');
  };
  const k = Math.abs(a.k) < 1e-9 ? 0 : a.k;
  const m = Math.abs(a.m) < 1e-9 ? 0 : a.m;
  if (m === 0) return f(k);
  const parteM = (Math.abs(m) === 1 ? '' : f(Math.abs(m))) + 'M';
  if (k === 0) return (m < 0 ? '-' : '') + parteM;
  return f(k) + (m < 0 ? ' - ' : ' + ') + parteM;
}

// Para poder probar este archivo con Node (no afecta al navegador)
if (typeof module !== 'undefined') {
  module.exports = { resolverSimplex, mejorSolucionEntera, formatoM };
}
