/* =====================================================================
   proyecto.js
   Sección "Proyecto" del panel: el proyecto de Investigación de
   Operaciones aplicado a Cracks1201.
   Rutas: #/proyecto/problema | ventas | plan | pedir | modelo | iteraciones | reportes
   ===================================================================== */

const PESTANAS = [
  { id: 'problema', nombre: 'El problema' },
  { id: 'ventas', nombre: 'Control de ventas' },
  { id: 'plan', nombre: 'Plan de compra' },
  { id: 'pedir', nombre: 'Cuándo pedir' },
  { id: 'modelo', nombre: 'Modelo matemático' },
  { id: 'reportes', nombre: 'Reportes' }
];

const ESCENARIOS = {
  normal: { nombre: 'Mes normal', get presupuesto() { return CONFIG.presupuestoNormal; } },
  especial: { nombre: 'Temporada especial', get presupuesto() { return CONFIG.presupuestoEspecial; } }
};

// Lo que el usuario eligió en el Plan de compra (lo usan Modelo, Iteraciones y Reportes)
const estadoProyecto = { escenario: 'normal', presupuesto: CONFIG.presupuestoNormal, nivelServicio: 0.95, optimizado: false, hora: '' };

const nombreMinimo = () => CONFIG.minimoJugador === CONFIG.tallas.length
  ? 'Mínimo de Jugador (una por talla)' : 'Mínimo de Jugador en stock';

const SIGNOS = { '<=': '≤', '>=': '≥', '=': '=' };
const sub = (i) => `<sub>${i}</sub>`;

/* =====================================================================
   CÁLCULOS
   ===================================================================== */

// Demanda esperada del escenario, sacada del historial de ventas
function demandaDeEscenario(analisis, escenario) {
  const d = escenario === 'especial' ? analisis.demandaEspecial : analisis.demandaNormal;
  return Math.round(d * 10) / 10;
}

function construirModelo(escenario, presupuesto) {
  const analisis = analizarVentas(leerVentas());
  const demanda = demandaDeEscenario(analisis, escenario);
  const P = CONFIG.productos;
  const unitario = (i) => P.map((_, j) => (j === i ? 1 : 0));

  const restricciones = [
    { nombre: 'Presupuesto', tipo: 'presupuesto', coef: P.map(p => p.costo), signo: '<=', rhs: presupuesto },
    { nombre: 'Espacio en bodega', tipo: 'espacio', coef: P.map(() => 1), signo: '<=', rhs: CONFIG.capacidadBodega }
  ];
  P.forEach((p, i) => restricciones.push({
    nombre: 'Demanda ' + p.nombre, tipo: 'demanda', producto: i, coef: unitario(i), signo: '<=',
    rhs: Math.round(demanda * analisis.pct[p.clave]) / 100
  }));
  restricciones.push({
    nombre: nombreMinimo(), tipo: 'minimo', producto: 0, coef: unitario(0), signo: '>=', rhs: CONFIG.minimoJugador
  });

  const problema = { tipo: 'max', c: P.map(gananciaPorPlayera), nombresVar: P.map((_, i) => 'x' + '₁₂₃'[i]), restricciones };
  return { problema, analisis, demanda, escenario, presupuesto };
}

function resolverPlan(escenario, presupuesto) {
  const m = construirModelo(escenario, presupuesto);
  m.resultado = resolverSimplex(m.problema);
  m.entero = m.resultado.estado === 'optimo' ? mejorSolucionEntera(m.problema) : null;
  return m;
}

function calcularPedidos(nivelServicio) {
  const analisis = analizarVentas(leerVentas());
  const costoUnitario = CONFIG.productos.reduce((s, p) => s + p.costo * analisis.pct[p.clave], 0) / 100;
  const entrada = {
    demandaMensual: analisis.promedioMensual,
    sigmaMes: analisis.sigmaNormal,
    demandaMin: analisis.minNormal, demandaMax: analisis.maxNormal,
    costoPedido: CONFIG.costoCaja,
    costoUnitario,
    tasaMantener: CONFIG.tasaMantener,
    entregaMin: CONFIG.entregaMin, entregaMax: CONFIG.entregaMax,
    nivelServicio,
    tamanoCaja: CONFIG.playerasPorCaja,
    capacidad: CONFIG.capacidadBodega
  };
  const r = calcularInventario(entrada);
  return { entrada, r, analisis, reparto: repartir(r.elegido.Q, analisis.pct) };
}

// Reparte un pedido entre los tipos según el % de ventas (método del residuo mayor)
function repartir(total, pct) {
  const P = CONFIG.productos;
  const exactos = P.map(p => total * pct[p.clave] / 100);
  const base = exactos.map(Math.floor);
  let faltan = total - base.reduce((s, v) => s + v, 0);
  exactos.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r)
    .forEach(o => { if (faltan > 0) { base[o.i]++; faltan--; } });
  return base;
}

/* =====================================================================
   ESTRUCTURA COMÚN DE LA SECCIÓN
   ===================================================================== */
function encabezadoProyecto(activa, descripcion) {
  return `
    <div class="cabecera">
      <div>
        <h1>Proyecto</h1>
        <p>${descripcion}</p>
      </div>
    </div>
    <nav class="pestanas" aria-label="Pasos del proyecto">
      ${PESTANAS.map((p, i) => `<a href="#/proyecto/${p.id}" class="${p.id === activa ? 'activo' : ''}"><span class="n">${i + 1}</span>${p.nombre}</a>`).join('')}
    </nav>`;
}

function pantallaProyecto(vista, subruta) {
  limpiarGraficas();
  const pantallas = {
    problema: pantallaProblema, ventas: pantallaVentas, plan: pantallaPlan, pedir: pantallaPedir,
    modelo: pantallaModelo, iteraciones: pantallaIteraciones, reportes: pantallaReportes, datos: pantallaDatos
  };
  (pantallas[subruta] || pantallaProblema)(vista);
}

/* =====================================================================
   1. EL PROBLEMA
   ===================================================================== */
function pantallaProblema(vista) {
  const P = CONFIG.productos;
  vista.innerHTML = `
    ${encabezadoProyecto('problema', 'Investigación de Operaciones aplicada a Cracks1201: qué playeras tener en stock y cuándo pedirlas.')}
    ${avisoParametros()}

    <div class="fila">
      <section class="tarjeta ancha">
        <h2>La empresa</h2>
        <div class="texto-largo">
          <p><b>Cracks1201</b> es una tienda deportiva en Guatemala que vende playeras de fútbol por Instagram, con envío gratis a todo el país. Vende tres versiones: <b>Jugador</b>, <b>Fan</b> y <b>Retro</b>, en tallas de la S a la XXL.</p>
          <p>Hay dos formas de vender: playeras que ya están <b>en stock</b> y se entregan de inmediato, y playeras <b>por encargo</b>, donde el cliente deja 50% de anticipo (o paga al recibir) y se piden al proveedor.</p>
          <p>El análisis usa el <b>historial de ventas de septiembre 2024 a junio 2026</b> (unas 545 playeras) para la demanda, y los <b>precios y costos actuales</b> para la ganancia.</p>
        </div>
      </section>
      <section class="tarjeta tarjeta-oscura">
        <h2>El problema</h2>
        <p class="suave">El dinero para stock es limitado: <b>${Q(CONFIG.presupuestoNormal)} al mes</b> y <b>${Q(CONFIG.presupuestoEspecial)}</b> en temporadas especiales (Mundial, final de Champions, nueva temporada), que llegan cada 7 meses aproximadamente.</p>
        <p class="suave">El proveedor tarda <b>${CONFIG.entregaMin} a ${CONFIG.entregaMax} días</b> en entregar. Si una playera no está en stock, el cliente espera mes y medio o se va con otra tienda.</p>
      </section>
    </div>

    <section class="tarjeta">
      <h2>Lo que se quiere resolver</h2>
      <div class="fila">
        <div class="aviso aviso-crema" style="flex-direction:column;gap:6px">
          <b style="font-size:16px">1. ¿Cuántas playeras de cada tipo comprar para stock?</b>
          <span>Maximizar la ganancia del stock sin pasarse del presupuesto, del espacio en bodega ni de lo que se vende.</span>
          <span class="chip chip-naranja" style="align-self:flex-start">Programación lineal: Método Simplex con M Grande</span>
        </div>
        <div class="aviso aviso-crema" style="flex-direction:column;gap:6px">
          <b style="font-size:16px">2. ¿Cuánto y cuándo pedirle al proveedor?</b>
          <span>Gastar lo menos posible en pedidos y en tener playeras guardadas, sin quedarse sin stock mientras llega el pedido.</span>
          <span class="chip chip-naranja" style="align-self:flex-start">Inventarios: EOQ con stock de seguridad</span>
        </div>
      </div>
    </section>

    <div class="fila">
      <section class="tarjeta ancha">
        <h2>Precios y costos</h2>
        <div class="tabla-scroll"><table class="tabla">
          <thead><tr><th>Versión</th><th class="num">Costo</th><th class="num">Precio de venta</th><th class="num">Envío gratis al cliente</th><th class="num">Ganancia por playera</th><th class="num">Ganancia por Q1 invertido</th></tr></thead>
          <tbody>${P.map(p => `<tr><td><b>${p.nombre}</b></td><td class="num">${Q(p.costo)}</td><td class="num">${Q(p.precio)}</td><td class="num">${Q(CONFIG.envioCliente)}</td><td class="num"><b>${Q(gananciaPorPlayera(p))}</b></td><td class="num">${Q2(gananciaPorPlayera(p) / p.costo)}</td></tr>`).join('')}</tbody>
        </table></div>
        <p class="subtitulo">Ganancia por playera = precio − costo − envío. El envío del proveedor (${Q(CONFIG.costoCaja)} por caja) se analiza en el modelo de inventario como costo de pedir.</p>
      </section>
      <section class="tarjeta">
        <h2>Reglas del negocio</h2>
        <ul class="lista-limpia">
          <li>En bodega caben <b>${CONFIG.capacidadBodega} playeras</b>.</li>
          <li>Siempre debe haber al menos <b>${CONFIG.minimoJugador} Jugador</b> en stock${CONFIG.minimoJugador === CONFIG.tallas.length ? `, una de cada talla (${CONFIG.tallas.join(', ')})` : ''}, porque es la más pedida.</li>
          <li>El proveedor manda cajas de <b>${CONFIG.playerasPorCaja} playeras</b> y cobra <b>${Q(CONFIG.costoCaja)}</b> por caja.</li>
          <li>Tener una playera guardada cuesta <b>${num(CONFIG.tasaMantener * 100)}% de su valor al año</b> (dinero amarrado, riesgo de que pase de moda). Es un supuesto.</li>
        </ul>
      </section>
    </div>

    <section class="tarjeta">
      <h2>Cómo funciona la solución</h2>
      <div class="cifras">
        ${[
          ['Control de ventas', 'Del historial salen la demanda de cada mes y el % que se vende de cada versión.', 'ventas'],
          ['Plan de compra', 'Con esos datos y el presupuesto, el Simplex calcula cuántas comprar de cada una.', 'plan'],
          ['Cuándo pedir', 'El EOQ calcula el tamaño de cada pedido, cada cuánto pedir y el stock de seguridad.', 'pedir'],
          ['Reportes', 'Conclusiones para decidir, en PDF y Excel.', 'reportes']
        ].map(([t, d, r], i) => `<a href="#/proyecto/${r}" class="cifra" style="text-decoration:none;color:inherit"><span class="cifra-valor" style="font-size:36px;color:var(--naranja)">${i + 1}</span><b>${t}</b><span class="cifra-detalle">${d}</span></a>`).join('')}
      </div>
    </section>`;
}

