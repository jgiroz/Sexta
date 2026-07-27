import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { CATEGORIAS, etiquetaDe } from '../lib/constants'

export default function ConfiguracionCorreos() {
  const { esAdmin } = useAuth()
  const [filas, setFilas] = useState([])
  const [carros, setCarros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [categoria, setCategoria] = useState(CATEGORIAS[0].value)
  const [carroId, setCarroId] = useState('')
  const [email, setEmail] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = () => {
    setCargando(true)
    Promise.all([
      supabase
        .from('notificaciones_email')
        .select('id, categoria, carro_id, email, carros(codigo)')
        .order('categoria'),
      supabase.from('carros').select('id, codigo').eq('activo', true)
    ]).then(([{ data: not, error }, { data: car }]) => {
      if (error) setError(error.message)
      setFilas(not ?? [])
      setCarros(car ?? [])
      setCargando(false)
    })
  }

  useEffect(() => {
    if (esAdmin) cargar()
  }, [esAdmin])

  if (!esAdmin) return <Navigate to="/" replace />

  const agregar = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setGuardando(true)
    const { error } = await supabase.from('notificaciones_email').insert({
      categoria,
      carro_id: carroId || null,
      email: email.trim()
    })
    setGuardando(false)
    if (error) setError(error.message)
    else {
      setEmail('')
      cargar()
    }
  }

  const eliminar = async (id) => {
    const { error } = await supabase.from('notificaciones_email').delete().eq('id', id)
    if (error) setError(error.message)
    else cargar()
  }

  return (
    <div className="pagina">
      <Link to="/" className="btn-link">
        ← Volver
      </Link>
      <h2>Configuración de correos</h2>
      <p className="muted">
        Define a qué correos se debería avisar según la categoría (y opcionalmente el carro) del
        levantamiento. El envío automático de correos se activará en una próxima etapa; por ahora
        esto solo guarda la lista de destinatarios.
      </p>

      <form onSubmit={agregar} className="form">
        <label>
          Categoría
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Carro (opcional, solo si aplica a un carro específico)
          <select value={carroId} onChange={(e) => setCarroId(e.target.value)}>
            <option value="">— Todos / no aplica —</option>
            {carros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo}
              </option>
            ))}
          </select>
        </label>
        <label>
          Correo electrónico
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.cl"
          />
        </label>
        <button className="btn-primario" type="submit" disabled={guardando}>
          {guardando ? 'Agregando…' : 'Agregar destinatario'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {cargando && <p className="cargando">Cargando…</p>}

      {!cargando && (
        <table className="tabla-simple" style={{ marginTop: '1.5rem' }}>
          <thead>
            <tr>
              <th>Categoría</th>
              <th>Carro</th>
              <th>Correo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}>
                <td>{etiquetaDe(CATEGORIAS, f.categoria)}</td>
                <td>{f.carros?.codigo ?? '—'}</td>
                <td>{f.email}</td>
                <td>
                  <button className="btn-link" onClick={() => eliminar(f.id)}>
                    🗑 Quitar
                  </button>
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Sin destinatarios configurados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
