import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { ESTADOS, ESTADOS_CERRADOS, etiquetaDe, colorDe } from '../lib/constants'
import Badge from '../components/Badge'
import EstadoCarros from '../components/EstadoCarros'

export default function ReportesCarros() {
  const [params, setParams] = useSearchParams()
  const carroDeUrl = params.get('carro') ?? 'todos'

  const [pestana, setPestana] = useState('novedades')
  const [carros, setCarros] = useState([])
  const [levantamientos, setLevantamientos] = useState([])
  const [reportes, setReportes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [soloAbiertos, setSoloAbiertos] = useState(true)
  const [filtroCarro, setFiltroCarro] = useState(carroDeUrl)
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

  // Mantiene el carro elegido en la dirección, para poder compartir el enlace.
  const cambiarCarro = (valor) => {
    setFiltroCarro(valor)
    if (valor === 'todos') setParams({})
    else setParams({ carro: valor })
  }

  const cargarNovedades = useCallback(async () => {
    setCargando(true)
    let consulta = supabase
      .from('levantamientos')
      .select('id, titulo, estado, prioridad, creado_at, carro_id, origen, carros(codigo)')
      .eq('categoria', 'carro')
      .order('creado_at', { ascending: false })

    if (soloAbiertos) {
      consulta = consulta.not('estado', 'in', `(${ESTADOS_CERRADOS.join(',')})`)
    }
    if (filtroCarro !== 'todos') consulta = consulta.eq('carro_id', filtroCarro)
    if (desde) consulta = consulta.gte('creado_at', `${desde}T00:00:00`)
    if (hasta) consulta = consulta.lte('creado_at', `${hasta}T23:59:59`)

    const { data, error } = await consulta
    if (error) setError(error.message)
    else setLevantamientos(data ?? [])
    setCargando(false)
  }, [soloAbiertos, filtroCarro, desde, hasta])

  const cargarReportes = useCallback(async () => {
    setCargando(true)
    let consulta = supabase
      .from('formulario_respuestas')
      .select(
        'id, creado_at, total_alertas, carro_id, carros(codigo), formularios(nombre), autor:profiles(nombre_completo), datos'
      )
      .order('creado_at', { ascending: false })
      .limit(200)

    if (filtroCarro !== 'todos') consulta = consulta.eq('carro_id', filtroCarro)
    if (desde) consulta = consulta.gte('creado_at', `${desde}T00:00:00`)
    if (hasta) consulta = consulta.lte('creado_at', `${hasta}T23:59:59`)

    const { data, error } = await consulta
    if (error) setError(error.message)
    else setReportes(data ?? [])
    setCargando(false)
  }, [filtroCarro, desde, hasta])

  useEffect(() => {
    if (pestana === 'novedades') cargarNovedades()
    else cargarReportes()
  }, [pestana, cargarNovedades, cargarReportes])

  // Extrae kilometraje y horas del detalle guardado en cada reporte.
  const medidaDe = (reporte, texto) => {
    const dato = (reporte.datos ?? []).find((d) =>
      (d.etiqueta ?? '').toLowerCase().includes(texto)
    )
    return dato?.respuesta && dato.respuesta !== '-' ? dato.respuesta : '—'
  }

  // Agrupa las novedades por carro, como pediste.
  const porCarro = {}
  levantamientos.forEach((l) => {
    const codigo = l.carros?.codigo ?? 'Sin carro'
    if (!porCarro[codigo]) porCarro[codigo] = []
    porCarro[codigo].push(l)
  })

  const limpiarFiltros = () => {
    setDesde('')
    setHasta('')
    cambiarCarro('todos')
  }

  return (
    <div className="pagina pagina-inicio">
      <Link to="/" className="btn-link">
        ← Volver
      </Link>
      <h2>Reportes Carros</h2>

      <EstadoCarros compacto />

      <div className="pestanas">
        <button
          className={`pestana ${pestana === 'novedades' ? 'activa' : ''}`}
          onClick={() => setPestana('novedades')}
        >
          📋 Novedades
        </button>
        <button
          className={`pestana ${pestana === 'reportes' ? 'activa' : ''}`}
          onClick={() => setPestana('reportes')}
        >
          🚒 Reportes enviados
        </button>
      </div>

      <div className="filtros-fecha">
        <label>
          Carro
          <select value={filtroCarro} onChange={(e) => cambiarCarro(e.target.value)}>
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
        {pestana === 'novedades' && (
          <label>
            Mostrar
            <select
              value={soloAbiertos ? 'abiertos' : 'todos'}
              onChange={(e) => setSoloAbiertos(e.target.value === 'abiertos')}
            >
              <option value="abiertos">Solo abiertas</option>
              <option value="todos">Todas</option>
            </select>
          </label>
        )}
        {(desde || hasta || filtroCarro !== 'todos') && (
          <button className="btn-link" onClick={limpiarFiltros}>
            Limpiar
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {cargando && <p className="cargando">Cargando…</p>}

      {/* ---------------- NOVEDADES ---------------- */}
      {pestana === 'novedades' && !cargando && (
        <>
          {levantamientos.length === 0 && (
            <p className="vacio">
              {soloAbiertos ? 'No hay novedades abiertas. 🎉' : 'Sin registros en este rango.'}
            </p>
          )}
          {Object.entries(porCarro).map(([codigo, items]) => (
            <section key={codigo} className="bloque-seccion">
              <div className="bloque-seccion-cabecera">
                <h3>{codigo}</h3>
                <span className="muted-chico">{items.length} novedad(es)</span>
              </div>
              <div className="lista-compacta" style={{ maxHeight: 'none', border: 'none' }}>
                {items.map((l) => (
                  <Link to={`/levantamiento/${l.id}`} key={l.id} className="fila-compacta">
                    <span
                      className="punto-estado"
                      style={{ background: colorDe(ESTADOS, l.estado) }}
                    />
                    <span className="fila-compacta-titulo">{l.titulo}</span>
                    <span className="fila-compacta-meta">
                      <Badge
                        texto={etiquetaDe(ESTADOS, l.estado)}
                        color={colorDe(ESTADOS, l.estado)}
                      />
                      {l.origen === 'formulario' && <Badge texto="reporte" color="#7f8c8d" />}
                      <span className="muted-chico fecha-compacta">
                        {new Date(l.creado_at).toLocaleDateString('es-CL')}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      {/* ---------------- REPORTES ENVIADOS ---------------- */}
      {pestana === 'reportes' && !cargando && (
        <>
          {reportes.length === 0 && <p className="vacio">No hay reportes en este rango.</p>}
          {reportes.length > 0 && (
            <div className="tabla-envoltorio">
              <table className="tabla-levantamientos">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Carro</th>
                    <th>Formulario</th>
                    <th>Realizado por</th>
                    <th>Kilometraje</th>
                    <th>Horas bomba</th>
                    <th>Alertas</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reportes.map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.creado_at).toLocaleString('es-CL')}</td>
                      <td>{r.carros?.codigo ?? '—'}</td>
                      <td>{r.formularios?.nombre ?? '—'}</td>
                      <td>{r.autor?.nombre_completo ?? '—'}</td>
                      <td>{medidaDe(r, 'kilometraje')}</td>
                      <td>{medidaDe(r, 'horas')}</td>
                      <td>
                        {r.total_alertas > 0 ? (
                          <Badge texto={`${r.total_alertas}`} color="#c0392b" />
                        ) : (
                          <Badge texto="0" color="#27ae60" />
                        )}
                      </td>
                      <td>
                        <Link to={`/reporte/${r.id}`}>ver</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
