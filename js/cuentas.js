/* =====================================================================
   cuentas.js
   Cuentas del negocio calculadas con el registro de Control de ventas:
   ingresos, costos, envíos y ganancia, por mes o por periodo.
   ===================================================================== */

let periodoCuentas = 'ultimos12';
let porcentajeSocio = 50;

function calcularCuentas(meses) {
  const fila = { unidades: 0, ventas: 0, costo: 0, envioCliente: 0, envioProveedor: 0, ganancia: 0 };
  const porTipo = {};
  CONFIG.productos.forEach(p => { porTipo[p.clave] = { ...fila, nombre: p.nombre }; });

  meses.forEach(m => {
    CONFIG.productos.forEach(p => {
      const u = m[p.clave] || 0;
      const t = porTipo[p.clave];
      t.unidades += u;
      t.ventas += u * p.precio;
      t.costo += u * p.costo;
      t.envioCliente += u * CONFIG.envioCliente;
      t.envioProveedor += u * envioProveedorPorPlayera();
    });
  });

  const total = { ...fila, nombre: 'Total' };
  Object.values(porTipo).forEach(t => {
    t.ganancia = t.ventas - t.costo - t.envioCliente - t.envioProveedor;
    Object.keys(fila).forEach(k => { total[k] += t[k]; });
  });
  return { porTipo, total };
}

function mesesDelPeriodo(ventas, periodo) {
  if (periodo === 'todo') return ventas;
  if (periodo === 'ultimos12') return ventas.slice(-12);
  return ventas.filter(v => v.mes === periodo);
}

