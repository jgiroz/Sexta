import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { ESTADOS, PRIORIDADES, etiquetaDe, colorDe } from '../lib/constants'
import Badge from '../components/Badge'

function usePantallaAncha(minWidth = 900) {
  const [ancha, setAncha] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= minWidth : false
  )
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`)
    const actualizar = () => setAncha(mq.matches)
    actualizar()
    mq.addEventListener('change', actualizar)
    return () => mq.removeEventListener('change', actualizar)
  }, [minWidth])
  return ancha
}

export default function Home() {
  const { session, esAdmin } = useAuth()
  const pantallaAncha = usePantallaAncha(900)
  const vistaTabla = esAdmin && pantallaAncha

  const [levantamientos, setLevantamientos] = useState([])
  const [carros, setCarros] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroCarro, setFiltroCarro] = useState('todos')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    let query = supabase
      .from('levantamientos')
      .select(
        'id, titulo, categoria, subcategoria, estado, prioridad, ubicacion, foto_url, creado_at, carro_id, asignado_a, carros(codigo), responsable:profiles!levantamientos_asignado_a_fkey(nombre_completo)'
      )
      .order('creado_at', { ascending: false })

    if (filtroEstado !== 'todos') query = query.eq('estado', filtroEstado)
    if (filtroCarro !== 'todos') query = query.eq('carro_id', filtroCarro)

    const { data, error } = await query
    if (error) setError(error.message)
    else setLevantamientos(data ?? [])
    setCargando(false)
  }, [filtroEstado, filtroCarro])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    supabase
      .from('carros')
      .select('id, codigo, nombre')
      .eq('activo', true)
      .then(({ data }) => setCarros(data ?? []))
  }, [])

  useEffect(() => {
    if (esAdmin) {
      supabase
        .from('profiles')
        .select('id, nombre_completo')
        .eq('activo', true)
        .then(({ data }) => setPerfiles(data ?? []))
    }
  }, [esAdmin])

  const actualizarEstado = async (id, estado) => {
    const { error } = await supabase.from('levantamientos').update({ estado }).eq('id', id)
    if (!error) cargar()
    else setError(error.message)
  }

  const actualizarAsignado = async (id, asignado_a) => {
    const { error } = await supabase
      .from('levantamientos')
      .update({ asignado_a: asignado_a || null })
      .eq('id', id)
    if (!error) cargar()
    else setError(error.message)
  }

  const misAsignados = levantamientos.filter((l) => l.asignado_a === session?.user?.id)
  const otros = levantamientos.filter((l) => l.asignado_a !== session?.user?.id)

  const renderTarjeta = (l) => (
    <Link to={`/levantamiento/${l.id}`} key={l.id} className="tarjeta-item">
      {l.foto_url && <img src={l.foto_url} alt="" className="tarjeta-foto" />}
      <div className="tarjeta-contenido">
        <div className="tarjeta-badges">
          <Badge texto={etiquetaDe(ESTADOS, l.estado)} color={colorDe(ESTADOS, l.estado)} />
          <Badge texto={etiquetaDe(PRIORIDADES, l.prioridad)} color={colorDe(PRIORIDADES, l.prioridad)} />
          {l.carros?.codigo && <Badge texto={l.carros.codigo} color="#34495e" />}
        </div>
        <h3>{l.titulo}</h3>
        {l.ubicacion && <p className="muted">📍 {l.ubicacion}</p>}
        <p className="muted-chico">{new Date(l.creado_at).toLocaleString('es-CL')}</p>
      </div>
    </Link>
  )

  return (
    <div className="pagina">
      <div className="pagina-header">
        <h2>Levantamientos</h2>
        <Link to="/nuevo" className="btn-primario btn-fab-like">
          + Nuevo
        </Link>
      </div>

      <div className="filtros">
        <button
          className={`chip-filtro ${filtroEstado === 'todos' ? 'activo' : ''}`}
          onClick={() => setFiltroEstado('todos')}
        >
          Todos
        </button>
        {ESTADOS.map((e) => (
          <button
            key={e.value}
            className={`chip-filtro ${filtroEstado === e.value ? 'activo' : ''}`}
            onClick={() => setFiltroEstado(e.value)}
          >
            {e.label}
          </button>
        ))}
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

      {error && <p className="error">{error}</p>}
      {cargando && <p className="cargando">Cargando…</p>}

      {!cargando && levantamientos.length === 0 && (
        <p className="vacio">No hay levantamientos con este filtro.</p>
      )}

      {!cargando && levantamientos.length > 0 && vistaTabla && (
        <div className="tabla-envoltorio">
          <table className="tabla-levantamientos">
            <thead>
              <tr>
                <th>Título</th>
                <th>Categoría</th>
                <th>Carro</th>
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Asignado a</th>
                <th>Fecha</th>
                <th>Foto</th>
              </tr>
            </thead>
            <tbody>
              {levantamientos.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link to={`/levantamiento/${l.id}`}>{l.titulo}</Link>
                  </td>
                  <td>
                    {etiquetaDe(
                      [
                        { value: 'infraestructura', label: 'Cuartel' },
                        { value: 'carro', label: 'Carro bomba' },
                        { value: 'epp', label: 'EPP' },
                        { value: 'otro', label: 'Otro' }
                      ],
                      l.categoria
                    )}
                    {l.subcategoria && ` · ${l.subcategoria === 'material_menor' ? 'Material menor' : 'Material motorizado'}`}
                  </td>
                  <td>{l.carros?.codigo ?? '—'}</td>
                  <td>
                    <select value={l.estado} onChange={(e) => actualizarEstado(l.id, e.target.value)}>
                      {ESTADOS.map((e) => (
                        <option key={e.value} value={e.value}>
                          {e.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Badge texto={etiquetaDe(PRIORIDADES, l.prioridad)} color={colorDe(PRIORIDADES, l.prioridad)} />
                  </td>
                  <td>
                    <select
                      value={l.asignado_a ?? ''}
                      onChange={(e) => actualizarAsignado(l.id, e.target.value)}
                    >
                      <option value="">— Sin asignar —</option>
                      {perfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre_completo}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="muted-chico">{new Date(l.creado_at).toLocaleDateString('es-CL')}</td>
                  <td>
                    {l.foto_url ? (
                      <a href={l.foto_url} target="_blank" rel="noreferrer">
                        ver foto
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!cargando && levantamientos.length > 0 && !vistaTabla && (
        <>
          {misAsignados.length > 0 && (
            <>
              <h3 className="subtitulo-seccion">Asignados a ti</h3>
              <div className="lista">{misAsignados.map(renderTarjeta)}</div>
            </>
          )}
          <h3 className="subtitulo-seccion">
            {misAsignados.length > 0 ? 'Otros levantamientos' : 'Levantamientos'}
          </h3>
          <div className="lista">{otros.map(renderTarjeta)}</div>
        </>
      )}
    </div>
  )
}
