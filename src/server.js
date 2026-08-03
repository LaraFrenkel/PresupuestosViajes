import { app } from './app.js';
import { config } from './config.js';
import { comprobarConexion } from './db.js';

try {
  await comprobarConexion();
  app.listen(config.port, () => {
    console.log(`API disponible en http://localhost:${config.port}`);
  });
} catch (error) {
  console.error('No se pudo iniciar la API:', error.message);
  process.exit(1);
}
