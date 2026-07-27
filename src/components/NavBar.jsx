import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import InstallButton from './InstallButton'

export default function NavBar() {
  const { session, profile, esAdmin, esVoluntario, esCuartelero, puedeGestionar, signOut } = useAuth()
  const navigate = useNavigate()

  const salir = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="navbar">
      <Link to={session ? '/' : '/login'} className="navbar-brand">
        <img src="/navbar-logo.png" alt="Sexta Compañía" className="navbar-logo" />
        Cuartel
      </Link>
      <div className="navbar-right">
        <InstallButton />
        {session && (
          <>
            {(esVoluntario || esCuartelero) && (
              <Link to="/mis-tareas" className="btn-link navbar-panel-link">
                📌 Mis tareas
              </Link>
            )}
            {puedeGestionar && (
              <Link to="/dashboard" className="btn-link navbar-panel-link">
                📊 Panel
              </Link>
            )}
            {esAdmin && (
              <Link to="/usuarios" className="btn-link navbar-panel-link">
                👤 Usuarios
              </Link>
            )}
            {esAdmin && (
              <Link to="/correos" className="btn-link navbar-panel-link">
                ✉️ Correos
              </Link>
            )}
            <span className="navbar-user">
              {profile?.nombre_completo ?? session.user.email}
              {esAdmin && <span className="chip-admin">admin</span>}
            </span>
            <button className="btn-link" onClick={salir}>
              Salir
            </button>
          </>
        )}
      </div>
    </header>
  )
}
