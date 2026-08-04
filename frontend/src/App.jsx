import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { borrarDatosLocales, listarOperaciones } from "./offline-db.js";
import { descartarPendientes, sincronizarViaje } from "./sync.js";

const viajeVacio = {
  nombre: "",
  tipoViaje: "CRUCERO",
  naviera: "",
  barco: "",
  puertoSalida: "",
  fechaSalida: "",
  fechaRegreso: "",
  monedaPrincipal: "USD",
  estado: "PLANIFICACION",
  itinerario: "",
};

const estadoTexto = {
  PLANIFICACION: "Planificación",
  CONFIRMADO: "Confirmado",
  EN_CURSO: "En curso",
  FINALIZADO: "Finalizado",
  ARCHIVADO: "Archivado",
};

const cotizacionVacia = {
  agencia: "",
  naviera: "",
  barco: "",
  fechaCotizacion: new Date().toISOString().slice(0, 10),
  duracionNoches: "",
  itinerario: "",
  tipoCamarote: "",
  distribucion: "",
  moneda: "USD",
  referencia: "",
  vigenteHasta: "",
  estado: "BORRADOR",
};
const conceptoVacio = {
  categoria: "Tarifa base",
  descripcion: "",
  importe: "",
  moneda: "USD",
  modalidad: "TOTAL",
  cantidad: 1,
  obligatorio: true,
  opcionalSeleccionado: true,
  incluido: false,
  aplicaTodos: true,
  participanteIds: [],
};
const modalidadTexto = {
  TOTAL: "Total",
  POR_PERSONA: "Por persona",
  POR_CAMAROTE: "Por camarote",
  POR_NOCHE: "Por noche",
  POR_PERSONA_NOCHE: "Por persona/noche",
};

function Auth({ onLogin }) {
  const [registro, setRegistro] = useState(false);
  const [form, setForm] = useState({ nombre: "", email: "", contrasena: "" });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      if (registro) {
        await api("/auth/registro", {
          method: "POST",
          body: JSON.stringify(form),
        });
        setRegistro(false);
        setForm((f) => ({ ...f, contrasena: "" }));
      } else {
        const data = await api("/auth/login", {
          method: "POST",
          body: JSON.stringify(form),
        });
        onLogin(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-mark">B</span>
          <span>Brújula</span>
        </div>
        <div className="story-copy">
          <p className="eyebrow">Tu próximo viaje, más claro</p>
          <h1>Decidir, organizar y compartir sin perderse en planillas.</h1>
          <p>
            Reuní alternativas, participantes y decisiones en un único lugar.
          </p>
        </div>
        <p className="story-note">
          Diseñada para viajar en grupo, pensada para quien organiza.
        </p>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={enviar}>
          <p className="eyebrow">
            {registro ? "Crear cuenta" : "Bienvenida de nuevo"}
          </p>
          <h2>{registro ? "Empezá a planificar" : "Ingresá a tus viajes"}</h2>
          {registro && (
            <label>
              Nombre
              <input
                required
                minLength="2"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </label>
          )}
          <label>
            Correo electrónico
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="nombre@correo.com"
            />
          </label>
          <label>
            Contraseña
            <input
              required
              type="password"
              minLength="8"
              value={form.contrasena}
              onChange={(e) => setForm({ ...form, contrasena: e.target.value })}
              placeholder="Al menos 8 caracteres"
            />
          </label>
          {error && <div className="alert">{error}</div>}
          <button className="button primary wide" disabled={cargando}>
            {cargando ? "Un momento…" : registro ? "Crear cuenta" : "Ingresar"}
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setRegistro(!registro);
              setError("");
            }}
          >
            {registro
              ? "Ya tengo una cuenta"
              : "Es mi primera vez, crear cuenta"}
          </button>
        </form>
      </section>
    </main>
  );
}

