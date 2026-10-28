# Cracks1201 · Panel de control + Proyecto de Investigación de Operaciones

Proyecto final del curso **Investigación de Operaciones (026)**, Universidad Mariano Gálvez de Guatemala.  
Autor: **Jony Estuardo Mejía Bravo**

Panel web de la tienda deportiva Cracks1201 con una sección **Proyecto** que resuelve dos problemas del negocio:

1. **¿Cuántas playeras de cada versión (Jugador, Fan, Retro) tener en stock?**  
   Programación lineal resuelta con el **Método Simplex con M Grande**, programado desde cero (`js/simplex.js`).
2. **¿Cuánto y cuándo pedirle al proveedor?**  
   Modelo de inventario **EOQ** con ajuste a cajas, stock de seguridad y punto de reorden (`js/inventario.js`).

## Cómo usarla

- **En línea:** abrir el enlace de GitHub Pages del repositorio.
- **Sin internet:** descargar el repositorio y abrir `index.html` con doble clic.

Usuario de demostración: `jbravo`

## Estructura

| Archivo | Qué hace |
|---|---|
| `index.html` | Login y estructura del panel |
| `css/estilos.css` | Diseño del panel (café, naranja y crema) |
| `js/simplex.js` | Método Simplex con M Grande + búsqueda de la mejor solución entera |
| `js/inventario.js` | EOQ, ajuste a cajas, stock de seguridad y punto de reorden |
| `js/datos.js` | Datos fijos del negocio, registro de ventas e importación de Excel |
| `js/proyecto.js` | Pantallas del proyecto: problema, ventas, plan, pedidos, modelo, iteraciones y reportes |
| `js/cuentas.js` | Cuentas del negocio calculadas con el registro de ventas |
| `js/auth.js` | Inicio de sesión de demostración (contraseña guardada como hash SHA-256) |
| `js/app.js` | Arranque y navegación |
| `js/datos-detalle.js` | Todas las ventas del Excel de cuentas (nombres de clientes abreviados) |
| `js/paginas-ejemplo.js` | Pantallas del panel con datos de ejemplo (solo vista) |
| `js/lib/` | Chart.js 4.4.1 y SheetJS 0.18.5 (copias locales) |

> El login es de demostración: al ser una página estática, sirve como control de acceso básico, no como seguridad de producción.
