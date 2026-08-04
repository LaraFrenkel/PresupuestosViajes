CREATE DATABASE IF NOT EXISTS app_presupuestos_viajes
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE app_presupuestos_viajes;

CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  contrasena_hash VARCHAR(255) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS viajes (
  id_viaje BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_usuario BIGINT UNSIGNED NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  tipo_viaje VARCHAR(50) NOT NULL DEFAULT 'CRUCERO',
  naviera VARCHAR(100),
  barco VARCHAR(100),
  puerto_salida VARCHAR(120),
  fecha_salida DATE NOT NULL,
  fecha_regreso DATE NOT NULL,
  moneda_principal CHAR(3) NOT NULL,
  estado ENUM('PLANIFICACION','CONFIRMADO','EN_CURSO','FINALIZADO','ARCHIVADO') NOT NULL DEFAULT 'PLANIFICACION',
  itinerario TEXT,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_viajes_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  CONSTRAINT chk_fechas_viaje CHECK (fecha_regreso >= fecha_salida),
  INDEX idx_viajes_usuario_fecha (id_usuario, fecha_salida)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS colaboradores_viaje (
  id_viaje BIGINT UNSIGNED NOT NULL,
  id_usuario BIGINT UNSIGNED NOT NULL,
  rol ENUM('EDITOR') NOT NULL DEFAULT 'EDITOR',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_viaje, id_usuario),
  CONSTRAINT fk_colaborador_viaje FOREIGN KEY (id_viaje) REFERENCES viajes(id_viaje) ON DELETE CASCADE,
  CONSTRAINT fk_colaborador_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  INDEX idx_colaborador_usuario (id_usuario)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sincronizacion_viaje (
  id_viaje BIGINT UNSIGNED PRIMARY KEY,
  version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  id_usuario_ultimo BIGINT UNSIGNED,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sync_viaje FOREIGN KEY (id_viaje) REFERENCES viajes(id_viaje) ON DELETE CASCADE,
  CONSTRAINT fk_sync_usuario FOREIGN KEY (id_usuario_ultimo) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cambios_sincronizacion (
  id_cambio BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_viaje BIGINT UNSIGNED NOT NULL,
  version BIGINT UNSIGNED NOT NULL,
  id_usuario BIGINT UNSIGNED,
  accion VARCHAR(12) NOT NULL,
  recurso VARCHAR(255) NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cambio_sync_viaje FOREIGN KEY (id_viaje) REFERENCES viajes(id_viaje) ON DELETE CASCADE,
  CONSTRAINT fk_cambio_sync_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  UNIQUE KEY uq_cambio_version (id_viaje, version),
  INDEX idx_cambio_sync (id_viaje, version)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS participantes (
  id_participante BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_viaje BIGINT UNSIGNED NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  color CHAR(7),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_participantes_viaje FOREIGN KEY (id_viaje) REFERENCES viajes(id_viaje) ON DELETE CASCADE,
  INDEX idx_participantes_viaje (id_viaje, activo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cotizaciones (
  id_cotizacion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_viaje BIGINT UNSIGNED NOT NULL,
  agencia VARCHAR(120) NOT NULL,
  naviera VARCHAR(100),
  barco VARCHAR(100),
  fecha_cotizacion DATE NOT NULL,
  duracion_noches SMALLINT UNSIGNED,
  itinerario TEXT,
  tipo_camarote VARCHAR(100),
  distribucion VARCHAR(255),
  moneda CHAR(3) NOT NULL,
  referencia VARCHAR(500),
  vigente_hasta DATE,
  estado ENUM('BORRADOR','COMPLETA','SELECCIONADA') NOT NULL DEFAULT 'BORRADOR',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cotizaciones_viaje FOREIGN KEY (id_viaje) REFERENCES viajes(id_viaje) ON DELETE CASCADE,
  INDEX idx_cotizaciones_viaje (id_viaje, estado)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS conceptos_cotizacion (
  id_concepto BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_cotizacion BIGINT UNSIGNED NOT NULL,
  categoria VARCHAR(60) NOT NULL,
  descripcion VARCHAR(180) NOT NULL,
  importe DECIMAL(15,2) NOT NULL,
  moneda CHAR(3) NOT NULL,
  modalidad ENUM('TOTAL','POR_PERSONA','POR_CAMAROTE','POR_NOCHE','POR_PERSONA_NOCHE') NOT NULL,
  cantidad DECIMAL(10,2) NOT NULL DEFAULT 1,
  obligatorio BOOLEAN NOT NULL DEFAULT FALSE,
  opcional_seleccionado BOOLEAN NOT NULL DEFAULT TRUE,
  incluido BOOLEAN NOT NULL DEFAULT FALSE,
  aplica_todos BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_conceptos_cotizacion FOREIGN KEY (id_cotizacion) REFERENCES cotizaciones(id_cotizacion) ON DELETE CASCADE,
  CONSTRAINT chk_concepto_importe CHECK (importe >= 0),
  CONSTRAINT chk_concepto_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS asignaciones_concepto (
  id_concepto BIGINT UNSIGNED NOT NULL,
  id_participante BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id_concepto, id_participante),
  CONSTRAINT fk_asignacion_concepto FOREIGN KEY (id_concepto) REFERENCES conceptos_cotizacion(id_concepto) ON DELETE CASCADE,
  CONSTRAINT fk_asignacion_participante FOREIGN KEY (id_participante) REFERENCES participantes(id_participante) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tipos_cambio (
  id_tipo_cambio BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_viaje BIGINT UNSIGNED NOT NULL,
  moneda_origen CHAR(3) NOT NULL,
  moneda_destino CHAR(3) NOT NULL,
  tasa DECIMAL(18,6) NOT NULL,
  fecha DATE NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tipos_cambio_viaje FOREIGN KEY (id_viaje) REFERENCES viajes(id_viaje) ON DELETE CASCADE,
  CONSTRAINT chk_tasa_positiva CHECK (tasa > 0),
  UNIQUE KEY uq_tipo_cambio (id_viaje, moneda_origen, moneda_destino, fecha)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS presupuestos (
  id_presupuesto BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_viaje BIGINT UNSIGNED NOT NULL,
  id_cotizacion_origen BIGINT UNSIGNED,
  version INT UNSIGNED NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  estado ENUM('CONFIRMADO','CERRADO') NOT NULL DEFAULT 'CONFIRMADO',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_presupuesto_viaje FOREIGN KEY (id_viaje) REFERENCES viajes(id_viaje) ON DELETE CASCADE,
  CONSTRAINT fk_presupuesto_cotizacion FOREIGN KEY (id_cotizacion_origen) REFERENCES cotizaciones(id_cotizacion) ON DELETE SET NULL,
  UNIQUE KEY uq_presupuesto_version (id_viaje, version),
  INDEX idx_presupuesto_activo (id_viaje, activo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS conceptos_presupuesto (
  id_concepto_presupuesto BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_presupuesto BIGINT UNSIGNED NOT NULL,
  id_concepto_origen BIGINT UNSIGNED,
  categoria VARCHAR(60) NOT NULL,
  descripcion VARCHAR(180) NOT NULL,
  importe DECIMAL(15,2) NOT NULL,
  moneda CHAR(3) NOT NULL,
  modalidad ENUM('TOTAL','POR_PERSONA','POR_CAMAROTE','POR_NOCHE','POR_PERSONA_NOCHE') NOT NULL,
  cantidad DECIMAL(10,2) NOT NULL DEFAULT 1,
  estado ENUM('ESTIMADO','CONFIRMADO','PENDIENTE','PAGADO','CANCELADO') NOT NULL DEFAULT 'CONFIRMADO',
  incluido BOOLEAN NOT NULL DEFAULT FALSE,
  aplica_todos BOOLEAN NOT NULL DEFAULT TRUE,
  es_ajuste BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_concepto_presupuesto FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto) ON DELETE CASCADE,
  CONSTRAINT fk_concepto_presupuesto_origen FOREIGN KEY (id_concepto_origen) REFERENCES conceptos_cotizacion(id_concepto) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS asignaciones_presupuesto (
  id_concepto_presupuesto BIGINT UNSIGNED NOT NULL,
  id_participante BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id_concepto_presupuesto, id_participante),
  CONSTRAINT fk_asignacion_presupuesto_concepto FOREIGN KEY (id_concepto_presupuesto) REFERENCES conceptos_presupuesto(id_concepto_presupuesto) ON DELETE CASCADE,
  CONSTRAINT fk_asignacion_presupuesto_participante FOREIGN KEY (id_participante) REFERENCES participantes(id_participante) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS excursiones (
  id_excursion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_presupuesto BIGINT UNSIGNED NOT NULL,
  puerto VARCHAR(120) NOT NULL,
  fecha DATE,
  hora TIME,
  proveedor VARCHAR(120),
  duracion VARCHAR(80),
  descripcion VARCHAR(180) NOT NULL,
  importe DECIMAL(15,2) NOT NULL,
  moneda CHAR(3) NOT NULL,
  referencia VARCHAR(500),
  politica_cancelacion TEXT,
  estado ENUM('ALTERNATIVA','ELEGIDA','CANCELADA') NOT NULL DEFAULT 'ALTERNATIVA',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_excursion_presupuesto FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS participantes_excursion (
  id_excursion BIGINT UNSIGNED NOT NULL,
  id_participante BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id_excursion, id_participante),
  CONSTRAINT fk_participante_excursion FOREIGN KEY (id_excursion) REFERENCES excursiones(id_excursion) ON DELETE CASCADE,
  CONSTRAINT fk_excursion_participante FOREIGN KEY (id_participante) REFERENCES participantes(id_participante) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cuotas (
  id_cuota BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_presupuesto BIGINT UNSIGNED NOT NULL,
  id_concepto_presupuesto BIGINT UNSIGNED,
  descripcion VARCHAR(180) NOT NULL,
  importe DECIMAL(15,2) NOT NULL,
  moneda CHAR(3) NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  estado ENUM('PENDIENTE','PAGADA','VENCIDA','CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cuota_presupuesto FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto) ON DELETE CASCADE,
  CONSTRAINT fk_cuota_concepto FOREIGN KEY (id_concepto_presupuesto) REFERENCES conceptos_presupuesto(id_concepto_presupuesto) ON DELETE SET NULL,
  INDEX idx_cuotas_vencimiento (id_presupuesto, estado, fecha_vencimiento)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pagos (
  id_pago BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_presupuesto BIGINT UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  importe DECIMAL(15,2) NOT NULL,
  moneda CHAR(3) NOT NULL,
  medio VARCHAR(80),
  tipo_cambio DECIMAL(18,6),
  observaciones TEXT,
  estado ENUM('ACTIVO','REVERTIDO') NOT NULL DEFAULT 'ACTIVO',
  revertido_en TIMESTAMP NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pago_presupuesto FOREIGN KEY (id_presupuesto) REFERENCES presupuestos(id_presupuesto) ON DELETE CASCADE,
  CONSTRAINT chk_pago_importe CHECK (importe > 0),
  CONSTRAINT chk_pago_cambio CHECK (tipo_cambio IS NULL OR tipo_cambio > 0),
  INDEX idx_pagos_fecha (id_presupuesto, fecha)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS aportes_pago (
  id_pago BIGINT UNSIGNED NOT NULL,
  id_participante BIGINT UNSIGNED NOT NULL,
  importe DECIMAL(15,2) NOT NULL,
  PRIMARY KEY (id_pago, id_participante),
  CONSTRAINT fk_aporte_pago FOREIGN KEY (id_pago) REFERENCES pagos(id_pago) ON DELETE CASCADE,
  CONSTRAINT fk_aporte_participante FOREIGN KEY (id_participante) REFERENCES participantes(id_participante) ON DELETE RESTRICT,
  CONSTRAINT chk_aporte_positivo CHECK (importe > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS beneficiarios_pago (
  id_pago BIGINT UNSIGNED NOT NULL,
  id_participante BIGINT UNSIGNED NOT NULL,
  importe DECIMAL(15,2) NOT NULL,
  PRIMARY KEY (id_pago, id_participante),
  CONSTRAINT fk_beneficiario_pago FOREIGN KEY (id_pago) REFERENCES pagos(id_pago) ON DELETE CASCADE,
  CONSTRAINT fk_beneficiario_participante FOREIGN KEY (id_participante) REFERENCES participantes(id_participante) ON DELETE RESTRICT,
  CONSTRAINT chk_beneficio_positivo CHECK (importe > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS aplicaciones_pago (
  id_aplicacion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_pago BIGINT UNSIGNED NOT NULL,
  id_cuota BIGINT UNSIGNED,
  id_concepto_presupuesto BIGINT UNSIGNED,
  importe DECIMAL(15,2) NOT NULL,
  CONSTRAINT fk_aplicacion_pago FOREIGN KEY (id_pago) REFERENCES pagos(id_pago) ON DELETE CASCADE,
  CONSTRAINT fk_aplicacion_cuota FOREIGN KEY (id_cuota) REFERENCES cuotas(id_cuota) ON DELETE RESTRICT,
  CONSTRAINT fk_aplicacion_concepto FOREIGN KEY (id_concepto_presupuesto) REFERENCES conceptos_presupuesto(id_concepto_presupuesto) ON DELETE RESTRICT,
  CONSTRAINT chk_aplicacion_destino CHECK (id_cuota IS NOT NULL OR id_concepto_presupuesto IS NOT NULL),
  CONSTRAINT chk_aplicacion_importe CHECK (importe > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gastos (
  id_gasto BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_viaje BIGINT UNSIGNED NOT NULL,
  id_concepto_presupuesto BIGINT UNSIGNED,
  descripcion VARCHAR(180) NOT NULL,
  categoria VARCHAR(60) NOT NULL,
  fecha DATE NOT NULL,
  importe DECIMAL(15,2) NOT NULL,
  moneda CHAR(3) NOT NULL,
  tipo_division ENUM('IGUAL','PERSONALIZADA') NOT NULL,
  observaciones TEXT,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gasto_viaje FOREIGN KEY (id_viaje) REFERENCES viajes(id_viaje) ON DELETE CASCADE,
  CONSTRAINT fk_gasto_concepto FOREIGN KEY (id_concepto_presupuesto) REFERENCES conceptos_presupuesto(id_concepto_presupuesto) ON DELETE SET NULL,
  CONSTRAINT chk_gasto_importe CHECK (importe > 0),
  INDEX idx_gastos_fecha (id_viaje, fecha)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pagadores_gasto (
  id_gasto BIGINT UNSIGNED NOT NULL,
  id_participante BIGINT UNSIGNED NOT NULL,
  importe DECIMAL(15,2) NOT NULL,
  PRIMARY KEY (id_gasto, id_participante),
  CONSTRAINT fk_pagador_gasto FOREIGN KEY (id_gasto) REFERENCES gastos(id_gasto) ON DELETE CASCADE,
  CONSTRAINT fk_pagador_participante FOREIGN KEY (id_participante) REFERENCES participantes(id_participante) ON DELETE RESTRICT,
  CONSTRAINT chk_pagador_gasto_importe CHECK (importe > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS asignaciones_gasto (
  id_gasto BIGINT UNSIGNED NOT NULL,
  id_participante BIGINT UNSIGNED NOT NULL,
  importe DECIMAL(15,2) NOT NULL,
  PRIMARY KEY (id_gasto, id_participante),
  CONSTRAINT fk_asignacion_gasto FOREIGN KEY (id_gasto) REFERENCES gastos(id_gasto) ON DELETE CASCADE,
  CONSTRAINT fk_asignacion_gasto_participante FOREIGN KEY (id_participante) REFERENCES participantes(id_participante) ON DELETE RESTRICT,
  CONSTRAINT chk_asignacion_gasto_importe CHECK (importe > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transferencias (
  id_transferencia BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_viaje BIGINT UNSIGNED NOT NULL,
  id_origen BIGINT UNSIGNED NOT NULL,
  id_destino BIGINT UNSIGNED NOT NULL,
  importe DECIMAL(15,2) NOT NULL,
  moneda CHAR(3) NOT NULL,
  estado ENUM('PENDIENTE','REALIZADA','ANULADA') NOT NULL DEFAULT 'PENDIENTE',
  fecha DATE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transferencia_viaje FOREIGN KEY (id_viaje) REFERENCES viajes(id_viaje) ON DELETE CASCADE,
  CONSTRAINT fk_transferencia_origen FOREIGN KEY (id_origen) REFERENCES participantes(id_participante) ON DELETE RESTRICT,
  CONSTRAINT fk_transferencia_destino FOREIGN KEY (id_destino) REFERENCES participantes(id_participante) ON DELETE RESTRICT,
  CONSTRAINT chk_transferencia_distintos CHECK (id_origen <> id_destino),
  CONSTRAINT chk_transferencia_importe CHECK (importe > 0),
  INDEX idx_transferencias_viaje (id_viaje, moneda, estado)
) ENGINE=InnoDB;

SET @agregar_estado_pago = (
  SELECT IF(COUNT(*) = 0,
    "ALTER TABLE pagos ADD COLUMN estado ENUM('ACTIVO','REVERTIDO') NOT NULL DEFAULT 'ACTIVO'",
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'pagos' AND column_name = 'estado'
);
PREPARE migracion_estado_pago FROM @agregar_estado_pago;
EXECUTE migracion_estado_pago;
DEALLOCATE PREPARE migracion_estado_pago;

SET @agregar_reversion_pago = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE pagos ADD COLUMN revertido_en TIMESTAMP NULL',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'pagos' AND column_name = 'revertido_en'
);
PREPARE migracion_reversion_pago FROM @agregar_reversion_pago;
EXECUTE migracion_reversion_pago;
DEALLOCATE PREPARE migracion_reversion_pago;
