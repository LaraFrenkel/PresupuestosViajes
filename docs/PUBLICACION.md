# Publicar Brújula

La configuración recomendada usa Aiven para MySQL, Render para la API y Vercel para el frontend/PWA. Las contraseñas se cargan en los paneles de cada servicio y nunca en GitHub.

## 1. Crear MySQL en Aiven

1. Crear un servicio **MySQL Free**.
2. Elegir una región cercana a las personas que usarán la aplicación.
3. En **Connection information**, guardar de forma privada el host, puerto, usuario, contraseña y nombre de la base.
4. No pegar estas credenciales en archivos del repositorio ni enviarlas por mensajes.

## 2. Publicar la API en Render

1. Subir los cambios actuales a GitHub.
2. En Render, crear un **Blueprint** desde el repositorio. Render detectará `render.yaml`.
3. Completar `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` con los datos de Aiven.
4. `FRONTEND_URL` se completa después con la dirección definitiva de Vercel.
5. Preparar las 24 tablas ejecutando una sola vez `npm run db:init` con las mismas variables de Aiven.
6. Verificar `https://DOMINIO-RENDER/api/salud`.

## 3. Publicar la PWA en Vercel

1. Importar el repositorio en Vercel.
2. Indicar `frontend` como **Root Directory**.
3. Crear `VITE_API_URL` con el valor `https://DOMINIO-RENDER/api`.
4. Desplegar y copiar la dirección definitiva de Vercel.
5. Volver a Render y configurar `FRONTEND_URL` con esa dirección, sin barra final.
6. Volver a desplegar la API.

## 4. Verificación

1. Abrir la dirección de Vercel desde el celular.
2. Registrar una cuenta y crear un viaje de prueba.
3. Instalar la PWA.
4. Compartir el viaje con una segunda cuenta.
5. Probar lectura, cambios offline y sincronización.

## Seguridad

- No subir `.env`.
- Usar únicamente HTTPS.
- No publicar las credenciales de Aiven.
- Rotar cualquier contraseña compartida accidentalmente.
- Antes de usar datos importantes, revisar la retención de copias de seguridad de Aiven.
