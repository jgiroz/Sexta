import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { ITEMS_MATERIAL_MAYOR } from '../lib/constants'

// Estado inicial del checklist: todo en OK, el cuartelero marca las excepciones.
function estadoInicial() {
  const inicial = {}
  ITEMS_MATERIAL_MAYOR.forEach((item) => {
    inicial[item.clave] = { estado: 'ok', descripcion: '' }
  })
  return inicial
}

export default function ReporteMaterialMayor() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [carros, setCarros] = useState([])
  const [carroId, setCarroId] = useState('')
  const [kilometraje, setKilometraje] = useState('')
  const [horasBomba, setHorasBomba] = useState('')
  const [items, setItems] = useState(estadoInicial)
  const [observaciones, setObservaciones] = useState('')

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [resumen, setResumen] = useState(null)

  useEffect(() => {
    supabase
      .from('carros')
      .select('id, codigo')
      .eq('activo', true)
      .order('codigo')
      .then(({ data }) => setCarros(data ?? []))
  }, [])

  const cambiarEstado = (clave, estado) => {
    setItems((prev) => ({
      ...prev,
      [clave]: { ...prev[clave], estado, descripcion: estado === 'ok' ? '' : prev[clave].descripcion }
    }))
  }

  const cambiarDescripcion = (clave, descripcion) => {
    setItems((prev) => ({ ...prev, [clave]: { ...prev[clave], descripcion } }))
  }

  const fallas = ITEMS_MATERIAL_MAYOR.filter((i) => items[i.clave].estado === 'falla')

  const enviar = async (e) => {
    e.preventDefault()
    setError('')

    if (!carroId) {
      setError('Selecciona el carro bomba.')
      return
    }

    const sinDescripcion = fallas.find((i) => !items[i.clave].descripcion.trim())
    if (sinDescripcion) {
      setError(`Describe la falla de "${sinDescripcion.etiqueta}".`)
      return
    }

    setGuardando(true)
    try {
      const codigoCarro = carros.find((c) => c.id === carroId)?.codigo ?? 'Carro'

      // Se guarda el checklist completo como JSON, con la etiqueta que
      // tenía el ítem al momento del reporte.
      const itemsGuardados = ITEMS_MATERIAL_MAYOR.map((i) => ({
        clave: i.clave,
        etiqueta: i.etiqueta,
        estado: items[i.clave].estado,
        descripcion: items[i.clave].descripcion.trim() || null
      }))

      const { data: reporte, error: errReporte } = await supabase
        .from('reportes_diarios')
        .insert({
          tipo: 'material_mayor',
          autor_id: session.user.id,
          carro_id: carroId,
          kilometraje: kilometraje === '' ? null : Number(kilometraje),
          horas_bomba: horasBomba === '' ? null : Number(horasBomba),
          items: itemsGuardados,
          observaciones: observaciones.trim() || null
        })
        .select('id')
        .single()

      if (errReporte) throw errReporte

      // Cada falla y las observaciones quedan como levantamiento asociado
      // al carro. Llevan origen 'reporte_diario' para que no salga un
      // correo por cada uno: el reporte ya manda un correo resumen.
      const nuevosLevantamientos = fallas.map((i) => ({
        titulo: `Material mayor · ${i.etiqueta} · ${codigoCarro}`,
        descripcion: items[i.clave].descripcion.trim(),
        categoria: 'carro',
        carro_id: carroId,
        prioridad: 'alta',
        reportado_por: session.user.id,
        origen: 'reporte_diario',
        reporte_id: reporte.id
      }))

      if (observaciones.trim()) {
        nuevosLevantamientos.push({
          titulo: `Observaciones reporte diario · ${codigoCarro}`,
          descripcion: observaciones.trim(),
          categoria: 'carro',
          carro_id: carroId,
          prioridad: 'media',
          reportado_por: session.user.id,
          origen: 'reporte_diario',
          reporte_id: reporte.id
        })
      }

      if (nuevosLevantamientos.length > 0) {
        const { error: errLev } = await supabase
          .from('levantamientos')
          .insert(nuevosLevantamientos)
        if (errLev) throw errLev
      }

      setResumen({
        carro: codigoCarro,
        fallas: fallas.length,
        levantamientos: nuevosLevantamientos.length
      })
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar el reporte')
    } finally {
      setGuardando(false)
    }
  }

  const nuevoReporte = () => {
    setResumen(null)
    setCarroId('')
    setKilometraje('')
    setHorasBomba('')
    setItems(estadoInicial())
    setObservaciones('')
  }

  if (resumen) {
    return (
      <div className="pagina">
        <h2>Reporte guardado</h2>
        <div className="aviso-ok">
          <div>
            Reporte diario de material mayor del carro <strong>{resumen.carro}</strong> registrado.
            {resumen.fallas > 0
              ? ` Se detectaron ${resumen.fallas} falla(s).`
              : ' Sin fallas detectadas.'}
            {resumen.levantamientos > 0 &&
              ` Se generaron ${resumen.levantamientos} levantamiento(s) y se envió el aviso por correo.`}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn-secundario" onClick={nuevoReporte}>
              Cargar otro reporte
            </button>
            <button className="btn-primario" onClick={() => navigate('/')}>
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pagina">
      <Link to="/" className="btn-link">
        ← Volver
      </Link>
      <h2>Reporte diario · Material mayor</h2>
      <p className="muted-chico">
        La fecha y hora se registran automáticamente al guardar.
      </p>

      <form onSubmit={enviar} className="form">
        <label>
          Carro bomba
          <select value={carroId} onChange={(e) => setCarroId(e.target.value)} required>
            <option value="">— Selecciona el carro —</option>
            {carros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo}
              </option>
            ))}
          </select>
        </label>

        <div className="fila-doble">
          <label>
            Kilometraje
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={kilometraje}
              onChange={(e) => setKilometraje(e.target.value)}
              placeholder="Ej: 45210"
            />
          </label>
          <label>
            Horas bomba
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={horasBomba}
              onChange={(e) => setHorasBomba(e.target.value)}
              placeholder="Ej: 1320.5"
            />
          </label>
        </div>

        <h3 className="subtitulo-seccion">Revisión de ítems</h3>

        {ITEMS_MATERIAL_MAYOR.map((item) => {
          const actual = items[item.clave]
          const esFalla = actual.estado === 'falla'
          return (
            <div key={item.clave} className={`item-checklist ${esFalla ? 'con-falla' : ''}`}>
              <div className="item-checklist-fila">
                <span className="item-checklist-nombre">{item.etiqueta}</span>
                <div className="item-checklist-botones">
                  <button
                    type="button"
                    className={`chip-estado ${!esFalla ? 'ok-activo' : ''}`}
                    onClick={() => cambiarEstado(item.clave, 'ok')}
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    className={`chip-estado ${esFalla ? 'falla-activo' : ''}`}
                    onClick={() => cambiarEstado(item.clave, 'falla')}
                  >
                    FALLA
                  </button>
                </div>
              </div>
              {esFalla && (
                <textarea
                  className="item-checklist-descripcion"
                  rows={3}
                  value={actual.descripcion}
                  onChange={(e) => cambiarDescripcion(item.clave, e.target.value)}
                  placeholder={`Describe la falla de ${item.etiqueta}…`}
                  autoFocus
                />
              )}
            </div>
          )
        })}

        <label>
          Observaciones
          <textarea
            rows={5}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Cualquier otra novedad del turno…"
          />
        </label>

        {fallas.length > 0 && (
          <p className="aviso-atencion">
            ⚠ {fallas.length} ítem(s) en falla. Se generará un levantamiento por cada uno y se
            enviará el aviso por correo.
          </p>
        )}

        {error && <p className="error">{error}</p>}

        <button className="btn-primario" type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar y enviar reporte'}
        </button>
      </form>
    </div>
  )
}
