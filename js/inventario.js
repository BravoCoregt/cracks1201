/* =====================================================================
   inventario.js
   Modelo de Inventario EOQ (Cantidad Económica de Pedido) con
   revisión continua, stock de seguridad y punto de reorden.
   Proyecto final - Investigación de Operaciones (026) - UMG
   Empresa: Cracks1201
   ===================================================================== */

// Valor Z de la distribución normal según el nivel de servicio
const TABLA_Z = { 0.90: 1.282, 0.95: 1.645, 0.975: 1.960, 0.99: 2.326 };

/* ---------------------------------------------------------------------
   calcularInventario(datos)

   datos = {
     demandaMensual: 50,       // playeras promedio al mes
     sigmaMes: 10,             // desviación estándar mensual (del historial)
     demandaMin: 30,           // mes flojo (solo si no hay sigmaMes)
     demandaMax: 70,           // mes fuerte (solo si no hay sigmaMes)
     costoPedido: 100,         // S: costo de hacer un pedido (envío del proveedor)
     costoUnitario: 230,       // costo promedio de una playera
     tasaMantener: 0.25,       // % anual del costo que cuesta tener la playera guardada
     entregaMin: 45,           // días que tarda el proveedor (mínimo)
     entregaMax: 50,           // días que tarda el proveedor (máximo)
     nivelServicio: 0.95,      // probabilidad de NO quedarse sin stock
     tamanoCaja: 20,           // playeras por caja
     capacidad: 100            // espacio en bodega
   }
   --------------------------------------------------------------------- */
function calcularInventario(datos) {
  const D = datos.demandaMensual * 12;                 // demanda anual
  const S = datos.costoPedido;
  const H = datos.tasaMantener * datos.costoUnitario;   // costo anual de mantener 1 playera

  // 1) EOQ clásico: Q* = raíz(2DS / H)
  const qOptimo = Math.sqrt((2 * D * S) / H);

  const costoTotal = (Q) => (D / Q) * S + (Q / 2) * H;   // costo de pedir + costo de mantener
  const costoPedirAnual = (Q) => (D / Q) * S;
  const costoMantenerAnual = (Q) => (Q / 2) * H;

  // 2) Ajuste a cajas completas: el proveedor manda cajas de 20
  const caja = datos.tamanoCaja;
  const abajo = Math.max(caja, Math.floor(qOptimo / caja) * caja);
  const arriba = Math.ceil(qOptimo / caja) * caja;
  const candidatos = [...new Set([abajo, arriba])].map(Q => ({
    Q, cajas: Q / caja, costo: costoTotal(Q)
  }));
  const elegido = candidatos.reduce((m, c) => (c.costo < m.costo ? c : m));

  // 3) Frecuencia de pedidos
  const pedidosAlAnio = D / elegido.Q;
  const diasEntrePedidos = 365 / pedidosAlAnio;

  // 4) Stock de seguridad con demanda y tiempo de entrega variables
  const d = D / 365;                                            // demanda diaria
  // Desviación estándar mensual: si viene del historial de ventas se usa directo;
  // si no, se estima con la regla del rango (máximo - mínimo) / 4
  const sigmaMes = (typeof datos.sigmaMes === 'number' && datos.sigmaMes >= 0)
    ? datos.sigmaMes
    : (datos.demandaMax - datos.demandaMin) / 4;
  const sigmaDia = sigmaMes / Math.sqrt(365 / 12);
  const L = (datos.entregaMin + datos.entregaMax) / 2;           // entrega promedio
  const sigmaL = (datos.entregaMax - datos.entregaMin) / 4;
  const z = TABLA_Z[datos.nivelServicio] || 1.645;

  // σ durante la entrega = raíz( L·σd² + d²·σL² )
  const sigmaEntrega = Math.sqrt(L * sigmaDia ** 2 + d ** 2 * sigmaL ** 2);
  const stockSeguridad = Math.ceil(z * sigmaEntrega);

  // 5) Punto de reorden: lo que se vende mientras llega el pedido + colchón
  const demandaEnEntrega = d * L;
  const puntoReorden = Math.ceil(demandaEnEntrega + stockSeguridad);

  // Con 45-50 días de entrega, siempre hay pedidos en camino
  const pedidosEnCamino = demandaEnEntrega / elegido.Q;

  // 6) ¿Cabe en la bodega? Lo máximo en mano es el pedido + el stock de seguridad
  const inventarioMaximo = elegido.Q + stockSeguridad;
  const cabeEnBodega = inventarioMaximo <= datos.capacidad;

  // 7) Datos para las gráficas
  const curva = [];
  const qFin = Math.max(qOptimo * 3, caja * 6);
  for (let Q = Math.max(5, Math.round(qOptimo * 0.2)); Q <= qFin; Q += Math.max(1, Math.round(qFin / 60))) {
    curva.push({ Q, total: costoTotal(Q), pedir: costoPedirAnual(Q), mantener: costoMantenerAnual(Q) });
  }

  // Diente de sierra: inventario en mano durante 4 ciclos
  const sierra = [];
  for (let ciclo = 0; ciclo < 4; ciclo++) {
    const t0 = ciclo * diasEntrePedidos;
    sierra.push({ dia: t0, nivel: stockSeguridad + elegido.Q });
    sierra.push({ dia: t0 + diasEntrePedidos - 0.01, nivel: stockSeguridad });
  }
  sierra.push({ dia: 4 * diasEntrePedidos, nivel: stockSeguridad + elegido.Q });

  return {
    D, S, H, d, qOptimo, costoOptimo: costoTotal(qOptimo),
    candidatos, elegido, pedidosAlAnio, diasEntrePedidos,
    sigmaMes, sigmaDia, L, sigmaL, z, sigmaEntrega,
    stockSeguridad, demandaEnEntrega, puntoReorden, pedidosEnCamino,
    inventarioMaximo, cabeEnBodega, curva, sierra,
    costoPedirElegido: costoPedirAnual(elegido.Q),
    costoMantenerElegido: costoMantenerAnual(elegido.Q)
  };
}

if (typeof module !== 'undefined') {
  module.exports = { calcularInventario };
}
