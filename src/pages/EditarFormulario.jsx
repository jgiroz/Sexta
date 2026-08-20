import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

const TIPOS_PREGUNTA = [
  { value: 'ok_falla', label: 'OK / FALLA', ayuda: 'Marcar FALLA genera alerta y pide descripción.' },
  {
    value: 'opciones',
    label: 'Lista de opciones',
    ayuda: 'Tú defines las alternativas y cuáles generan alerta. Ej: nivel de combustible.'
  },
  {
    value: 'numero',
    label: 'Número',
    ayuda: 'Para kilometraje, horas, presiones. Puedes fijar un mínimo o máximo que alerte.'
  },
  { value: 'texto', label: 'Texto libre', ayuda: 'Anotaciones u observaciones.' }
]

const OPCIONES_POR_DEFECTO = [
  { valor: 'lleno', etiqueta: 'Lleno', alerta: false },
  { valor: '3_4', etiqueta: '3/4 de estanque', alerta: false },
  { valor: '1_2', etiqueta: '1/2 estanque', alerta: true },
  { valor: '1_4', etiqueta: '1/4 de estanque', alerta: true },
  { valor: 'reserva', etiqueta: 'Reserva o vacío', alerta: true }
]

export default function EditarFormulario() {
  const { id } = useParams()
  const { puedeEditarFormularios } = useAuth()

  const [formulario, setFormulario] = useState(null)
  const [secciones, setSecciones] = useState([])
  const [preguntas, setPreguntas] = useState([])
  const [destinatarios, setDestinatarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [nuevaSeccion, setNuevaSeccion] = useState('')
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [editandoPregunta, setEditandoPregunta] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [{ data: form, error: errForm }, { data: secs }, { data: dest }] = await Promise.all([
      supabase
        .from('formularios')
        .select('id, nombre, descripcion, activo, carro_id, carros(codigo)')
        .eq('id', id)
        .single(),
      supabase.from('formulario_secciones').select('*').eq('formulario_id', id).order('orden'),
      supabase.from('formulario_destinatarios').select('*').eq('formulario_id', id)
    ])

    if (errForm) setError(errForm.message)
    setFormulario(form ?? null)
    setSecciones(secs ?? [])
    setDestinatarios(dest ?? [])

    const ids = (secs ?? []).map((s) => s.id)
    if (ids.length > 0) {
      const { data: pregs } = await supabase
        .from('formulario_preguntas')
        .select('*')
        .in('seccion_id', ids)
        .order('orden')
      setPreguntas(pregs ?? [])
    } else {
      setPreguntas([])
    }
    setCargando(false)
  }, [id])

  useEffect(() => {
    if (puedeEditarFormularios) cargar()
  }, [puedeEditarFormularios, cargar])

  if (!puedeEditarFormularios) return <Navigate to="/" replace />

  // ---------- secciones ----------
  const agregarSeccion = async (e) => {
    e.preventDefault()
    if (!nuevaSeccion.trim()) return
    const orden = secciones.length > 0 ? Math.max(...secciones.map((s) => s.orden)) + 1 : 1
    const { error } = await supabase
      .from('formulario_secciones')
      .insert({ formulario_id: id, titulo: nuevaSeccion.trim().toUpperCase(), orden })
    if (error) setError(error.message)
    else {
      setNuevaSeccion('')
      cargar()
    }
  }

  const renombrarSeccion = async (seccion) => {
    const titulo = window.prompt('Nuevo nombre de la sección:', seccion.titulo)
    if (!titulo || !titulo.trim()) return
    const { error } = await supabase
      .from('formulario_secciones')
      .update({ titulo: titulo.trim().toUpperCase() })
      .eq('id', seccion.id)
    if (error) setError(error.message)
    else cargar()
  }

  const eliminarSeccion = async (seccion) => {
    const cuantas = preguntas.filter((p) => p.seccion_id === seccion.id).length
    const ok = window.confirm(
      `¿Eliminar la sección "${seccion.titulo}"${
        cuantas > 0 ? ` y sus ${cuantas} pregunta(s)` : ''
      }?`
    )
    if (!ok) return
    const { error } = await supabase.from('formulario_secciones').delete().eq('id', seccion.id)
    if (error) setError(error.message)
    else cargar()
  }

  const moverSeccion = async (seccion, direccion) => {
    const ordenadas = [...secciones].sort((a, b) => a.orden - b.orden)
    const i = ordenadas.findIndex((s) => s.id === seccion.id)
    const j = i + direccion
    if (j < 0 || j >= ordenadas.length) return
    const a = ordenadas[i]
    const b = ordenadas[j]
    await Promise.all([
      supabase.from('formulario_secciones').update({ orden: b.orden }).eq('id', a.id),
      supabase.from('formulario_secciones').update({ orden: a.orden }).eq('id', b.id)
    ])
    cargar()
  }

  // ---------- preguntas ----------
  const nuevaPregunta = (seccionId) => {
    const delSeccion = preguntas.filter((p) => p.seccion_id === seccionId)
    const orden = delSeccion.length > 0 ? Math.max(...delSeccion.map((p) => p.orden)) + 1 : 1
    setEditandoPregunta({
      seccion_id: seccionId,
      etiqueta: '',
      tipo: 'ok_falla',
      orden,
      requerido: false,
      genera_levantamiento: true,
      config: {}
    })
  }

  const guardarPregunta = async () => {
    const p = editandoPregunta
    if (!p.etiqueta.trim()) {
      setError('La pregunta necesita un nombre.')
      return
    }

    const fila = {
      seccion_id: p.seccion_id,
      etiqueta: p.etiqueta.trim(),
      tipo: p.tipo,
      orden: p.orden,
      requerido: p.requerido,
      genera_levantamiento: p.genera_levantamiento,
      config: p.config ?? {}
    }

    const { error } = p.id
      ? await supabase.from('formulario_preguntas').update(fila).eq('id', p.id)
      : await supabase.from('formulario_preguntas').insert(fila)

    if (error) setError(error.message)
    else {
      setEditandoPregunta(null)
      setError('')
      cargar()
    }
  }

  const eliminarPregunta = async (pregunta) => {
    if (!window.confirm(`¿Eliminar la pregunta "${pregunta.etiqueta}"?`)) return
    const { error } = await supabase.from('formulario_preguntas').delete().eq('id', pregunta.id)
    if (error) setError(error.message)
    else cargar()
  }

  const moverPregunta = async (pregunta, direccion) => {
    const hermanas = preguntas
      .filter((p) => p.seccion_id === pregunta.seccion_id)
      .sort((a, b) => a.orden - b.orden)
    const i = hermanas.findIndex((p) => p.id === pregunta.id)
    const j = i + direccion
    if (j < 0 || j >= hermanas.length) return
    const a = hermanas[i]
    const b = hermanas[j]
    await Promise.all([
      supabase.from('formulario_preguntas').update({ orden: b.orden }).eq('id', a.id),
      supabase.from('formulario_preguntas').update({ orden: a.orden }).eq('id', b.id)
    ])
    cargar()
  }

  // ---------- destinatarios ----------
  const agregarEmail = async (e) => {
    e.preventDefault()
    const correo = nuevoEmail.trim()
    if (!correo) return
    if (!correo.includes('@') || /\.(local|invalid|test|example)$/i.test(correo)) {
      setError('Esa dirección no puede recibir correos. Usa un correo real.')
      return
    }
    const { error } = await supabase
      .from('formulario_destinatarios')
      .insert({ formulario_id: id, email: correo })
    if (error) setError(error.message)
    else {
      setNuevoEmail('')
      setError('')
      cargar()
    }
  }

  const quitarEmail = async (destId) => {
    const { error } = await supabase.from('formulario_destinatarios').delete().eq('id', destId)
    if (error) setError(error.message)
    else cargar()
  }

  if (cargando) return <div className="pagina cargando">Cargando…</div>
  if (!formulario) return <div className="pagina">Formulario no encontrado.</div>

  const seccionesOrdenadas = [...secciones].sort((a, b) => a.orden - b.orden)

  return (
    <div className="pagina pagina-ancha">
      <Link to="/formularios" className="btn-link">
        ← Volver a formularios
      </Link>
      <h2>{formulario.nombre}</h2>
      <p className="muted-chico">
        {formulario.carros?.codigo ? `Carro ${formulario.carros.codigo}` : 'Sin carro asociado'} ·{' '}
        {preguntas.length} pregunta(s) en {secciones.length} sección(es)
      </p>

      {error && <p className="error">{error}</p>}

      {seccionesOrdenadas.map((seccion, iSeccion) => {
        const suyas = preguntas
          .filter((p) => p.seccion_id === seccion.id)
          .sort((a, b) => a.orden - b.orden)
        return (
          <section key={seccion.id} className="bloque-seccion">
            <div className="bloque-seccion-cabecera">
              <h3>{seccion.titulo}</h3>
              <div className="acciones-inline">
                <button
                  className="btn-mini"
                  onClick={() => moverSeccion(seccion, -1)}
                  disabled={iSeccion === 0}
                  title="Subir sección"
                >
                  ↑
                </button>
                <button
                  className="btn-mini"
                  onClick={() => moverSeccion(seccion, 1)}
                  disabled={iSeccion === seccionesOrdenadas.length - 1}
                  title="Bajar sección"
                >
                  ↓
                </button>
                <button className="btn-mini" onClick={() => renombrarSeccion(seccion)}>
                  Renombrar
                </button>
                <button className="btn-mini peligro" onClick={() => eliminarSeccion(seccion)}>
                  Eliminar
                </button>
              </div>
            </div>

            {suyas.length === 0 && <p className="muted-chico">Sección sin preguntas.</p>}

            {suyas.map((pregunta, iPregunta) => (
              <div key={pregunta.id} className="fila-pregunta">
                <div className="fila-pregunta-texto">
                  <strong>{pregunta.etiqueta}</strong>
                  <span className="muted-chico">
                    {' '}
                    · {TIPOS_PREGUNTA.find((t) => t.value === pregunta.tipo)?.label ?? pregunta.tipo}
                    {pregunta.requerido && ' · obligatoria'}
                    {pregunta.tipo === 'opciones' &&
                      ` · ${(pregunta.config?.opciones ?? []).length} opciones`}
                  </span>
                </div>
                <div className="acciones-inline">
                  <button
                    className="btn-mini"
                    onClick={() => moverPregunta(pregunta, -1)}
                    disabled={iPregunta === 0}
                  >
                    ↑
                  </button>
                  <button
                    className="btn-mini"
                    onClick={() => moverPregunta(pregunta, 1)}
                    disabled={iPregunta === suyas.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    className="btn-mini"
                    onClick={() =>
                      setEditandoPregunta({ ...pregunta, config: pregunta.config ?? {} })
                    }
                  >
                    Editar
                  </button>
                  <button className="btn-mini peligro" onClick={() => eliminarPregunta(pregunta)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}

            <button className="btn-secundario btn-mini-ancho" onClick={() => nuevaPregunta(seccion.id)}>
              + Agregar pregunta a {seccion.titulo}
            </button>
          </section>
        )
      })}

      <form onSubmit={agregarSeccion} className="form-inline" style={{ marginTop: '1.5rem' }}>
        <input
          value={nuevaSeccion}
          onChange={(e) => setNuevaSeccion(e.target.value)}
          placeholder="Nombre de la nueva sección"
        />
        <button className="btn-primario" type="submit">
          + Sección
        </button>
      </form>

      <h3 className="subtitulo-seccion">¿A quién le llega este formulario?</h3>
      <p className="muted-chico">
        Cuando el formulario se envía con alguna alerta, se manda un correo resumen a estas
        direcciones.
      </p>
      <ul className="lista-facturas">
        {destinatarios.map((d) => (
          <li key={d.id}>
            {d.email}
            <button className="btn-link" onClick={() => quitarEmail(d.id)}>
              🗑
            </button>
          </li>
        ))}
        {destinatarios.length === 0 && (
          <p className="muted">Sin destinatarios. No se enviará correo.</p>
        )}
      </ul>
      <form onSubmit={agregarEmail} className="form-inline">
        <input
          type="email"
          value={nuevoEmail}
          onChange={(e) => setNuevoEmail(e.target.value)}
          placeholder="correo@ejemplo.cl"
        />
        <button className="btn-secundario" type="submit">
          Agregar
        </button>
      </form>

      {editandoPregunta && (
        <EditorPregunta
          pregunta={editandoPregunta}
          setPregunta={setEditandoPregunta}
          onGuardar={guardarPregunta}
          onCancelar={() => {
            setEditandoPregunta(null)
            setError('')
          }}
        />
      )}
    </div>
  )
}

// ------------------------------------------------------------
// Ventana para crear o editar una pregunta
// ------------------------------------------------------------
function EditorPregunta({ pregunta, setPregunta, onGuardar, onCancelar }) {
  const cambiar = (campo, valor) => setPregunta({ ...pregunta, [campo]: valor })
  const cambiarConfig = (campo, valor) =>
    setPregunta({ ...pregunta, config: { ...(pregunta.config ?? {}), [campo]: valor } })

  const opciones = pregunta.config?.opciones ?? []

  const cambiarTipo = (tipo) => {
    // Al pasar a "opciones" se precargan alternativas de ejemplo.
    const config =
      tipo === 'opciones' && opciones.length === 0 ? { opciones: OPCIONES_POR_DEFECTO } : {}
    setPregunta({ ...pregunta, tipo, config })
  }

  const cambiarOpcion = (i, campo, valor) => {
    const nuevas = opciones.map((o, idx) => (idx === i ? { ...o, [campo]: valor } : o))
    cambiarConfig('opciones', nuevas)
  }

  const agregarOpcion = () =>
    cambiarConfig('opciones', [
      ...opciones,
      { valor: `opcion_${opciones.length + 1}`, etiqueta: '', alerta: false }
    ])

  const quitarOpcion = (i) =>
    cambiarConfig(
      'opciones',
      opciones.filter((_, idx) => idx !== i)
    )

  const ayuda = TIPOS_PREGUNTA.find((t) => t.value === pregunta.tipo)?.ayuda

  return (
    <div className="modal-fondo" onClick={onCancelar}>
      <div className="modal-caja modal-ancho" onClick={(e) => e.stopPropagation()}>
        <h3>{pregunta.id ? 'Editar pregunta' : 'Nueva pregunta'}</h3>

        <div className="form">
          <label>
            Texto de la pregunta
            <input
              value={pregunta.etiqueta}
              onChange={(e) => cambiar('etiqueta', e.target.value)}
              placeholder="Ej: Nivel de combustible"
              autoFocus
            />
          </label>

          <label>
            Tipo de respuesta
            <select value={pregunta.tipo} onChange={(e) => cambiarTipo(e.target.value)}>
              {TIPOS_PREGUNTA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {ayuda && <p className="muted-chico">{ayuda}</p>}

          {pregunta.tipo === 'opciones' && (
            <div className="bloque-opciones">
              <p className="muted-chico">
                Marca la casilla de las opciones que deben generar alerta.
              </p>
              {opciones.map((o, i) => (
                <div key={i} className="fila-opcion">
                  <input
                    value={o.etiqueta}
                    onChange={(e) => cambiarOpcion(i, 'etiqueta', e.target.value)}
                    placeholder="Texto de la opción"
                  />
                  <label className="check-alerta">
                    <input
                      type="checkbox"
                      checked={!!o.alerta}
                      onChange={(e) => cambiarOpcion(i, 'alerta', e.target.checked)}
                    />
                    alerta
                  </label>
                  <button type="button" className="btn-mini peligro" onClick={() => quitarOpcion(i)}>
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn-mini" onClick={agregarOpcion}>
                + Agregar opción
              </button>
            </div>
          )}

          {pregunta.tipo === 'numero' && (
            <>
              <label>
                Unidad (opcional)
                <input
                  value={pregunta.config?.unidad ?? ''}
                  onChange={(e) => cambiarConfig('unidad', e.target.value)}
                  placeholder="km, h, PSI…"
                />
              </label>
              <div className="fila-doble">
                <label>
                  Alertar si es menor que
                  <input
                    type="number"
                    value={pregunta.config?.alerta_menor_que ?? ''}
                    onChange={(e) =>
                      cambiarConfig(
                        'alerta_menor_que',
                        e.target.value === '' ? null : Number(e.target.value)
                      )
                    }
                  />
                </label>
                <label>
                  Alertar si es mayor que
                  <input
                    type="number"
                    value={pregunta.config?.alerta_mayor_que ?? ''}
                    onChange={(e) =>
                      cambiarConfig(
                        'alerta_mayor_que',
                        e.target.value === '' ? null : Number(e.target.value)
                      )
                    }
                  />
                </label>
              </div>
            </>
          )}

          {pregunta.tipo === 'texto' && (
            <label className="check-linea">
              <input
                type="checkbox"
                checked={!!pregunta.config?.alerta_si_tiene_texto}
                onChange={(e) => cambiarConfig('alerta_si_tiene_texto', e.target.checked)}
              />
              Generar alerta si se escribe algo
            </label>
          )}

          <label className="check-linea">
            <input
              type="checkbox"
              checked={!!pregunta.requerido}
              onChange={(e) => cambiar('requerido', e.target.checked)}
            />
            Obligatoria
          </label>

          <label className="check-linea">
            <input
              type="checkbox"
              checked={!!pregunta.genera_levantamiento}
              onChange={(e) => cambiar('genera_levantamiento', e.target.checked)}
            />
            Si genera alerta, crear también un levantamiento
          </label>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button className="btn-secundario" onClick={onCancelar}>
              Cancelar
            </button>
            <button className="btn-primario" onClick={onGuardar}>
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
