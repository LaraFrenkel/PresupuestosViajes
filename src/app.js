import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { requerirAutenticacion } from './middleware/auth.js';
import { manejarErrores, rutaNoEncontrada } from './middleware/errors.js';
import authRoutes from './routes/auth.routes.js';
import viajesRoutes from './routes/viajes.routes.js';
import participantesRoutes from './routes/participantes.routes.js';
import cotizacionesRoutes from './routes/cotizaciones.routes.js';
import presupuestosRoutes from './routes/presupuestos.routes.js';
import finanzasRoutes from './routes/finanzas.routes.js';

export const app = express();
app.use(helmet());
app.use(cors({ origin: config.frontendUrl }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/salud', (_req, res) => res.json({ estado: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/viajes/:idViaje/cotizaciones', requerirAutenticacion, cotizacionesRoutes);
app.use('/api/viajes/:idViaje/presupuesto', requerirAutenticacion, presupuestosRoutes);
app.use('/api/viajes/:idViaje/finanzas', requerirAutenticacion, finanzasRoutes);
app.use('/api/viajes/:idViaje/participantes', requerirAutenticacion, participantesRoutes);
app.use('/api/viajes', requerirAutenticacion, viajesRoutes);
app.use(rutaNoEncontrada);
app.use(manejarErrores);