function pantallaCuentas(vista) {
  const ventas = leerVentas().sort((a, b) => a.mes.localeCompare(b.mes));
  if (!ventas.length) {
    vista.innerHTML = `<div class="cabecera"><div><h1>Cuentas</h1></div></div>
      <div class="aviso aviso-durazno"><span>Todavía no hay ventas registradas. Agregalas en <a href="#/proyecto/ventas">Proyecto, Control de ventas</a>.</span></div>`;
    return;
  }
  if (periodo_invalido(ventas)) periodoCuentas = 'ultimos12';

  const meses = mesesDelPeriodo(ventas, periodoCuentas);
  const { porTipo, total } = calcularCuentas(meses);
  const margen = total.ventas ? (total.ganancia / total.ventas) * 100 : 0;
  const etiquetaPeriodo = periodoCuentas === 'todo' ? 'todo el historial'
    : periodoCuentas === 'ultimos12' ? 'los últimos 12 meses' : nombreMes(periodoCuentas);

  const opciones = [
    `<option value="ultimos12">Últimos 12 meses</option>`,
    `<option value="todo">Todo el historial</option>`,
    ...ventas.slice().reverse().map(v => `<option value="${v.mes}">${nombreMes(v.mes)}</option>`)
  ].join('');

  const socio = total.ganancia * (100 - porcentajeSocio) / 100;
  const estuardo = total.ganancia * porcentajeSocio / 100;

  vista.innerHTML = `
    <div class="cabecera">
      <div>
        <h1>Cuentas</h1>
        <p>Ventas, costos y ganancia de ${etiquetaPeriodo}.</p>
      </div>
      <div class="cabecera-acciones">
        <label for="periodo" class="subtitulo"><b>Periodo</b></label>
        <select id="periodo" style="width:auto">${opciones}</select>
      </div>
    </div>

    <div class="aviso aviso-crema"><span>Las cantidades vendidas salen del <a href="#/proyecto/ventas">Control de ventas</a>; los montos están calculados con los precios y costos actuales.</span></div>

    <div class="cifras">
      <div class="cifra"><span class="cifra-etiqueta">Ventas</span><span class="cifra-valor">${Q(total.ventas)}</span><span class="cifra-detalle">${num(total.unidades, 0)} playeras vendidas</span></div>
      <div class="cifra"><span class="cifra-etiqueta">Costo de las playeras</span><span class="cifra-valor">${Q(total.costo)}</span><span class="cifra-detalle">Lo que se le paga al proveedor</span></div>
      <div class="cifra"><span class="cifra-etiqueta">Envíos</span><span class="cifra-valor">${Q(total.envioCliente + total.envioProveedor)}</span><span class="cifra-detalle">${Q(total.envioCliente)} a clientes y ${Q(total.envioProveedor)} del proveedor</span></div>
      <div class="cifra oscura"><span class="cifra-etiqueta">Ganancia neta</span><span class="cifra-valor">${Q(total.ganancia)}</span><span class="cifra-detalle">Te quedan ${num(margen, 0)} de cada 100 quetzales vendidos</span></div>
    </div>

    <div class="fila">
      <section class="tarjeta ancha">
        <h2>Cuánto deja cada tipo de playera</h2>
        <div class="tabla-scroll"><table class="tabla">
          <thead><tr><th>Tipo</th><th class="num">Vendidas</th><th class="num">Ventas</th><th class="num">Costo</th><th class="num">Envíos</th><th class="num">Ganancia</th><th class="num">Por playera</th></tr></thead>
          <tbody>
            ${Object.values(porTipo).map(t => `<tr><td><b>${t.nombre}</b></td><td class="num">${num(t.unidades, 0)}</td><td class="num">${Q(t.ventas)}</td><td class="num">${Q(t.costo)}</td><td class="num">${Q(t.envioCliente + t.envioProveedor)}</td><td class="num"><b>${Q(t.ganancia)}</b></td><td class="num">${t.unidades ? Q2(t.ganancia / t.unidades) : '—'}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr><td>Total</td><td class="num">${num(total.unidades, 0)}</td><td class="num">${Q(total.ventas)}</td><td class="num">${Q(total.costo)}</td><td class="num">${Q(total.envioCliente + total.envioProveedor)}</td><td class="num">${Q(total.ganancia)}</td><td class="num">${total.unidades ? Q2(total.ganancia / total.unidades) : '—'}</td></tr></tfoot>
        </table></div>
        <p class="subtitulo">Envíos: ${Q(CONFIG.envioCliente)} por playera al cliente (envío gratis) y ${Q2(envioProveedorPorPlayera())} por playera del proveedor (${Q(CONFIG.costoCaja)} por caja de ${CONFIG.playerasPorCaja}).</p>
      </section>

      <section class="tarjeta">
        <h2>Reparto entre socios</h2>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
          <label for="pctSocio"><b>Porcentaje de Estuardo</b></label>
          <span style="display:flex;align-items:center;gap:6px"><input id="pctSocio" type="number" min="0" max="100" value="${porcentajeSocio}" style="width:80px;text-align:right">%</span>
        </div>
        <div class="barra"><span style="width:${porcentajeSocio}%;background:var(--cafe)"></span><span style="width:${100 - porcentajeSocio}%;background:var(--naranja)"></span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div style="background:var(--borde-suave);border-radius:12px;padding:12px"><div class="subtitulo">Estuardo, ${num(porcentajeSocio)}%</div><div class="cifra-valor" style="font-size:32px">${Q(estuardo)}</div></div>
          <div style="background:var(--durazno);border-radius:12px;padding:12px"><div class="subtitulo">Socio, ${num(100 - porcentajeSocio)}%</div><div class="cifra-valor" style="font-size:32px">${Q(socio)}</div></div>
        </div>
        <p class="subtitulo">Sobre la ganancia neta del periodo.</p>
      </section>
    </div>

    <section class="tarjeta">
      <h2>Ventas y ganancia por mes</h2>
      <div class="grafica"><canvas id="gCuentasMes"></canvas></div>
    </section>`;

  $('periodo').value = periodoCuentas;
  $('periodo').addEventListener('change', (e) => { periodoCuentas = e.target.value; pantallaCuentas(vista); });
  $('pctSocio').addEventListener('change', (e) => {
    porcentajeSocio = Math.min(100, Math.max(0, Number(e.target.value) || 0));
    pantallaCuentas(vista);
  });

  // Gráfica de los últimos 12 meses
  const ultimos = ventas.slice(-12);
  const porMes = ultimos.map(m => calcularCuentas([m]).total);
  limpiarGraficas();
  crearGrafica('gCuentasMes', {
    type: 'bar',
    data: {
      labels: ultimos.map(m => nombreMes(m.mes, true)),
      datasets: [
        { label: 'Ventas', data: porMes.map(t => t.ventas), backgroundColor: COLORES.crema, order: 2 },
        { label: 'Ganancia neta', data: porMes.map(t => t.ganancia), type: 'line', borderColor: COLORES.naranja, backgroundColor: COLORES.naranja, borderWidth: 3, order: 1 }
      ]
    },
    options: opcionesGrafica({ tituloY: 'Quetzales' })
  });
}

function periodo_invalido(ventas) {
  return !['todo', 'ultimos12'].includes(periodoCuentas) && !ventas.some(v => v.mes === periodoCuentas);
}
