import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { ESTADOS, ESTADOS_CERRADOS, etiquetaDe, colorDe } from '../lib/constants'
import Badge from '../components/Badge'

export default function RevisarObservaciones() {
  const [pestana, setPestana] = useState('observaciones')

  const [carros, setCarros] = useState([])
  const [levantamientos, setLevantamientos] = useState([])
  const [reportes, setReportes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [soloAbiertos, setSoloAbiertos] = useState(true)
  const [filtroCarro, setFiltroCarro] = useState('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  useEffect(() => {
    supabase
      .from('carros')
      .select('id, codigo')
      .eq('activo', true)
      .order('codigo')
      .then(({ data }) => setCarros(data ?? []))
  }, [])

  const cargarObservaciones = useCallback(async () => {
    setCargando(true)
    let consulta = supabase
      .from('levantamientos')
      .select('id, titulo, estado, prioridad, creado_at, carro_id, origen, carros(codigo)')
      .eq('categoria', 'carro')
      .order('creado_at', { ascending: false })

    if (soloAbiertos) {
      consulta = consulta.not('estado', 'in', `(${ESTADOS_CERRADOS.join(',')})`)
    }
    if (filtroCarro !== 'todos') {
      consulta = consulta.eq('carro_id', filtroCarro)
    }

    const { data, error } = await consulta
    if (error) setError(error.message)
    else setLevantamientos(data ?? [])
    setCargando(false)
  }, [soloAbiertos, filtroCarro])

  const cargarHorometros = useCallback(async () => {
    setCargando(true)
    let consulta = supabase
      .from('reportes_diarios')
      .select('id, creado_at, kilometraje, horas_bomba, carro_id, carros(codigo)')
      .eq('tipo', 'material_mayor')
      .order('creado_at', { ascending: false })

    if (filtroCarro !== 'todos') consulta = consulta.eq('carro_id', filtroCarro)
    if (desde) consulta = consulta.gte('creado_at', `${desde}T00:00:00`)
    if (hasta) consulta = consulta.lte('creado_at', `${hasta}T23:59:59`)

    const { data, error } = await consulta
    if (error) setError(error.message)
    else setReportes(data ?? [])
    setCargando(false)
  }, [filtroCarro, desde, hasta])

  useEffect(() => {
    if (pestana === 'observaciones') cargarObservaciones()
    else cargarHorometros()
  }, [pestana, cargarObservaciones, cargarHorometros])

  const conteo = {
    abiertos: levantamientos.filter((l) => l.estado === 'pendiente').length,
    asignados: levantamientos.filter((l) => l.estado === 'asignado' || l.estado === 'en_progreso')
      .length,
    cerrados: levantamientos.filter((l) => ESTADOS_CERRADOS.includes(l.estado)).length
  }

  return (
    <div className="pagina">
      <Link to="/" className="btn-link">
        ← Volver
      </Link>
      <h2>Revisar observaciones</h2>

      <div className="pestanas">
        <button
          className={`pestana ${pestana === 'observaciones' ? 'activa' : ''}`}
          onClick={() => setPestana('observaciones')}
        >
          📋 Observaciones
        </button>
        <button
          className={`pestana ${pestana === 'horometros' ? 'activa' : ''}`}
          onClick={() => setPestana('horometros')}
        >
          ⏱ Horómetros
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {pestana === 'observaciones' && (
        <>
          <div className="filtros">
            <button
              className={`chip-filtro ${soloAbiertos ? 'activo' : ''}`}
              onClick={() => setSoloAbiertos(true)}
            >
              Abiertos
            </button>
            <button
              className={`chip-filtro ${!soloAbiertos ? 'activo' : ''}`}
              onClick={() => setSoloAbiertos(false)}
            >
              Todos
            </button>
            <select
              className="select-filtro-carro"
              value={filtroCarro}
              onChange={(e) => setFiltroCarro(e.target.value)}
            >
              <option value="todos">Todos los carros</option>
              {carros.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo}
                </option>
              ))}
            </select>
          </div>

          {!cargando && levantamientos.length > 0 && (
            <p className="muted-chico">
              {conteo.abiertos} pendiente(s) · {conteo.asignados} en curso · {conteo.cerrados}{' '}
              cerrado(s)
            </p>
          )}

          {cargando && <p className="cargando">Cargando…</p>}
          {!cargando && levantamientos.length === 0 && (
            <p className="vacio">
              {soloAbiertos ? 'No hay observaciones abiertas. 🎉' : 'Sin registros.'}
            </p>
          )}

          {!cargando && levantamientos.length > 0 && (
            <table className="tabla-simple">
              <thead>
                <tr>
                  <th>Detalle</th>
                  <th>Carro</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {levantamientos.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link to={`/levantamiento/${l.id}`}>{l.titulo}</Link>
                      {l.origen === 'reporte_diario' && (
                        <span className="muted-chico"> · reporte diario</span>
                      )}
                    </td>
                    <td>{l.carros?.codigo ?? '—'}</td>
                    <td>
                      <Badge
                        texto={etiquetaDe(ESTADOS, l.estado)}
                        color={colorDe(ESTADOS, l.estado)}
                      />
                    </td>
                    <td className="muted-chico">
                      {new Date(l.creado_at).toLocaleDateString('es-CL')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {pestana === 'horometros' && (
        <>
          <div className="filtros-fecha">
            <label>
              Carro
              <select value={filtroCarro} onChange={(e) => setFiltroCarro(e.target.value)}>
                <option value="todos">Todos</option>
                {carros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Desde
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label>
              Hasta
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </label>
            {(desde || hasta || filtroCarro !== 'todos') && (
              <button
                className="btn-link"
                onClick={() => {
                  setDesde('')
                  setHasta('')
                  setFiltroCarro('todos')
                }}
              >
                Limpiar
              </button>
            )}
          </div>

          {cargando && <p className="cargando">Cargando…</p>}
          {!cargando && reportes.length === 0 && (
            <p className="vacio">No hay reportes en este rango.</p>
          )}

          {!cargando && reportes.length > 0 && (
            <table className="tabla-simple">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Carro</th>
                  <th>Kilometraje</th>
                  <th>Horas bomba</th>
                </tr>
              </thead>
              <tbody>
                {reportes.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.creado_at).toLocaleString('es-CL')}</td>
                    <td>{r.carros?.codigo ?? '—'}</td>
                    <td>
                      {r.kilometraje != null
                        ? Number(r.kilometraje).toLocaleString('es-CL')
                        : '—'}
                    </td>
                    <td>
                      {r.horas_bomba != null
                        ? Number(r.horas_bomba).toLocaleString('es-CL')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
