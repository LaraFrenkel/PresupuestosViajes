# PresupuestosViajes — Brújula

Aplicación web para organizar presupuestos y gastos de viajes grupales. Permite comparar cotizaciones, confirmar un presupuesto, administrar cuotas y pagos, registrar gastos reales y calcular quién debe transferirle dinero a quién en cada moneda.

## Funcionalidades

- Registro e inicio de sesión con JWT.
- CRUD, archivo y eliminación segura de viajes.
- Participantes activos e inactivos con detalle individual.
- Cotizaciones, conceptos, comparación y tipos de cambio.
- Presupuestos versionados, planes, ajustes, excursiones y cuotas.
- Pagos con múltiples pagadoras, beneficiarias y destinos.
- Gastos con división igual o personalizada.
- Balances por moneda y transferencias sugeridas o realizadas.
- Historial unificado y conversión informativa entre monedas.

La guía funcional está en [docs/GUIA_DE_USO.md](docs/GUIA_DE_USO.md).

## Requisitos

- Node.js 20 o superior.
- npm.
- MySQL 8 o una versión compatible.

## Instalación local

1. Clonar el repositorio y entrar en su carpeta.
2. Crear la base ejecutando una sola vez [database/01_schema.sql](database/01_schema.sql) en MySQL. Ese archivo crea la base `app_presupuestos_viajes` y sus 21 tablas.
3. Copiar `.env.example` como `.env` y completar, como mínimo, `DB_USER`, `DB_PASSWORD` y `JWT_SECRET`.
4. Instalar el backend desde la raíz:

   ```powershell
   npm install
   ```

5. Instalar el frontend:

   ```powershell
   cd frontend
   npm install
   cd ..
   ```

## Iniciar la aplicación

En una terminal, desde la raíz:

```powershell
npm run dev
```

En otra terminal:

```powershell
cd frontend
npm run dev
```

Luego abrir http://localhost:5173. La API queda disponible en http://localhost:3000 y su comprobación de salud en http://localhost:3000/api/salud.

El frontend está preparado como PWA. En Android, un navegador compatible mostrará **Instalar** cuando la aplicación se sirva por HTTPS o desde `localhost`. En iPhone, se instala desde Safari con **Compartir → Agregar a inicio**. Las consultas ya visitadas y los cambios sobre viajes existentes pueden conservarse sin conexión; la cola se sincroniza con el backend al recuperar internet y detecta cambios concurrentes.

## Variables de entorno

| Variable         | Uso                                                | Ejemplo                   |
| ---------------- | -------------------------------------------------- | ------------------------- |
| `PORT`           | Puerto del backend                                 | `3000`                    |
| `DB_HOST`        | Servidor MySQL                                     | `localhost`               |
| `DB_PORT`        | Puerto MySQL                                       | `3306`                    |
| `DB_USER`        | Usuario MySQL                                      | `root`                    |
| `DB_PASSWORD`    | Contraseña MySQL                                   | —                         |
| `DB_NAME`        | Nombre de la base                                  | `app_presupuestos_viajes` |
| `JWT_SECRET`     | Firma de los tokens; usar un valor largo y privado | —                         |
| `JWT_EXPIRES_IN` | Duración de la sesión                              | `8h`                      |
| `FRONTEND_URL`   | Origen autorizado por CORS                         | `http://localhost:5173`   |

El archivo `.env` contiene secretos y no debe subirse al repositorio.

## Pruebas

Ejecutar desde la raíz:

```powershell
npm test
```

El conjunto comprueba rutas básicas, validaciones, el flujo funcional completo y la instalación limpia de las 21 tablas. Los escenarios integrales usan datos temporales y los eliminan al terminar.

También pueden ejecutarse por separado:

```powershell
npm run test:flow
npm run test:schema
```

Para verificar el frontend:

```powershell
cd frontend
npm run build
```

## Estructura

- `src/`: API Express, autenticación y reglas del negocio.
- `frontend/`: interfaz React con Vite.
- `database/01_schema.sql`: instalación completa de MySQL.
- `test/`: pruebas básicas, integrales y de instalación.
- `docs/`: documentación funcional.

`database/04_entrega2_cotizaciones.sql` se conserva como antecedente histórico y no debe ejecutarse durante una instalación nueva.