/* =====================================================================
   2. CONTROL DE VENTAS
   ===================================================================== */
function pantallaVentas(vista) {
  const ventas = leerVentas().sort((a, b) => a.mes.localeCompare(b.mes));
  const a = analizarVentas(ventas);
  const P = CONFIG.productos;
  const modificado = origenVentas() !== 'historial';

  vista.innerHTML = `
    ${encabezadoProyecto('ventas', 'El historial de ventas es la base del modelo: de aquí salen la demanda y el porcentaje de cada versión.')}

    <div class="aviso aviso-crema"><span>${modificado
      ? '<b>Historial modificado.</b> Estás usando datos que agregaste, editaste o importaste.'
      : `<b>Historial de Cracks1201</b>, de septiembre 2024 a junio 2026, sacado del Excel de cuentas. ${a.estimados ? `${a.estimados} meses sin registro se estimaron con el promedio de los meses vecinos` : ''}${a.excluidos ? ` y ${a.excluidos} mes se dejó fuera por problemas con el proveedor` : ''}.`}</span></div>

    <div class="cifras">
      <div class="cifra"><span class="cifra-etiqueta">Meses registrados</span><span class="cifra-valor">${a.meses}</span><span class="cifra-detalle">${num(a.total, 0)} playeras${a.excluidos ? `, ${a.excluidos} mes excluido` : ''}</span></div>
      <div class="cifra"><span class="cifra-etiqueta">Mes normal</span><span class="cifra-valor">${num(a.demandaNormal, 1)}</span><span class="cifra-detalle">playeras en promedio (σ = ${num(a.sigmaNormal, 1)})</span></div>
      <div class="cifra"><span class="cifra-etiqueta">Temporada especial</span><span class="cifra-valor">${num(a.demandaEspecial, 1)}</span><span class="cifra-detalle">${a.mesesEspeciales ? `promedio de ${a.mesesEspeciales} meses especiales` : 'sin meses especiales marcados: se usa el mes más alto'}</span></div>
      <div class="cifra oscura"><span class="cifra-etiqueta">Promedio de todos los meses</span><span class="cifra-valor">${num(a.promedioMensual, 1)}</span><span class="cifra-detalle">${num(a.demandaAnual, 0)} playeras al año</span></div>
    </div>

    <div class="fila">
      <section class="tarjeta ancha">
        <h2>Ventas por mes</h2>
        <div class="grafica" style="height:300px"><canvas id="gVentasMes"></canvas></div>
        <p class="subtitulo">★ temporada especial. * mes estimado. ✕ mes que no se cuenta (problemas con el proveedor).</p>
      </section>
      <section class="tarjeta">
        <h2>Qué se vende más</h2>
        <div class="barra" style="height:16px">${P.map(p => `<span style="height:16px;width:${a.pct[p.clave]}%;background:${COLOR_PRODUCTO[p.clave]}"></span>`).join('')}</div>
        ${P.map(p => `<div style="display:flex;justify-content:space-between;align-items:center;font-size:15px"><span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${COLOR_PRODUCTO[p.clave]};margin-right:8px"></span>${p.nombre}</span><b>${num(a.pct[p.clave], 1)}%</b></div>`).join('')}
        <p class="subtitulo">Estos porcentajes se calculan solos con el historial y se usan en el Simplex y en el reparto de cada pedido.</p>
      </section>
    </div>

    <section class="tarjeta">
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px">
        <h2>Registro</h2>
        <div class="cabecera-acciones">
          <a href="#/proyecto/datos" class="btn btn-naranja btn-chico">Ver todos los datos</a>
          <label class="btn btn-cafe btn-chico" style="cursor:pointer">Importar Excel<input type="file" id="archivoVentas" accept=".xlsx,.xls,.csv" hidden></label>
          <button class="btn btn-borde btn-chico" id="btnDescargarVentas" type="button">Descargar Excel</button>
          <button class="btn btn-borde btn-chico" id="btnPlantilla" type="button">Descargar plantilla</button>
          ${modificado ? '<button class="btn-texto" id="btnRestaurar" type="button">Volver al historial original</button>' : ''}
        </div>
      </div>
      <div id="msgVentas"></div>

      <div class="campos" style="background:var(--fondo);border-radius:12px;padding:14px">
        <label>Mes<select id="nuevoMesNum">${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'].map((n, i) => `<option value="${String(i + 1).padStart(2, '0')}">${n}</option>`).join('')}</select></label>
        <label>Año<select id="nuevoAnio">${[2024, 2025, 2026, 2027, 2028].map(a => `<option ${a === new Date().getFullYear() ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        ${P.map(p => `<label>${p.nombre}<input type="number" min="0" step="1" id="nuevo-${p.clave}" value="0"></label>`).join('')}
        <label style="flex-direction:row;align-items:center;gap:8px;padding-bottom:10px"><input type="checkbox" id="nuevoEspecial" style="width:18px;height:18px;accent-color:var(--naranja)">Temporada especial</label>
        <button class="btn btn-naranja" id="btnAgregarMes" type="button">Agregar mes</button>
      </div>

      <div class="tabla-scroll"><table class="tabla" id="tablaVentas">
        <thead><tr><th>Mes</th>${P.map(p => `<th class="num">${p.nombre}</th>`).join('')}<th class="num">Total</th><th>Temporada especial</th><th>No contar</th><th>Nota</th><th></th></tr></thead>
        <tbody>
          ${ventas.slice().reverse().map(v => `
            <tr data-mes="${v.mes}">
              <td><b>${nombreMes(v.mes)}</b></td>
              ${P.map(p => `<td class="num"><input type="number" min="0" step="1" data-campo="${p.clave}" value="${v[p.clave]}" aria-label="${p.nombre} en ${nombreMes(v.mes)}"></td>`).join('')}
              <td class="num"><b>${totalMes(v)}</b></td>
              <td><input type="checkbox" data-campo="especial" ${v.especial ? 'checked' : ''} aria-label="Temporada especial en ${nombreMes(v.mes)}"></td>
              <td><input type="checkbox" data-campo="excluir" ${v.excluir ? 'checked' : ''} aria-label="No contar ${nombreMes(v.mes)}"></td>
              <td style="white-space:normal;min-width:200px">${v.estimado ? '<span class="chip chip-amarillo">Estimado</span> ' : ''}${v.excluir ? '<span class="chip chip-crema">No se cuenta</span> ' : ''}<span class="subtitulo">${esc(v.nota || '')}</span></td>
              <td><button class="btn-texto" data-quitar="${v.mes}" type="button">Quitar</button></td>
            </tr>`).join('')}
        </tbody>
      </table></div>
      <p class="subtitulo">Formato del Excel: columnas <b>Mes, Jugador, Fan, Retro</b> y opcionales <b>Especial, Estimado, No contar</b> (Sí/No) y <b>Nota</b>. También sirve una fila por venta con <b>Fecha, Tipo, Cantidad</b>: la app las agrupa por mes.</p>
    </section>`;

  // Gráfica apilada por mes
  crearGrafica('gVentasMes', {
    type: 'bar',
    data: {
      labels: ventas.map(v => (v.especial ? '★ ' : '') + nombreMes(v.mes, true) + (v.estimado ? '*' : '') + (v.excluir ? ' ✕' : '')),
      datasets: P.map(p => ({ label: p.nombre, data: ventas.map(v => v[p.clave]), backgroundColor: COLOR_PRODUCTO[p.clave] }))
    },
    options: opcionesGrafica({ tituloY: 'Playeras', apilada: true })
  });

  const mensaje = (texto, tipo = 'verde') => { $('msgVentas').innerHTML = `<div class="aviso aviso-${tipo}">${texto}</div>`; };
  const recargar = () => pantallaVentas(vista);

  // Editar en la tabla
  vista.querySelectorAll('#tablaVentas input').forEach(inp => {
    inp.addEventListener('change', () => {
      const mes = inp.closest('tr').dataset.mes;
      const lista = leerVentas();
      const v = lista.find(x => x.mes === mes);
      if (inp.dataset.campo === 'especial' || inp.dataset.campo === 'excluir') v[inp.dataset.campo] = inp.checked;
      else v[inp.dataset.campo] = Math.max(0, Math.round(Number(inp.value) || 0));
      guardarVentas(lista);
      recargar();
    });
  });
  vista.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', () => {
    const lista = leerVentas().filter(x => x.mes !== b.dataset.quitar);
    if (lista.length < 2) { mensaje('Dejá al menos 2 meses para poder calcular la variación de la demanda.', 'rojo'); return; }
    guardarVentas(lista);
    recargar();
  }));

  // Agregar un mes
  $('btnAgregarMes').addEventListener('click', () => {
    const mes = `${$('nuevoAnio').value}-${$('nuevoMesNum').value}`;
    const yaExiste = leerVentas().some(x => x.mes === mes);
    if (yaExiste && !confirm(`${nombreMes(mes)} ya está registrado. ¿Querés reemplazarlo?`)) return;
    const nuevo = { mes, especial: $('nuevoEspecial').checked, estimado: false, excluir: false, nota: '' };
    P.forEach(p => { nuevo[p.clave] = Math.max(0, Math.round(Number($('nuevo-' + p.clave).value) || 0)); });
    if (totalMes(nuevo) === 0) { mensaje('Ingresá cuántas playeras se vendieron ese mes.', 'rojo'); return; }
    const lista = leerVentas().filter(x => x.mes !== mes);
    lista.push(nuevo);
    guardarVentas(lista);
    recargar();
  });

  // Importar Excel
  $('archivoVentas').addEventListener('change', (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const libro = XLSX.read(new Uint8Array(lector.result), { type: 'array', cellDates: true });
        const nuevas = importarLibro(libro).filter(v => totalMes(v) > 0);
        if (nuevas.length < 2) throw new Error('El archivo tiene menos de 2 meses con ventas.');
        guardarVentas(nuevas);
        recargar();
        mensaje(`Listo: se importaron ${nuevas.length} meses de ${esc(archivo.name)}. Revisá y marcá cuáles fueron temporada especial.`);
      } catch (err) {
        mensaje('No se pudo importar el archivo. ' + esc(err.message), 'rojo');
      }
    };
    lector.readAsArrayBuffer(archivo);
  });

  $('btnDescargarVentas').addEventListener('click', () => {
    descargarLibroExcel({
      Ventas: [['Mes', ...P.map(p => p.nombre), 'Total', 'Especial', 'Estimado', 'No contar', 'Nota'],
        ...ventas.map(v => [v.mes, ...P.map(p => v[p.clave]), totalMes(v), v.especial ? 'Sí' : 'No', v.estimado ? 'Sí' : 'No', v.excluir ? 'Sí' : 'No', v.nota || ''])]
    }, 'ventas-cracks1201.xlsx');
  });
  $('btnPlantilla').addEventListener('click', () => {
    descargarLibroExcel({ Ventas: [['Mes', 'Jugador', 'Fan', 'Retro', 'Especial'], ['2025-01', 0, 0, 0, 'No']] }, 'plantilla-ventas-cracks1201.xlsx');
  });
  if ($('btnRestaurar')) $('btnRestaurar').addEventListener('click', () => {
    if (confirm('¿Descartar tus cambios (incluidas las ventas que registraste) y volver al historial original?')) { restaurarHistorial(); recargar(); }
  });
}

