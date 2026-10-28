/* =====================================================================
   app.js
   Arranque de la app: inicio de sesión y navegación entre pantallas.
   ===================================================================== */

/* ---------------------- Inicio de sesión ---------------------- */
function mostrarApp(sesion) {
  $('pantallaLogin').hidden = true;
  $('pantallaApp').hidden = false;
  $('nombreUsuario').textContent = sesion.nombre;
  if (!location.hash || location.hash === '#/') location.hash = '#/resumen';
  navegar();
}

function mostrarLogin() {
  $('pantallaApp').hidden = true;
  $('pantallaLogin').hidden = false;
  $('clave').value = '';
  $('usuario').focus();
}

$('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('errorLogin').textContent = '';
  const sesion = await iniciarSesion($('usuario').value, $('clave').value);
  if (sesion) mostrarApp(sesion);
  else { $('errorLogin').textContent = 'Usuario o contraseña incorrectos.'; $('clave').select(); }
});

$('verClave').addEventListener('click', () => {
  const visible = $('clave').type === 'text';
  $('clave').type = visible ? 'password' : 'text';
  $('verClave').textContent = visible ? 'Mostrar' : 'Ocultar';
  $('verClave').setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
});

$('btnSalir').addEventListener('click', () => { cerrarSesion(); location.hash = ''; mostrarLogin(); });

/* ---------------------- Navegación ----------------------
   Rutas:  #/resumen  #/inventario  #/pedidos  #/agencia  #/cuentas  #/clientes
           #/proyecto/<problema|ventas|plan|pedir|modelo|iteraciones|reportes>
   -------------------------------------------------------- */
function navegar() {
  if (!sesionActual()) { mostrarLogin(); return; }
  const [seccion = 'resumen', subruta] = location.hash.replace(/^#\/?/, '').split('/');
  const vista = $('vista');

  document.querySelectorAll('.menu a').forEach(a => a.classList.toggle('activo', a.dataset.ruta === seccion));
  limpiarGraficas();

  if (seccion === 'proyecto') pantallaProyecto(vista, subruta || 'problema');
  else if (seccion === 'cuentas') pantallaCuentas(vista);
  else if (PAGINAS_EJEMPLO[seccion]) vista.innerHTML = PAGINAS_EJEMPLO[seccion];
  else { location.hash = '#/resumen'; return; }

  window.scrollTo(0, 0);
  vista.focus({ preventScroll: true });
}

window.addEventListener('hashchange', navegar);

/* ---------------------- Arranque ---------------------- */
const sesionGuardada = sesionActual();
if (sesionGuardada) mostrarApp(sesionGuardada);
else mostrarLogin();
