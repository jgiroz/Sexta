import { Suspense, lazy } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import NavBar from './components/NavBar'
import MenuLateral from './components/MenuLateral'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import NuevoLevantamiento from './pages/NuevoLevantamiento'
import DetalleLevantamiento from './pages/DetalleLevantamiento'
import MisTareas from './pages/MisTareas'

const Levantamientos = lazy(() => import('./pages/Levantamientos'))
const ReporteDiario = lazy(() => import('./pages/ReporteDiario'))
const RevisarObservaciones = lazy(() => import('./pages/RevisarObservaciones'))
const GestionUsuarios = lazy(() => import('./pages/GestionUsuarios'))
const ConfiguracionCorreos = lazy(() => import('./pages/ConfiguracionCorreos'))
const Formularios = lazy(() => import('./pages/Formularios'))
const EditarFormulario = lazy(() => import('./pages/EditarFormulario'))
const ElegirFormulario = lazy(() => import('./pages/ElegirFormulario'))
const LlenarFormulario = lazy(() => import('./pages/LlenarFormulario'))

const Cargando = () => <div className="pagina cargando">Cargando…</div>

const protegida = (elemento, conSuspense = false) => (
  <ProtectedRoute>{conSuspense ? <Suspense fallback={<Cargando />}>{elemento}</Suspense> : elemento}</ProtectedRoute>
)

export default function App() {
  const { pathname } = useLocation()
  const enLogin = pathname === '/login'

  return (
    <>
      <NavBar />
      <div className={enLogin ? '' : 'contenedor-app'}>
        {!enLogin && <MenuLateral />}
        <main className="contenido-app">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={protegida(<Inicio />)} />
            <Route path="/nuevo" element={protegida(<NuevoLevantamiento />)} />
            <Route path="/levantamiento/:id" element={protegida(<DetalleLevantamiento />)} />
            <Route path="/mis-tareas" element={protegida(<MisTareas />)} />
            <Route path="/levantamientos" element={protegida(<Levantamientos />, true)} />
            <Route path="/reporte-diario/:tipo" element={protegida(<ReporteDiario />, true)} />
            <Route path="/observaciones" element={protegida(<RevisarObservaciones />, true)} />
            <Route path="/usuarios" element={protegida(<GestionUsuarios />, true)} />
            <Route path="/correos" element={protegida(<ConfiguracionCorreos />, true)} />
            <Route path="/formularios" element={protegida(<Formularios />, true)} />
            <Route path="/formularios/:id" element={protegida(<EditarFormulario />, true)} />
            <Route path="/control-carro" element={protegida(<ElegirFormulario />, true)} />
            <Route path="/formulario/:id" element={protegida(<LlenarFormulario />, true)} />
          </Routes>
        </main>
      </div>
    </>
  )
}
