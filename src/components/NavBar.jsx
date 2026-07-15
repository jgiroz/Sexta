import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import InstallButton from './InstallButton'

export default function NavBar() {
  const { session, profile, esAdmin, signOut } = useAuth()
  const navigate = useNavigate()

  const salir = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="navbar">
      <Link to={session ? '/' : '/login'} className="navbar-brand">
        🚒 Cuartel
      </Link>
      <div className="navbar-right">
        <InstallButton />
        {session && (
          <>
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
