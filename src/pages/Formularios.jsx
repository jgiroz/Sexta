import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

// Listado de formularios. Desde aquí se entra a editar cada uno.
export default function Formularios() {
  const { puedeEditarFormularios } = useAuth()
  const [formularios, setFormularios] = useState([])
  const [carros, setCarros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [nombre, setNombre] = useState('')
  const [carroId, setCarroId] = useState('')
  const [creando, setCreando] = useState(false)

  const cargar = () => {
    setCargando(true)
    Promise.all([
      supabase
        .from('formularios')
        .select('id, nombre, descripcion, activo, carro_id, carros(codigo)')
        .order('nombre'),
      supabase.from('carros').select('id, codigo').eq('activo', true).order('codigo')
    ]).then(([{ data: forms, error }, { data: cars }]) => {
      if (error) setError(error.message)
      setFormularios(forms ?? [])
      setCarros(cars ?? [])
      setCargando(false)
    })
  }

  useEffect(() => {
    if (puedeEditarFormularios) cargar()
  }, [puedeEditarFormularios])

  if (!puedeEditarFormularios) return <Navigate to="/" replace />

  const crear = async (e) => {
    e.preventDefault()
    if (!nombre.trim()) return
    setCreando(true)
    setError('')
    const { error } = await supabase.from('formularios').insert({
      nombre: nombre.trim(),
      carro_id: carroId || null
    })
    setCreando(false)
    if (error) setError(error.message)
    else {
      setNombre('')
      setCarroId('')
      cargar()
    }
  }

  const eliminar = async (f) => {
    const ok = window.confirm(
      `¿Eliminar el formulario "${f.nombre}"? Se borran sus secciones y preguntas. ` +
        'Las respuestas ya enviadas también se eliminan.'
    )
    if (!ok) return
    const { error } = await supabase.from('formularios').delete().eq('id', f.id)
    if (error) setError(error.message)
    else cargar()
  }

  return (
    <div className="pagina">
      <Link to="/" className="btn-link">
        ← Volver
      </Link>
      <h2>Formularios</h2>
      <p className="muted">
        Aquí defines qué se pregunta en cada control. Los cambios se aplican de inmediato a los
        formularios en blanco; las respuestas ya enviadas conservan las preguntas que tenían al
        momento de guardarse.
      </p>

      {error && <p className="error">{error}</p>}
      {cargando && <p className="cargando">Cargando…</p>}

      {!cargando && (
        <div className="lista">
          {formularios.map((f) => (
            <div key={f.id} className="tarjeta-formulario">
              <div>
                <h3>{f.nombre}</h3>
                <p className="muted-chico">
                  {f.carros?.codigo ? `Carro ${f.carros.codigo}` : 'Sin carro asociado'}
                  {!f.activo && ' · inactivo'}
                </p>
              </div>
              <div className="tarjeta-formulario-acciones">
                <Link to={`/formularios/${f.id}`} className="btn-secundario">
                  Editar
                </Link>
                <button className="btn-link" onClick={() => eliminar(f)}>
                  🗑
                </button>
              </div>
            </div>
          ))}
          {formularios.length === 0 && <p className="vacio">Todavía no hay formularios.</p>}
        </div>
      )}

      <h3 className="subtitulo-seccion">Crear formulario nuevo</h3>
      <form onSubmit={crear} className="form">
        <label>
          Nombre
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Control carro bomba R6"
          />
        </label>
        <label>
          Carro asociado (opcional)
          <select value={carroId} onChange={(e) => setCarroId(e.target.value)}>
            <option value="">— Sin carro —</option>
            {carros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-primario" type="submit" disabled={creando}>
          {creando ? 'Creando…' : 'Crear formulario'}
        </button>
      </form>
    </div>
  )
}
