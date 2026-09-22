import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

// Configuración › Personal de cuartel
// Los nombres que aparecen en la tablet al preguntar quién hace el reporte.
export default function PersonalCuartel() {
  const { puedeEditarFormularios } = useAuth()
  const [personas, setPersonas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = () => {
    setCargando(true)
    supabase
      .from('personal_cuartel')
      .select('id, nombre, activo')
      .order('nombre')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setPersonas(data ?? [])
        setCargando(false)
      })
  }

  useEffect(() => {
    if (puedeEditarFormularios) cargar()
  }, [puedeEditarFormularios])

  if (!puedeEditarFormularios) return <Navigate to="/" replace />

  const agregar = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) return
    setGuardando(true)
    setError('')
    const { error } = await supabase.from('personal_cuartel').insert({ nombre: nombre.trim() })
    setGuardando(false)
    if (error) setError(error.message)
    else {
      setNombre('')
      cargar()
    }
  }

  const cambiarActivo = async (persona) => {
    const { error } = await supabase
      .from('personal_cuartel')
      .update({ activo: !persona.activo })
      .eq('id', persona.id)
    if (error) setError(error.message)
    else cargar()
  }

  const renombrar = async (persona) => {
    const nuevo = window.prompt('Nombre:', persona.nombre)
    if (!nuevo || !nuevo.trim()) return
    const { error } = await supabase
      .from('personal_cuartel')
      .update({ nombre: nuevo.trim() })
      .eq('id', persona.id)
    if (error) setError(error.message)
    else cargar()
  }

  const eliminar = async (persona) => {
    const ok = window.confirm(
      `¿Eliminar a "${persona.nombre}" de la lista? Los reportes que ya hizo conservan su nombre.`
    )
    if (!ok) return
    const { error } = await supabase.from('personal_cuartel').delete().eq('id', persona.id)
    if (error) setError(error.message)
    else cargar()
  }

  return (
    <div className="pagina">
      <Link to="/" className="btn-link">
        ← Volver
      </Link>
      <h2>Personal de cuartel</h2>
      <p className="muted">
        Estos nombres aparecen en la tablet cuando un cuartelero hace un levantamiento o un
        reporte, para saber quién lo hizo aunque compartan la misma cuenta.
      </p>

      {error && <p className="error">{error}</p>}
      {cargando && <p className="cargando">Cargando…</p>}

      {!cargando && (
        <ul className="lista-facturas">
          {personas.map((p) => (
            <li key={p.id} className={p.activo ? '' : 'inactivo'}>
              <span style={{ flex: 1 }}>
                {p.nombre}
                {!p.activo && <span className="muted-chico"> · no aparece en la lista</span>}
              </span>
              <span className="acciones-inline">
                <button className="btn-mini" onClick={() => renombrar(p)}>
                  Renombrar
                </button>
                <button className="btn-mini" onClick={() => cambiarActivo(p)}>
                  {p.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button className="btn-mini peligro" onClick={() => eliminar(p)}>
                  Eliminar
                </button>
              </span>
            </li>
          ))}
          {personas.length === 0 && (
            <p className="vacio">
              Sin personal cargado. Mientras la lista esté vacía, el cuartelero no verá la pregunta.
            </p>
          )}
        </ul>
      )}

      <form onSubmit={agregar} className="form-inline">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre y apellido"
        />
        <button className="btn-primario" type="submit" disabled={guardando}>
          {guardando ? 'Agregando…' : 'Agregar'}
        </button>
      </form>
    </div>
  )
}