/* =====================================================================
   PARÁMETROS EDITABLES (se usan en Plan de compra y en Cuándo pedir)
   ===================================================================== */
function avisoParametros() {
  if (!parametrosModificados()) return '';
  return `<div class="aviso aviso-durazno"><span><b>Parámetros modificados.</b> Estás usando valores distintos a los de Cracks1201. Podés volver a los originales desde Plan de compra o Cuándo pedir.</span></div>`;
}

function campo(id, etiqueta, valor, extra = '') {
  return `<label>${etiqueta}<input type="number" id="${id}" value="${valor}" ${extra}></label>`;
}

function tarjetaParametrosPlan() {
  const P = CONFIG.productos;
  return `
    <details class="tarjeta" id="parPlan" ${parametrosModificados() ? 'open' : ''}>
      <summary><b>Datos del modelo</b> <span class="subtitulo">Precios, costos y reglas. Se pueden cambiar para probar otros escenarios.</span> ${parametrosModificados() ? '<span class="chip chip-amarillo">Modificados</span>' : '<span class="chip chip-verde">Valores de Cracks1201</span>'}</summary>
      <div class="tabla-scroll"><table class="tabla">
        <thead><tr><th>Versión</th><th class="num">Costo (Q)</th><th class="num">Precio de venta (Q)</th><th class="num">Ganancia por playera</th></tr></thead>
        <tbody>${P.map((p, i) => `<tr><td><b>${p.nombre}</b></td>
          <td class="num"><input type="number" min="1" step="1" id="par-costo-${i}" value="${p.costo}" aria-label="Costo ${p.nombre}"></td>
          <td class="num"><input type="number" min="1" step="1" id="par-precio-${i}" value="${p.precio}" aria-label="Precio ${p.nombre}"></td>
          <td class="num" id="par-gan-${i}">${Q(gananciaPorPlayera(p))}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="campos">
        ${campo('par-envio', 'Envío gratis al cliente (Q)', CONFIG.envioCliente, 'min="0" step="1"')}
        ${campo('par-capacidad', 'Espacio en bodega (playeras)', CONFIG.capacidadBodega, 'min="1" step="1"')}
        ${campo('par-minimo', 'Mínimo de Jugador en stock', CONFIG.minimoJugador, 'min="0" step="1"')}
        ${campo('par-presNormal', 'Presupuesto mes normal (Q)', CONFIG.presupuestoNormal, 'min="1" step="100"')}
        ${campo('par-presEspecial', 'Presupuesto temporada especial (Q)', CONFIG.presupuestoEspecial, 'min="1" step="100"')}
      </div>
      <div id="msgParPlan"></div>
      <div class="cabecera-acciones">
        <button class="btn btn-cafe btn-chico" id="btnGuardarParPlan" type="button">Guardar cambios</button>
        <button class="btn btn-borde btn-chico" id="btnRestaurarParPlan" type="button">Volver a los datos de Cracks1201</button>
      </div>
    </details>`;
}

function conectarParametrosPlan(vista, alGuardar) {
  const P = CONFIG.productos;
  P.forEach((p, i) => ['costo', 'precio'].forEach(c => $(`par-${c}-${i}`).addEventListener('input', () => {
    const g = Number($(`par-precio-${i}`).value) - Number($(`par-costo-${i}`).value) - Number($('par-envio').value);
    $(`par-gan-${i}`).textContent = Q(g);
  })));
  $('btnGuardarParPlan').addEventListener('click', () => {
    const nuevo = parametrosDe(CONFIG);
    nuevo.productos = P.map((_, i) => ({ costo: Number($(`par-costo-${i}`).value), precio: Number($(`par-precio-${i}`).value) }));
    nuevo.envioCliente = Number($('par-envio').value);
    nuevo.capacidadBodega = Number($('par-capacidad').value);
    nuevo.minimoJugador = Number($('par-minimo').value);
    nuevo.presupuestoNormal = Number($('par-presNormal').value);
    nuevo.presupuestoEspecial = Number($('par-presEspecial').value);

    const errores = [];
    nuevo.productos.forEach((x, i) => {
      if (!(x.costo > 0)) errores.push(`El costo de ${P[i].nombre} tiene que ser mayor que 0.`);
      if (!(x.precio - x.costo - nuevo.envioCliente > 0)) errores.push(`${P[i].nombre} no deja ganancia: el precio tiene que ser mayor que costo + envío.`);
    });
    if (!(nuevo.envioCliente >= 0)) errores.push('El envío no puede ser negativo.');
    if (!(nuevo.capacidadBodega >= 1)) errores.push('El espacio en bodega tiene que ser al menos 1.');
    if (!(nuevo.minimoJugador >= 0) || !Number.isInteger(nuevo.minimoJugador)) errores.push('El mínimo de Jugador tiene que ser un número entero, 0 o más.');
    if (!(nuevo.presupuestoNormal > 0) || !(nuevo.presupuestoEspecial > 0)) errores.push('Los presupuestos tienen que ser mayores que 0.');
    if (errores.length) { $('msgParPlan').innerHTML = `<div class="aviso aviso-rojo"><span>${errores.join('<br>')}</span></div>`; return; }

    guardarParametros(nuevo);
    estadoProyecto.presupuesto = ESCENARIOS[estadoProyecto.escenario].presupuesto;
    alGuardar('Cambios guardados. Apachá “Optimizar compra” para ver el nuevo plan.');
  });
  $('btnRestaurarParPlan').addEventListener('click', () => {
    restaurarParametros();
    estadoProyecto.presupuesto = ESCENARIOS[estadoProyecto.escenario].presupuesto;
    alGuardar('Listo: se volvió a los datos de Cracks1201.');
  });
}

/* =====================================================================
   3. PLAN DE COMPRA
   ===================================================================== */
function pantallaPlan(vista, mensaje = '') {
  const analisis = analizarVentas(leerVentas());
  const demanda = demandaDeEscenario(analisis, estadoProyecto.escenario);

  vista.innerHTML = `
    ${encabezadoProyecto('plan', 'Cuántas playeras de cada versión conviene tener en stock para ganar lo más posible.')}

    ${tarjetaParametrosPlan()}

    <section class="tarjeta">
      <h2>¿Para qué mes es la compra?</h2>
      <div class="opciones" role="radiogroup" aria-label="Escenario">
        <label class="opcion"><input type="radio" name="esc" value="normal" ${estadoProyecto.escenario === 'normal' ? 'checked' : ''}>Mes normal</label>
        <label class="opcion"><input type="radio" name="esc" value="especial" ${estadoProyecto.escenario === 'especial' ? 'checked' : ''}>Temporada especial</label>
      </div>
      <div class="campos">
        <label>Presupuesto para stock (Q)<input type="number" id="presupuesto" min="0" step="100" value="${estadoProyecto.presupuesto}"></label>
        <label>Demanda esperada del mes<input type="text" value="${num(demanda, 1)} playeras (del historial)" disabled></label>
        <button class="btn btn-naranja" id="btnOptimizar" type="button">Optimizar compra</button>
      </div>
      ${mensaje ? `<div class="aviso aviso-verde"><span>${mensaje}</span></div>` : ''}
    </section>

    <div id="resultadoPlan" tabindex="-1"></div>`;

  conectarParametrosPlan(vista, (msg) => { estadoProyecto.optimizado = false; pantallaPlan(vista, msg); });

  vista.querySelectorAll('input[name="esc"]').forEach(r => r.addEventListener('change', () => {
    estadoProyecto.escenario = r.value;
    estadoProyecto.presupuesto = ESCENARIOS[r.value].presupuesto;
    estadoProyecto.optimizado = false;
    pantallaPlan(vista);
  }));
  $('presupuesto').addEventListener('input', () => {
    if (estadoProyecto.optimizado) $('resultadoPlan').style.opacity = '0.4';
  });

  $('btnOptimizar').addEventListener('click', () => {
    const p = Number($('presupuesto').value);
    if (!(p > 0)) {
      $('resultadoPlan').style.opacity = '1';
      $('resultadoPlan').innerHTML = '<div class="aviso aviso-rojo"><span>El presupuesto tiene que ser mayor que 0.</span></div>';
      return;
    }
    estadoProyecto.presupuesto = p;
    estadoProyecto.optimizado = true;
    estadoProyecto.hora = new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    mostrarResultadoPlan();
    $('resultadoPlan').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    $('resultadoPlan').focus({ preventScroll: true });
  });

  if (estadoProyecto.optimizado) mostrarResultadoPlan();
  else $('resultadoPlan').innerHTML = `<div class="aviso aviso-crema"><span>Elegí el escenario, revisá el presupuesto y apachá <b>Optimizar compra</b>. El Método Simplex va a calcular cuántas playeras de cada versión comprar.</span></div>`;
}

function mostrarResultadoPlan() {
  const m = resolverPlan(estadoProyecto.escenario, estadoProyecto.presupuesto);
  const P = CONFIG.productos;
  const caja = $('resultadoPlan');
  caja.style.opacity = '1';
  limpiarGraficas();
  const res = m.resultado;
  if (res.estado !== 'optimo') {
    caja.innerHTML = `<div class="aviso aviso-rojo"><span><b>No hay un plan posible con ese presupuesto.</b> ${res.estado === 'infactible'
      ? `Ni siquiera alcanza para el mínimo de ${CONFIG.minimoJugador} Jugador (${Q(CONFIG.minimoJugador * P[0].costo)}). Subí el presupuesto o bajá el mínimo.`
      : 'Revisá los datos del historial y los parámetros.'}</span></div>`;
    return;
  }

  const xs = m.entero ? m.entero.x : res.x;
  const Z = m.entero ? m.entero.Z : res.Z;
  const invertido = xs.reduce((s, v, i) => s + v * P[i].costo, 0);
  const unidades = xs.reduce((s, v) => s + v, 0);
  const planTexto = P.map((p, i) => `<b>${xs[i]} ${p.nombre}</b>`).join(', ');

  caja.innerHTML = `
    <p class="subtitulo">Resultado calculado a las ${estadoProyecto.hora}, en ${res.iteraciones.length - 1} iteraciones del Simplex.</p>
    <div class="camisolas">
      ${P.map((p, i) => `<div class="camisola"><div class="numero">${xs[i]}</div><div class="tipo">Versión ${p.nombre}</div><div class="detalle">${xs[i] ? `${Q(xs[i] * p.costo)} de inversión` : 'Mejor por encargo'}</div></div>`).join('')}
    </div>

    <div class="aviso aviso-verde"><span>Con ${Q(m.presupuesto)}, lo que más conviene tener en stock es ${planTexto}. Al venderse dejan <b>${Q(Z)}</b> de ganancia.</span></div>

    <div class="cifras">
      <div class="cifra oscura"><span class="cifra-etiqueta">Ganancia esperada</span><span class="cifra-valor">${Q(Z)}</span><span class="cifra-detalle">Con playeras completas</span></div>
      <div class="cifra"><span class="cifra-etiqueta">Inversión</span><span class="cifra-valor">${Q(invertido)}</span><span class="cifra-detalle">Sobran ${Q(m.presupuesto - invertido)} del presupuesto</span></div>
      <div class="cifra"><span class="cifra-etiqueta">Playeras en bodega</span><span class="cifra-valor">${unidades} / ${CONFIG.capacidadBodega}</span><span class="cifra-detalle">Espacio usado</span></div>
      <div class="cifra"><span class="cifra-etiqueta">Ganancia por Q1 invertido</span><span class="cifra-valor">${Q2(invertido ? Z / invertido : 0)}</span><span class="cifra-detalle">Rendimiento del stock</span></div>
    </div>

    <div class="fila">
      <section class="tarjeta ancha">
        <h2>¿Qué está limitando el plan?</h2>
        ${limitantesEnPalabras(m)}
        <a href="#/proyecto/modelo" class="btn btn-borde btn-chico" style="align-self:flex-start">Ver el modelo matemático</a>
      </section>
      <section class="tarjeta">
        <h2>Ganancia por cada Q1 invertido</h2>
        <div class="grafica" style="height:240px"><canvas id="gRentabilidad"></canvas></div>
      </section>
    </div>`;

  crearGrafica('gRentabilidad', {
    type: 'bar',
    data: { labels: P.map(p => p.nombre), datasets: [{ label: 'Quetzales', data: P.map(p => gananciaPorPlayera(p) / p.costo), backgroundColor: P.map(p => COLOR_PRODUCTO[p.clave]) }] },
    options: opcionesGrafica({ leyenda: false })
  });
}

// Explica el análisis de restricciones sin tecnicismos
function limitantesEnPalabras(m) {
  const res = m.resultado, P = CONFIG.productos;
  const items = res.analisis.map((a, i) => {
    const r = m.problema.restricciones[i];
    if (r.tipo === 'presupuesto') return a.activa
      ? `<li><b>El dinero es lo que limita.</b> El modelo usa todo el presupuesto (lo que sobra es porque no alcanza para una playera más). Cada ${Q(100)} más que inviertas darían unos <b>${Q2(a.precioSombra * 100)}</b> más de ganancia.</li>`
      : `<li><b>El dinero no limita.</b> Sobran ${Q(a.holgura)}.</li>`;
    if (r.tipo === 'espacio') return a.activa
      ? `<li><b>La bodega está llena.</b> Cada espacio extra daría ${Q2(a.precioSombra)} más.</li>`
      : `<li><b>La bodega no limita.</b> Sobran ${num(a.holgura, 1)} espacios.</li>`;
    if (r.tipo === 'demanda' && a.activa) return `<li><b>${P[r.producto].nombre} llega a su demanda.</b> Comprar más no tendría a quién venderse ese mes.</li>`;
    if (r.tipo === 'minimo' && a.activa) return `<li><b>El mínimo de ${CONFIG.minimoJugador} Jugador</b> se cumple justo. Por sí solo el modelo compraría menos Jugador: cada una del mínimo cuesta ${Q2(Math.abs(a.precioSombra))} de ganancia, pero asegura tener a la mano la versión más pedida.</li>`;
    return '';
  }).filter(Boolean);
  const enCero = P.filter((_, i) => (m.entero ? m.entero.x[i] : res.x[i]) < 0.5).map(p => p.nombre);
  if (enCero.length) items.push(`<li><b>${enCero.join(' y ')}</b> no entra al stock: conviene venderla por encargo con anticipo.</li>`);
  return `<ul class="lista-limpia">${items.join('')}</ul>`;
}

/* =====================================================================
   4. CUÁNDO PEDIR (EOQ)
   ===================================================================== */
function pantallaPedir(vista) {
  const { entrada: e, r, analisis, reparto } = calcularPedidos(estadoProyecto.nivelServicio);
  const P = CONFIG.productos;

  vista.innerHTML = `
    ${encabezadoProyecto('pedir', 'Cuántas playeras pedirle al proveedor cada vez y en qué momento, para no quedarse sin stock.')}

    <details class="tarjeta" ${parametrosModificados() ? 'open' : ''}>
      <summary><b>Datos del proveedor</b> <span class="subtitulo">Se pueden cambiar para probar otros escenarios.</span> ${parametrosModificados() ? '<span class="chip chip-amarillo">Modificados</span>' : '<span class="chip chip-verde">Valores de Cracks1201</span>'}</summary>
      <div class="campos">
        ${campo('par-S', 'Costo por pedido S (Q)', CONFIG.costoCaja, 'min="1" step="1"')}
        ${campo('par-caja', 'Playeras por caja', CONFIG.playerasPorCaja, 'min="1" step="1"')}
        ${campo('par-entMin', 'Entrega mínima (días)', CONFIG.entregaMin, 'min="1" step="1"')}
        ${campo('par-entMax', 'Entrega máxima (días)', CONFIG.entregaMax, 'min="1" step="1"')}
        ${campo('par-H', 'Costo de mantener (% anual)', num(CONFIG.tasaMantener * 100, 2), 'min="1" max="100" step="1"')}
      </div>
      <div id="msgParPedir"></div>
      <div class="cabecera-acciones">
        <button class="btn btn-cafe btn-chico" id="btnGuardarParPedir" type="button">Guardar y recalcular</button>
        <button class="btn btn-borde btn-chico" id="btnRestaurarParPedir" type="button">Volver a los datos de Cracks1201</button>
      </div>
    </details>

    <section class="tarjeta">
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:16px">
        <div><h2>Nivel de servicio</h2><p class="subtitulo">Qué tan seguro querés estar de no quedarte sin playeras mientras llega un pedido.</p></div>
        <select id="nivel" style="width:auto">
          ${[0.9, 0.95, 0.975, 0.99].map(n => `<option value="${n}" ${n === estadoProyecto.nivelServicio ? 'selected' : ''}>${num(n * 100, 1)}%</option>`).join('')}
        </select>
      </div>
    </section>

    <div class="cifras">
      <div class="cifra oscura"><span class="cifra-etiqueta">Cada pedido</span><span class="cifra-valor">${r.elegido.cajas} cajas</span><span class="cifra-detalle">${r.elegido.Q} playeras: ${P.map((p, i) => `${reparto[i]} ${p.nombre}`).join(', ')}</span></div>
      <div class="cifra"><span class="cifra-etiqueta">Cada cuánto</span><span class="cifra-valor">${num(r.diasEntrePedidos, 0)} días</span><span class="cifra-detalle">${num(r.pedidosAlAnio, 1)} pedidos al año</span></div>
      <div class="cifra"><span class="cifra-etiqueta">Punto de reorden</span><span class="cifra-valor">${r.puntoReorden}</span><span class="cifra-detalle">playeras en bodega + en camino</span></div>
      <div class="cifra"><span class="cifra-etiqueta">Stock de seguridad</span><span class="cifra-valor">${r.stockSeguridad}</span><span class="cifra-detalle">colchón para meses fuertes</span></div>
    </div>

    <div class="aviso aviso-durazno"><span><b>La regla para Cracks1201:</b> cuando lo que hay en bodega más lo que viene en camino baje a <b>${r.puntoReorden} playeras</b>, pedí <b>${r.elegido.cajas} cajas</b>. Como el proveedor tarda ${e.entregaMin} a ${e.entregaMax} días, normalmente vas a tener unos <b>${num(r.pedidosEnCamino, 1)} pedidos en camino</b>. En bodega nunca vas a tener más de ${r.inventarioMaximo} playeras ${r.cabeEnBodega ? `(caben, el espacio es de ${e.capacidad})` : `(<b>no caben</b> en ${e.capacidad})`}.</span></div>

    <div class="fila">
      <section class="tarjeta">
        <h2>Costo anual según el tamaño del pedido</h2>
        <div class="grafica"><canvas id="gCostos"></canvas></div>
      </section>
      <section class="tarjeta">
        <h2>Playeras en bodega con el tiempo</h2>
        <div class="grafica"><canvas id="gSierra"></canvas></div>
      </section>
    </div>

    <div class="fila">
      <section class="tarjeta ancha">
        <h2>Cálculos paso a paso</h2>
        <div class="ecuacion">D = ${num(analisis.promedioMensual, 2)} × 12 = ${num(r.D, 1)} playeras al año<small>promedio mensual del historial</small></div>
        <div class="ecuacion">H = ${num(e.tasaMantener * 100)}% × ${Q2(e.costoUnitario)} = ${Q2(r.H)}<small>costo de tener una playera guardada un año</small></div>
        <div class="ecuacion">Q* = √(2DS / H) = √(2 × ${num(r.D, 1)} × ${num(r.S)} / ${num(r.H, 2)}) = ${num(r.qOptimo, 2)} playeras</div>
        <div class="ecuacion">σ<sub>entrega</sub> = √(L·σ<sub>d</sub>² + d²·σ<sub>L</sub>²) = √(${num(r.L, 1)} × ${num(r.sigmaDia, 3)}² + ${num(r.d, 3)}² × ${num(r.sigmaL, 2)}²) = ${num(r.sigmaEntrega, 3)}</div>
        <div class="ecuacion">SS = z × σ<sub>entrega</sub> = ${num(r.z, 3)} × ${num(r.sigmaEntrega, 3)} ≈ ${r.stockSeguridad}<small>stock de seguridad</small></div>
        <div class="ecuacion">ROP = d × L + SS = ${num(r.d, 3)} × ${num(r.L, 1)} + ${r.stockSeguridad} ≈ ${r.puntoReorden}<small>punto de reorden</small></div>
        <p class="subtitulo">S = ${Q(e.costoPedido)} por pedido. σ<sub>d</sub> sale de la desviación estándar de las ventas en meses normales (${num(r.sigmaMes, 2)} al mes). L es el promedio entre ${e.entregaMin} y ${e.entregaMax} días. El costo unitario es el promedio ponderado por lo que se vende de cada versión.</p>
      </section>
      <section class="tarjeta">
        <h2>Ajuste a cajas de ${e.tamanoCaja}</h2>
        <div class="tabla-scroll"><table class="tabla">
          <thead><tr><th>Pedido</th><th class="num">Playeras</th><th class="num">Costo anual</th></tr></thead>
          <tbody>
            <tr><td>EOQ exacto</td><td class="num">${num(r.qOptimo, 2)}</td><td class="num">${Q2(r.costoOptimo)}</td></tr>
            ${r.candidatos.map(c => `<tr><td>${c.cajas} ${c.cajas === 1 ? 'caja' : 'cajas'} ${c.Q === r.elegido.Q ? '<span class="chip chip-naranja">Elegido</span>' : ''}</td><td class="num">${c.Q}</td><td class="num">${Q2(c.costo)}</td></tr>`).join('')}
          </tbody>
        </table></div>
        <p class="subtitulo">No se pueden pedir cajas a la mitad, así que se comparan las cajas completas más cercanas al EOQ y se elige la más barata.</p>
      </section>
    </div>`;

  $('nivel').addEventListener('change', (ev) => { estadoProyecto.nivelServicio = Number(ev.target.value); pantallaPedir(vista); });
  $('btnGuardarParPedir').addEventListener('click', () => {
    const nuevo = parametrosDe(CONFIG);
    nuevo.costoCaja = Number($('par-S').value);
    nuevo.playerasPorCaja = Number($('par-caja').value);
    nuevo.entregaMin = Number($('par-entMin').value);
    nuevo.entregaMax = Number($('par-entMax').value);
    nuevo.tasaMantener = Number($('par-H').value) / 100;
    const errores = [];
    if (!(nuevo.costoCaja > 0)) errores.push('El costo por pedido tiene que ser mayor que 0.');
    if (!(nuevo.playerasPorCaja >= 1) || !Number.isInteger(nuevo.playerasPorCaja)) errores.push('Las playeras por caja tienen que ser un número entero, 1 o más.');
    if (!(nuevo.entregaMin > 0) || !(nuevo.entregaMax >= nuevo.entregaMin)) errores.push('Los días de entrega tienen que ser mayores que 0 y el máximo no puede ser menor que el mínimo.');
    if (!(nuevo.tasaMantener > 0 && nuevo.tasaMantener <= 1)) errores.push('El costo de mantener tiene que estar entre 1% y 100%.');
    if (errores.length) { $('msgParPedir').innerHTML = `<div class="aviso aviso-rojo"><span>${errores.join('<br>')}</span></div>`; return; }
    guardarParametros(nuevo);
    pantallaPedir(vista);
  });
  $('btnRestaurarParPedir').addEventListener('click', () => { restaurarParametros(); pantallaPedir(vista); });

  crearGrafica('gCostos', {
    type: 'line',
    data: {
      datasets: [
        { label: 'Costo total', data: r.curva.map(p => ({ x: p.Q, y: p.total })), borderColor: COLORES.cafe, pointRadius: 0, borderWidth: 3 },
        { label: 'Pedir', data: r.curva.map(p => ({ x: p.Q, y: p.pedir })), borderColor: COLORES.naranja, pointRadius: 0, borderDash: [6, 4] },
        { label: 'Mantener', data: r.curva.map(p => ({ x: p.Q, y: p.mantener })), borderColor: COLORES.azul, pointRadius: 0, borderDash: [6, 4] },
        { label: 'Pedido elegido', type: 'scatter', data: [{ x: r.elegido.Q, y: r.elegido.costo }], backgroundColor: COLORES.dorado, borderColor: COLORES.cafe, pointRadius: 8 }
      ]
    },
    options: opcionesGrafica({ tituloY: 'Quetzales al año', tituloX: 'Playeras por pedido', xLineal: true })
  });

  const fin = r.sierra[r.sierra.length - 1].dia;
  const opS = opcionesGrafica({ tituloY: 'Playeras', tituloX: 'Días', xLineal: true });
  opS.scales.x.max = Math.ceil(fin);
  opS.scales.y.suggestedMax = Math.ceil(e.capacidad * 1.1);
  crearGrafica('gSierra', {
    type: 'line',
    data: {
      datasets: [
        { label: 'En bodega', data: r.sierra.map(p => ({ x: p.dia, y: p.nivel })), borderColor: COLORES.cafe, pointRadius: 0, borderWidth: 3 },
        { label: 'Stock de seguridad', data: [{ x: 0, y: r.stockSeguridad }, { x: fin, y: r.stockSeguridad }], borderColor: COLORES.naranja, pointRadius: 0, borderDash: [6, 4] },
        { label: 'Espacio en bodega', data: [{ x: 0, y: e.capacidad }, { x: fin, y: e.capacidad }], borderColor: COLORES.rojo, pointRadius: 0, borderDash: [2, 4] }
      ]
    },
    options: opS
  });
}

/* =====================================================================
   5. MODELO MATEMÁTICO (solo lectura)
   ===================================================================== */
function ladoIzquierdo(coef) {
  let html = '', primero = true;
  coef.forEach((a, i) => {
    if (!a) return;
    const signo = a < 0 ? ' − ' : (primero ? '' : ' + ');
    html += `${signo}${Math.abs(a) === 1 ? '' : num(Math.abs(a))}<i>x</i>${sub(i + 1)}`;
    primero = false;
  });
  return html || '0';
}

function pantallaModelo(vista) {
  const m = resolverPlan(estadoProyecto.escenario, estadoProyecto.presupuesto);
  const P = CONFIG.productos, res = m.resultado;
  const explicacion = {
    presupuesto: 'no gastar más del presupuesto', espacio: 'no pasar el espacio en bodega',
    demanda: 'no comprar más de lo que se vende en el mes', minimo: 'una Jugador de cada talla'
  };

  vista.innerHTML = `
    ${encabezadoProyecto('modelo', `Formulación del plan de compra para: ${ESCENARIOS[m.escenario].nombre.toLowerCase()}, con ${Q(m.presupuesto)} de presupuesto. Para cambiarlo, andá a Plan de compra.`)}

    <div class="fila">
      <section class="tarjeta ancha">
        <h2>Variables de decisión</h2>
        ${P.map((p, i) => `<div class="ecuacion"><i>x</i>${sub(i + 1)} = playeras versión ${p.nombre} a comprar para stock</div>`).join('')}

        <h2>Función objetivo</h2>
        <div class="ecuacion">Maximizar Z = ${ladoIzquierdo(m.problema.c)}<small>ganancia total del stock</small></div>
        ${P.map((p, i) => `<div class="ecuacion" style="font-size:15px">c${sub(i + 1)} = ${p.precio} − ${p.costo} − ${CONFIG.envioCliente} = ${gananciaPorPlayera(p)}<small>precio − costo − envío</small></div>`).join('')}

        <h2>Sujeto a</h2>
        ${m.problema.restricciones.map(r => `<div class="ecuacion">${ladoIzquierdo(r.coef)} ${SIGNOS[r.signo]} ${num(r.rhs)}<small>${r.nombre}: ${explicacion[r.tipo]}</small></div>`).join('')}
        <div class="ecuacion"><i>x</i>${sub(1)}, <i>x</i>${sub(2)}, <i>x</i>${sub(3)} ≥ 0<small>no negatividad</small></div>
        <p class="subtitulo">La demanda de cada versión = demanda esperada del mes (${num(m.demanda, 1)}, del historial) × su % de ventas (${P.map(p => `${p.nombre} ${num(m.analisis.pct[p.clave], 1)}%`).join(', ')}).</p>
      </section>

      <section class="tarjeta">
        <h2>Método de solución</h2>
        <div class="texto-largo" style="font-size:15px">
          <p>Se usa el <b>Método Simplex</b>. La restricción del mínimo de Jugador es de tipo "≥", así que no tiene una variable de holgura que sirva para empezar. Por eso se agrega una <b>variable artificial</b> y se penaliza en la función objetivo con una <b>M muy grande</b> (método de la M Grande), para que el Simplex la saque de la solución.</p>
          <p>En cada iteración entra la variable con el valor más negativo de la fila Z y sale la que tiene la menor razón (solución ÷ columna pivote). Termina cuando ya no hay negativos en la fila Z.</p>
          <p>Como no se pueden comprar fracciones de playera, después se prueban todas las combinaciones enteras posibles y se elige la de más ganancia que cumpla todo.</p>
        </div>
        <a href="#/proyecto/iteraciones" class="btn btn-cafe">Ver iteraciones del Simplex</a>
      </section>
    </div>

    ${res.estado === 'optimo' ? `
    <section class="tarjeta">
      <h2>Solución</h2>
      <div class="cifras">
        ${P.map((p, i) => `<div class="cifra"><span class="cifra-etiqueta"><i>x</i>${sub(i + 1)} (${p.nombre})</span><span class="cifra-valor">${num(res.x[i], 2)}</span><span class="cifra-detalle">Entero: ${m.entero ? m.entero.x[i] : '—'}</span></div>`).join('')}
        <div class="cifra oscura"><span class="cifra-etiqueta">Z óptimo</span><span class="cifra-valor">${Q2(res.Z)}</span><span class="cifra-detalle">Con enteros: ${m.entero ? Q2(m.entero.Z) : '—'}</span></div>
      </div>
      <div class="tabla-scroll"><table class="tabla">
        <thead><tr><th>Restricción</th><th>Tipo</th><th class="num">Límite</th><th class="num">Usado</th><th class="num">Holgura</th><th>¿Activa?</th><th class="num">Precio sombra</th></tr></thead>
        <tbody>${res.analisis.map(a => `<tr><td>${a.nombre}</td><td>${SIGNOS[a.signo]}</td><td class="num">${num(a.rhs)}</td><td class="num">${num(a.usado)}</td><td class="num">${num(a.holgura)}</td><td>${a.activa ? '<span class="chip chip-naranja">Sí</span>' : '<span class="chip chip-crema">No</span>'}</td><td class="num">${num(a.precioSombra, 3)}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="subtitulo">Precio sombra: cuánto cambia la ganancia si ese límite sube una unidad. Una restricción activa es la que está frenando la solución.${res.hayAlternativas ? ' Hay soluciones alternativas con la misma ganancia.' : ''}</p>
    </section>` : `<div class="aviso aviso-rojo">Con este presupuesto el problema no tiene solución factible.</div>`}`;
}

/* =====================================================================
   5b. ITERACIONES DEL SIMPLEX (página aparte)
   ===================================================================== */
function pantallaIteraciones(vista) {
  const m = resolverPlan(estadoProyecto.escenario, estadoProyecto.presupuesto);
  const res = m.resultado, cols = res.columnas;
  const n3 = (v) => num(Math.round(v * 1000) / 1000, 3);

  vista.innerHTML = `
    <div class="cabecera">
      <div>
        <h1>Iteraciones del Simplex</h1>
        <p>${ESCENARIOS[m.escenario].nombre}, presupuesto de ${Q(m.presupuesto)}. Método de la M Grande.</p>
      </div>
      <div class="cabecera-acciones"><a href="#/proyecto/modelo" class="btn btn-borde">Volver al modelo</a></div>
    </div>
    <section class="tarjeta">
      <p>Variables: <i>x</i> son las de decisión, <b>h</b> holguras de las restricciones "≤", <b>e</b> exceso y <b>a</b> artificial de la restricción "≥".</p>
      <div class="leyenda"><span class="l-col">Columna que entra y fila que sale</span><span class="l-piv">Elemento pivote</span></div>
    </section>
    <div id="listaIteraciones" style="display:flex;flex-direction:column;gap:24px"></div>`;

  const lista = $('listaIteraciones');
  res.iteraciones.forEach((it, k) => {
    let desc;
    if (it.final && it.entra < 0) desc = res.estado === 'optimo' ? 'Tabla óptima: ya no quedan valores negativos en la fila Z.' : 'El problema no tiene solución factible: queda una variable artificial en la base.';
    else if (it.sale < 0) desc = `Entra ${cols[it.entra].nombre}, pero ninguna fila la limita: no acotado.`;
    else desc = `Entra <b>${cols[it.entra].nombre}</b> (el más negativo de Z: ${formatoM(it.z[it.entra])}). Sale <b>${cols[it.base[it.sale]].nombre}</b> (razón mínima ${n3(it.razones[it.sale])}). Pivote = ${n3(it.filas[it.sale][it.entra])}.`;

    const conRazon = it.razones !== null;
    let html = `<section class="tarjeta iteracion"><h3>${k === 0 ? 'Tabla inicial' : 'Iteración ' + k}</h3><p>${desc}</p>
      <div class="tabla-scroll"><table class="tabla simplex"><thead><tr><th>Base</th>`;
    cols.forEach((c, j) => { html += `<th class="${j === it.entra ? 'col-entra' : ''}">${c.nombre}</th>`; });
    html += `<th>Solución</th>${conRazon ? '<th>Razón</th>' : ''}</tr></thead><tbody>`;
    it.filas.forEach((f, i) => {
      html += `<tr class="${i === it.sale ? 'fila-sale' : ''}"><td>${cols[it.base[i]].nombre}</td>`;
      f.forEach((v, j) => { html += `<td class="${j === it.entra ? 'col-entra' : ''} ${i === it.sale && j === it.entra ? 'pivote' : ''}">${n3(v)}</td>`; });
      html += `<td>${n3(it.rhs[i])}</td>${conRazon ? `<td>${it.razones[i] === null ? '—' : n3(it.razones[i])}</td>` : ''}</tr>`;
    });
    html += `<tr class="fila-z"><td>Z</td>${it.z.map((v, j) => `<td class="${j === it.entra ? 'col-entra' : ''}">${formatoM(v, 3)}</td>`).join('')}<td>${formatoM(it.zRhs, 3)}</td>${conRazon ? '<td></td>' : ''}</tr></tbody></table></div></section>`;
    lista.insertAdjacentHTML('beforeend', html);
  });
}

/* =====================================================================
   6. REPORTES
   ===================================================================== */
function pantallaReportes(vista) {
  const planes = Object.keys(ESCENARIOS).map(k => resolverPlan(k, ESCENARIOS[k].presupuesto));
  const actual = resolverPlan(estadoProyecto.escenario, estadoProyecto.presupuesto);
  const pedidos = calcularPedidos(estadoProyecto.nivelServicio);
  const a = actual.analisis;
  const P = CONFIG.productos;
  const conclusiones = generarConclusiones(actual, planes, pedidos);

  vista.innerHTML = `
    ${encabezadoProyecto('reportes', 'Resumen de resultados y recomendaciones para Cracks1201.')}

    <div class="cabecera-acciones no-imprimir">
      <button class="btn btn-cafe" id="btnPdf" type="button">Imprimir o guardar en PDF</button>
      <button class="btn btn-borde" id="btnExcel" type="button">Descargar reporte en Excel</button>
    </div>

    <section class="tarjeta">
      <h2>Datos de ventas usados</h2>
      <p>${a.meses} meses de ventas${a.estimados ? `, ${a.estimados} de ellos estimados` : ''}${a.excluidos ? ` (más ${a.excluidos} excluido por problemas con el proveedor)` : ''}. Las cantidades son las del historial y los montos usan los precios actuales. Mes normal: ${num(a.demandaNormal, 1)} playeras en promedio (σ = ${num(a.sigmaNormal, 1)}). Temporada especial: ${num(a.demandaEspecial, 1)}. Mezcla de ventas: ${P.map(p => `${p.nombre} ${num(a.pct[p.clave], 1)}%`).join(', ')}.</p>
    </section>

    <section class="tarjeta">
      <h2>Plan de compra por escenario</h2>
      <div class="tabla-scroll"><table class="tabla">
        <thead><tr><th>Escenario</th><th class="num">Presupuesto</th><th class="num">Demanda</th>${P.map(p => `<th class="num">${p.nombre}</th>`).join('')}<th class="num">Ganancia (enteros)</th><th class="num">Z Simplex</th><th class="num">Precio sombra del presupuesto</th></tr></thead>
        <tbody>${planes.map(m => {
          const ok = m.resultado.estado === 'optimo';
          const pres = ok ? m.resultado.analisis[0].precioSombra : 0;
          return `<tr><td><b>${ESCENARIOS[m.escenario].nombre}</b></td><td class="num">${Q(m.presupuesto)}</td><td class="num">${num(m.demanda, 1)}</td>${P.map((_, i) => `<td class="num">${ok && m.entero ? m.entero.x[i] : '—'}</td>`).join('')}<td class="num">${ok && m.entero ? Q2(m.entero.Z) : '—'}</td><td class="num">${ok ? Q2(m.resultado.Z) : 'Sin solución'}</td><td class="num">${ok ? num(pres, 3) : '—'}</td></tr>`;
        }).join('')}</tbody>
      </table></div>
    </section>

    <section class="tarjeta">
      <h2>Política de pedidos al proveedor</h2>
      <p>Pedir <b>${pedidos.r.elegido.cajas} cajas (${pedidos.r.elegido.Q} playeras)</b> cada <b>${num(pedidos.r.diasEntrePedidos, 0)} días</b>. Punto de reorden: <b>${pedidos.r.puntoReorden}</b> playeras (en bodega + en camino). Stock de seguridad: <b>${pedidos.r.stockSeguridad}</b> con ${num(estadoProyecto.nivelServicio * 100, 1)}% de nivel de servicio. Costo anual de pedir y mantener: <b>${Q2(pedidos.r.elegido.costo)}</b>.</p>
    </section>

    <section class="tarjeta">
      <h2>Conclusiones y recomendaciones</h2>
      <ol class="conclusiones">${conclusiones.map(c => `<li>${c}</li>`).join('')}</ol>
    </section>`;

  $('btnPdf').addEventListener('click', () => window.print());
  $('btnExcel').addEventListener('click', () => {
    const ventas = leerVentas();
    const quitarHTML = (t) => t.replace(/<[^>]+>/g, '');
    descargarLibroExcel({
      'Ventas': [['Mes', ...P.map(p => p.nombre), 'Total', 'Especial', 'Estimado', 'No contar', 'Nota'], ...ventas.map(v => [v.mes, ...P.map(p => v[p.clave]), totalMes(v), v.especial ? 'Sí' : 'No', v.estimado ? 'Sí' : 'No', v.excluir ? 'Sí' : 'No', v.nota || ''])],
      'Plan de compra': [['Escenario', 'Presupuesto', 'Demanda', ...P.map(p => p.nombre), 'Ganancia enteros', 'Z Simplex'],
        ...planes.map(m => [ESCENARIOS[m.escenario].nombre, m.presupuesto, m.demanda, ...P.map((_, i) => m.entero ? m.entero.x[i] : ''), m.entero ? m.entero.Z : '', m.resultado.estado === 'optimo' ? m.resultado.Z : 'Sin solución'])],
      'Restricciones': [['Restricción', 'Tipo', 'Límite', 'Usado', 'Holgura', 'Activa', 'Precio sombra'],
        ...(actual.resultado.estado === 'optimo' ? actual.resultado.analisis.map(x => [x.nombre, x.signo, x.rhs, x.usado, x.holgura, x.activa ? 'Sí' : 'No', x.precioSombra]) : [])],
      'Inventario EOQ': [['Concepto', 'Valor'], ['Demanda anual', +pedidos.r.D.toFixed(1)], ['Costo por pedido', pedidos.r.S], ['Costo de mantener anual', +pedidos.r.H.toFixed(2)],
        ['EOQ exacto', +pedidos.r.qOptimo.toFixed(2)], ['Pedido elegido (playeras)', pedidos.r.elegido.Q], ['Cajas', pedidos.r.elegido.cajas], ['Días entre pedidos', +pedidos.r.diasEntrePedidos.toFixed(1)],
        ['Stock de seguridad', pedidos.r.stockSeguridad], ['Punto de reorden', pedidos.r.puntoReorden], ['Costo total anual', +pedidos.r.elegido.costo.toFixed(2)]],
      'Conclusiones': [['#', 'Conclusión'], ...conclusiones.map((c, i) => [i + 1, quitarHTML(c)])]
    }, 'reporte-cracks1201.xlsx');
  });
}

function generarConclusiones(m, planes, pedidos) {
  const P = CONFIG.productos, res = m.resultado, lista = [];
  if (res.estado !== 'optimo') return ['Con el presupuesto elegido no hay un plan factible: no alcanza ni para el mínimo de Jugador.'];

  const xs = m.entero ? m.entero.x : res.x;
  lista.push(`<b>Plan de compra.</b> En ${ESCENARIOS[m.escenario].nombre.toLowerCase()}, con ${Q(m.presupuesto)}, lo óptimo es tener en stock ${P.map((p, i) => `${xs[i]} ${p.nombre}`).join(', ')}, con una ganancia esperada de ${Q2(m.entero ? m.entero.Z : res.Z)}.`);

  const rent = P.map(p => ({ p, r: gananciaPorPlayera(p) / p.costo }));
  const mejor = rent.reduce((x, y) => (y.r > x.r ? y : x)), peor = rent.reduce((x, y) => (y.r < x.r ? y : x));
  const masVendida = P.reduce((x, y) => (m.analisis.pct[y.clave] > m.analisis.pct[x.clave] ? y : x));
  let t = `<b>Rentabilidad.</b> ${mejor.p.nombre} es la que más rinde: ${Q2(mejor.r)} de ganancia por cada Q1 invertido, contra ${Q2(peor.r)} de ${peor.p.nombre}.`;
  if (masVendida.clave !== mejor.p.clave) t += ` La más vendida es ${masVendida.nombre} (${num(m.analisis.pct[masVendida.clave], 1)}%), pero amarra más dinero por playera; por eso conviene tener lo justo en stock y vender el resto por encargo con anticipo.`;
  lista.push(t);

  const pres = res.analisis[0], esp = res.analisis[1];
  if (pres.activa) lista.push(`<b>El dinero es el cuello de botella.</b> El presupuesto se usa completo y su precio sombra es ${num(pres.precioSombra, 3)}: cada Q100 extra en stock darían cerca de ${Q2(pres.precioSombra * 100)} más de ganancia.`);
  if (!esp.activa) lista.push(`<b>La bodega no es problema.</b> Sobran ${num(esp.holgura, 1)} espacios; no hace falta invertir en más espacio.`);

  const enCero = P.filter((_, i) => xs[i] < 0.5).map(p => p.nombre);
  if (enCero.length) lista.push(`<b>Solo por encargo.</b> ${enCero.join(' y ')} no entra al stock en este escenario; conviene venderla por encargo con 50% de anticipo.`);

  const minimo = res.analisis.find((_, i) => m.problema.restricciones[i].tipo === 'minimo');
  if (minimo && minimo.activa && minimo.precioSombra < 0) lista.push(`<b>Mínimo por tallas.</b> Tener una Jugador de cada talla cuesta ${Q2(Math.abs(minimo.precioSombra))} de ganancia por playera del mínimo, pero con ${CONFIG.entregaMin} a ${CONFIG.entregaMax} días de entrega es lo que permite vender la más pedida al instante.`);

  const [n, e] = planes;
  if (n.entero && e.entero) lista.push(`<b>Temporadas especiales.</b> La ganancia del stock pasa de ${Q2(n.entero.Z)} en un mes normal a ${Q2(e.entero.Z)} en temporada especial. Conviene apartar dinero en los meses normales para llegar con los ${Q(e.presupuesto)} listos.`);

  const r = pedidos.r;
  lista.push(`<b>Cuánto pedir.</b> El EOQ da ${num(r.qOptimo, 1)} playeras; ajustado a cajas completas conviene pedir ${r.elegido.cajas} cajas (${r.elegido.Q}) cada ${num(r.diasEntrePedidos, 0)} días, repartidas en ${P.map((p, i) => `${pedidos.reparto[i]} ${p.nombre}`).join(', ')}.`);
  lista.push(`<b>Cuándo pedir.</b> Por los ${CONFIG.entregaMin} a ${CONFIG.entregaMax} días de entrega siempre hay unos ${num(r.pedidosEnCamino, 1)} pedidos en camino. Hay que pedir cuando bodega + en camino baje a ${r.puntoReorden} playeras; el stock de seguridad de ${r.stockSeguridad} cubre la variación de las ventas.`);
  return lista;
}

/* =====================================================================
   2b. TODOS LOS DATOS (página aparte desde Control de ventas)
   Muestra cada venta del Excel con todas sus columnas. Las columnas
   resaltadas son las únicas que usa el modelo: fecha y versión.
   ===================================================================== */
const filtrosDatos = { texto: '', mes: '', version: '', soloModelo: false };

function pantallaDatos(vista, mensaje = '') {
  const base = typeof VENTAS_DETALLE !== 'undefined' ? VENTAS_DETALLE : [];
  const nuevas = leerVentasNuevas().map(v => ({ ...v, nueva: true }));
  const filas = [...base, ...nuevas].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.orden || 0) - (b.orden || 0));
  const siguienteOrden = Math.max(0, ...filas.map(f => f.orden || 0)) + 1;
  const hoy = new Date();
  const hoyTexto = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const meses = [...new Set(filas.map(f => f.fecha.slice(0, 7)))].sort().reverse();

  vista.innerHTML = `
    <div class="cabecera">
      <div>
        <h1>Todas las ventas</h1>
        <p>Cada venta de la hoja "Ventas" del Excel de cuentas, tal como está registrada.</p>
      </div>
      <div class="cabecera-acciones"><a href="#/proyecto/ventas" class="btn btn-borde">Volver a Control de ventas</a></div>
    </div>

    <div class="aviso aviso-crema"><span>Las columnas <b style="background:#FFF1DC;padding:0 4px;border-radius:4px">resaltadas</b> son las únicas que usa el modelo: la <b>fecha</b> (para contar ventas por mes) y la <b>versión</b> (Jugador, Fan o Retro). Las demás se muestran como referencia. Los montos son los de cada venta en su momento; el modelo usa los precios actuales.${typeof NOMBRES_ABREVIADOS !== 'undefined' && NOMBRES_ABREVIADOS ? ' Los nombres de los clientes están abreviados para proteger su privacidad.' : ''}</span></div>

    <details class="tarjeta" id="formVenta" ${mensaje ? '' : ''}>
      <summary><b>Registrar una venta</b> <span class="subtitulo">Se agrega a esta lista y suma 1 a su mes en Control de ventas.</span></summary>
      <div class="campos">
        <label>Orden<input type="number" id="vOrden" value="${siguienteOrden}" min="1" step="1"></label>
        <label>Fecha<input type="date" id="vFecha" value="${hoyTexto}"></label>
        <label>Cliente (nombre y apellido)<input type="text" id="vCliente" autocomplete="off"></label>
        <label>Producto<input type="text" id="vProducto" placeholder="Ej.: Barcelona Local 25/26" autocomplete="off"></label>
        <label>Versión<select id="vVersion">${CONFIG.productos.map(p => `<option value="${p.nombre}">${p.nombre}</option>`).join('')}</select></label>
        <label>Talla<select id="vTalla">${CONFIG.tallas.map(t => `<option>${t}</option>`).join('')}</select></label>
        <label>Nombre en la camisola<input type="text" id="vNombre" placeholder="Opcional" autocomplete="off"></label>
        <label>Precio de venta (Q)<input type="number" id="vPrecio" min="0" step="1" value="${CONFIG.productos[0].precio}"></label>
        <button class="btn btn-naranja" id="btnRegistrarVenta" type="button">Registrar venta</button>
      </div>
      <div id="msgVenta"></div>
    </details>
    ${mensaje ? `<div class="aviso aviso-verde"><span>${mensaje}</span></div>` : ''}

    <section class="tarjeta">
      <div class="campos">
        <label>Buscar<input type="search" id="fTexto" placeholder="Cliente, producto, orden o guía" value="${esc(filtrosDatos.texto)}"></label>
        <label>Mes<select id="fMes"><option value="">Todos</option>${meses.map(m => `<option value="${m}" ${m === filtrosDatos.mes ? 'selected' : ''}>${nombreMes(m)}</option>`).join('')}</select></label>
        <label>Versión<select id="fVersion">
          ${[['', 'Todas'], ['Jugador', 'Jugador'], ['Fan', 'Fan'], ['Retro', 'Retro'], ['-', 'No se cuentan']].map(([v, t]) => `<option value="${v}" ${v === filtrosDatos.version ? 'selected' : ''}>${t}</option>`).join('')}
        </select></label>
        <label style="flex-direction:row;align-items:center;gap:8px;padding-bottom:10px"><input type="checkbox" id="fSoloModelo" ${filtrosDatos.soloModelo ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--naranja)">Solo columnas del modelo</label>
      </div>
      <div id="resumenDatos" class="subtitulo"></div>
      <div class="cabecera-acciones"><button class="btn btn-borde btn-chico" id="btnExcelDatos" type="button">Descargar lo filtrado en Excel</button></div>
      <div class="tabla-scroll" style="max-height:70vh;overflow:auto"><table class="tabla tabla-datos" id="tablaDatos"></table></div>
    </section>`;

  const COLS = [
    ['orden', 'Orden', false], ['fecha', 'Fecha', true], ['cliente', 'Cliente', false], ['producto', 'Producto', false],
    ['version', 'Versión', true], ['regla', 'Cómo se clasificó', false], ['nombre', 'Nombre en camisola', false], ['talla', 'Talla', false],
    ['guia', 'Guía', false], ['responsable', 'Responsable', false], ['precioCosto', 'Precio costo', false], ['envio', 'Envío', false],
    ['cargo', '% cargo', false], ['costo', 'Costo total', false], ['anticipo', 'Anticipo', false], ['precioVenta', 'Precio venta', false],
    ['ganancia', 'Ganancia', false], ['deposito', 'Depósito', false]
  ];
  const montos = ['precioCosto', 'envio', 'costo', 'anticipo', 'precioVenta', 'ganancia'];

  const filtrar = () => {
    const t = filtrosDatos.texto.trim().toLowerCase();
    return filas.filter(f =>
      (!filtrosDatos.mes || f.fecha.startsWith(filtrosDatos.mes)) &&
      (!filtrosDatos.version || (filtrosDatos.version === '-' ? !f.version : f.version === filtrosDatos.version)) &&
      (!t || [f.cliente, f.producto, f.orden, f.guia, f.nombre].some(v => String(v ?? '').toLowerCase().includes(t))));
  };

  const dibujar = () => {
    const lista = filtrar();
    const cols = filtrosDatos.soloModelo ? COLS.filter(c => c[2] || ['orden', 'producto'].includes(c[0])) : COLS;
    const cuenta = { Jugador: 0, Fan: 0, Retro: 0, '': 0 };
    lista.forEach(f => { cuenta[f.version || '']++; });
    $('resumenDatos').innerHTML = `Mostrando <b>${lista.length}</b> de ${filas.length} ventas: ${cuenta.Jugador} Jugador, ${cuenta.Fan} Fan, ${cuenta.Retro} Retro${cuenta[''] ? ` y ${cuenta['']} que no se cuentan` : ''}. ${lista.filter(f => f.fechaEstimada).length} con fecha estimada.`;

    const celda = (f, c) => {
      const v = f[c];
      if (c === 'orden') return `${v ?? ''}${f.nueva ? ` <span class="chip chip-verde">Nueva</span> <button class="btn-texto" data-quitar-venta="${f.id}" type="button">Quitar</button>` : ''}`;
      if (c === 'fecha') return `${v}${f.fechaEstimada ? ' <span class="chip chip-amarillo">Estimada</span>' : ''}`;
      if (c === 'version') return v ? `<b>${v}</b>` : '<span class="chip chip-crema">No se cuenta</span>';
      if (c === 'cargo') return v === null || v === '' ? '' : `${num(v)}%`;
      if (montos.includes(c)) return v === null || v === '' ? '' : Q2(v);
      return esc(v ?? '');
    };
    $('tablaDatos').innerHTML = `
      <thead><tr>${cols.map(c => `<th class="${c[2] ? 'col-modelo' : ''} ${montos.includes(c[0]) || c[0] === 'cargo' ? 'num' : ''}" style="position:sticky;top:0;z-index:1">${c[1]}</th>`).join('')}</tr></thead>
      <tbody>${lista.map(f => `<tr>${cols.map(c => `<td class="${c[2] ? 'col-modelo' : ''} ${montos.includes(c[0]) || c[0] === 'cargo' ? 'num' : ''}">${celda(f, c[0])}</td>`).join('')}</tr>`).join('')}</tbody>`;
    $('tablaDatos').querySelectorAll('[data-quitar-venta]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('¿Quitar esta venta? También se resta 1 de su mes en Control de ventas.')) return;
      quitarVentaNueva(Number(b.dataset.quitarVenta));
      pantallaDatos(vista, 'Venta quitada.');
    }));
    return { lista, cols };
  };

  // Registrar una venta nueva
  $('vVersion').addEventListener('change', () => {
    const p = CONFIG.productos.find(x => x.nombre === $('vVersion').value);
    $('vPrecio').value = p.precio;
  });
  $('btnRegistrarVenta').addEventListener('click', () => {
    const fecha = $('vFecha').value, cliente = $('vCliente').value.trim(), producto = $('vProducto').value.trim();
    const version = $('vVersion').value, precio = Number($('vPrecio').value);
    const errores = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) errores.push('Elegí la fecha de la venta (formato aaaa-mm-dd).');
    if (!cliente) errores.push('Escribí el nombre del cliente.');
    if (!producto) errores.push('Escribí qué playera se vendió.');
    if (!(precio > 0)) errores.push('El precio de venta tiene que ser mayor que 0.');
    if (errores.length) { $('msgVenta').innerHTML = `<div class="aviso aviso-rojo"><span>${errores.join('<br>')}</span></div>`; return; }
    const prod = CONFIG.productos.find(x => x.nombre === version);
    registrarVenta({
      orden: Number($('vOrden').value) || null, fecha, fechaEstimada: false, cliente, producto,
      nombre: $('vNombre').value.trim(), talla: $('vTalla').value, guia: '', responsable: '',
      precioCosto: prod.costo, envio: CONFIG.envioCliente, cargo: null, costo: prod.costo + CONFIG.envioCliente,
      anticipo: null, precioVenta: precio, ganancia: precio - prod.costo - CONFIG.envioCliente, deposito: '',
      version, regla: 'Registrada en la app'
    });
    filtrosDatos.texto = ''; filtrosDatos.mes = ''; filtrosDatos.version = '';
    pantallaDatos(vista, `Venta registrada: ${esc(cliente)}, ${esc(producto)} (${version}). Se sumó 1 ${version} a ${nombreMes(fecha.slice(0, 7))} en Control de ventas.`);
  });

  let actual = dibujar();
  $('fTexto').addEventListener('input', e => { filtrosDatos.texto = e.target.value; actual = dibujar(); });
  $('fMes').addEventListener('change', e => { filtrosDatos.mes = e.target.value; actual = dibujar(); });
  $('fVersion').addEventListener('change', e => { filtrosDatos.version = e.target.value; actual = dibujar(); });
  $('fSoloModelo').addEventListener('change', e => { filtrosDatos.soloModelo = e.target.checked; actual = dibujar(); });
  $('btnExcelDatos').addEventListener('click', () => {
    descargarLibroExcel({
      'Ventas': [actual.cols.map(c => c[1]), ...actual.lista.map(f => actual.cols.map(c => c[0] === 'version' ? (f.version || 'No se cuenta') : (f[c[0]] ?? '')))]
    }, 'todas-las-ventas-cracks1201.xlsx');
  });
}
