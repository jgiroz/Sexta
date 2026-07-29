import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

const ROLES = [
  { value: 'usuario', label: 'Usuario' },
  { value: 'admin', label: 'Admin' }
]
const TIPOS = [
  { value: 'voluntario', label: 'Voluntario' },
  { value: 'oficial', label: 'Oficial' },
  { value: 'cuartelero', label: 'Cuartelero' }
]

export default function GestionUsuarios() {
  const { esAdmin } = useAuth()
  const [perfiles, setPerfiles] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [guardandoId, setGuardandoId] = useState(null)

  const cargar = () => {
    setCargando(true)
    supabase
      .from('profiles')
      .select('id, nombre_completo, rol, tipo, telefono, activo, email_contacto')
      .order('nombre_completo')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setPerfiles(data ?? [])
        setCargando(false)
      })
  }

  useEffect(() => {
    if (esAdmin) cargar()
  }, [esAdmin])

  if (!esAdmin) return <Navigate to="/" replace />

  const actualizarCampo = (id, campo, valor) => {
    setPerfiles((prev) => prev.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)))
  }

  const guardar = async (p) => {
    setGuardandoId(p.id)
    const { error } = await supabase
      .from('profiles')
      .update({
        nombre_completo: p.nombre_completo,
        rol: p.rol,
        tipo: p.tipo,
        activo: p.activo,
        email_contacto: p.email_contacto?.trim() || null
      })
      .eq('id', p.id)
    setGuardandoId(null)
    if (error) setError(error.message)
  }

  return (
    <div className="pagina pagina-ancha">
      <Link to="/" className="btn-link">
        ← Volver
      </Link>
      <h2>Gestión de usuarios</h2>
      <p className="muted">
        Para crear cuentas nuevas de cuarteleros (ej. L6, L16), agrégalas primero en Supabase →
        Authentication → Add user, con su correo/usuario y contraseña. Luego aparecerán aquí para
        asignarles nombre, tipo "Cuartelero" y estado activo.
      </p>
      <p className="muted-chico">
        <strong>Correo de contacto:</strong> es la dirección real a la que se avisa cuando se le
        asigna un levantamiento a esa persona. Es obligatorio para las cuentas internas
        (tipo <code>l6@sexta.local</code>), porque esas direcciones no reciben correo. Si lo dejas
        vacío, se usa el correo de la cuenta.
      </p>
      {error && <p className="error">{error}</p>}
      {cargando && <p className="cargando">Cargando…</p>}

      {!cargando && (
        <div className="tabla-envoltorio">
          <table className="tabla-levantamientos">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo de contacto</th>
                <th>Rol</th>
                <th>Tipo</th>
                <th>Activo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {perfiles.map((p) => (
                <tr key={p.id}>
                  <td>
                    <input
                      value={p.nombre_completo ?? ''}
                      onChange={(e) => actualizarCampo(p.id, 'nombre_completo', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="email"
                      value={p.email_contacto ?? ''}
                      onChange={(e) => actualizarCampo(p.id, 'email_contacto', e.target.value)}
                      placeholder="correo@ejemplo.cl"
                    />
                  </td>
                  <td>
                    <select value={p.rol} onChange={(e) => actualizarCampo(p.id, 'rol', e.target.value)}>
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select value={p.tipo} onChange={(e) => actualizarCampo(p.id, 'tipo', e.target.value)}>
                      {TIPOS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={p.activo}
                      onChange={(e) => actualizarCampo(p.id, 'activo', e.target.checked)}
                    />
                  </td>
                  <td>
                    <button
                      className="btn-secundario"
                      onClick={() => guardar(p)}
                      disabled={guardandoId === p.id}
                    >
                      {guardandoId === p.id ? 'Guardando…' : 'Guardar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
