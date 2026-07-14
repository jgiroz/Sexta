import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [modo, setModo] = useState('login') // 'login' | 'registro'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [avisoRegistro, setAvisoRegistro] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      if (modo === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
        navigate('/')
      } else {
        const { error } = await signUp(email, password, nombre)
        if (error) throw error
        setAvisoRegistro(true)
      }
    } catch (err) {
      setError(err.message ?? 'Ocurrió un error')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="pantalla-centrada">
      <div className="tarjeta-login">
        <h1>🚒 Cuartel</h1>
        <p className="subtitulo">Levantamiento de problemas</p>

        {avisoRegistro ? (
          <div className="aviso-ok">
            Cuenta creada. Revisa tu correo para confirmar (si tu proyecto Supabase lo requiere)
            y luego inicia sesión.
            <button className="btn-secundario" onClick={() => { setModo('login'); setAvisoRegistro(false) }}>
              Ir a iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={enviar} className="form">
            {modo === 'registro' && (
              <label>
                Nombre completo
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                />
              </label>
            )}
            <label>
              Correo
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>

            {error && <p className="error">{error}</p>}

            <button className="btn-primario" type="submit" disabled={cargando}>
              {cargando ? 'Un momento…' : modo === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </button>

            <button
              type="button"
              className="btn-link"
              onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}
            >
              {modo === 'login' ? '¿Nuevo aquí? Crear cuenta' : 'Ya tengo cuenta'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