function ViajeForm({ inicial, onSave, onCancel, onDelete }) {
  const [form, setForm] = useState(inicial ?? viajeVacio);
  const [error, setError] = useState("");
  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  async function enviar(e) {
    e.preventDefault();
    setError("");
    if (form.fechaRegreso < form.fechaSalida) {
      setError(
        "La fecha de regreso no puede ser anterior a la fecha de salida.",
      );
      return;
    }
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <form className="panel form-panel" onSubmit={enviar}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Datos generales</p>
          <h2>{inicial ? "Editar viaje" : "Nuevo viaje"}</h2>
        </div>
        <button type="button" className="icon-button" onClick={onCancel}>
          ×
        </button>
      </div>
      <div className="form-grid">
        <label className="span-2">
          Nombre del viaje
          <input
            required
            minLength="2"
            value={form.nombre}
            onChange={update("nombre")}
            placeholder="Crucero Brasil 2027"
          />
        </label>
        <label>
          Tipo
          <select value={form.tipoViaje} onChange={update("tipoViaje")}>
            <option>CRUCERO</option>
            <option>PLAYA</option>
            <option>AVENTURA</option>
            <option>OTRO</option>
          </select>
        </label>
        <label>
          Estado
          <select value={form.estado} onChange={update("estado")}>
            {Object.entries(estadoTexto).map(([v, t]) => (
              <option value={v} key={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Naviera
          <input value={form.naviera ?? ""} onChange={update("naviera")} />
        </label>
        <label>
          Barco
          <input value={form.barco ?? ""} onChange={update("barco")} />
        </label>
        <label>
          Puerto de salida
          <input
            value={form.puertoSalida ?? ""}
            onChange={update("puertoSalida")}
          />
        </label>
        <label>
          Moneda principal
          <select
            value={form.monedaPrincipal}
            onChange={update("monedaPrincipal")}
          >
            <option>USD</option>
            <option>ARS</option>
            <option>BRL</option>
            <option>EUR</option>
          </select>
        </label>
        <label>
          Fecha de salida
          <input
            required
            type="date"
            value={form.fechaSalida}
            onChange={update("fechaSalida")}
          />
        </label>
        <label>
          Fecha de regreso
          <input
            required
            type="date"
            value={form.fechaRegreso}
            onChange={update("fechaRegreso")}
          />
        </label>
        <label className="span-2">
          Itinerario
          <textarea
            rows="3"
            value={form.itinerario ?? ""}
            onChange={update("itinerario")}
            placeholder="Buenos Aires, Montevideo, Río de Janeiro…"
          />
        </label>
      </div>
      {inicial && <ColaboradoresViaje viaje={inicial} />}
      {error && <div className="alert">{error}</div>}
      <div className="actions">
        {inicial && onDelete && (
          <button type="button" className="button danger" onClick={onDelete}>
            Eliminar viaje
          </button>
        )}
        <button type="button" className="button ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button className="button primary">Guardar viaje</button>
      </div>
    </form>
  );
}

function ColaboradoresViaje({ viaje }) {
  const [data, setData] = useState(null);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState("EDITOR");
  const [error, setError] = useState("");

  async function cargar() {
    try {
      setData(await api(`/viajes/${viaje.idViaje}/colaboradores`));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    cargar();
  }, [viaje.idViaje]);

  async function agregar() {
    try {
      await api(`/viajes/${viaje.idViaje}/colaboradores`, {
        method: "POST",
        body: JSON.stringify({ email, rol }),
      });
      setEmail("");
      setRol("EDITOR");
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function quitar(persona) {
    if (!confirm(`¿Quitar el acceso de “${persona.nombre}”?`)) return;
    try {
      await api(`/viajes/${viaje.idViaje}/colaboradores/${persona.idUsuario}`, {
        method: "DELETE",
      });
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function cambiarRol(persona, nuevoRol) {
    try {
      await api(`/viajes/${viaje.idViaje}/colaboradores/${persona.idUsuario}`, {
        method: "PATCH",
        body: JSON.stringify({ rol: nuevoRol }),
      });
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="collaborators-block">
      <div>
        <p className="eyebrow">Acceso compartido</p>
        <h3>Colaboradoras</h3>
        <p className="empty-copy">
          Las editoras pueden consultar y modificar toda la información del
          viaje.
        </p>
      </div>
      {data?.puedeAdministrar && (
        <div className="collaborator-form">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            aria-label="Correo de la colaboradora"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregar();
              }
            }}
          />
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            aria-label="Permiso de la colaboradora"
          >
            <option value="EDITOR">Puede editar</option>
            <option value="LECTOR">Solo lectura</option>
          </select>
          <button type="button" className="button secondary" onClick={agregar}>
            Dar acceso
          </button>
        </div>
      )}
      {error && <div className="alert">{error}</div>}
      <div className="collaborator-list">
        {data?.colaboradores.map((persona) => (
          <div key={persona.idUsuario}>
            <span className="user-avatar">{persona.nombre[0]}</span>
            <div>
              <strong>{persona.nombre}</strong>
              <small>{persona.email}</small>
            </div>
            {persona.rol === "PROPIETARIA" ? (
              <span className="status">Propietaria</span>
            ) : data.puedeAdministrar ? (
              <select
                className="role-select"
                value={persona.rol}
                onChange={(e) => cambiarRol(persona, e.target.value)}
                aria-label={`Permiso de ${persona.nombre}`}
              >
                <option value="EDITOR">Puede editar</option>
                <option value="LECTOR">Solo lectura</option>
              </select>
            ) : (
              <span className="status">
                {persona.rol === "EDITOR" ? "Puede editar" : "Solo lectura"}
              </span>
            )}
            {data.puedeAdministrar && persona.rol !== "PROPIETARIA" && (
              <button
                type="button"
                className="text-button danger"
                onClick={() => quitar(persona)}
              >
                Quitar
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function DetalleParticipante({ viaje, participante, onClose }) {
  const [presupuesto, setPresupuesto] = useState(null),
    [finanzas, setFinanzas] = useState(null),
    [cargando, setCargando] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    (async () => {
      try {
        setFinanzas(await api(`/viajes/${viaje.idViaje}/finanzas`));
        try {
          setPresupuesto(await api(`/viajes/${viaje.idViaje}/presupuesto`));
        } catch (e) {
          if (!/no hay un presupuesto/i.test(e.message)) throw e;
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setCargando(false);
      }
    })();
  }, [viaje.idViaje, participante.idParticipante]);
  const money = (n, m) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: m }).format(
      n || 0,
    );
  const detalle = useMemo(() => {
    if (!finanzas) return null;
    const id = participante.idParticipante,
      activos = finanzas.participantes.filter((p) => p.activo),
      noches = Math.max(
        1,
        Math.round(
          (new Date(viaje.fechaRegreso) - new Date(viaje.fechaSalida)) /
            86400000,
        ),
      ),
      sumar = (o, m, v) => (o[m] = (o[m] || 0) + Number(v)),
      asignado = {},
      aporto = {},
      correspondia = {},
      movimientos = [];
    if (presupuesto) {
      for (const c of presupuesto.conceptos) {
        if (c.estado === "CANCELADO" || c.incluido) continue;
        const ids = c.aplicaTodos
          ? activos.map((p) => p.idParticipante)
          : c.participanteIds;
        if (!ids.includes(id)) continue;
        const factor = {
            TOTAL: c.cantidad,
            POR_PERSONA: ids.length * c.cantidad,
            POR_CAMAROTE: c.cantidad,
            POR_NOCHE: noches * c.cantidad,
            POR_PERSONA_NOCHE: ids.length * noches * c.cantidad,
          }[c.modalidad],
          parte = (Number(c.importe) * factor) / ids.length;
        sumar(asignado, c.moneda, parte);
      }
      for (const e of presupuesto.excursiones.filter(
        (e) => e.estado === "ELEGIDA" && e.participanteIds.includes(id),
      ))
        sumar(asignado, e.moneda, e.importe);
      for (const p of presupuesto.pagos || []) {
        if (p.estado === "REVERTIDO") continue;
        const a = p.aportes.find((x) => x.idParticipante === id),
          b = p.beneficiarios.find((x) => x.idParticipante === id);
        if (a) sumar(aporto, p.moneda, a.importe);
        if (b) sumar(correspondia, p.moneda, b.importe);
        if (a || b)
          movimientos.push({
            fecha: p.fecha,
            tipo: "Pago",
            descripcion:
              p.aplicaciones.map((x) => x.destino).join(", ") || "Pago",
            moneda: p.moneda,
            aporto: a?.importe || 0,
            correspondia: b?.importe || 0,
          });
      }
    }
    for (const g of finanzas.gastos || []) {
      const a = g.pagadores.find((x) => x.idParticipante === id),
        b = g.asignaciones.find((x) => x.idParticipante === id);
      if (a) sumar(aporto, g.moneda, a.importe);
      if (b) sumar(correspondia, g.moneda, b.importe);
      if (a || b)
        movimientos.push({
          fecha: g.fecha,
          tipo: "Gasto",
          descripcion: g.descripcion,
          moneda: g.moneda,
          aporto: a?.importe || 0,
          correspondia: b?.importe || 0,
        });
    }
    movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha));
    return {
      asignado,
      aporto,
      correspondia,
      movimientos,
      balances: finanzas.balances.filter((b) => b.idParticipante === id),
    };
  }, [presupuesto, finanzas, participante, viaje]);
  if (cargando)
    return (
      <section className="panel participant-detail">
        <p>Cargando detalle…</p>
      </section>
    );
  if (error || !detalle)
    return (
      <section className="panel participant-detail">
        <div className="alert">{error || "No se pudo cargar el detalle."}</div>
        <button className="button ghost" onClick={onClose}>
          Volver
        </button>
      </section>
    );
  const monedas = [
    ...new Set([
      ...Object.keys(detalle.asignado),
      ...Object.keys(detalle.aporto),
      ...Object.keys(detalle.correspondia),
      ...detalle.balances.map((b) => b.moneda),
    ]),
  ];
  return (
    <section className="panel participant-detail">
      <div className="participant-detail-header">
        <button className="back" onClick={onClose}>
          ← Participantes
        </button>
        <div className="participant-title">
          <span
            className="avatar large"
            style={{ background: participante.color || "#829c98" }}
          >
            {participante.nombre[0]}
          </span>
          <div>
            <p className="eyebrow">Ficha individual</p>
            <h2>{participante.nombre}</h2>
            <span
              className={`status ${participante.activo ? "" : "archivado"}`}
            >
              {participante.activo ? "Activa" : "Inactiva"}
            </span>
          </div>
        </div>
      </div>
      <div className="individual-kpis">
        {monedas.map((m) => {
          const balance =
            detalle.balances.find((b) => b.moneda === m)?.balance || 0;
          return (
            <article key={m}>
              <h3>{m}</h3>
              <div>
                <span>Presupuesto asignado</span>
                <strong>{money(detalle.asignado[m], m)}</strong>
              </div>
              <div>
                <span>Total aportado</span>
                <strong>{money(detalle.aporto[m], m)}</strong>
              </div>
              <div>
                <span>Le correspondía</span>
                <strong>{money(detalle.correspondia[m], m)}</strong>
              </div>
              <div
                className={`individual-balance ${balance > 0 ? "credit" : balance < 0 ? "debt" : "settled"}`}
              >
                <span>
                  {balance > 0
                    ? "Debe recibir"
                    : balance < 0
                      ? "Debe pagar"
                      : "Saldo"}
                </span>
                <strong>{money(Math.abs(balance), m)}</strong>
              </div>
            </article>
          );
        })}
        {!monedas.length && (
          <p className="empty-copy">
            Todavía no tiene importes ni movimientos asignados.
          </p>
        )}
      </div>
      <div className="section-actions">
        <h3>Historial de movimientos</h3>
        <span className="count">{detalle.movimientos.length}</span>
      </div>
      <div className="participant-ledger">
        {detalle.movimientos.map((x, i) => (
          <div
            className="participant-movement"
            key={`${x.tipo}-${x.fecha}-${i}`}
          >
            <div>
              <span className="status">{x.tipo}</span>
              <strong>{x.descripcion}</strong>
              <small>{x.fecha}</small>
            </div>
            <div>
              <small>Aportó</small>
              <strong>{money(x.aporto, x.moneda)}</strong>
            </div>
            <div>
              <small>Le correspondía</small>
              <strong>{money(x.correspondia, x.moneda)}</strong>
            </div>
            <div>
              <small>Impacto</small>
              <strong
                className={
                  x.aporto - x.correspondia >= 0 ? "credit-text" : "debt-text"
                }
              >
                {x.aporto - x.correspondia >= 0 ? "+" : ""}
                {money(x.aporto - x.correspondia, x.moneda)}
              </strong>
            </div>
          </div>
        ))}
      </div>
      {!detalle.movimientos.length && (
        <p className="empty-copy">Todavía no intervino en pagos ni gastos.</p>
      )}
    </section>
  );
}

function Participantes({ viaje, onCountChange }) {
  const [items, setItems] = useState([]);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState("#E9774C");
  const [error, setError] = useState("");
  const [seleccionada, setSeleccionada] = useState(null);
  async function cargar() {
    const data = await api(`/viajes/${viaje.idViaje}/participantes`);
    setItems(data);
    onCountChange(data.filter((x) => x.activo).length);
  }
  useEffect(() => {
    cargar().catch((e) => setError(e.message));
  }, [viaje.idViaje]);
  async function agregar(e) {
    e.preventDefault();
    try {
      await api(`/viajes/${viaje.idViaje}/participantes`, {
        method: "POST",
        body: JSON.stringify({ nombre, color }),
      });
      setNombre("");
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }
  async function alternar(p) {
    try {
      await api(
        `/viajes/${viaje.idViaje}/participantes/${p.idParticipante}/${p.activo ? "desactivar" : "reactivar"}`,
        { method: "PATCH" },
      );
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }
  async function eliminar(p) {
    if (!confirm(`¿Eliminar definitivamente a “${p.nombre}”?`)) return;
    try {
      await api(`/viajes/${viaje.idViaje}/participantes/${p.idParticipante}`, {
        method: "DELETE",
      });
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }
  if (seleccionada) {
    return (
      <DetalleParticipante
        viaje={viaje}
        participante={seleccionada}
        onClose={() => setSeleccionada(null)}
      />
    );
  }
  return (
    <section className="panel participants-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">El grupo</p>
          <h2>Participantes</h2>
        </div>
        <span className="count">
          {items.filter((x) => x.activo).length} activas
        </span>
      </div>
      <form className="participant-form" onSubmit={agregar}>
        <input
          required
          minLength="2"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre de la participante"
        />
        <input
          className="color-input"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          title="Color"
        />
        <button className="button secondary">Agregar</button>
      </form>
      {error && <div className="alert">{error}</div>}
      <div className="people-list">
        {items.length === 0 ? (
          <p className="empty-copy">Todavía no agregaste participantes.</p>
        ) : (
          items.map((p) => (
            <div
              className={`person ${p.activo ? "" : "inactive"}`}
              key={p.idParticipante}
            >
              <span
                className="avatar"
                style={{ background: p.color ?? "#829c98" }}
              >
                {p.nombre[0].toUpperCase()}
              </span>
              <div>
                <strong>{p.nombre}</strong>
                <small>{p.activo ? "Participante activa" : "Inactiva"}</small>
              </div>
              <div className="person-actions">
                <button
                  className="text-button"
                  onClick={() => setSeleccionada(p)}
                >
                  Ver detalle
                </button>
                <button className="text-button" onClick={() => alternar(p)}>
                  {p.activo ? "Desactivar" : "Reactivar"}
                </button>
                <button
                  className="text-button danger"
                  onClick={() => eliminar(p)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function CotizacionForm({ viaje, inicial, onSave, onCancel }) {
  const [form, setForm] = useState(
    inicial
      ? { ...cotizacionVacia, ...inicial }
      : { ...cotizacionVacia, moneda: viaje.monedaPrincipal },
  );
  const [error, setError] = useState("");
  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  async function enviar(e) {
    e.preventDefault();
    if (form.vigenteHasta && form.vigenteHasta < form.fechaCotizacion) {
      setError(
        "La vigencia no puede terminar antes de la fecha de cotización.",
      );
      return;
    }
    try {
      await onSave({
        ...form,
        duracionNoches: form.duracionNoches
          ? Number(form.duracionNoches)
          : null,
        vigenteHasta: form.vigenteHasta || null,
      });
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <form className="quote-form" onSubmit={enviar}>
      <div className="form-grid">
        <label>
          Agencia
          <input
            required
            minLength="2"
            value={form.agencia}
            onChange={update("agencia")}
          />
        </label>
        <label>
          Estado
          <select value={form.estado} onChange={update("estado")}>
            <option value="BORRADOR">Borrador</option>
            <option value="COMPLETA">Completa</option>
            {inicial?.estado === "SELECCIONADA" && (
              <option value="SELECCIONADA">Seleccionada</option>
            )}
          </select>
        </label>
        <label>
          Naviera
          <input value={form.naviera ?? ""} onChange={update("naviera")} />
        </label>
        <label>
          Barco
          <input value={form.barco ?? ""} onChange={update("barco")} />
        </label>
        <label>
          Fecha de cotización
          <input
            required
            type="date"
            value={form.fechaCotizacion}
            onChange={update("fechaCotizacion")}
          />
        </label>
        <label>
          Vigente hasta
          <input
            type="date"
            value={form.vigenteHasta ?? ""}
            onChange={update("vigenteHasta")}
          />
        </label>
        <label>
          Noches
          <input
            type="number"
            min="1"
            value={form.duracionNoches ?? ""}
            onChange={update("duracionNoches")}
          />
        </label>
        <label>
          Moneda
          <select value={form.moneda} onChange={update("moneda")}>
            <option>USD</option>
            <option>ARS</option>
            <option>BRL</option>
            <option>EUR</option>
          </select>
        </label>
        <label>
          Tipo de camarote
          <input
            value={form.tipoCamarote ?? ""}
            onChange={update("tipoCamarote")}
          />
        </label>
        <label>
          Distribución
          <input
            value={form.distribucion ?? ""}
            onChange={update("distribucion")}
            placeholder="2 dobles, cubierta 8…"
          />
        </label>
        <label className="span-2">
          Referencia o enlace
          <input
            value={form.referencia ?? ""}
            onChange={update("referencia")}
          />
        </label>
        <label className="span-2">
          Itinerario
          <textarea
            rows="2"
            value={form.itinerario ?? ""}
            onChange={update("itinerario")}
          />
        </label>
      </div>
      {error && <div className="alert">{error}</div>}
      <div className="actions">
        <button type="button" className="button ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button className="button primary">Guardar cotización</button>
      </div>
    </form>
  );
}

function ConceptoForm({
  cotizacion,
  participantes,
  inicial,
  onSave,
  onCancel,
}) {
  const [form, setForm] = useState({
    ...conceptoVacio,
    moneda: cotizacion.moneda,
    ...inicial,
    obligatorio: inicial
      ? Boolean(inicial.obligatorio)
      : conceptoVacio.obligatorio,
    opcionalSeleccionado: inicial
      ? Boolean(inicial.opcionalSeleccionado)
      : conceptoVacio.opcionalSeleccionado,
    incluido: inicial ? Boolean(inicial.incluido) : conceptoVacio.incluido,
    aplicaTodos: inicial
      ? Boolean(inicial.aplicaTodos)
      : conceptoVacio.aplicaTodos,
  });
  const [error, setError] = useState("");
  const update = (k) => (e) =>
    setForm({
      ...form,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    });
  function toggle(id) {
    setForm({
      ...form,
      participanteIds: form.participanteIds.includes(id)
        ? form.participanteIds.filter((x) => x !== id)
        : [...form.participanteIds, id],
    });
  }
  async function enviar(e) {
    e.preventDefault();
    try {
      await onSave({
        ...form,
        importe: Number(form.importe),
        cantidad: Number(form.cantidad),
      });
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <form className="concept-form" onSubmit={enviar}>
      <div className="form-grid">
        <label>
          Categoría
          <select value={form.categoria} onChange={update("categoria")}>
            <option>Tarifa base</option>
            <option>Tasas</option>
            <option>Impuestos</option>
            <option>Propinas</option>
            <option>Plan de bebidas</option>
            <option>Seguro</option>
            <option>Traslado</option>
            <option>Otro</option>
          </select>
        </label>
        <label>
          Descripción
          <input
            required
            minLength="2"
            value={form.descripcion}
            onChange={update("descripcion")}
          />
        </label>
        <label>
          Importe
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.importe}
            onChange={update("importe")}
          />
        </label>
        <label>
          Moneda
          <select value={form.moneda} onChange={update("moneda")}>
            <option>USD</option>
            <option>ARS</option>
            <option>BRL</option>
            <option>EUR</option>
          </select>
        </label>
        <label>
          Modalidad
          <select value={form.modalidad} onChange={update("modalidad")}>
            {Object.entries(modalidadTexto).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cantidad
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.cantidad}
            onChange={update("cantidad")}
          />
        </label>
      </div>
      <div className="check-row">
        <label>
          <input
            type="checkbox"
            checked={form.obligatorio}
            onChange={update("obligatorio")}
          />{" "}
          Obligatorio
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.incluido}
            onChange={update("incluido")}
          />{" "}
          Ya incluido en el precio
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.opcionalSeleccionado}
            onChange={update("opcionalSeleccionado")}
          />{" "}
          Incluir en comparación
        </label>
      </div>
      <label className="inline-check">
        <input
          type="checkbox"
          checked={form.aplicaTodos}
          onChange={update("aplicaTodos")}
        />{" "}
        Aplicar a todas las participantes
      </label>
      {!form.aplicaTodos && (
        <div className="participant-checks">
          {participantes
            .filter((p) => p.activo)
            .map((p) => (
              <label key={p.idParticipante}>
                <input
                  type="checkbox"
                  checked={form.participanteIds.includes(p.idParticipante)}
                  onChange={() => toggle(p.idParticipante)}
                />
                {p.nombre}
              </label>
            ))}
        </div>
      )}
      {error && <div className="alert">{error}</div>}
      <div className="actions">
        <button type="button" className="button ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button className="button secondary">
          {inicial ? "Guardar cambios" : "Agregar concepto"}
        </button>
      </div>
    </form>
  );
}

function Comparador({ viaje, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [cambio, setCambio] = useState({
    monedaOrigen: "ARS",
    tasa: "",
    fecha: new Date().toISOString().slice(0, 10),
  });
  async function cargar() {
    try {
      setData(await api(`/viajes/${viaje.idViaje}/cotizaciones/comparacion`));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    cargar();
  }, []);
  async function guardarCambio(e) {
    e.preventDefault();
    try {
      await api(`/viajes/${viaje.idViaje}/cotizaciones/tipos-cambio`, {
        method: "POST",
        body: JSON.stringify({ ...cambio, tasa: Number(cambio.tasa) }),
      });
      setCambio({ ...cambio, tasa: "" });
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }
  async function confirmar(c) {
    if (
      !confirm(
        `¿Confirmar la cotización de “${c.agencia}”? Se creará una nueva versión del presupuesto.`,
      )
    )
      return;
    try {
      await api(`/viajes/${viaje.idViaje}/presupuesto/confirmar`, {
        method: "POST",
        body: JSON.stringify({ idCotizacion: c.idCotizacion }),
      });
      await cargar();
      alert(
        "Presupuesto confirmado. Ya podés abrir la pestaña Presupuesto y planes.",
      );
    } catch (err) {
      setError(err.message);
    }
  }
  const dinero = (n, m) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: m,
      maximumFractionDigits: 2,
    }).format(n || 0);
  return (
    <div>
      <div className="subheading">
        <button className="back" onClick={onBack}>
          ← Cotizaciones
        </button>
        <div>
          <p className="eyebrow">Vista homogénea</p>
          <h2>Comparador</h2>
        </div>
      </div>
      <form className="exchange-form" onSubmit={guardarCambio}>
        <strong>Tipo de cambio hacia {viaje.monedaPrincipal}</strong>
        <select
          value={cambio.monedaOrigen}
          onChange={(e) =>
            setCambio({ ...cambio, monedaOrigen: e.target.value })
          }
        >
          <option>ARS</option>
          <option>USD</option>
          <option>BRL</option>
          <option>EUR</option>
        </select>
        <input
          required
          type="number"
          min="0.000001"
          step="0.000001"
          placeholder={`1 ${cambio.monedaOrigen} = … ${viaje.monedaPrincipal}`}
          value={cambio.tasa}
          onChange={(e) => setCambio({ ...cambio, tasa: e.target.value })}
        />
        <input
          type="date"
          value={cambio.fecha}
          onChange={(e) => setCambio({ ...cambio, fecha: e.target.value })}
        />
        <button className="button secondary">Guardar</button>
      </form>
      {error && <div className="alert">{error}</div>}
      {!data ? (
        <p>Cargando…</p>
      ) : data.cotizaciones.length < 2 ? (
        <div className="empty-copy">
          Necesitás al menos dos cotizaciones para comparar.
        </div>
      ) : (
        <div className="comparison-grid">
          {data.cotizaciones.map((c) => (
            <article className="comparison-card" key={c.idCotizacion}>
              <div className="card-top">
                <span className="status">{c.estado}</span>
                {c.incompleta && (
                  <span className="warning">Falta tipo de cambio</span>
                )}
              </div>
              <h3>{c.agencia}</h3>
              <p>
                {c.naviera || "Naviera por definir"} ·{" "}
                {c.tipoCamarote || "Camarote por definir"}
              </p>
              <div className="grand-total">
                <small>Total estimado</small>
                <strong>
                  {c.incompleta
                    ? "—"
                    : dinero(c.totalPrincipal, data.monedaPrincipal)}
                </strong>
              </div>
              <div className="original-totals">
                {Object.entries(c.totalesPorMoneda).map(([m, n]) => (
                  <span key={m}>{dinero(n, m)}</span>
                ))}
              </div>
              <h4>Por participante</h4>
              {data.participantes.map((p) => (
                <div className="participant-total" key={p.idParticipante}>
                  <span>{p.nombre}</span>
                  <strong>
                    {dinero(
                      c.porParticipante[p.idParticipante],
                      data.monedaPrincipal,
                    )}
                  </strong>
                </div>
              ))}
              <details>
                <summary>Ver {c.conceptos.length} conceptos</summary>
                {c.conceptos.map((x) => (
                  <div className="concept-mini" key={x.idConcepto}>
                    <span>{x.descripcion}</span>
                    <span>{dinero(x.total, x.moneda)}</span>
                  </div>
                ))}
              </details>
              <button
                className="button primary wide confirm-quote"
                disabled={c.incompleta}
                onClick={() => confirmar(c)}
              >
                {c.estado === "SELECCIONADA"
                  ? "Crear nueva versión"
                  : "Seleccionar cotización"}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Cotizaciones({ viaje }) {
  const [items, setItems] = useState([]);
  const [vista, setVista] = useState("lista");
  const [seleccionada, setSeleccionada] = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [conceptForm, setConceptForm] = useState(false);
  const [editandoCotizacion, setEditandoCotizacion] = useState(null);
  const [editandoConcepto, setEditandoConcepto] = useState(null);
  const [error, setError] = useState("");
  async function cargar() {
    try {
      const [c, p] = await Promise.all([
        api(`/viajes/${viaje.idViaje}/cotizaciones`),
        api(`/viajes/${viaje.idViaje}/participantes`),
      ]);
      setItems(c);
      setParticipantes(p);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    cargar();
  }, [viaje.idViaje]);
  async function abrir(id) {
    try {
      setSeleccionada(await api(`/viajes/${viaje.idViaje}/cotizaciones/${id}`));
      setVista("detalle");
    } catch (e) {
      setError(e.message);
    }
  }
  async function guardar(data) {
    const url = editandoCotizacion
      ? `/viajes/${viaje.idViaje}/cotizaciones/${editandoCotizacion.idCotizacion}`
      : `/viajes/${viaje.idViaje}/cotizaciones`;
    const c = await api(url, {
      method: editandoCotizacion ? "PUT" : "POST",
      body: JSON.stringify(data),
    });
    setEditandoCotizacion(null);
    if (c.pendienteSincronizar) {
      setVista("lista");
      return;
    }
    await cargar();
    await abrir(c.idCotizacion);
  }
  async function agregarConcepto(data) {
    const url = editandoConcepto
      ? `/viajes/${viaje.idViaje}/cotizaciones/${seleccionada.idCotizacion}/conceptos/${editandoConcepto.idConcepto}`
      : `/viajes/${viaje.idViaje}/cotizaciones/${seleccionada.idCotizacion}/conceptos`;
    await api(url, {
      method: editandoConcepto ? "PUT" : "POST",
      body: JSON.stringify(data),
    });
    setConceptForm(false);
    setEditandoConcepto(null);
    await abrir(seleccionada.idCotizacion);
  }
  async function duplicar(id) {
    await api(`/viajes/${viaje.idViaje}/cotizaciones/${id}/duplicar`, {
      method: "POST",
    });
    await cargar();
  }
  async function eliminarConcepto(id) {
    if (!confirm("¿Eliminar este concepto?")) return;
    await api(
      `/viajes/${viaje.idViaje}/cotizaciones/${seleccionada.idCotizacion}/conceptos/${id}`,
      { method: "DELETE" },
    );
    await abrir(seleccionada.idCotizacion);
  }
  if (vista === "comparar")
    return (
      <section className="panel quotes-panel">
        <Comparador viaje={viaje} onBack={() => setVista("lista")} />
      </section>
    );
  if (vista === "form")
    return (
      <section className="panel quotes-panel">
        <CotizacionForm
          key={editandoCotizacion?.idCotizacion ?? "nueva"}
          viaje={viaje}
          inicial={editandoCotizacion}
          onSave={guardar}
          onCancel={() => {
            const volverAlDetalle = Boolean(editandoCotizacion);
            setEditandoCotizacion(null);
            setVista(volverAlDetalle ? "detalle" : "lista");
          }}
        />
      </section>
    );
  if (vista === "detalle" && seleccionada)
    return (
      <section className="panel quotes-panel">
        <button
          className="back"
          onClick={() => {
            setVista("lista");
            cargar();
          }}
        >
          ← Cotizaciones
        </button>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{seleccionada.estado}</p>
            <h2>{seleccionada.agencia}</h2>
            <p>
              {seleccionada.naviera || "Naviera por definir"} ·{" "}
              {seleccionada.barco || "Barco por definir"} ·{" "}
              {seleccionada.moneda}
            </p>
          </div>
          <div className="heading-actions">
            <button
              className="button ghost"
              onClick={() => {
                setEditandoCotizacion(seleccionada);
                setVista("form");
              }}
            >
              Editar cotización
            </button>
            <button
              className="button secondary"
              onClick={() => {
                setEditandoConcepto(null);
                setConceptForm(true);
              }}
            >
              ＋ Concepto
            </button>
          </div>
        </div>
        {conceptForm && (
          <ConceptoForm
            key={editandoConcepto?.idConcepto ?? "nuevo"}
            cotizacion={seleccionada}
            participantes={participantes}
            inicial={editandoConcepto}
            onSave={agregarConcepto}
            onCancel={() => {
              setConceptForm(false);
              setEditandoConcepto(null);
            }}
          />
        )}
        <div className="concept-list">
          {seleccionada.conceptos.length === 0 ? (
            <p className="empty-copy">
              Desglosá la tarifa base, tasas, impuestos y opcionales.
            </p>
          ) : (
            seleccionada.conceptos.map((c) => (
              <div className="concept-row" key={c.idConcepto}>
                <div>
                  <strong>{c.descripcion}</strong>
                  <small>
                    {c.categoria} · {modalidadTexto[c.modalidad]} ·{" "}
                    {c.aplicaTodos
                      ? "Todas"
                      : `${c.participanteIds.length} participantes`}
                  </small>
                </div>
                <span>
                  {new Intl.NumberFormat("es-AR", {
                    style: "currency",
                    currency: c.moneda,
                  }).format(c.importe)}
                </span>
                <button
                  className="text-button"
                  onClick={() => {
                    setEditandoConcepto(c);
                    setConceptForm(true);
                  }}
                >
                  Editar
                </button>
                <button
                  className="text-button danger"
                  onClick={() => eliminarConcepto(c.idConcepto)}
                >
                  Eliminar
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    );
  return (
    <section className="panel quotes-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Decisión del viaje</p>
          <h2>Cotizaciones</h2>
        </div>
        <div className="heading-actions">
          <button
            className="button ghost"
            disabled={items.length < 2}
            onClick={() => setVista("comparar")}
          >
            Comparar
          </button>
          <button
            className="button secondary"
            onClick={() => {
              setEditandoCotizacion(null);
              setVista("form");
            }}
          >
            ＋ Nueva
          </button>
        </div>
      </div>
      {error && <div className="alert">{error}</div>}
      {items.length === 0 ? (
        <p className="empty-copy">
          Cargá al menos dos alternativas para comparar el costo real.
        </p>
      ) : (
        <div className="quote-list">
          {items.map((c) => (
            <article className="quote-card" key={c.idCotizacion}>
              <button onClick={() => abrir(c.idCotizacion)}>
                <span className="status">{c.estado}</span>
                <h3>{c.agencia}</h3>
                <p>
                  {c.naviera || "Sin naviera"} ·{" "}
                  {c.tipoCamarote || "Camarote por definir"}
                </p>
                <small>
                  {c.cantidadConceptos} conceptos · {c.moneda}
                </small>
              </button>
              <button
                className="text-button"
                onClick={() => duplicar(c.idCotizacion)}
              >
                Duplicar
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Presupuesto({ viaje, onGoQuotes }) {
  const [data, setData] = useState(null),
    [participantes, setParticipantes] = useState([]),
    [error, setError] = useState(""),
    [modo, setModo] = useState("conceptos"),
    [form, setForm] = useState(null),
    [editandoConcepto, setEditandoConcepto] = useState(null),
    [editandoExcursion, setEditandoExcursion] = useState(null),
    [editandoCuota, setEditandoCuota] = useState(null);
  async function cargar() {
    try {
      const [p, b] = await Promise.all([
        api(`/viajes/${viaje.idViaje}/participantes`),
        api(`/viajes/${viaje.idViaje}/presupuesto`),
      ]);
      setParticipantes(p);
      setData(b);
      setError("");
    } catch (e) {
      setError(e.message);
      setData(null);
    }
  }
  useEffect(() => {
    cargar();
  }, [viaje.idViaje]);
  const money = (n, m) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: m }).format(
      n,
    );
  const totales = useMemo(() => {
    if (!data) return {};
    const r = {};
    for (const c of data.conceptos) {
      if (c.estado === "CANCELADO" || c.incluido) continue;
      const personas = c.aplicaTodos
        ? participantes.filter((p) => p.activo).length
        : c.participanteIds.length;
      const noches = Math.max(
        1,
        Math.round(
          (new Date(viaje.fechaRegreso) - new Date(viaje.fechaSalida)) /
            86400000,
        ),
      );
      const f = {
        TOTAL: c.cantidad,
        POR_PERSONA: personas * c.cantidad,
        POR_CAMAROTE: c.cantidad,
        POR_NOCHE: noches * c.cantidad,
        POR_PERSONA_NOCHE: personas * noches * c.cantidad,
      }[c.modalidad];
      r[c.moneda] = (r[c.moneda] || 0) + Number(c.importe) * f;
    }
    for (const e of data.excursiones)
      if (e.estado === "ELEGIDA")
        r[e.moneda] =
          (r[e.moneda] || 0) + Number(e.importe) * e.participanteIds.length;
    return r;
  }, [data, participantes]);
  async function addConcepto(d) {
    const url = editandoConcepto
      ? `/viajes/${viaje.idViaje}/presupuesto/conceptos/${editandoConcepto.idConceptoPresupuesto}`
      : `/viajes/${viaje.idViaje}/presupuesto/conceptos`;
    await api(url, {
      method: editandoConcepto ? "PUT" : "POST",
      body: JSON.stringify(d),
    });
    setForm(null);
    setEditandoConcepto(null);
    await cargar();
  }
  async function addExcursion(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const url = editandoExcursion
      ? `/viajes/${viaje.idViaje}/presupuesto/excursiones/${editandoExcursion.idExcursion}`
      : `/viajes/${viaje.idViaje}/presupuesto/excursiones`;
    await api(url, {
      method: editandoExcursion ? "PUT" : "POST",
      body: JSON.stringify({
        puerto: fd.get("puerto"),
        fecha: fd.get("fecha") || null,
        hora: fd.get("hora") || null,
        proveedor: fd.get("proveedor") || null,
        duracion: fd.get("duracion") || null,
        descripcion: fd.get("descripcion"),
        importe: Number(fd.get("importe")),
        moneda: fd.get("moneda"),
        estado: fd.get("estado"),
        referencia: editandoExcursion?.referencia ?? null,
        politicaCancelacion: editandoExcursion?.politicaCancelacion ?? null,
        participanteIds: fd.getAll("participantes").map(Number),
      }),
    });
    setForm(null);
    setEditandoExcursion(null);
    await cargar();
  }
  async function addCuota(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const url = editandoCuota
      ? `/viajes/${viaje.idViaje}/presupuesto/cuotas/${editandoCuota.idCuota}`
      : `/viajes/${viaje.idViaje}/presupuesto/cuotas`;
    await api(url, {
      method: editandoCuota ? "PUT" : "POST",
      body: JSON.stringify({
        idConceptoPresupuesto: editandoCuota?.idConceptoPresupuesto ?? null,
        descripcion: fd.get("descripcion"),
        importe: Number(fd.get("importe")),
        moneda: fd.get("moneda"),
        fechaVencimiento: fd.get("fechaVencimiento"),
        estado: editandoCuota?.estado ?? "PENDIENTE",
      }),
    });
    setForm(null);
    setEditandoCuota(null);
    await cargar();
  }
  async function estadoCuota(c, estado) {
    await api(`/viajes/${viaje.idViaje}/presupuesto/cuotas/${c.idCuota}`, {
      method: "PATCH",
      body: JSON.stringify({ estado }),
    });
    await cargar();
  }
  async function addPago(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget),
      decimal = (v) =>
        Number(
          String(v ?? "")
            .trim()
            .replace(",", "."),
        ),
      importe = decimal(fd.get("importe"));
    const aportes = participantes
      .map((p) => ({
        idParticipante: p.idParticipante,
        importe: decimal(fd.get(`aporte-${p.idParticipante}`) || 0),
      }))
      .filter((x) => x.importe > 0);
    const beneficiarios = participantes
      .map((p) => ({
        idParticipante: p.idParticipante,
        importe: decimal(fd.get(`beneficio-${p.idParticipante}`) || 0),
      }))
      .filter((x) => x.importe > 0);
    const aplicaciones = [
      ...data.cuotas.map((c) => ({
        idCuota: c.idCuota,
        importe: decimal(fd.get(`aplicacion-cuota-${c.idCuota}`) || 0),
      })),
      ...data.conceptos
        .filter((c) => !Number(c.cantidadCuotas))
        .map((c) => ({
          idConceptoPresupuesto: c.idConceptoPresupuesto,
          importe: decimal(
            fd.get(`aplicacion-concepto-${c.idConceptoPresupuesto}`) || 0,
          ),
        })),
    ].filter((x) => x.importe > 0);
    try {
      await api(`/viajes/${viaje.idViaje}/presupuesto/pagos`, {
        method: "POST",
        body: JSON.stringify({
          fecha: fd.get("fecha"),
          importe,
          moneda: fd.get("moneda"),
          medio: fd.get("medio") || null,
          tipoCambio: fd.get("tipoCambio")
            ? decimal(fd.get("tipoCambio"))
            : null,
          observaciones: fd.get("observaciones") || null,
          aportes,
          beneficiarios,
          aplicaciones,
        }),
      });
      setForm(null);
      setError("");
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }
  async function eliminarPago(p) {
    if (
      !confirm(
        "¿Revertir este pago? Quedará en el historial y se recalcularán cuotas y balances.",
      )
    )
      return;
    await api(`/viajes/${viaje.idViaje}/presupuesto/pagos/${p.idPago}`, {
      method: "DELETE",
    });
    await cargar();
  }
  if (!data)
    return (
      <section className="panel budget-empty">
        <p className="eyebrow">Entrega 3</p>
        <h2>Presupuesto y planes</h2>
        <p>{error || "Todavía no confirmaste una alternativa."}</p>
        <button className="button primary" onClick={onGoQuotes}>
          Ir a comparar cotizaciones
        </button>
      </section>
    );
  return (
    <section className="panel budget-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            Versión {data.version} · {data.estado}
          </p>
          <h2>{data.nombre}</h2>
          <p className="empty-copy">
            La cotización original quedó preservada. Los cambios nuevos se
            guardan como ajustes.
          </p>
        </div>
        <div className="budget-totals">
          {Object.entries(totales).map(([m, n]) => (
            <div key={m}>
              <small>Total {m}</small>
              <strong>{money(n, m)}</strong>
            </div>
          ))}
        </div>
      </div>
      <nav className="inner-nav">
        <button
          className={modo === "conceptos" ? "active" : ""}
          onClick={() => {
            setModo("conceptos");
            setForm(null);
          }}
        >
          Conceptos y planes
        </button>
        <button
          className={modo === "excursiones" ? "active" : ""}
          onClick={() => {
            setModo("excursiones");
            setForm(null);
          }}
        >
          Excursiones
        </button>
        <button
          className={modo === "cuotas" ? "active" : ""}
          onClick={() => {
            setModo("cuotas");
            setForm(null);
          }}
        >
          Cuotas y vencimientos
        </button>
        <button
          className={modo === "pagos" ? "active" : ""}
          onClick={() => {
            setModo("pagos");
            setForm(null);
          }}
        >
          Pagos
        </button>
      </nav>
      {modo === "conceptos" && (
        <div>
          <div className="section-actions">
            <h3>Conceptos confirmados</h3>
            <button
              className="button secondary"
              onClick={() => {
                setEditandoConcepto(null);
                setForm("concepto");
              }}
            >
              ＋ Plan o ajuste
            </button>
          </div>
          {form === "concepto" && (
            <ConceptoForm
              key={editandoConcepto?.idConceptoPresupuesto ?? "nuevo"}
              cotizacion={{ moneda: viaje.monedaPrincipal }}
              participantes={participantes}
              inicial={editandoConcepto}
              onSave={addConcepto}
              onCancel={() => {
                setForm(null);
                setEditandoConcepto(null);
              }}
            />
          )}
          <div className="concept-list">
            {data.conceptos.map((c) => (
              <div className="concept-row" key={c.idConceptoPresupuesto}>
                <div>
                  <strong>{c.descripcion}</strong>
                  <small>
                    {c.categoria} · {modalidadTexto[c.modalidad]}{" "}
                    {c.esAjuste ? "· Ajuste" : ""}
                  </small>
                  <small className="paid-progress">
                    Pagado: {money(c.pagado, c.moneda)}
                    {Number(c.cantidadCuotas) > 0
                      ? ` mediante ${c.cantidadCuotas} cuota(s)`
                      : " directamente"}
                  </small>
                </div>
                <span>{money(c.importe, c.moneda)}</span>
                <span className="status">{c.estado}</span>
                <button
                  className="text-button"
                  onClick={() => {
                    setEditandoConcepto(c);
                    setForm("concepto");
                  }}
                >
                  Editar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {modo === "excursiones" && (
        <div>
          <div className="section-actions">
            <h3>Alternativas por puerto</h3>
            <button
              className="button secondary"
              onClick={() => {
                setEditandoExcursion(null);
                setForm("excursion");
              }}
            >
              ＋ Excursión
            </button>
          </div>
          {form === "excursion" && (
            <form
              key={editandoExcursion?.idExcursion ?? "nueva"}
              className="concept-form"
              onSubmit={addExcursion}
            >
              <div className="form-grid">
                <label>
                  Puerto
                  <input
                    required
                    name="puerto"
                    defaultValue={editandoExcursion?.puerto ?? ""}
                  />
                </label>
                <label>
                  Descripción
                  <input
                    required
                    name="descripcion"
                    defaultValue={editandoExcursion?.descripcion ?? ""}
                  />
                </label>
                <label>
                  Fecha
                  <input
                    name="fecha"
                    type="date"
                    defaultValue={editandoExcursion?.fecha ?? ""}
                  />
                </label>
                <label>
                  Hora
                  <input
                    name="hora"
                    type="time"
                    defaultValue={editandoExcursion?.hora ?? ""}
                  />
                </label>
                <label>
                  Proveedor
                  <input
                    name="proveedor"
                    defaultValue={editandoExcursion?.proveedor ?? ""}
                  />
                </label>
                <label>
                  Duración
                  <input
                    name="duracion"
                    placeholder="4 horas"
                    defaultValue={editandoExcursion?.duracion ?? ""}
                  />
                </label>
                <label>
                  Precio por persona
                  <input
                    required
                    name="importe"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={editandoExcursion?.importe ?? ""}
                  />
                </label>
                <label>
                  Moneda
                  <select
                    name="moneda"
                    defaultValue={
                      editandoExcursion?.moneda ?? viaje.monedaPrincipal
                    }
                  >
                    <option>USD</option>
                    <option>ARS</option>
                    <option>BRL</option>
                    <option>EUR</option>
                  </select>
                </label>
                <label>
                  Estado
                  <select
                    name="estado"
                    defaultValue={editandoExcursion?.estado ?? "ALTERNATIVA"}
                  >
                    <option>ALTERNATIVA</option>
                    <option>ELEGIDA</option>
                    <option>CANCELADA</option>
                  </select>
                </label>
              </div>
              <div className="participant-checks">
                {participantes
                  .filter((p) => p.activo)
                  .map((p) => (
                    <label key={p.idParticipante}>
                      <input
                        name="participantes"
                        type="checkbox"
                        value={p.idParticipante}
                        defaultChecked={editandoExcursion?.participanteIds.includes(
                          p.idParticipante,
                        )}
                      />
                      {p.nombre}
                    </label>
                  ))}
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => {
                    setForm(null);
                    setEditandoExcursion(null);
                  }}
                >
                  Cancelar
                </button>
                <button className="button secondary">
                  {editandoExcursion ? "Guardar cambios" : "Guardar excursión"}
                </button>
              </div>
            </form>
          )}
          <div className="quote-list">
            {data.excursiones.map((e) => (
              <article
                className="quote-card excursion-card"
                key={e.idExcursion}
              >
                <div>
                  <span className="status">{e.estado}</span>
                  <h3>{e.descripcion}</h3>
                  <p>
                    {e.puerto} {e.fecha ? `· ${e.fecha}` : ""}{" "}
                    {e.hora ? `· ${e.hora}` : ""}
                  </p>
                  <strong>{money(e.importe, e.moneda)} por persona</strong>
                  <small>{e.participanteIds.length} participantes</small>
                </div>
                <button
                  className="text-button"
                  onClick={() => {
                    setEditandoExcursion(e);
                    setForm("excursion");
                  }}
                >
                  Editar
                </button>
              </article>
            ))}
          </div>
          {data.excursiones.length === 0 && (
            <p className="empty-copy">Todavía no cargaste excursiones.</p>
          )}
        </div>
      )}
      {modo === "cuotas" && (
        <div>
          <div className="section-actions">
            <h3>Próximos compromisos</h3>
            <button
              className="button secondary"
              onClick={() => {
                setEditandoCuota(null);
                setForm("cuota");
              }}
            >
              ＋ Cuota
            </button>
          </div>
          {form === "cuota" && (
            <form
              key={editandoCuota?.idCuota ?? "nueva"}
              className="concept-form"
              onSubmit={addCuota}
            >
              <div className="form-grid">
                <label>
                  Descripción
                  <input
                    required
                    name="descripcion"
                    placeholder="Seña agencia"
                    defaultValue={editandoCuota?.descripcion ?? ""}
                  />
                </label>
                <label>
                  Importe
                  <input
                    required
                    name="importe"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={editandoCuota?.importe ?? ""}
                  />
                </label>
                <label>
                  Moneda
                  <select
                    name="moneda"
                    defaultValue={
                      editandoCuota?.moneda ?? viaje.monedaPrincipal
                    }
                  >
                    <option>USD</option>
                    <option>ARS</option>
                    <option>BRL</option>
                    <option>EUR</option>
                  </select>
                </label>
                <label>
                  Vencimiento
                  <input
                    required
                    name="fechaVencimiento"
                    type="date"
                    defaultValue={editandoCuota?.fechaVencimiento ?? ""}
                  />
                </label>
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => {
                    setForm(null);
                    setEditandoCuota(null);
                  }}
                >
                  Cancelar
                </button>
                <button className="button secondary">
                  {editandoCuota ? "Guardar cambios" : "Guardar cuota"}
                </button>
              </div>
            </form>
          )}
          <div className="due-list">
            {data.cuotas.map((c) => (
              <div className="due-row" key={c.idCuota}>
                <div>
                  <strong>{c.descripcion}</strong>
                  <small>Vence {c.fechaVencimiento}</small>
                  <small className="paid-progress">
                    Pagado {money(c.pagado, c.moneda)} · Pendiente{" "}
                    {money(c.pendiente, c.moneda)}
                  </small>
                </div>
                <strong>{money(c.importe, c.moneda)}</strong>
                <select
                  value={c.estado}
                  onChange={(e) => estadoCuota(c, e.target.value)}
                >
                  <option>PENDIENTE</option>
                  <option>PAGADA</option>
                  <option>CANCELADA</option>
                </select>
                <button
                  className="text-button"
                  onClick={() => {
                    setEditandoCuota(c);
                    setForm("cuota");
                  }}
                >
                  Editar
                </button>
              </div>
            ))}
          </div>
          {data.cuotas.length === 0 && (
            <p className="empty-copy">Todavía no hay cuotas ni vencimientos.</p>
          )}
        </div>
      )}
      {modo === "pagos" && (
        <div>
          <div className="section-actions">
            <div>
              <h3>Pagos realizados</h3>
              <p className="empty-copy">
                Registrá quién aportó y a quién correspondía el pago.
              </p>
            </div>
            <button
              className="button secondary"
              disabled={!data.cuotas.length && !data.conceptos.length}
              onClick={() => setForm("pago")}
            >
              ＋ Registrar pago
            </button>
          </div>
          {error && <div className="alert">{error}</div>}
          {form === "pago" && (
            <form className="concept-form payment-form" onSubmit={addPago}>
              <div className="form-grid">
                <label>
                  Fecha
                  <input
                    required
                    name="fecha"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </label>
                <label>
                  Importe total
                  <input
                    required
                    name="importe"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]+([.,][0-9]{1,2})?"
                    placeholder="0,00"
                  />
                </label>
                <label>
                  Moneda
                  <select name="moneda" defaultValue={viaje.monedaPrincipal}>
                    <option>USD</option>
                    <option>ARS</option>
                    <option>BRL</option>
                    <option>EUR</option>
                  </select>
                </label>
                <label>
                  Medio de pago
                  <input name="medio" placeholder="Transferencia, tarjeta…" />
                </label>
                <label>
                  Tipo de cambio usado
                  <input
                    name="tipoCambio"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]+([.,][0-9]+)?"
                    placeholder="Opcional"
                  />
                </label>
                <label className="span-2">
                  Observaciones
                  <textarea name="observaciones" rows="2" />
                </label>
              </div>
              <section className="payment-destinations">
                <h4>¿A qué conceptos o cuotas se aplica?</h4>
                <p>
                  Podés repartir el importe entre varios destinos. La suma debe
                  coincidir con el pago.
                </p>
                {data.conceptos.map((concepto) => {
                  const cuotas = data.cuotas.filter(
                    (cuota) =>
                      cuota.idConceptoPresupuesto ===
                      concepto.idConceptoPresupuesto,
                  );
                  return (
                    <div
                      className="destination-group"
                      key={concepto.idConceptoPresupuesto}
                    >
                      <strong>{concepto.descripcion}</strong>
                      {cuotas.length ? (
                        cuotas.map((cuota) => (
                          <label key={cuota.idCuota}>
                            <span>
                              Cuota: {cuota.descripcion}
                              <small>
                                Pendiente {money(cuota.pendiente, cuota.moneda)}
                              </small>
                            </span>
                            <input
                              name={`aplicacion-cuota-${cuota.idCuota}`}
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9]*([.,][0-9]{1,2})?"
                              placeholder="0,00"
                            />
                          </label>
                        ))
                      ) : (
                        <label>
                          <span>Pago directo al concepto</span>
                          <input
                            name={`aplicacion-concepto-${concepto.idConceptoPresupuesto}`}
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*([.,][0-9]{1,2})?"
                            placeholder="0,00"
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </section>
              <div className="money-split">
                <section>
                  <h4>¿Quién pagó?</h4>
                  <p>La suma debe coincidir con el total.</p>
                  {participantes
                    .filter((p) => p.activo)
                    .map((p) => (
                      <label key={p.idParticipante}>
                        <span>{p.nombre}</span>
                        <input
                          name={`aporte-${p.idParticipante}`}
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]*([.,][0-9]{1,2})?"
                          placeholder="0,00"
                        />
                      </label>
                    ))}
                </section>
                <section>
                  <h4>¿A quién correspondía?</h4>
                  <p>Indicá cuánto le corresponde a cada una.</p>
                  {participantes.map((p) => (
                    <label key={p.idParticipante}>
                      <span>{p.nombre}</span>
                      <input
                        name={`beneficio-${p.idParticipante}`}
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*([.,][0-9]{1,2})?"
                        placeholder="0,00"
                      />
                    </label>
                  ))}
                </section>
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setForm(null)}
                >
                  Cancelar
                </button>
                <button className="button primary">Guardar pago</button>
              </div>
            </form>
          )}
          <div className="payments-list">
            {(data.pagos || []).map((p) => (
              <article className="payment-row" key={p.idPago}>
                <div className="payment-amount">
                  <strong>{money(p.importe, p.moneda)}</strong>
                  <small>
                    {p.fecha} · {p.medio || "Sin medio"}
                  </small>
                </div>
                <div>
                  <small>Pagaron</small>
                  <p>
                    {p.aportes
                      .map((a) => `${a.nombre} ${money(a.importe, p.moneda)}`)
                      .join(" · ")}
                  </p>
                </div>
                <div>
                  <small>Aplicado a</small>
                  <p>{p.aplicaciones.map((a) => a.destino).join(", ")}</p>
                </div>
                {p.estado === "REVERTIDO" ? (
                  <span className="status archivado">Revertido</span>
                ) : (
                  <button
                    className="text-button danger"
                    onClick={() => eliminarPago(p)}
                  >
                    Revertir pago
                  </button>
                )}
              </article>
            ))}
          </div>
          {!(data.pagos || []).length && (
            <p className="empty-copy">Todavía no registraste pagos.</p>
          )}
        </div>
      )}
    </section>
  );
}

function Monedas({ viaje, onBack }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({
    monedaOrigen: ["USD", "ARS", "BRL", "EUR"].find(
      (m) => m !== viaje.monedaPrincipal,
    ),
    tasa: "",
    fecha: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState("");
  async function cargar() {
    try {
      setData(await api(`/viajes/${viaje.idViaje}/cotizaciones/tipos-cambio`));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    cargar();
  }, [viaje.idViaje]);
  async function guardar(e) {
    e.preventDefault();
    try {
      await api(`/viajes/${viaje.idViaje}/cotizaciones/tipos-cambio`, {
        method: "POST",
        body: JSON.stringify({
          ...form,
          tasa: Number(form.tasa.replace(",", ".")),
        }),
      });
      setForm({ ...form, tasa: "" });
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }
  const monedas = ["USD", "ARS", "BRL", "EUR"].filter(
    (m) => m !== viaje.monedaPrincipal,
  );
  return (
    <section className="panel currencies-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Conversión informativa</p>
          <h2>Monedas</h2>
          <p className="empty-copy">
            La moneda principal del viaje es{" "}
            <strong>{viaje.monedaPrincipal}</strong>. Cada importe conserva
            siempre su moneda original.
          </p>
        </div>
        {onBack && (
          <button className="button ghost" onClick={onBack}>
            Volver a balances
          </button>
        )}
      </div>
      <form className="exchange-form currency-form" onSubmit={guardar}>
        <strong>Nuevo tipo de cambio</strong>
        <select
          value={form.monedaOrigen}
          onChange={(e) => setForm({ ...form, monedaOrigen: e.target.value })}
        >
          {monedas.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <label className="exchange-rate-label">
          <span>1 {form.monedaOrigen} =</span>
          <input
            required
            type="text"
            inputMode="decimal"
            pattern="[0-9]+([.,][0-9]+)?"
            value={form.tasa}
            onChange={(e) => setForm({ ...form, tasa: e.target.value })}
            placeholder={`cantidad en ${viaje.monedaPrincipal}`}
          />
          <span>{viaje.monedaPrincipal}</span>
        </label>
        <input
          type="date"
          value={form.fecha}
          onChange={(e) => setForm({ ...form, fecha: e.target.value })}
        />
        <button className="button secondary">Guardar</button>
      </form>
      {error && <div className="alert">{error}</div>}
      <div className="section-title">
        <h3>Historial de tipos de cambio</h3>
        <span>{data?.tiposCambio?.length || 0}</span>
      </div>
      <div className="rates-list">
        {data?.tiposCambio?.map((t) => (
          <div className="rate-row" key={t.idTipoCambio}>
            <strong>1 {t.monedaOrigen}</strong>
            <span>=</span>
            <strong>
              {Number(t.tasa).toLocaleString("es-AR", {
                maximumFractionDigits: 6,
              })}{" "}
              {t.monedaDestino}
            </strong>
            <small>{t.fecha}</small>
          </div>
        ))}
      </div>
      {data && !data.tiposCambio.length && (
        <p className="empty-copy">Todavía no cargaste tipos de cambio.</p>
      )}
    </section>
  );
}

function TransferenciaRow({ transferencia, money, onSave }) {
  const [estado, setEstado] = useState(transferencia.estado);
  const [guardando, setGuardando] = useState(false);
  const cambioPendiente = estado !== transferencia.estado;
  async function guardar() {
    setGuardando(true);
    try {
      await onSave(transferencia, estado);
    } finally {
      setGuardando(false);
    }
  }
  return (
    <div className="transfer-row">
      <span>
        {transferencia.origen} → {transferencia.destino}
      </span>
      <strong>{money(transferencia.importe, transferencia.moneda)}</strong>
      <select value={estado} onChange={(e) => setEstado(e.target.value)}>
        <option>PENDIENTE</option>
        <option>REALIZADA</option>
        <option>ANULADA</option>
      </select>
      <button
        className="button secondary"
        disabled={!cambioPendiente || guardando}
        onClick={guardar}
      >
        {guardando ? "Guardando…" : "Guardar cambio"}
      </button>
    </div>
  );
}

function VistaBalances({
  data,
  viaje,
  money,
  onRegister,
  onChange,
  onCurrencies,
}) {
  const [monedaVista, setMonedaVista] = useState(viaje.monedaPrincipal);
  const monedasBalance = [...new Set(data.balances.map((b) => b.moneda))];
  const monedasDisponibles = [
    ...new Set(
      [
        data.monedaPrincipal,
        ...monedasBalance,
        ...data.transferencias.map((t) => t.moneda),
        ...data.sugerencias.map((s) => s.moneda),
        ...(data.tiposCambio || []).flatMap((t) => [
          t.monedaOrigen,
          t.monedaDestino,
        ]),
      ].filter(Boolean),
    ),
  ];
  const tasa = (moneda) =>
    moneda === data.monedaPrincipal
      ? 1
      : Number(
          (data.tiposCambio || []).find(
            (t) =>
              t.monedaOrigen === moneda &&
              t.monedaDestino === data.monedaPrincipal,
          )?.tasa || 0,
        );
  const convertir = (importe, origen) =>
    origen === monedaVista
      ? Number(importe)
      : tasa(origen) && tasa(monedaVista)
        ? (Number(importe) * tasa(origen)) / tasa(monedaVista)
        : null;
  const importeVisible = (importe, origen) => {
    const valor = convertir(importe, origen);
    return origen === monedaVista
      ? money(importe, origen)
      : valor === null
        ? money(importe, origen)
        : `${money(importe, origen)} · ≈ ${money(valor, monedaVista)}`;
  };
  const pendientes = data.transferencias.filter(
    (t) => t.estado === "PENDIENTE",
  );
  const sugeridas = data.sugerencias.filter(
    (s) =>
      !pendientes.some(
        (t) =>
          t.idOrigen === s.idOrigen &&
          t.idDestino === s.idDestino &&
          t.moneda === s.moneda &&
          Math.abs(Number(t.importe) - Number(s.importe)) < 0.01,
      ),
  );
  const finalizadas = data.transferencias.filter(
    (t) => t.estado !== "PENDIENTE",
  );
  const movimientos = [...sugeridas, ...pendientes, ...finalizadas];
  const faltanCambios = movimientos.some(
    (m) => m.moneda !== monedaVista && convertir(m.importe, m.moneda) === null,
  );
  const saldado = !data.balances.some(
    (b) => Math.abs(Number(b.balance)) >= 0.01,
  );
  return (
    <section className="panel friendly-balances">
      <div className="friendly-header">
        <div>
          <p className="eyebrow">Liquidación del grupo</p>
          <h2>
            {saldado ? "El viaje está saldado" : "Transferencias por hacer"}
          </h2>
          <p>
            {saldado
              ? "No quedan deudas pendientes entre participantes."
              : "Estas son las transferencias necesarias para saldar las cuentas."}
          </p>
        </div>
        <label>
          Mostrar equivalencias en
          <select
            value={monedaVista}
            onChange={(e) => setMonedaVista(e.target.value)}
          >
            {monedasDisponibles.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>
      {faltanCambios && (
        <div className="exchange-warning">
          <div>
            <strong>Faltan tipos de cambio</strong>
            <p>Algunos importes sólo pueden mostrarse en su moneda original.</p>
          </div>
          <button className="button ghost" onClick={onCurrencies}>
            Cargar tipos de cambio
          </button>
        </div>
      )}
      <div className="todo-transfers">
        {sugeridas.map((s, i) => (
          <article className="action-transfer" key={`s-${s.moneda}-${i}`}>
            <span className="transfer-icon">→</span>
            <div>
              <small>Transferencia sugerida</small>
              <h3>
                {s.origen} le transfiere a {s.destino}
              </h3>
              <strong>{importeVisible(s.importe, s.moneda)}</strong>
            </div>
            <div className="action-buttons">
              <button
                className="button primary"
                onClick={() => onRegister(s, "REALIZADA")}
              >
                Ya se realizó
              </button>
              <button
                className="button ghost"
                onClick={() => onRegister(s, "PENDIENTE")}
              >
                Dejar pendiente
              </button>
            </div>
          </article>
        ))}
        {pendientes.map((t) => (
          <article className="action-transfer pending" key={t.idTransferencia}>
            <span className="transfer-icon">⌛</span>
            <div>
              <small>Pendiente</small>
              <h3>
                {t.origen} le transfiere a {t.destino}
              </h3>
              <strong>{importeVisible(t.importe, t.moneda)}</strong>
            </div>
            <div className="action-buttons">
              <button
                className="button primary"
                onClick={() => onChange(t, "REALIZADA")}
              >
                Marcar realizada
              </button>
              <button
                className="text-button danger"
                onClick={() => onChange(t, "ANULADA")}
              >
                Anular
              </button>
            </div>
          </article>
        ))}
        {!sugeridas.length && !pendientes.length && (
          <div className="all-set">
            <span>✓</span>
            <div>
              <strong>No hay transferencias por hacer</strong>
              <p>Todos los movimientos están conciliados.</p>
            </div>
          </div>
        )}
      </div>
      <details className="balance-details">
        <summary>Ver cómo se calculó el balance</summary>
        {monedasBalance.map((moneda) => (
          <section className="currency-detail" key={moneda}>
            <h3>Balance en {moneda}</h3>
            <div className="balance-grid">
              {data.balances
                .filter((b) => b.moneda === moneda)
                .map((b) => (
                  <div
                    className={`balance-card ${b.balance > 0 ? "credit" : b.balance < 0 ? "debt" : "settled"}`}
                    key={b.idParticipante}
                  >
                    <span>{b.nombre}</span>
                    <strong>{money(Math.abs(b.balance), moneda)}</strong>
                    <small>
                      {b.balance > 0
                        ? "Tiene que recibir"
                        : b.balance < 0
                          ? "Tiene que pagar"
                          : "Saldada"}
                    </small>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </details>
      <details className="transfer-history friendly-history" open={false}>
        <summary>Historial de transferencias ({finalizadas.length})</summary>
        {finalizadas.map((t) => (
          <div className="history-row" key={t.idTransferencia}>
            <div>
              <strong>
                {t.origen} → {t.destino}
              </strong>
              <small>{t.fecha || "Sin fecha"}</small>
            </div>
            <strong>{importeVisible(t.importe, t.moneda)}</strong>
            <span className={`status ${t.estado.toLowerCase()}`}>
              {t.estado === "REALIZADA" ? "Realizada" : "Anulada"}
            </span>
          </div>
        ))}
        {!finalizadas.length && (
          <p className="empty-copy">
            Todavía no hay transferencias finalizadas.
          </p>
        )}
      </details>
    </section>
  );
}

function Finanzas({ viaje, vista, onGoCurrencies }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [form, setForm] = useState(false),
    [tipo, setTipo] = useState("IGUAL"),
    [seleccionados, setSeleccionados] = useState([]),
    [editandoGasto, setEditandoGasto] = useState(null),
    [monedaVista, setMonedaVista] = useState(viaje.monedaPrincipal);
  const money = (n, m) =>
      new Intl.NumberFormat("es-AR", { style: "currency", currency: m }).format(
        n || 0,
      ),
    decimal = (v) =>
      Number(
        String(v ?? "")
          .trim()
          .replace(",", "."),
      );
  async function cargar() {
    try {
      setData(await api(`/viajes/${viaje.idViaje}/finanzas`));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    cargar();
  }, [viaje.idViaje]);
  function toggle(id) {
    setSeleccionados((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }
  async function guardarGasto(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget),
      importe = decimal(fd.get("importe")),
      pagadores = (data?.participantes || [])
        .map((p) => ({
          idParticipante: p.idParticipante,
          importe: decimal(fd.get(`pagador-${p.idParticipante}`) || 0),
        }))
        .filter((x) => x.importe > 0);
    let asignaciones;
    if (tipo === "IGUAL") {
      const centavos = Math.round(importe * 100),
        base = Math.floor(centavos / seleccionados.length),
        resto = centavos - base * seleccionados.length;
      asignaciones = seleccionados.map((id, i) => ({
        idParticipante: id,
        importe: (base + (i < resto ? 1 : 0)) / 100,
      }));
    } else
      asignaciones = (data?.participantes || [])
        .filter((p) => seleccionados.includes(p.idParticipante))
        .map((p) => ({
          idParticipante: p.idParticipante,
          importe: decimal(fd.get(`asignacion-${p.idParticipante}`) || 0),
        }))
        .filter((x) => x.importe > 0);
    try {
      await api(
        `/viajes/${viaje.idViaje}/finanzas/gastos${editandoGasto ? `/${editandoGasto.idGasto}` : ""}`,
        {
          method: editandoGasto ? "PUT" : "POST",
          body: JSON.stringify({
            descripcion: fd.get("descripcion"),
            categoria: fd.get("categoria"),
            fecha: fd.get("fecha"),
            importe,
            moneda: fd.get("moneda"),
            tipoDivision: tipo,
            observaciones: fd.get("observaciones") || null,
            pagadores,
            asignaciones,
          }),
        },
      );
      setForm(false);
      setEditandoGasto(null);
      setSeleccionados([]);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }
  function editarGasto(g) {
    setEditandoGasto(g);
    setTipo(g.tipoDivision);
    setSeleccionados(g.asignaciones.map((a) => a.idParticipante));
    setForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function eliminarGasto(g) {
    if (!confirm(`¿Eliminar “${g.descripcion}”?`)) return;
    await api(`/viajes/${viaje.idViaje}/finanzas/gastos/${g.idGasto}`, {
      method: "DELETE",
    });
    await cargar();
  }
  async function registrarSugerencia(s, estado = "PENDIENTE") {
    await api(`/viajes/${viaje.idViaje}/finanzas/transferencias`, {
      method: "POST",
      body: JSON.stringify({
        ...s,
        estado,
        fecha:
          estado === "REALIZADA" ? new Date().toISOString().slice(0, 10) : null,
      }),
    });
    await cargar();
  }
  async function cambiarTransferencia(t, estado) {
    await api(
      `/viajes/${viaje.idViaje}/finanzas/transferencias/${t.idTransferencia}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          estado,
          fecha:
            estado === "REALIZADA"
              ? new Date().toISOString().slice(0, 10)
              : null,
        }),
      },
    );
    await cargar();
  }
  if (!data)
    return (
      <section className="panel">
        <h2>{vista === "gastos" ? "Gastos reales" : "Balances"}</h2>
        {error ? <div className="alert">{error}</div> : <p>Cargando…</p>}
      </section>
    );
  if (vista === "gastos")
    return (
      <section className="panel finance-panel">
        <div className="section-actions">
          <div>
            <p className="eyebrow">Durante el viaje</p>
            <h2>Gastos reales</h2>
            <p className="empty-copy">
              Cenas, taxis y consumos que pueden existir fuera del presupuesto.
            </p>
          </div>
          <button
            className="button secondary"
            onClick={() => {
              setEditandoGasto(null);
              setSeleccionados([]);
              setTipo("IGUAL");
              setForm(true);
            }}
          >
            ＋ Nuevo gasto
          </button>
        </div>
        {error && <div className="alert">{error}</div>}
        {form && (
          <form
            key={editandoGasto?.idGasto || "nuevo"}
            className="concept-form"
            onSubmit={guardarGasto}
          >
            <div className="form-grid">
              <label>
                Descripción
                <input
                  required
                  name="descripcion"
                  defaultValue={editandoGasto?.descripcion || ""}
                />
              </label>
              <label>
                Categoría
                <select
                  name="categoria"
                  defaultValue={editandoGasto?.categoria || "Comida"}
                >
                  <option>Comida</option>
                  <option>Transporte</option>
                  <option>Excursión</option>
                  <option>Compras</option>
                  <option>Alojamiento</option>
                  <option>Otro</option>
                </select>
              </label>
              <label>
                Fecha
                <input
                  required
                  name="fecha"
                  type="date"
                  defaultValue={
                    editandoGasto?.fecha ||
                    new Date().toISOString().slice(0, 10)
                  }
                />
              </label>
              <label>
                Importe
                <input
                  required
                  name="importe"
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]+([.,][0-9]{1,2})?"
                  defaultValue={editandoGasto?.importe || ""}
                />
              </label>
              <label>
                Moneda
                <select
                  name="moneda"
                  defaultValue={editandoGasto?.moneda || viaje.monedaPrincipal}
                >
                  <option>USD</option>
                  <option>ARS</option>
                  <option>BRL</option>
                  <option>EUR</option>
                </select>
              </label>
              <label>
                División
                <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  <option value="IGUAL">Por partes iguales</option>
                  <option value="PERSONALIZADA">Importes personalizados</option>
                </select>
              </label>
              <label className="span-2">
                Observaciones
                <textarea
                  name="observaciones"
                  rows="2"
                  defaultValue={editandoGasto?.observaciones || ""}
                />
              </label>
            </div>
            <div className="money-split">
              <section>
                <h4>¿Quién pagó?</h4>
                <p>Podés registrar una o varias pagadoras.</p>
                {data.participantes
                  .filter((p) => p.activo)
                  .map((p) => (
                    <label key={p.idParticipante}>
                      <span>{p.nombre}</span>
                      <input
                        name={`pagador-${p.idParticipante}`}
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        defaultValue={
                          editandoGasto?.pagadores.find(
                            (x) => x.idParticipante === p.idParticipante,
                          )?.importe || ""
                        }
                      />
                    </label>
                  ))}
              </section>
              <section>
                <h4>¿Quiénes participaron?</h4>
                <p>
                  {tipo === "IGUAL"
                    ? "La aplicación dividirá el total y resolverá el redondeo."
                    : "Indicá el importe de cada una."}
                </p>
                {data.participantes
                  .filter((p) => p.activo)
                  .map((p) => (
                    <div className="beneficiary-line" key={p.idParticipante}>
                      <label>
                        <input
                          type="checkbox"
                          checked={seleccionados.includes(p.idParticipante)}
                          onChange={() => toggle(p.idParticipante)}
                        />
                        <span>{p.nombre}</span>
                      </label>
                      {tipo === "PERSONALIZADA" &&
                        seleccionados.includes(p.idParticipante) && (
                          <input
                            name={`asignacion-${p.idParticipante}`}
                            type="text"
                            inputMode="decimal"
                            placeholder="0,00"
                            defaultValue={
                              editandoGasto?.asignaciones.find(
                                (x) => x.idParticipante === p.idParticipante,
                              )?.importe || ""
                            }
                          />
                        )}
                    </div>
                  ))}
              </section>
            </div>
            <div className="actions">
              <button
                type="button"
                className="button ghost"
                onClick={() => {
                  setForm(false);
                  setEditandoGasto(null);
                  setSeleccionados([]);
                }}
              >
                Cancelar
              </button>
              <button
                className="button primary"
                disabled={!seleccionados.length}
              >
                {editandoGasto ? "Guardar cambios" : "Guardar gasto"}
              </button>
            </div>
          </form>
        )}
        <div className="expense-list">
          {data.gastos.map((g) => (
            <article className="expense-row" key={g.idGasto}>
              <div>
                <span className="status">{g.categoria}</span>
                <h3>{g.descripcion}</h3>
                <small>
                  {g.fecha} ·{" "}
                  {g.tipoDivision === "IGUAL"
                    ? "División igual"
                    : "División personalizada"}
                </small>
              </div>
              <strong>{money(g.importe, g.moneda)}</strong>
              <div>
                <small>Pagaron</small>
                <p>{g.pagadores.map((p) => p.nombre).join(", ")}</p>
              </div>
              <div>
                <small>Participaron</small>
                <p>{g.asignaciones.map((a) => a.nombre).join(", ")}</p>
              </div>
              <button className="text-button" onClick={() => editarGasto(g)}>
                Editar
              </button>
              <button
                className="text-button danger"
                onClick={() => eliminarGasto(g)}
              >
                Eliminar
              </button>
            </article>
          ))}
        </div>
        {!data.gastos.length && (
          <p className="empty-copy">Todavía no registraste gastos reales.</p>
        )}
      </section>
    );
  if (vista === "balances") {
    return (
      <VistaBalances
        data={data}
        viaje={viaje}
        money={money}
        onRegister={registrarSugerencia}
        onChange={cambiarTransferencia}
        onCurrencies={onGoCurrencies}
      />
    );
  }
  const monedas = [...new Set(data.balances.map((b) => b.moneda))];
  const monedasDisponibles = [
    ...new Set(
      [
        data.monedaPrincipal,
        ...monedas,
        ...data.transferencias.map((t) => t.moneda),
        ...data.sugerencias.map((s) => s.moneda),
        ...(data.tiposCambio || []).flatMap((t) => [
          t.monedaOrigen,
          t.monedaDestino,
        ]),
      ].filter(Boolean),
    ),
  ];
  function convertir(importe, origen, destino) {
    if (origen === destino) return Number(importe);
    const tasa = (moneda) => {
      if (moneda === data.monedaPrincipal) return 1;
      const cambio = (data.tiposCambio || []).find(
        (t) =>
          t.monedaOrigen === moneda && t.monedaDestino === data.monedaPrincipal,
      );
      return cambio ? Number(cambio.tasa) : null;
    };
    const tasaOrigen = tasa(origen),
      tasaDestino = tasa(destino);
    if (!tasaOrigen || !tasaDestino) return null;
    return (Number(importe) * tasaOrigen) / tasaDestino;
  }
  function importeVisible(importe, monedaOriginal) {
    const convertido = convertir(importe, monedaOriginal, monedaVista);
    const original = money(importe, monedaOriginal);
    if (monedaOriginal === monedaVista) return original;
    return convertido === null
      ? `${original} · sin tipo de cambio`
      : `${original} · ≈ ${money(convertido, monedaVista)}`;
  }
  const sugerenciasSinRegistrar = data.sugerencias.filter(
    (s) =>
      !data.transferencias.some(
        (t) =>
          t.estado === "PENDIENTE" &&
          t.idOrigen === s.idOrigen &&
          t.idDestino === s.idDestino &&
          t.moneda === s.moneda &&
          Math.abs(Number(t.importe) - Number(s.importe)) < 0.01,
      ),
  );
  return (
    <section className="panel finance-panel">
      <div>
        <p className="eyebrow">Liquidación del grupo</p>
        <h2>Balances y transferencias</h2>
        <p className="empty-copy">
          Un saldo positivo debe recibir; uno negativo debe pagar.
        </p>
      </div>
      {error && <div className="alert">{error}</div>}
      {!monedas.length ? (
        <div className="empty-state compact">
          <h2>Sin movimientos para calcular</h2>
          <p>Registrá pagos o gastos para generar balances.</p>
        </div>
      ) : (
        monedas.map((moneda) => (
          <section className="currency-balance" key={moneda}>
            <div className="section-title">
              <h3>{moneda}</h3>
              <span>
                {data.balances.filter(
                  (b) => b.moneda === moneda && Math.abs(b.balance) < 0.01,
                ).length === data.participantes.length
                  ? "Saldado"
                  : "Pendiente"}
              </span>
            </div>
            <div className="balance-grid">
              {data.balances
                .filter((b) => b.moneda === moneda)
                .map((b) => (
                  <div
                    className={`balance-card ${b.balance > 0 ? "credit" : b.balance < 0 ? "debt" : "settled"}`}
                    key={b.idParticipante}
                  >
                    <span>{b.nombre}</span>
                    <strong>{money(Math.abs(b.balance), moneda)}</strong>
                    <small>
                      {b.balance > 0
                        ? "Debe recibir"
                        : b.balance < 0
                          ? "Debe pagar"
                          : "Saldada"}
                    </small>
                  </div>
                ))}
            </div>
          </section>
        ))
      )}
      <section className="transfer-ledger">
        <div className="ledger-heading">
          <div>
            <h3 className="transfers-title">
              Historial único de transferencias
            </h3>
            <p className="empty-copy">
              Importes originales y equivalencia informativa.
            </p>
          </div>
          <div className="ledger-tools">
            <label>
              Ver equivalencias en
              <select
                value={monedaVista}
                onChange={(e) => setMonedaVista(e.target.value)}
              >
                {monedasDisponibles.map((moneda) => (
                  <option key={moneda}>{moneda}</option>
                ))}
              </select>
            </label>
            <button className="button ghost" onClick={onGoCurrencies}>
              Administrar monedas
            </button>
          </div>
        </div>
        {sugerenciasSinRegistrar.map((s, i) => (
          <div className="ledger-row" key={`sugerida-${s.moneda}-${i}`}>
            <span>
              <strong>{s.origen}</strong> → <strong>{s.destino}</strong>
            </span>
            <strong>{importeVisible(s.importe, s.moneda)}</strong>
            <span className="status">SUGERIDA</span>
            <button
              className="button ghost"
              onClick={() => registrarSugerencia(s)}
            >
              Registrar pendiente
            </button>
          </div>
        ))}
        {data.transferencias.map((t) => (
          <TransferenciaRow
            key={t.idTransferencia}
            transferencia={t}
            money={importeVisible}
            onSave={cambiarTransferencia}
          />
        ))}
        {!sugerenciasSinRegistrar.length && !data.transferencias.length && (
          <p className="empty-copy">Todavía no hay transferencias.</p>
        )}
      </section>
    </section>
  );
}

function ResumenViaje({ viaje, onNavigate }) {
  const [presupuesto, setPresupuesto] = useState(null),
    [finanzas, setFinanzas] = useState(null),
    [cargando, setCargando] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const f = await api(`/viajes/${viaje.idViaje}/finanzas`);
        setFinanzas(f);
        try {
          setPresupuesto(await api(`/viajes/${viaje.idViaje}/presupuesto`));
        } catch (e) {
          if (!/no hay un presupuesto/i.test(e.message)) throw e;
        }
        setError("");
      } catch (e) {
        setError(e.message);
      } finally {
        setCargando(false);
      }
    })();
  }, [viaje.idViaje]);
  const money = (n, m) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: m,
      maximumFractionDigits: 2,
    }).format(n || 0);
  const resumen = useMemo(() => {
    if (!finanzas) return null;
    const participantes = finanzas.participantes || [],
      activos = participantes.filter((p) => p.activo),
      noches = Math.max(
        1,
        Math.round(
          (new Date(viaje.fechaRegreso) - new Date(viaje.fechaSalida)) /
            86400000,
        ),
      ),
      sumar = (obj, m, v) => (obj[m] = (obj[m] || 0) + Number(v)),
      presupuestado = {},
      pagado = {},
      gastos = {},
      categorias = {},
      individual = Object.fromEntries(
        participantes.map((p) => [p.idParticipante, {}]),
      );
    if (presupuesto) {
      for (const c of presupuesto.conceptos) {
        if (c.estado === "CANCELADO" || c.incluido) continue;
        const ids = c.aplicaTodos
            ? activos.map((p) => p.idParticipante)
            : c.participanteIds,
          personas = ids.length,
          factor = {
            TOTAL: c.cantidad,
            POR_PERSONA: personas * c.cantidad,
            POR_CAMAROTE: c.cantidad,
            POR_NOCHE: noches * c.cantidad,
            POR_PERSONA_NOCHE: personas * noches * c.cantidad,
          }[c.modalidad],
          total = Number(c.importe) * factor;
        sumar(presupuestado, c.moneda, total);
        if (ids.length)
          ids.forEach((id) =>
            sumar(individual[id], c.moneda, total / ids.length),
          );
      }
      for (const e of presupuesto.excursiones.filter(
        (e) => e.estado === "ELEGIDA",
      )) {
        const total = Number(e.importe) * e.participanteIds.length;
        sumar(presupuestado, e.moneda, total);
        e.participanteIds.forEach((id) =>
          sumar(individual[id], e.moneda, Number(e.importe)),
        );
      }
      for (const p of presupuesto.pagos || [])
        if (p.estado !== "REVERTIDO") sumar(pagado, p.moneda, p.importe);
    }
    for (const g of finanzas.gastos || []) {
      sumar(gastos, g.moneda, g.importe);
      categorias[g.categoria] ??= {};
      sumar(categorias[g.categoria], g.moneda, g.importe);
    }
    const tasas = Object.fromEntries(
      (finanzas.tiposCambio || []).map((t) => [t.monedaOrigen, Number(t.tasa)]),
    );
    tasas[finanzas.monedaPrincipal] = 1;
    const convertir = (totales) => {
      let total = 0,
        missing = [];
      for (const [m, n] of Object.entries(totales)) {
        if (tasas[m]) total += n * tasas[m];
        else missing.push(m);
      }
      return { total, missing };
    };
    const pendiente = {};
    for (const m of new Set([
      ...Object.keys(presupuestado),
      ...Object.keys(pagado),
    ]))
      pendiente[m] = Math.max((presupuestado[m] || 0) - (pagado[m] || 0), 0);
    return {
      participantes,
      presupuestado,
      pagado,
      pendiente,
      gastos,
      categorias,
      individual,
      convertir,
      proximas: (presupuesto?.cuotas || [])
        .filter((c) => c.estado === "PENDIENTE" || c.estado === "VENCIDA")
        .slice(0, 5),
      transferencias: (finanzas.transferencias || []).filter(
        (t) => t.estado === "PENDIENTE",
      ),
      sugerencias: finanzas.sugerencias || [],
      balances: finanzas.balances || [],
    };
  }, [presupuesto, finanzas, viaje]);
  if (cargando)
    return (
      <section className="panel summary-loading">
        Preparando el resumen…
      </section>
    );
  if (error || !resumen)
    return (
      <div className="alert">{error || "No se pudo preparar el resumen."}</div>
    );
  const indicador = (titulo, totales, clase) => {
    const c = resumen.convertir(totales);
    return (
      <article className={`summary-kpi ${clase || ""}`}>
        <small>{titulo}</small>
        <strong>
          {c.missing.length ? "—" : money(c.total, finanzas.monedaPrincipal)}
        </strong>
        <div>
          {Object.entries(totales).map(([m, n]) => (
            <span key={m}>{money(n, m)}</span>
          ))}
        </div>
        {c.missing.length > 0 && (
          <button className="text-button" onClick={() => onNavigate("monedas")}>
            Falta cambio: {c.missing.join(", ")}
          </button>
        )}
      </article>
    );
  };
  return (
    <div className="summary-dashboard">
      <section className="summary-intro">
        <div>
          <p className="eyebrow">Estado económico</p>
          <h2>Resumen del viaje</h2>
          <p>
            Una vista rápida del presupuesto, los movimientos y lo que queda por
            resolver.
          </p>
        </div>
        <span
          className={`trip-health ${resumen.transferencias.length || resumen.sugerencias.length ? "pending" : "ok"}`}
        >
          {resumen.transferencias.length || resumen.sugerencias.length
            ? "Hay saldos pendientes"
            : "Cuentas al día"}
        </span>
      </section>
      <div className="summary-kpis">
        {indicador("Presupuesto confirmado", resumen.presupuestado, "budget")}
        {indicador("Pagado", resumen.pagado, "paid")}
        {indicador("Pendiente de pago", resumen.pendiente, "pending")}
        {indicador("Gastos reales", resumen.gastos, "expenses")}
      </div>
      {!presupuesto && (
        <section className="summary-notice">
          <div>
            <strong>Todavía no hay un presupuesto confirmado</strong>
            <p>
              Compará las cotizaciones y elegí una alternativa para completar
              los indicadores.
            </p>
          </div>
          <button
            className="button primary"
            onClick={() => onNavigate("cotizaciones")}
          >
            Ir a cotizaciones
          </button>
        </section>
      )}
      <div className="summary-columns">
        <section className="panel summary-section">
          <div className="section-actions">
            <h3>Próximos vencimientos</h3>
            <button
              className="text-button"
              onClick={() => onNavigate("presupuesto")}
            >
              Ver cuotas →
            </button>
          </div>
          {resumen.proximas.map((c) => (
            <div className="summary-list-row" key={c.idCuota}>
              <div>
                <strong>{c.descripcion}</strong>
                <small>
                  {c.estado === "VENCIDA" ? "Vencida" : "Vence"}{" "}
                  {c.fechaVencimiento}
                </small>
              </div>
              <strong>{money(c.pendiente, c.moneda)}</strong>
            </div>
          ))}
          {!resumen.proximas.length && (
            <p className="empty-copy">No hay vencimientos pendientes.</p>
          )}
        </section>
        <section className="panel summary-section">
          <div className="section-actions">
            <h3>Balances del grupo</h3>
            <button
              className="text-button"
              onClick={() => onNavigate("balances")}
            >
              Resolver →
            </button>
          </div>
          {[...new Set(resumen.balances.map((b) => b.moneda))].map((m) => (
            <div className="balance-summary-row" key={m}>
              <strong>{m}</strong>
              <span>
                {
                  resumen.balances.filter(
                    (b) => b.moneda === m && b.balance < -0.01,
                  ).length
                }{" "}
                deben pagar
              </span>
              <span>
                {
                  resumen.balances.filter(
                    (b) => b.moneda === m && b.balance > 0.01,
                  ).length
                }{" "}
                deben recibir
              </span>
            </div>
          ))}
          {!resumen.balances.length && (
            <p className="empty-copy">
              Todavía no hay movimientos para calcular.
            </p>
          )}
        </section>
      </div>
      <section className="panel summary-section">
        <div className="section-actions">
          <div>
            <p className="eyebrow">Distribución</p>
            <h3>Presupuesto por participante</h3>
          </div>
          <button
            className="text-button"
            onClick={() => onNavigate("participantes")}
          >
            Gestionar participantes →
          </button>
        </div>
        <div className="person-summary-grid">
          {resumen.participantes.map((p) => (
            <article className="person-summary" key={p.idParticipante}>
              <span
                className="avatar"
                style={{ background: p.color || "#829c98" }}
              >
                {p.nombre[0]}
              </span>
              <div>
                <strong>{p.nombre}</strong>
                <small>
                  {Object.keys(resumen.individual[p.idParticipante] || {})
                    .length
                    ? Object.entries(resumen.individual[p.idParticipante])
                        .map(([m, n]) => money(n, m))
                        .join(" · ")
                    : "Sin conceptos asignados"}
                </small>
              </div>
              {resumen.balances
                .filter(
                  (b) =>
                    b.idParticipante === p.idParticipante &&
                    Math.abs(b.balance) > 0.01,
                )
                .map((b) => (
                  <span
                    className={b.balance > 0 ? "credit-text" : "debt-text"}
                    key={b.moneda}
                  >
                    {b.balance > 0 ? "Recibe" : "Paga"}{" "}
                    {money(Math.abs(b.balance), b.moneda)}
                  </span>
                ))}
            </article>
          ))}
        </div>
      </section>
      <section className="quick-actions">
        <button onClick={() => onNavigate("gastos")}>
          <span>＋</span>
          <div>
            <strong>Registrar gasto</strong>
            <small>Comidas, traslados y compras</small>
          </div>
        </button>
        <button onClick={() => onNavigate("presupuesto")}>
          <span>＋</span>
          <div>
            <strong>Registrar pago</strong>
            <small>Cuotas y conceptos</small>
          </div>
        </button>
        <button onClick={() => onNavigate("balances")}>
          <span>→</span>
          <div>
            <strong>Revisar transferencias</strong>
            <small>
              {resumen.transferencias.length + resumen.sugerencias.length} por
              resolver
            </small>
          </div>
        </button>
      </section>
    </div>
  );
}

function Dashboard({ usuario, onLogout, onUsuarioUpdate, onAdmin }) {
  const [viajes, setViajes] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState("");
  const [seccion, setSeccion] = useState("resumen");
  async function cargar() {
    try {
      setViajes(await api("/viajes"));
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    cargar();
  }, []);
  const activos = useMemo(
    () => viajes.filter((v) => v.estado !== "ARCHIVADO"),
    [viajes],
  );
  async function guardar(data) {
    if (editando)
      await api(`/viajes/${editando.idViaje}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    else await api("/viajes", { method: "POST", body: JSON.stringify(data) });
    setFormVisible(false);
    setEditando(null);
    await cargar();
  }
  async function archivar(v) {
    if (
      !confirm(
        `${v.estado === "ARCHIVADO" ? "¿Restaurar" : "¿Archivar"} “${v.nombre}”?`,
      )
    )
      return;
    const actualizado = await api(`/viajes/${v.idViaje}`, { method: "DELETE" });
    if (
      seleccionado?.idViaje === v.idViaje &&
      !actualizado.pendienteSincronizar
    )
      setSeleccionado(actualizado);
    await cargar();
  }
  async function eliminarViaje(v) {
    if (
      !confirm(
        `¿Eliminar definitivamente “${v.nombre}”? Se borrarán participantes, presupuestos, pagos, gastos y transferencias.`,
      )
    )
      return;
    const nombre = prompt(
      `Esta acción no se puede deshacer. Escribí el nombre del viaje para confirmar:\n\n${v.nombre}`,
    );
    if (nombre !== v.nombre) {
      if (nombre !== null)
        alert("El nombre no coincide. No se eliminó el viaje.");
      return;
    }
    try {
      await api(`/viajes/${v.idViaje}/permanente`, { method: "DELETE" });
      setSeleccionado(null);
      setFormVisible(false);
      setEditando(null);
      setSeccion("resumen");
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }
  function abrirViaje(v) {
    setFormVisible(false);
    setEditando(null);
    setSeccion("resumen");
    setSeleccionado(v);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function salir() {
    await borrarDatosLocales().catch(() => undefined);
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    onLogout();
  }
  if (seleccionado)
    return (
      <div
        className={`app-shell ${seleccionado.rolAcceso === "LECTOR" ? "solo-lectura" : ""}`}
      >
        <Header
          usuario={usuario}
          onLogout={salir}
          onUsuarioUpdate={onUsuarioUpdate}
          onAdmin={onAdmin}
        />
        <main className="content">
          <button
            className="back"
            onClick={() => {
              setSeleccionado(null);
              setSeccion("resumen");
            }}
          >
            ← Todos los viajes
          </button>
          <section className="trip-hero">
            <div>
              <span className={`status ${seleccionado.estado.toLowerCase()}`}>
                {estadoTexto[seleccionado.estado]}
              </span>
              {seleccionado.rolAcceso === "LECTOR" && (
                <span className="read-only-badge">Solo lectura</span>
              )}
              <h1>{seleccionado.nombre}</h1>
              <p>
                {seleccionado.puertoSalida || "Puerto por definir"} ·{" "}
                {seleccionado.fechaSalida} → {seleccionado.fechaRegreso}
              </p>
              <EstadoSincronizacion viaje={seleccionado} />
            </div>
            {seleccionado.rolAcceso !== "LECTOR" && (
              <button
                className="button light"
                onClick={() => {
                  setEditando(seleccionado);
                  setFormVisible(true);
                }}
              >
                Editar viaje
              </button>
            )}
          </section>
          <nav className="trip-nav" aria-label="Secciones del viaje">
            <button
              className={seccion === "resumen" ? "active" : ""}
              onClick={() => setSeccion("resumen")}
            >
              Resumen
            </button>
            <button
              className={seccion === "participantes" ? "active" : ""}
              onClick={() => setSeccion("participantes")}
            >
              Participantes
            </button>
            <button
              className={seccion === "cotizaciones" ? "active" : ""}
              onClick={() => setSeccion("cotizaciones")}
            >
              Cotizaciones
            </button>
            <button
              className={seccion === "presupuesto" ? "active" : ""}
              onClick={() => setSeccion("presupuesto")}
            >
              Presupuesto y planes
            </button>
            <button
              className={seccion === "gastos" ? "active" : ""}
              onClick={() => setSeccion("gastos")}
            >
              Gastos
            </button>
            <button
              className={seccion === "balances" ? "active" : ""}
              onClick={() => setSeccion("balances")}
            >
              Balances
            </button>
            <button
              className={seccion === "monedas" ? "active" : ""}
              onClick={() => setSeccion("monedas")}
            >
              Monedas
            </button>
          </nav>
          {formVisible && (
            <ViajeForm
              inicial={editando}
              onSave={async (d) => {
                await guardar(d);
                const actualizado = await api(
                  `/viajes/${seleccionado.idViaje}`,
                );
                setSeleccionado(actualizado);
              }}
              onCancel={() => setFormVisible(false)}
              onDelete={
                seleccionado.esPropietaria
                  ? () => eliminarViaje(seleccionado)
                  : undefined
              }
            />
          )}{" "}
          {seccion === "resumen" && (
            <ResumenViaje viaje={seleccionado} onNavigate={setSeccion} />
          )}
          {seccion === "participantes" && (
            <Participantes
              viaje={seleccionado}
              onCountChange={() => cargar()}
            />
          )}{" "}
          {seccion === "cotizaciones" && <Cotizaciones viaje={seleccionado} />}{" "}
          {seccion === "presupuesto" && (
            <Presupuesto
              viaje={seleccionado}
              onGoQuotes={() => setSeccion("cotizaciones")}
            />
          )}
          {seccion === "gastos" && (
            <Finanzas viaje={seleccionado} vista="gastos" />
          )}
          {seccion === "balances" && (
            <Finanzas
              viaje={seleccionado}
              vista="balances"
              onGoCurrencies={() => setSeccion("monedas")}
            />
          )}
          {seccion === "monedas" && (
            <Monedas
              viaje={seleccionado}
              onBack={() => setSeccion("balances")}
            />
          )}
        </main>
      </div>
    );
  return (
    <div className="app-shell">
      <Header
        usuario={usuario}
        onLogout={salir}
        onUsuarioUpdate={onUsuarioUpdate}
        onAdmin={onAdmin}
      />
      <main className="content">
        <section className="welcome">
          <div>
            <p className="eyebrow">Panel de viajes</p>
            <h1>Hola, {usuario.nombre?.split(" ")[0]}</h1>
            <p>Organizá cada decisión desde el primer presupuesto.</p>
          </div>
          <button
            className="button primary"
            onClick={() => {
              setEditando(null);
              setFormVisible(true);
            }}
          >
            ＋ Nuevo viaje
          </button>
        </section>
        {error && <div className="alert">{error}</div>}
        {formVisible && (
          <ViajeForm
            inicial={editando}
            onSave={guardar}
            onCancel={() => {
              setFormVisible(false);
              setEditando(null);
            }}
          />
        )}
        <div className="section-title">
          <h2>Viajes activos</h2>
          <span>{activos.length}</span>
        </div>
        {activos.length === 0 ? (
          <section className="empty-state">
            <div className="compass">✦</div>
            <h2>Tu próximo viaje empieza acá</h2>
            <p>Creá el viaje y sumá a las personas que van a compartirlo.</p>
            <button
              className="button primary"
              onClick={() => setFormVisible(true)}
            >
              Crear primer viaje
            </button>
          </section>
        ) : (
          <div className="trip-grid">
            {activos.map((v) => (
              <TripCard
                key={v.idViaje}
                viaje={v}
                onOpen={() => abrirViaje(v)}
                onArchive={() => archivar(v)}
              />
            ))}
          </div>
        )}
        {viajes.some((v) => v.estado === "ARCHIVADO") && (
          <details className="archived">
            <summary>
              Viajes archivados (
              {viajes.filter((v) => v.estado === "ARCHIVADO").length})
            </summary>
            {viajes
              .filter((v) => v.estado === "ARCHIVADO")
              .map((v) => (
                <TripCard
                  key={v.idViaje}
                  viaje={v}
                  onOpen={() => abrirViaje(v)}
                  onArchive={() => archivar(v)}
                />
              ))}
          </details>
        )}
      </main>
    </div>
  );
}

function EstadoSincronizacion({ viaje }) {
  const [estado, setEstado] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState("");

  async function cargar() {
    setPendientes(await listarOperaciones(viaje.idViaje).catch(() => []));
    try {
      if (navigator.onLine)
        setEstado(await api(`/viajes/${viaje.idViaje}/sincronizacion?desde=0`));
    } catch {
      // El indicador general ya informa la falta de conexión.
    }
  }
  useEffect(() => {
    cargar();
    const actualizar = () => cargar();
    const reconectar = async () => {
      await cargar();
      const cola = await listarOperaciones(viaje.idViaje);
      if (cola.length && !cola.some((x) => x.estado === "CONFLICTO"))
        await sincronizar(false);
    };
    window.addEventListener("brujula:cola", actualizar);
    window.addEventListener("online", reconectar);
    return () => {
      window.removeEventListener("brujula:cola", actualizar);
      window.removeEventListener("online", reconectar);
    };
  }, [viaje.idViaje]);

  async function sincronizar(forzar = false) {
    setTrabajando(true);
    setError("");
    try {
      const resultado = await sincronizarViaje(viaje.idViaje, forzar);
      if (resultado.conflicto) {
        setError(
          "Otra colaboradora modificó el viaje antes de tu sincronización.",
        );
        await cargar();
      } else if (resultado.sincronizadas) {
        window.location.reload();
      }
    } catch (e) {
      setError(e.message);
      await cargar();
    } finally {
      setTrabajando(false);
    }
  }

  async function descartar() {
    if (
      !confirm("¿Descartar todos los cambios pendientes de este dispositivo?")
    )
      return;
    await descartarPendientes(viaje.idViaje);
    setError("");
    await cargar();
  }

  const conflicto = pendientes.some((x) => x.estado === "CONFLICTO");
  return (
    <div className={`sync-indicator ${conflicto ? "conflict" : ""}`}>
      <span>
        {conflicto
          ? "Conflicto de sincronización"
          : pendientes.length
            ? `${pendientes.length} cambio(s) pendiente(s)`
            : navigator.onLine
              ? "Sincronizado"
              : "Copia local"}
      </span>
      {estado?.ultimoUsuario && !pendientes.length && (
        <small>Último cambio: {estado.ultimoUsuario}</small>
      )}
      {error && <small>{error}</small>}
      {pendientes.length > 0 && navigator.onLine && (
        <div>
          <button disabled={trabajando} onClick={() => sincronizar(false)}>
            Sincronizar
          </button>
          {conflicto && (
            <button
              disabled={trabajando}
              onClick={() => {
                if (
                  confirm(
                    "Esto aplicará tus cambios sobre la versión más reciente. ¿Continuar?",
                  )
                )
                  sincronizar(true);
              }}
            >
              Aplicar mis cambios
            </button>
          )}
          <button disabled={trabajando} onClick={descartar}>
            Descartar
          </button>
        </div>
      )}
    </div>
  );
}

function PerfilUsuario({ usuario, onClose, onUpdate, onDelete }) {
  const [form, setForm] = useState({
    nombre: usuario.nombre,
    email: usuario.email,
    contrasenaActual: "",
    contrasenaNueva: "",
  });
  const [contrasenaEliminar, setContrasenaEliminar] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [mostrarEliminar, setMostrarEliminar] = useState(false);

  const cambiar = (campo) => (event) =>
    setForm((actual) => ({ ...actual, [campo]: event.target.value }));

  async function guardar(event) {
    event.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const data = await api("/auth/perfil", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      localStorage.setItem("token", data.token);
      localStorage.setItem("usuario", JSON.stringify(data.usuario));
      onUpdate(data.usuario);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarCuenta() {
    if (!contrasenaEliminar) {
      setError("Ingresá tu contraseña para eliminar la cuenta.");
      return;
    }
    if (
      !confirm(
        "¿Eliminar definitivamente tu cuenta? También se eliminarán los viajes que creaste. Esta acción no se puede deshacer.",
      )
    )
      return;
    setGuardando(true);
    setError("");
    try {
      await api("/auth/perfil", {
        method: "DELETE",
        body: JSON.stringify({ contrasena: contrasenaEliminar }),
      });
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      onDelete();
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  }

  return (
    <div className="profile-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="profile-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Mi cuenta</p>
            <h2 id="profile-title">Perfil</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={guardar}>
          <label>
            Nombre
            <input
              required
              minLength="2"
              value={form.nombre}
              onChange={cambiar("nombre")}
            />
          </label>
          <label>
            Correo electrónico
            <input
              required
              type="email"
              value={form.email}
              onChange={cambiar("email")}
            />
          </label>
          <button
            type="button"
            className="profile-option"
            onClick={() => setMostrarContrasena((visible) => !visible)}
            aria-expanded={mostrarContrasena}
          >
            <span>
              <strong>Cambiar contraseña</strong>
              <small>Solo si querés usar una nueva</small>
            </span>
            <span aria-hidden="true">{mostrarContrasena ? "−" : "+"}</span>
          </button>
          {mostrarContrasena && (
            <div className="profile-option-content">
              <label>
                Contraseña actual
                <input
                  type="password"
                  autoComplete="current-password"
                  value={form.contrasenaActual}
                  onChange={cambiar("contrasenaActual")}
                />
              </label>
              <label>
                Contraseña nueva
                <input
                  type="password"
                  minLength="8"
                  autoComplete="new-password"
                  value={form.contrasenaNueva}
                  onChange={cambiar("contrasenaNueva")}
                />
                <small>Mínimo 8 caracteres</small>
              </label>
            </div>
          )}
          {error && <div className="alert">{error}</div>}
          <div className="form-actions">
            <button type="button" className="button ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={guardando}
            >
              Guardar perfil
            </button>
          </div>
        </form>
        <div className="device-data">
          <div>
            <h3>Datos de este dispositivo</h3>
            <p>
              Borra las copias offline de este celular sin eliminar informaciÃ³n
              de la cuenta.
            </p>
          </div>
          <button
            type="button"
            className="button ghost"
            onClick={async () => {
              try {
                await borrarDatosLocales();
                alert(
                  "Los datos offline de este dispositivo fueron eliminados.",
                );
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Borrar datos del dispositivo
          </button>
        </div>
        <div className="delete-account">
          <button
            type="button"
            className="profile-option danger-option"
            onClick={() => setMostrarEliminar((visible) => !visible)}
            aria-expanded={mostrarEliminar}
          >
            <span>
              <strong>Eliminar cuenta</strong>
              <small>Esta acción es permanente</small>
            </span>
            <span aria-hidden="true">{mostrarEliminar ? "−" : "+"}</span>
          </button>
          {mostrarEliminar && (
            <div className="profile-option-content">
              <p>
                Se eliminarán tu cuenta y todos los viajes que creaste. Esta
                acción no se puede deshacer.
              </p>
              <label>
                Contraseña para confirmar
                <input
                  type="password"
                  value={contrasenaEliminar}
                  onChange={(event) =>
                    setContrasenaEliminar(event.target.value)
                  }
                />
              </label>
              <button
                type="button"
                className="button danger-button"
                disabled={guardando}
                onClick={eliminarCuenta}
              >
                Eliminar mi cuenta
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PanelAdministracion({ usuario, onViajes, onLogout }) {
  const [usuarios, setUsuarios] = useState([]);
  const [acciones, setAcciones] = useState([]);
  const [eventosSeguridad, setEventosSeguridad] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [gestion, setGestion] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [emailConfirmacion, setEmailConfirmacion] = useState("");
  const [limpieza, setLimpieza] = useState(null);
  const [limpiezaVisible, setLimpiezaVisible] = useState(false);
  const [limpiezaForm, setLimpiezaForm] = useState({
    emailConfirmacion: "",
    contrasena: "",
    confirmacion: "",
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    try {
      const [lista, historial, seguridad] = await Promise.all([
        api("/admin/usuarios"),
        api("/admin/acciones"),
        api("/admin/seguridad"),
      ]);
      setUsuarios(lista);
      setAcciones(historial);
      setEventosSeguridad(seguridad);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function cambiarAcceso(event) {
    event.preventDefault();
    try {
      if (gestion.accion === "ELIMINAR") {
        await api(`/admin/usuarios/${gestion.idUsuario}`, {
          method: "DELETE",
          body: JSON.stringify({ motivo, emailConfirmacion }),
        });
      } else {
        await api(`/admin/usuarios/${gestion.idUsuario}/acceso`, {
          method: "PATCH",
          body: JSON.stringify({ accion: gestion.accion, motivo }),
        });
      }
      setGestion(null);
      setMotivo("");
      setEmailConfirmacion("");
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function abrirLimpieza() {
    try {
      setLimpieza(await api("/admin/limpieza"));
      setLimpiezaForm({
        emailConfirmacion: "",
        contrasena: "",
        confirmacion: "",
      });
      setLimpiezaVisible(true);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  async function ejecutarLimpieza(event) {
    event.preventDefault();
    try {
      const resultado = await api("/admin/limpieza", {
        method: "DELETE",
        body: JSON.stringify(limpiezaForm),
      });
      setLimpiezaVisible(false);
      setError("");
      alert(
        `Limpieza completada: ${resultado.usuariosEliminados} usuarios y ${resultado.viajesEliminados} viajes eliminados.`,
      );
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const visibles = usuarios.filter((persona) =>
    `${persona.nombre} ${persona.email}`
      .toLowerCase()
      .includes(busqueda.toLowerCase()),
  );
  const fecha = (valor) =>
    valor ? new Date(valor).toLocaleString("es-AR") : "Nunca";

  return (
    <div className="app-shell admin-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">B</span>
          <span>Brújula · Administración</span>
        </div>
        <div className="user-menu">
          <button className="button ghost" onClick={onViajes}>
            Mis viajes
          </button>
          <button className="text-button" onClick={onLogout}>
            Salir
          </button>
        </div>
      </header>
      <main className="content admin-content">
        <section className="admin-heading">
          <div>
            <p className="eyebrow">Acceso restringido</p>
            <h1>Usuarios</h1>
            <p>
              Administrá el acceso sin consultar viajes, pagos ni información
              financiera.
            </p>
          </div>
          <div className="admin-stat">
            <strong>{usuarios.length}</strong>
            <span>cuentas registradas</span>
          </div>
        </section>
        {error && <div className="alert">{error}</div>}
        <section className="panel admin-users">
          <div className="admin-toolbar">
            <div>
              <h2>Directorio de usuarios</h2>
              <p className="empty-copy">
                Solo se muestran datos de la cuenta y actividad general.
              </p>
            </div>
            <input
              type="search"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar por nombre o correo"
              aria-label="Buscar usuarios"
            />
          </div>
          {cargando ? (
            <p>Cargando usuarios…</p>
          ) : (
            <div className="admin-user-list">
              {visibles.map((persona) => {
                const propia = persona.idUsuario === usuario.idUsuario;
                return (
                  <article className="admin-user-card" key={persona.idUsuario}>
                    <span className="user-avatar">
                      {persona.nombre?.[0]?.toUpperCase()}
                    </span>
                    <div className="admin-user-main">
                      <div>
                        <strong>{persona.nombre}</strong>
                        {persona.rol === "ADMIN" && (
                          <span className="admin-badge">Admin</span>
                        )}
                        {!persona.activo && (
                          <span className="blocked-badge">Bloqueada</span>
                        )}
                      </div>
                      <small>{persona.email}</small>
                      <div className="admin-user-meta">
                        <span>
                          Último acceso: {fecha(persona.ultimoAcceso)}
                        </span>
                        <span>{persona.cantidadViajes} viajes</span>
                        <span>
                          {persona.cantidadColaboraciones} colaboraciones
                        </span>
                      </div>
                      {!persona.activo && persona.motivoBloqueo && (
                        <p className="block-reason">
                          Motivo: {persona.motivoBloqueo}
                        </p>
                      )}
                    </div>
                    <div>
                      {!propia && (
                        <div className="admin-user-actions">
                          <button
                            type="button"
                            className={`button ${persona.activo ? "danger-button" : "secondary"}`}
                            onClick={() => {
                              setGestion({
                                ...persona,
                                accion: persona.activo
                                  ? "BLOQUEAR"
                                  : "RESTAURAR",
                              });
                              setMotivo("");
                              setEmailConfirmacion("");
                            }}
                          >
                            {persona.activo
                              ? "Bloquear acceso"
                              : "Restaurar acceso"}
                          </button>
                          {!persona.activo && persona.rol !== "ADMIN" && (
                            <button
                              type="button"
                              className="text-button danger"
                              onClick={() => {
                                setGestion({ ...persona, accion: "ELIMINAR" });
                                setMotivo("");
                                setEmailConfirmacion("");
                              }}
                            >
                              Eliminar definitivamente
                            </button>
                          )}
                        </div>
                      )}
                      {propia && <small>Tu cuenta</small>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <section className="panel admin-history">
          <h2>Historial de accesos</h2>
          {acciones.length ? (
            acciones.map((accion) => (
              <div key={accion.idAccion}>
                <span
                  className={`status ${accion.accion === "BLOQUEAR" ? "blocked-badge" : ""}`}
                >
                  {accion.accion === "BLOQUEAR"
                    ? "Bloqueo"
                    : accion.accion === "ELIMINAR"
                      ? "Eliminación"
                      : "Restauración"}
                </span>
                <div>
                  <strong>{accion.usuarioNombre || "Usuario eliminado"}</strong>
                  <small>{accion.usuarioEmail}</small>
                  <p>{accion.motivo}</p>
                </div>
                <small>{fecha(accion.creadoEn)}</small>
              </div>
            ))
          ) : (
            <p className="empty-copy">
              Todavía no se realizaron cambios de acceso.
            </p>
          )}
        </section>
        <section className="panel admin-history security-events">
          <h2>Alertas de seguridad</h2>
          <p className="empty-copy">
            Intentos fallidos y bloqueos temporales recientes.
          </p>
          {eventosSeguridad.length ? (
            eventosSeguridad.map((evento) => (
              <div key={evento.idEvento}>
                <span
                  className={`status ${evento.tipo === "BLOQUEO_TEMPORAL" ? "blocked-badge" : ""}`}
                >
                  {evento.tipo === "BLOQUEO_TEMPORAL"
                    ? "Bloqueo temporal"
                    : "Intento fallido"}
                </span>
                <div>
                  <strong>{evento.usuarioNombre || evento.email}</strong>
                  <small>IP: {evento.ip || "No disponible"}</small>
                  <p>{evento.detalle}</p>
                </div>
                <small>{fecha(evento.creadoEn)}</small>
              </div>
            ))
          ) : (
            <p className="empty-copy">No hay alertas recientes.</p>
          )}
        </section>
        <section className="panel admin-maintenance">
          <div>
            <p className="eyebrow">Mantenimiento</p>
            <h2>Limpiar usuarios de prueba</h2>
            <p className="empty-copy">
              Conserva tu cuenta y todos tus viajes. Elimina las demás cuentas,
              sus viajes propios y el historial administrativo.
            </p>
          </div>
          <button
            type="button"
            className="button ghost"
            onClick={abrirLimpieza}
          >
            Ver vista previa
          </button>
        </section>
      </main>
      {gestion && (
        <div className="profile-overlay" onMouseDown={() => setGestion(null)}>
          <form
            className="admin-action-dialog"
            onSubmit={cambiarAcceso}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p className="eyebrow">Administrar acceso</p>
            <h2>
              {gestion.accion === "BLOQUEAR"
                ? "Bloquear"
                : gestion.accion === "ELIMINAR"
                  ? "Eliminar"
                  : "Restaurar"}{" "}
              a {gestion.nombre}
            </h2>
            <p>
              {gestion.accion === "BLOQUEAR"
                ? "La persona perderá el acceso inmediatamente, incluso si ya inició sesión."
                : gestion.accion === "ELIMINAR"
                  ? `Se eliminarán definitivamente la cuenta y sus ${gestion.cantidadViajes} viajes. Esta acción no se puede deshacer.`
                  : "La persona podrá volver a iniciar sesión y usar la aplicación."}
            </p>
            {gestion.accion === "ELIMINAR" && (
              <label>
                Escribí {gestion.email} para confirmar
                <input
                  required
                  type="email"
                  value={emailConfirmacion}
                  onChange={(event) => setEmailConfirmacion(event.target.value)}
                  autoComplete="off"
                />
              </label>
            )}
            <label>
              Motivo
              <textarea
                required
                minLength="5"
                maxLength="300"
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Explicá brevemente la razón"
              />
            </label>
            <div className="profile-actions">
              <button
                type="button"
                className="button ghost"
                onClick={() => setGestion(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`button ${gestion.accion === "RESTAURAR" ? "secondary" : "danger-button"}`}
              >
                {gestion.accion === "ELIMINAR"
                  ? "Eliminar definitivamente"
                  : "Confirmar"}
              </button>
            </div>
          </form>
        </div>
      )}
      {limpiezaVisible && limpieza && (
        <div
          className="profile-overlay"
          onMouseDown={() => setLimpiezaVisible(false)}
        >
          <form
            className="admin-action-dialog cleanup-dialog"
            onSubmit={ejecutarLimpieza}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <p className="eyebrow">Vista previa</p>
            <h2>Limpiar datos de prueba</h2>
            <div className="cleanup-summary">
              <div>
                <strong>{limpieza.cantidadUsuarios}</strong>
                <span>usuarios</span>
              </div>
              <div>
                <strong>{limpieza.cantidadViajes}</strong>
                <span>viajes ajenos</span>
              </div>
              <div>
                <strong>{limpieza.cantidadHistorial}</strong>
                <span>registros del historial</span>
              </div>
            </div>
            <p className="preserved-account">
              Se conservará <strong>{limpieza.cuentaConservada}</strong> y todos
              sus viajes.
            </p>
            <div className="alert">
              Esta acción es definitiva. Verificá las cantidades antes de
              continuar.
            </div>
            <label>
              Tu correo para confirmar
              <input
                required
                type="email"
                value={limpiezaForm.emailConfirmacion}
                onChange={(event) =>
                  setLimpiezaForm((actual) => ({
                    ...actual,
                    emailConfirmacion: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Tu contraseña
              <input
                required
                type="password"
                value={limpiezaForm.contrasena}
                onChange={(event) =>
                  setLimpiezaForm((actual) => ({
                    ...actual,
                    contrasena: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Escribí ELIMINAR USUARIOS
              <input
                required
                value={limpiezaForm.confirmacion}
                onChange={(event) =>
                  setLimpiezaForm((actual) => ({
                    ...actual,
                    confirmacion: event.target.value,
                  }))
                }
                autoComplete="off"
              />
            </label>
            <div className="profile-actions">
              <button
                type="button"
                className="button ghost"
                onClick={() => setLimpiezaVisible(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="button danger-button">
                Eliminar datos indicados
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Header({ usuario, onLogout, onUsuarioUpdate, onAdmin }) {
  const [perfilVisible, setPerfilVisible] = useState(false);
  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">B</span>
          <span>Brújula</span>
        </div>
        <div className="user-menu">
          {usuario.rol === "ADMIN" && (
            <button type="button" className="text-button" onClick={onAdmin}>
              Administración
            </button>
          )}
          <button
            type="button"
            className="profile-trigger"
            onClick={() => setPerfilVisible(true)}
            aria-label="Abrir mi perfil"
          >
            <span className="user-avatar">
              {usuario.nombre?.[0]?.toUpperCase()}
            </span>
            <span className="user-name">{usuario.nombre}</span>
          </button>
          <button className="text-button" onClick={onLogout}>
            Salir
          </button>
        </div>
      </header>
      {perfilVisible && (
        <PerfilUsuario
          usuario={usuario}
          onClose={() => setPerfilVisible(false)}
          onUpdate={onUsuarioUpdate}
          onDelete={onLogout}
        />
      )}
    </>
  );
}
function TripCard({ viaje, onOpen, onArchive }) {
  return (
    <article className="trip-card">
      <button className="card-main" onClick={onOpen}>
        <div className="card-top">
          <span className={`status ${viaje.estado.toLowerCase()}`}>
            {estadoTexto[viaje.estado]}
          </span>
          <span className="currency">{viaje.monedaPrincipal}</span>
        </div>
        <h3>{viaje.nombre}</h3>
        <p className="dates">
          {viaje.fechaSalida} → {viaje.fechaRegreso}
        </p>
        <div className="card-meta">
          <span>♙ {viaje.cantidadParticipantes} participantes</span>
          <span>{viaje.tipoViaje}</span>
        </div>
        <span className="open-trip">Abrir viaje →</span>
      </button>
      <div className="card-actions">
        <button onClick={onArchive}>
          {viaje.estado === "ARCHIVADO" ? "Restaurar" : "Archivar"}
        </button>
      </div>
    </article>
  );
}

function InstalacionApp() {
  const [evento, setEvento] = useState(null);
  const [oculto, setOculto] = useState(
    () => sessionStorage.getItem("ocultar-instalacion") === "true",
  );
  const esIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const instalada = window.matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    const disponible = (e) => {
      e.preventDefault();
      setEvento(e);
    };
    const completada = () => setEvento(null);
    window.addEventListener("beforeinstallprompt", disponible);
    window.addEventListener("appinstalled", completada);
    return () => {
      window.removeEventListener("beforeinstallprompt", disponible);
      window.removeEventListener("appinstalled", completada);
    };
  }, []);

  async function instalar() {
    if (!evento) return;
    await evento.prompt();
    const eleccion = await evento.userChoice;
    if (eleccion.outcome === "accepted") setEvento(null);
  }

  if (instalada || oculto || (!evento && !esIos)) return null;
  return (
    <aside className="install-banner" aria-label="Instalar aplicación">
      <img src="/icons/brujula.svg" alt="" />
      <div>
        <strong>Instalá Brújula</strong>
        <small>
          {esIos && !evento
            ? "En Safari: Compartir → Agregar a inicio."
            : "Usala desde tu pantalla de inicio como una aplicación."}
        </small>
      </div>
      {evento && (
        <button className="button primary" onClick={instalar}>
          Instalar
        </button>
      )}
      <button
        className="icon-button"
        aria-label="Cerrar indicación de instalación"
        onClick={() => {
          sessionStorage.setItem("ocultar-instalacion", "true");
          setOculto(true);
        }}
      >
        ×
      </button>
    </aside>
  );
}

function EstadoConexion() {
  const [conectada, setConectada] = useState(navigator.onLine);
  useEffect(() => {
    const online = () => setConectada(true);
    const offline = () => setConectada(false);
    const resultado = (e) => setConectada(Boolean(e.detail));
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("brujula:conexion", resultado);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("brujula:conexion", resultado);
    };
  }, []);
  if (conectada) return null;
  return (
    <div className="offline-status" role="status">
      Sin conexión · mostrando la información guardada en este dispositivo
    </div>
  );
}

export default function App() {
  const [vista, setVista] = useState("viajes");
  const [sesion, setSesion] = useState(() => {
    const token = localStorage.getItem("token");
    const usuario = localStorage.getItem("usuario");
    return token && usuario ? { token, usuario: JSON.parse(usuario) } : null;
  });
  useEffect(() => {
    const esNumero = (target) => target?.matches?.('input[type="number"]');
    const bloquearRueda = (event) => {
      if (esNumero(event.target) && document.activeElement === event.target)
        event.preventDefault();
    };
    const bloquearFlechas = (event) => {
      if (
        esNumero(event.target) &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      )
        event.preventDefault();
    };
    document.addEventListener("wheel", bloquearRueda, { passive: false });
    document.addEventListener("keydown", bloquearFlechas);
    return () => {
      document.removeEventListener("wheel", bloquearRueda);
      document.removeEventListener("keydown", bloquearFlechas);
    };
  }, []);
  function login(data) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("usuario", JSON.stringify(data.usuario));
    setSesion(data);
  }
  function actualizarUsuario(usuario) {
    setSesion((actual) => ({ ...actual, usuario }));
  }
  async function cerrarSesion() {
    await borrarDatosLocales().catch(() => undefined);
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    setVista("viajes");
    setSesion(null);
  }
  return (
    <>
      {sesion?.usuario.rol === "ADMIN" && vista === "admin" ? (
        <PanelAdministracion
          usuario={sesion.usuario}
          onViajes={() => setVista("viajes")}
          onLogout={cerrarSesion}
        />
      ) : sesion ? (
        <Dashboard
          usuario={sesion.usuario}
          onLogout={cerrarSesion}
          onUsuarioUpdate={actualizarUsuario}
          onAdmin={() => setVista("admin")}
        />
      ) : (
        <Auth onLogin={login} />
      )}
      <EstadoConexion />
      <InstalacionApp />
    </>
  );
}
