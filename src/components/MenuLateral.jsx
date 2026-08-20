import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { construirMenu } from '../lib/menu'

// Lista fija a la izquierda. Solo se muestra en pantallas anchas;
// en celular la navegación se hace desde los botones de Inicio.
export default function MenuLateral() {
  const permisos = useAuth()
  const [configAbierta, setConfigAbierta] = useState(true)
  const { items, configuracion } = construirMenu(permisos)

  if (!permisos.session) return null

  return (
    <nav className="menu-lateral">
      {items.map((item) =>
        item.proximamente ? (
          <span key={item.a} className="menu-item proximamente" title="Próximamente">
            <span className="menu-icono">{item.icono}</span>
            {item.texto}
          </span>
        ) : (
          <NavLink
            key={item.a}
            to={item.a}
            end={item.a === '/'}
            className={({ isActive }) => `menu-item ${isActive ? 'activo' : ''}`}
          >
            <span className="menu-icono">{item.icono}</span>
            {item.texto}
          </NavLink>
        )
      )}

      {configuracion.length > 0 && (
        <>
          <button
            className="menu-item menu-grupo"
            onClick={() => setConfigAbierta((v) => !v)}
          >
            <span className="menu-icono">⚙️</span>
            Configuración
            <span className="menu-flecha">{configAbierta ? '▾' : '▸'}</span>
          </button>

          {configAbierta &&
            configuracion.map((item) =>
              item.proximamente ? (
                <span key={item.a} className="menu-item menu-sub proximamente">
                  <span className="menu-icono">{item.icono}</span>
                  {item.texto}
                </span>
              ) : (
                <NavLink
                  key={item.a}
                  to={item.a}
                  className={({ isActive }) => `menu-item menu-sub ${isActive ? 'activo' : ''}`}
                >
                  <span className="menu-icono">{item.icono}</span>
                  {item.texto}
                </NavLink>
              )
            )}
        </>
      )}
    </nav>
  )
}
