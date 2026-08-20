import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import {
  respuestaVacia,
  motivoDeAlerta,
  textoDeRespuesta,
  estaSinResponder
} from '../lib/formularios'

export default function LlenarFormulario() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [formulario, setFormulario] = useState(null)
  const [secciones, setSecciones] = useState([])
  const [preguntas, setPreguntas] = useState([])
  const [respuestas, setRespuestas] = useState({})
  const [observaciones, setObservaciones] = useState('')

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [resumen, setResumen] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const [{ data: form, error: errForm }, { data: secs }] = await Promise.all([
      supabase
        .from('formularios')
        .select('id, nombre, descripcion, carro_id, carros(codigo)')
        .eq('id', id)
        .single(),
      supabase.from('formulario_secciones').select('*').eq('formulario_id', id).order('orden')
    ])

    if (errForm) {
      setError(errForm.message)
      setCargando(false)
      return
    }

    setFormulario(form)
    setSecciones(secs ?? [])

    const ids = (secs ?? []).map((s) => s.id)
    let pregs = []
    if (ids.length > 0) {
      const { data } = await supabase
        .from('formulario_preguntas')
        .select('*')
        .in('seccion_id', ids)
        .eq('activo', true)
        .order('orden')
      pregs = data ?? []
    }
    setPreguntas(pregs)

    const iniciales = {}
    pregs.forEach((p) => {
      iniciales[p.id] = respuestaVacia(p)
    })
    setRespuestas(iniciales)
    setCargando(false)
  }, [id])

  useEffect(() => {
    cargar()
  }, [cargar])

  const actualizar = (preguntaId, cambios) => {
    setRespuestas((prev) => ({ ...prev, [preguntaId]: { ...prev[preguntaId], ...cambios } }))
  }

  const conAlerta = preguntas.filter((p) => motivoDeAlerta(p, respuestas[p.id] ?? {}))

  const enviar = async (e) => {
    e.preventDefault()
    setError('')

    // Obligatorias sin responder
    const faltante = preguntas.find(
      (p) => p.requerido && estaSinResponder(p, respuestas[p.id] ?? {})
    )
    if (faltante) {
      setError(`Falta responder "${faltante.etiqueta}".`)
      return
    }

    // Toda FALLA necesita descripción
    const sinDescripcion = preguntas.find(
      (p) =>
        p.tipo === 'ok_falla' &&
        respuestas[p.id]?.estado === 'falla' &&
        !respuestas[p.id]?.descripcion?.trim()
    )
    if (sinDescripcion) {
      setError(`Describe la falla de "${sinDescripcion.etiqueta}".`)
      return
    }

    setGuardando(true)
    try {
      const codigoCarro = formulario.carros?.codigo ?? null

      // Se guarda una copia completa de las preguntas y sus respuestas,
      // para que editar el formulario después no altere este registro.
      const datos = preguntas.map((p) => {
        const r = respuestas[p.id] ?? {}
        const motivo = motivoDeAlerta(p, r)
        const seccion = secciones.find((s) => s.id === p.seccion_id)
        return {
          pregunta_id: p.id,
          seccion: seccion?.titulo ?? '',
          etiqueta: p.etiqueta,
          tipo: p.tipo,
          respuesta: textoDeRespuesta(p, r),
          descripcion: p.tipo === 'ok_falla' ? r.descripcion?.trim() || null : null,
          alerta: !!motivo,
          motivo: motivo ?? null,
          genera_levantamiento: p.genera_levantamiento
        }
      })

      const alertas = datos.filter((d) => d.alerta)

      const { data: respuesta, error: errResp } = await supabase
        .from('formulario_respuestas')
        .insert({
          formulario_id: id,
          carro_id: formulario.carro_id,
          autor_id: session.user.id,
          datos,
          total_alertas: alertas.length,
          observaciones: observaciones.trim() || null
        })
        .select('id')
        .single()

      if (errResp) throw errResp

      // Cada alerta marcada para ello queda además como levantamiento.
      // Llevan origen 'formulario' para no disparar un correo por cada una:
      // el formulario manda un único correo resumen.
      const nuevos = alertas
        .filter((a) => a.genera_levantamiento)
        .map((a) => ({
          titulo: `${a.seccion} · ${a.etiqueta}${codigoCarro ? ` · ${codigoCarro}` : ''}`,
          descripcion: a.motivo,
          categoria: 'carro',
          carro_id: formulario.carro_id,
          prioridad: 'alta',
          reportado_por: session.user.id,
          origen: 'formulario'
        }))

      if (observaciones.trim()) {
        nuevos.push({
          titulo: `Observaciones ${formulario.nombre}${codigoCarro ? ` · ${codigoCarro}` : ''}`,
          descripcion: observaciones.trim(),
          categoria: 'carro',
          carro_id: formulario.carro_id,
          prioridad: 'media',
          reportado_por: session.user.id,
          origen: 'formulario'
        })
      }

      if (nuevos.length > 0) {
        const { error: errLev } = await supabase.from('levantamientos').insert(nuevos)
        if (errLev) throw errLev
      }

      setResumen({
        alertas: alertas.length,
        levantamientos: nuevos.length,
        respuestaId: respuesta.id
      })
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar el formulario')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <div className="pagina cargando">Cargando…</div>
  if (error && !formulario) return <div className="pagina error">{error}</div>
  if (!formulario) return <div className="pagina">Formulario no encontrado.</div>

  if (resumen) {
    return (
      <div className="pagina">
        <h2>Formulario enviado</h2>
        <div className="aviso-ok">
          <div>
            {resumen.alertas === 0
              ? 'Sin novedades: no se detectaron alertas.'
              : `Se registraron ${resumen.alertas} alerta(s).`}
            {resumen.levantamientos > 0 &&
              ` Se generaron ${resumen.levantamientos} levantamiento(s) y se envió el correo resumen.`}
          </div>
          <button className="btn-primario" onClick={() => navigate('/')}>
            Volver al inicio
          </button>
        </div>
      </div>
    )
  }

  const seccionesOrdenadas = [...secciones].sort((a, b) => a.orden - b.orden)

  return (
    <div className="pagina">
      <Link to="/" className="btn-link">
        ← Volver
      </Link>
      <h2>{formulario.nombre}</h2>
      <p className="muted-chico">
        {formulario.carros?.codigo ? `Carro ${formulario.carros.codigo} · ` : ''}
        La fecha y hora se registran automáticamente al enviar.
      </p>

      <form onSubmit={enviar} className="form">
        {seccionesOrdenadas.map((seccion) => {
          const suyas = preguntas
            .filter((p) => p.seccion_id === seccion.id)
            .sort((a, b) => a.orden - b.orden)
          if (suyas.length === 0) return null

          return (
            <div key={seccion.id}>
              <h3 className="subtitulo-seccion">{seccion.titulo}</h3>
              {suyas.map((p) => (
                <CampoPregunta
                  key={p.id}
                  pregunta={p}
                  respuesta={respuestas[p.id] ?? {}}
                  onCambio={(cambios) => actualizar(p.id, cambios)}
                />
              ))}
            </div>
          )
        })}

        <h3 className="subtitulo-seccion">Observaciones generales</h3>
        <label>
          <textarea
            rows={4}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Cualquier otra novedad del turno…"
          />
        </label>

        {conAlerta.length > 0 && (
          <p className="aviso-atencion">
            ⚠ {conAlerta.length} alerta(s) detectada(s). Se enviarán en un solo correo resumen.
          </p>
        )}

        {error && <p className="error">{error}</p>}

        <button className="btn-primario" type="submit" disabled={guardando}>
          {guardando ? 'Enviando…' : 'Guardar y enviar'}
        </button>
      </form>
    </div>
  )
}

// ------------------------------------------------------------
// Un campo, según el tipo de pregunta
// ------------------------------------------------------------
function CampoPregunta({ pregunta, respuesta, onCambio }) {
  const motivo = motivoDeAlerta(pregunta, respuesta)
  const config = pregunta.config ?? {}

  if (pregunta.tipo === 'ok_falla') {
    const esFalla = respuesta.estado === 'falla'
    return (
      <div className={`item-checklist ${esFalla ? 'con-falla' : ''}`}>
        <div className="item-checklist-fila">
          <span className="item-checklist-nombre">{pregunta.etiqueta}</span>
          <div className="item-checklist-botones">
            <button
              type="button"
              className={`chip-estado ${!esFalla ? 'ok-activo' : ''}`}
              onClick={() => onCambio({ estado: 'ok', descripcion: '' })}
            >
              OK
            </button>
            <button
              type="button"
              className={`chip-estado ${esFalla ? 'falla-activo' : ''}`}
              onClick={() => onCambio({ estado: 'falla' })}
            >
              FALLA
            </button>
          </div>
        </div>
        {esFalla && (
          <textarea
            className="item-checklist-descripcion"
            rows={3}
            value={respuesta.descripcion ?? ''}
            onChange={(e) => onCambio({ descripcion: e.target.value })}
            placeholder={`Describe la falla de ${pregunta.etiqueta}…`}
          />
        )}
      </div>
    )
  }

  if (pregunta.tipo === 'opciones') {
    return (
      <div className={`item-checklist ${motivo ? 'con-falla' : ''}`}>
        <div className="item-checklist-nombre">
          {pregunta.etiqueta}
          {pregunta.requerido && <span className="marca-obligatoria"> *</span>}
        </div>
        <div className="grupo-opciones">
          {(config.opciones ?? []).map((o) => (
            <button
              key={o.valor}
              type="button"
              className={`chip-opcion ${respuesta.valor === o.valor ? 'activa' : ''} ${
                o.alerta ? 'es-alerta' : ''
              }`}
              onClick={() => onCambio({ valor: o.valor })}
            >
              {o.etiqueta}
            </button>
          ))}
        </div>
        {motivo && <p className="texto-alerta">⚠ {motivo}</p>}
      </div>
    )
  }

  if (pregunta.tipo === 'numero') {
    return (
      <label>
        {pregunta.etiqueta}
        {config.unidad ? ` (${config.unidad})` : ''}
        {pregunta.requerido && <span className="marca-obligatoria"> *</span>}
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={respuesta.numero ?? ''}
          onChange={(e) => onCambio({ numero: e.target.value })}
        />
        {motivo && <span className="texto-alerta">⚠ {motivo}</span>}
      </label>
    )
  }

  return (
    <label>
      {pregunta.etiqueta}
      {pregunta.requerido && <span className="marca-obligatoria"> *</span>}
      <textarea
        rows={3}
        value={respuesta.texto ?? ''}
        onChange={(e) => onCambio({ texto: e.target.value })}
      />
      {motivo && <span className="texto-alerta">⚠ Genera alerta</span>}
    </label>
  )
}
