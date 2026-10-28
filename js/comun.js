/* =====================================================================
   comun.js - utilidades que usan todas las pantallas
   ===================================================================== */
const $ = (id) => document.getElementById(id);

function num(v, dec = 2) {
  return Number(v).toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: dec });
}
function Q(v, dec = 0) {
  return 'Q' + Number(v).toLocaleString('es-GT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function Q2(v) { return Q(v, 2); }

// Evita que texto escrito por el usuario se interprete como HTML
function esc(t) {
  return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------------- Gráficas ---------------------- */
const COLORES = {
  cafe: '#3A2614', naranja: '#E9841C', dorado: '#F5B342', azul: '#1D4B73',
  verde: '#2E7A4F', rojo: '#A93A26', crema: '#CDB79C', suave: '#6B5A47', borde: '#EADFD2'
};
const COLOR_PRODUCTO = { jugador: COLORES.cafe, fan: COLORES.naranja, retro: COLORES.azul };

let graficasActivas = [];

function crearGrafica(canvasId, config) {
  if (typeof Chart === 'undefined' || !$(canvasId)) return null;
  const g = new Chart($(canvasId), config);
  graficasActivas.push(g);
  return g;
}

// Al cambiar de pantalla se destruyen las gráficas anteriores
function limpiarGraficas() {
  graficasActivas.forEach(g => g.destroy());
  graficasActivas = [];
}

function opcionesGrafica({ tituloY = '', tituloX = '', apilada = false, xLineal = false, leyenda = true } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: leyenda, labels: { color: COLORES.suave, font: { family: 'Figtree, sans-serif' } } },
      tooltip: { titleFont: { family: 'Figtree' }, bodyFont: { family: 'Figtree' } }
    },
    scales: {
      x: {
        type: xLineal ? 'linear' : 'category', stacked: apilada,
        ticks: { color: COLORES.suave }, grid: { color: COLORES.borde },
        title: { display: !!tituloX, text: tituloX, color: COLORES.suave }
      },
      y: {
        beginAtZero: true, stacked: apilada,
        ticks: { color: COLORES.suave }, grid: { color: COLORES.borde },
        title: { display: !!tituloY, text: tituloY, color: COLORES.suave }
      }
    }
  };
}

/* ---------------------- Descargas ---------------------- */
function descargarLibroExcel(hojas, nombreArchivo) {
  // hojas = { 'Nombre hoja': [[fila], [fila], ...] }
  const libro = XLSX.utils.book_new();
  Object.entries(hojas).forEach(([nombre, filas]) => {
    const hoja = XLSX.utils.aoa_to_sheet(filas);
    hoja['!cols'] = (filas[0] || []).map((_, i) => ({ wch: Math.max(12, ...filas.map(f => String(f[i] ?? '').length + 2)) }));
    XLSX.utils.book_append_sheet(libro, hoja, nombre.slice(0, 31));
  });
  XLSX.writeFile(libro, nombreArchivo);
}
