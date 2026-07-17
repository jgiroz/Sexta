import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase, BUCKET_FACTURAS } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { CATEGORIAS, SUBCATEGORIAS_CARRO, ESTADOS, PRIORIDADES, etiquetaDe, colorDe } from '../lib/constants'
import Badge from '../components/Badge'

export default function DetalleLevantamiento() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session, esAdmin } = useAuth()

  const [item, setItem] = useState(null)
  const [comentarios, setComentarios] = useState([])
  const [facturas, setFacturas] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [eliminando, setEliminando] = useState(false)

  const [nuevoComentario, setNuevoComentario] = useState('')
  const [asignadoA, setAsignadoA] = useState('')
  const [estadoSel, setEstadoSel] = useState('')

  const [factProveedor, setFactProveedor] = useState('')
  const [factNumero, setFactNumero] = useState('')
  const [factMonto, setFactMonto] = useState('')
  const [factArchivo, setFactArchivo] = useState(null)
  const [subiendoFactura, setSubiendoFactura] = useState(false)

  const cargarTodo = useCallback(async () => {
    setCargando(true)
    const [{ data: lev, error: errLev }, { data: coms }, { data: facts }] = await Promise.all([
      supabase
        .from('levantamientos')
        .select(
          'id, titulo, descripcion, categoria, subcategoria, estado, prioridad, ubicacion, foto_url, creado_at, carro_id, asignado_a, reportado_por, carros(codigo, nombre), reportante:profiles!levantamientos_reportado_por_fkey(nombre_completo), responsable:profiles!levantamientos_asignado_a_fkey(nombre_completo)'
        )
        .eq('id', id)
        .single(),
      supabase
        .from('comentarios')
        .select('id, texto, creado_at, autor:profiles(nombre_completo)')
        .eq('levantamiento_id', id)
        .order('creado_at', { ascending: true }),
      supabase
        .from('facturas')
        .select('id, proveedor, numero_documento, monto, archivo_url, creado_at')
        .eq('levantamiento_id', id)
        .order('creado_at', { ascending: false })
    ])

    if (errLev) setError(errLev.message)
    setItem(lev)
    setComentarios(coms ?? [])
    setFacturas(facts ?? [])
    if (lev) {
      setAsignadoA(lev.asignado_a ?? '')
      setEstadoSel(lev.estado)
    }
    setCargando(false)
  }, [id])

  useEffect(() => {
    cargarTodo()
  }, [cargarTodo])

  useEffect(() => {
    if (esAdmin) {
      supabase
        .from('profiles')
        .select('id, nombre_completo')
        .eq('activo', true)
        .then(({ data }) => setPerfiles(data ?? []))
    }
  }, [esAdmin])

  const enviarComentario = async (e) => {
    e.preventDefault()
    if (!nuevoComentario.trim()) return
    const { error } = await supabase.from('comentarios').insert({
      levantamiento_id: id,
      autor_id: session.user.id,
      texto: nuevoComentario.trim()
    })
    if (!error) {
      setNuevoComentario('')
      cargarTodo()
    }
  }

  const guardarAsignacionYEstado = async () => {
    const { error } = await supabase
      .from('levantamientos')
      .update({ asignado_a: asignadoA || null, estado: estadoSel })
      .eq('id', id)
    if (!error) cargarTodo()
    else setError(error.message)
  }

  const eliminarLevantamiento = async () => {
    const confirmado = window.confirm(
      `¿Eliminar "${item.titulo}"? Esta acción no se puede deshacer (se borran también sus comentarios y facturas asociadas).`
    )
    if (!confirmado) return

    setEliminando(true)
    const { error } = await supabase.from('levantamientos').delete().eq('id', id)
    if (error) {
      setError(error.message)
      setEliminando(false)
    } else {
      navigate('/')
    }
  }

  const agregarFactura = async (e) => {
    e.preventDefault()
    setSubiendoFactura(true)
    try {
      let archivo_url = null
      if (factArchivo) {
        const ext = factArchivo.name.split('.').pop()
        const ruta = `${id}/${Date.now()}.${ext}`
        const { error: errSubida } = await supabase.storage
          .from(BUCKET_FACTURAS)
          .upload(ruta, factArchivo)
        if (errSubida) throw errSubida
        const { data: pub } = supabase.storage.from(BUCKET_FACTURAS).getPublicUrl(ruta)
        archivo_url = pub.publicUrl
      }

      const { error: errInsert } = await supabase.from('facturas').insert({
        levantamiento_id: id,
        proveedor: factProveedor,
        numero_documento: factNumero,
        monto: factMonto ? Number(factMonto) : null,
        archivo_url,
        subido_por: session.user.id
      })
      if (errInsert) throw errInsert

      setFactProveedor('')
      setFactNumero('')
      setFactMonto('')
      setFactArchivo(null)
      cargarTodo()
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar la factura')
    } finally {
      setSubiendoFactura(false)
    }
  }

  if (cargando) return <div className="pagina cargando">Cargando…</div>
  if (error && !item) return <div className="pagina error">{error}</div>
  if (!item) return <div className="pagina">No encontrado.</div>

  return (
    <div className="pagina">
      <Link to="/" className="btn-link">
        ← Volver
      </Link>

      <div className="tarjeta-badges" style={{ marginTop: '0.75rem' }}>
        <Badge texto={etiquetaDe(ESTADOS, item.estado)} color={colorDe(ESTADOS, item.estado)} />
        <Badge texto={etiquetaDe(PRIORIDADES, item.prioridad)} color={colorDe(PRIORIDADES, item.prioridad)} />
        <Badge texto={etiquetaDe(CATEGORIAS, item.categoria)} color="#34495e" />
        {item.subcategoria && (
          <Badge texto={etiquetaDe(SUBCATEGORIAS_CARRO, item.subcategoria)} color="#16a085" />
        )}
        {item.carros?.codigo && <Badge texto={item.carros.codigo} color="#2c3e50" />}
      </div>

      <h2>{item.titulo}</h2>
      {item.foto_url && <img src={item.foto_url} alt="" className="detalle-foto" />}
      <p>{item.descripcion}</p>
      {item.ubicacion && <p className="muted">📍 {item.ubicacion}</p>}
      <p className="muted-chico">
        Reportado por {item.reportante?.nombre_completo ?? '—'} el{' '}
        {new Date(item.creado_at).toLocaleString('es-CL')}
      </p>
      <p className="muted-chico">
        Responsable asignado: {item.responsable?.nombre_completo ?? 'Sin asignar'}
      </p>

      {esAdmin && (
        <section className="seccion-admin">
          <h3>Gestión (admin)</h3>
          <label>
            Asignar responsable
            <select value={asignadoA} onChange={(e) => setAsignadoA(e.target.value)}>
              <option value="">— Sin asignar —</option>
              {perfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre_completo}
                </option>
              ))}
            </select>
          </label>

          <label>
            Estado
            <select value={estadoSel} onChange={(e) => setEstadoSel(e.target.value)}>
              {ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>

          <button className="btn-primario" onClick={guardarAsignacionYEstado}>
            Guardar cambios
          </button>

          <h4>Cargar factura / boleta</h4>
          <form onSubmit={agregarFactura} className="form">
            <label>
              Proveedor
              <input value={factProveedor} onChange={(e) => setFactProveedor(e.target.value)} />
            </label>
            <label>
              N° documento
              <input value={factNumero} onChange={(e) => setFactNumero(e.target.value)} />
            </label>
            <label>
              Monto
              <input
                type="number"
                step="0.01"
                value={factMonto}
                onChange={(e) => setFactMonto(e.target.value)}
              />
            </label>
            <label>
              Archivo (foto o PDF)
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFactArchivo(e.target.files?.[0] ?? null)}
              />
            </label>
            <button className="btn-secundario" type="submit" disabled={subiendoFactura}>
              {subiendoFactura ? 'Subiendo…' : 'Agregar factura'}
            </button>
          </form>

          <hr className="separador" />
          <button className="btn-peligro" onClick={eliminarLevantamiento} disabled={eliminando}>
            {eliminando ? 'Eliminando…' : '🗑 Eliminar levantamiento'}
          </button>
        </section>
      )}

      {facturas.length > 0 && (
        <section>
          <h3>Facturas / boletas</h3>
          <ul className="lista-facturas">
            {facturas.map((f) => (
              <li key={f.id}>
                <strong>{f.proveedor || 'Sin proveedor'}</strong>
                {f.numero_documento && ` · N° ${f.numero_documento}`}
                {f.monto != null && ` · $${Number(f.monto).toLocaleString('es-CL')}`}
                {f.archivo_url && (
                  <>
                    {' · '}
                    <a href={f.archivo_url} target="_blank" rel="noreferrer">
                      ver archivo
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3>Comentarios</h3>
        <ul className="lista-comentarios">
          {comentarios.map((c) => (
            <li key={c.id}>
              <strong>{c.autor?.nombre_completo ?? '—'}:</strong> {c.texto}
              <span className="muted-chico"> · {new Date(c.creado_at).toLocaleString('es-CL')}</span>
            </li>
          ))}
          {comentarios.length === 0 && <p className="muted">Aún no hay comentarios.</p>}
        </ul>

        <form onSubmit={enviarComentario} className="form-inline">
          <input
            type="text"
            placeholder="Escribe un comentario…"
            value={nuevoComentario}
            onChange={(e) => setNuevoComentario(e.target.value)}
          />
          <button className="btn-secundario" type="submit">
            Enviar
          </button>
        </form>
      </section>

      {error && <p className="error">{error}</p>}
    </div>
  )
}
