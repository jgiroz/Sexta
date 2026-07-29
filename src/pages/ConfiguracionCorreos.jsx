import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { CATEGORIAS, etiquetaDe } from '../lib/constants'

const TIPOS_REPORTE = [
  { value: 'material_mayor', label: 'Material mayor' },
  { value: 'equipos_motorizados', label: 'Equipos motorizados' }
]

// Dominios que no existen en internet (las cuentas internas de cuartelero).
// Deben coincidir con el filtro de la Edge Function.
const DOMINIOS_INTERNOS = ['.local', '.invalid', '.test', '.example']

function esCorreoEntregable(correo) {
  const limpio = (correo ?? '').trim().toLowerCase()
  if (!limpio.includes('@')) return false
  return !DOMINIOS_INTERNOS.some((d) => limpio.endsWith(d))
}

export default function ConfiguracionCorreos() {
  const { esAdmin } = useAuth()
  const [filas, setFilas] = useState([])
  const [carros, setCarros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [ambito, setAmbito] = useState('levantamiento')
  const [categoria, setCategoria] = useState(CATEGORIAS[0].value)
  const [tipoReporte, setTipoReporte] = useState(TIPOS_REPORTE[0].value)
  const [carroId, setCarroId] = useState('')
  const [email, setEmail] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = () => {
    setCargando(true)
    Promise.all([
      supabase
        .from('notificaciones_email')
        .select('id, categoria, tipo_reporte, carro_id, email, carros(codigo)')
        .order('creado_at'),
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

    if (!esCorreoEntregable(email)) {
      setError(
        'Esa dirección no puede recibir correos. Las cuentas internas (por ejemplo ' +
          'l6@sexta.local) no existen en internet. Usa un correo real; si es para avisarle a ' +
          'un cuartelero, cárgalo en su ficha en la página Usuarios, campo "Correo de contacto".'
      )
      return
    }

    setGuardando(true)
    setError('')

    const fila =
      ambito === 'levantamiento'
        ? { categoria, tipo_reporte: null, carro_id: carroId || null, email: email.trim() }
        : { categoria: null, tipo_reporte: tipoReporte, carro_id: null, email: email.trim() }

    const { error } = await supabase.from('notificaciones_email').insert(fila)
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

  const deLevantamientos = filas.filter((f) => f.categoria)
  const deReportes = filas.filter((f) => f.tipo_reporte)

  return (
    <div className="pagina">
      <Link to="/" className="btn-link">
        ← Volver
      </Link>
      <h2>Configuración de correos</h2>
      <p className="muted">
        Define a quién se le avisa por correo. Los levantamientos se notifican al crearse y al
        cerrarse; los reportes diarios, al enviarse.
      </p>

      <form onSubmit={agregar} className="form">
        <label>
          ¿Para qué es este destinatario?
          <select value={ambito} onChange={(e) => setAmbito(e.target.value)}>
            <option value="levantamiento">Levantamientos de problemas</option>
            <option value="reporte">Reportes diarios de cuarteleros</option>
          </select>
        </label>

        {ambito === 'levantamiento' ? (
          <>
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
          </>
        ) : (
          <label>
            Tipo de reporte diario
            <select value={tipoReporte} onChange={(e) => setTipoReporte(e.target.value)}>
              {TIPOS_REPORTE.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        )}

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
        <>
          <h3 className="subtitulo-seccion">Levantamientos</h3>
          <table className="tabla-simple">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Carro</th>
                <th>Correo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deLevantamientos.map((f) => (
                <tr key={f.id}>
                  <td>{etiquetaDe(CATEGORIAS, f.categoria)}</td>
                  <td>{f.carros?.codigo ?? 'Todos'}</td>
                  <td>{f.email}</td>
                  <td>
                    <button className="btn-link" onClick={() => eliminar(f.id)}>
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
              {deLevantamientos.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Sin destinatarios configurados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <h3 className="subtitulo-seccion">Reportes diarios</h3>
          <table className="tabla-simple">
            <thead>
              <tr>
                <th>Tipo de reporte</th>
                <th>Correo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {deReportes.map((f) => (
                <tr key={f.id}>
                  <td>{etiquetaDe(TIPOS_REPORTE, f.tipo_reporte)}</td>
                  <td>{f.email}</td>
                  <td>
                    <button className="btn-link" onClick={() => eliminar(f.id)}>
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
              {deReportes.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    Sin destinatarios configurados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
