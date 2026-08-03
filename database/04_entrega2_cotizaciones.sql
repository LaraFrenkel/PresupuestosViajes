USE app_presupuestos_viajes;

CREATE TABLE IF NOT EXISTS cotizaciones (
  id_cotizacion BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_viaje BIGINT UNSIGNED NOT NULL,
  agencia VARCHAR(120) NOT NULL,
  naviera VARCHAR(100),
  barco VARCHAR(100),
  fecha_cotizacion DATE NOT NULL,
  duracion_noches SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  itinerario TEXT,
  camarote VARCHAR(120),
  distribucion VARCHAR(255),
  moneda CHAR(3) NOT NULL,
  referencia VARCHAR(500),
  vigencia_hasta DATE,
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
  importe DECIMAL(15,2) UNSIGNED NOT NULL,
  moneda CHAR(3) NOT NULL,
  modalidad ENUM('TOTAL','POR_PERSONA','POR_CAMAROTE','POR_NOCHE','POR_PERSONA_NOCHE') NOT NULL,
  obligatorio BOOLEAN NOT NULL DEFAULT FALSE,
  incluido BOOLEAN NOT NULL DEFAULT FALSE,
  seleccionado BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_conceptos_cotizacion FOREIGN KEY (id_cotizacion) REFERENCES cotizaciones(id_cotizacion) ON DELETE CASCADE,
  INDEX idx_conceptos_cotizacion (id_cotizacion)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS asignaciones_concepto (
  id_concepto BIGINT UNSIGNED NOT NULL,
  id_participante BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id_concepto, id_participante),
  CONSTRAINT fk_asignaciones_concepto FOREIGN KEY (id_concepto) REFERENCES conceptos_cotizacion(id_concepto) ON DELETE CASCADE,
  CONSTRAINT fk_asignaciones_participante FOREIGN KEY (id_participante) REFERENCES participantes(id_participante) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tipos_cambio (
  id_tipo_cambio BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_viaje BIGINT UNSIGNED NOT NULL,
  moneda_origen CHAR(3) NOT NULL,
  moneda_destino CHAR(3) NOT NULL,
  tasa DECIMAL(18,6) UNSIGNED NOT NULL,
  fecha DATE NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tipos_cambio_viaje FOREIGN KEY (id_viaje) REFERENCES viajes(id_viaje) ON DELETE CASCADE,
  CONSTRAINT uq_tipo_cambio UNIQUE (id_viaje, moneda_origen, moneda_destino, fecha),
  CONSTRAINT chk_monedas_distintas CHECK (moneda_origen <> moneda_destino),
  INDEX idx_tipos_cambio_busqueda (id_viaje, moneda_origen, moneda_destino, fecha)
) ENGINE=InnoDB;
