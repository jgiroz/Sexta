import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { useCatalogos } from '../lib/CatalogosContext'

// Formularios › Levantamientos
// Configura lo que aparece en "Nuevo levantamiento": categorías,
// carros y prioridades.
export default function FormularioLevantamientos() {
  const { puedeEditarFormularios } = useAuth()
  const { recargar } = useCatalogos()

  const [categorias, setCategorias] = useState([])
  const [prioridades, setPrioridades] = useState([])
  const [carros, setCarros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [tiposMaterial, setTiposMaterial] = useState([])
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [nuevaPrioridad, setNuevaPrioridad] = useState('')
  const [nuevoCarro, setNuevoCarro] = useState('')
  const [nuevoTipoMaterial, setNuevoTipoMaterial] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    const [cats, prios, cars, tipos] = await Promise.all([
      supabase.from('categorias_levantamiento').select('*').order('orden'),
      supabase.from('prioridades_levantamiento').select('*').order('orden'),
      supabase.from('carros').select('id, codigo, activo').order('codigo'),
      supabase.from('tipos_material').select('*').order('orden')
    ])
    if (cats.error) setError(cats.error.message)
    setCategorias(cats.data ?? [])
    setPrioridades(prios.data ?? [])
    setCarros(cars.data ?? [])
    setTiposMaterial(tipos.data ?? [])
    setCargando(false)
    recargar()
  }, [recargar])

  useEffect(() => {
    if (puedeEditarFormularios) cargar()
  }, [puedeEditarFormularios, cargar])

  if (!puedeEditarFormularios) return <Navigate to="/" replace />

  // La clave es lo que se guarda en cada levantamiento. Se genera del
  // nombre y no se vuelve a tocar, para no romper los registros viejos.
  const claveDesde = (texto) =>
    texto
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')

  const ejecutar = async (promesa) => {
    const { error } = await promesa
    if (error) setError(error.message)
    else {
      setError('')
      cargar()
    }
  }

  // ---------------- categorías ----------------
  const agregarCategoria = (e) => {
    e.preventDefault()
    const etiqueta = nuevaCategoria.trim()
    if (!etiqueta) return
    const clave = claveDesde(etiqueta)
    if (!clave) {
      setError('Ese nombre no sirve como categoría.')
      return
    }
    setNuevaCategoria('')
    ejecutar(
      supabase.from('categorias_levantamiento').insert({
        clave,
        etiqueta,
        orden: categorias.length + 1
      })
    )
  }

  const renombrarCategoria = (c) => {
    const etiqueta = window.prompt('Nombre visible de la categoría:', c.etiqueta)
    if (!etiqueta || !etiqueta.trim()) return
    ejecutar(
      supabase
        .from('categorias_levantamiento')
        .update({ etiqueta: etiqueta.trim() })
        .eq('id', c.id)
    )
  }

  const alternar = (tabla, fila) =>
    ejecutar(supabase.from(tabla).update({ activo: !fila.activo }).eq('id', fila.id))

  const alternarOpcion = (c, campo) =>
    ejecutar(
      supabase
        .from('categorias_levantamiento')
        .update({ [campo]: !c[campo] })
        .eq('id', c.id)
    )

  const eliminar = (tabla, fila, nombre) => {
    const ok = window.confirm(
      `¿Eliminar "${nombre}"? Si ya hay levantamientos que la usan, es preferible desactivarla: ` +
        'así deja de aparecer en el formulario pero los registros antiguos se siguen leyendo bien.'
    )
    if (!ok) return
    ejecutar(supabase.from(tabla).delete().eq('id', fila.id))
  }

  // ---------------- prioridades ----------------
  const agregarPrioridad = (e) => {
    e.preventDefault()
    const etiqueta = nuevaPrioridad.trim()
    if (!etiqueta) return
    const clave = claveDesde(etiqueta)
    if (!clave) {
      setError('Ese nombre no sirve como prioridad.')
      return
    }
    setNuevaPrioridad('')
    ejecutar(
      supabase.from('prioridades_levantamiento').insert({
        clave,
        etiqueta,
        orden: prioridades.length + 1
      })
    )
  }

  const cambiarColor = (p, color) =>
    ejecutar(supabase.from('prioridades_levantamiento').update({ color }).eq('id', p.id))

  // ---------------- tipos de material ----------------
  const agregarTipoMaterial = (e) => {
    e.preventDefault()
    const etiqueta = nuevoTipoMaterial.trim()
    if (!etiqueta) return
    const clave = claveDesde(etiqueta)
    if (!clave) {
      setError('Ese nombre no sirve como tipo de material.')
      return
    }
    setNuevoTipoMaterial('')
    ejecutar(
      supabase.from('tipos_material').insert({
        clave,
        etiqueta,
        orden: tiposMaterial.length + 1
      })
    )
  }

  const renombrarTipoMaterial = (t) => {
    const etiqueta = window.prompt('Nombre del tipo de material:', t.etiqueta)
    if (!etiqueta || !etiqueta.trim()) return
    ejecutar(
      supabase.from('tipos_material').update({ etiqueta: etiqueta.trim() }).eq('id', t.id)
    )
  }

  // ---------------- carros ----------------
  const agregarCarro = (e) => {
    e.preventDefault()
    const codigo = nuevoCarro.trim().toUpperCase()
    if (!codigo) return
    setNuevoCarro('')
    ejecutar(supabase.from('carros').insert({ codigo }))
  }

  return (
    <div className="pagina">
      <Link to="/formularios" className="btn-link">
        ← Volver a formularios
      </Link>
      <h2>Formulario de levantamientos</h2>
      <p className="muted">
        Lo que se configura aquí es lo que ven todos al reportar un problema.
      </p>

      {error && <p className="error">{error}</p>}
      {cargando && <p className="cargando">Cargando…</p>}

      {/* ---------------- CATEGORÍAS ---------------- */}
      <section className="bloque-seccion">
        <h3>Categorías</h3>
        <p className="muted-chico">
          Los dos primeros botones son interruptores: en verde con ✓ están encendidos, en gris con
          ○ apagados. "Pide carro" muestra el selector de carro al reportar; "pide tipo material"
          agrega el menú de material menor o motorizado. Así una categoría nueva puede comportarse
          igual que Carro bomba, y Cuartel puede no pedir carro.
        </p>

        {categorias.map((c) => (
          <div key={c.id} className={`fila-catalogo ${c.activo ? '' : 'inactivo'}`}>
            <div className="fila-catalogo-nombre">
              <strong>{c.etiqueta}</strong>
              <span className="muted-chico"> · {c.clave}</span>
              {!c.activo && <span className="muted-chico"> · oculta</span>}
            </div>
            <div className="acciones-inline">
              <button
                className={`chip-toggle ${c.pide_carro ? 'encendido' : ''}`}
                onClick={() => alternarOpcion(c, 'pide_carro')}
                aria-pressed={c.pide_carro}
              >
                {c.pide_carro ? '✓' : '○'} Pide carro
              </button>
              <button
                className={`chip-toggle ${c.pide_subcategoria ? 'encendido' : ''}`}
                onClick={() => alternarOpcion(c, 'pide_subcategoria')}
                aria-pressed={c.pide_subcategoria}
              >
                {c.pide_subcategoria ? '✓' : '○'} Pide tipo material
              </button>
              <button className="btn-mini" onClick={() => renombrarCategoria(c)}>
                Renombrar
              </button>
              <button
                className="btn-mini"
                onClick={() => alternar('categorias_levantamiento', c)}
              >
                {c.activo ? 'Ocultar' : 'Mostrar'}
              </button>
              <button
                className="btn-mini peligro"
                onClick={() => eliminar('categorias_levantamiento', c, c.etiqueta)}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}

        <form onSubmit={agregarCategoria} className="form-inline">
          <input
            value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)}
            placeholder="Nueva categoría"
          />
          <button className="btn-secundario" type="submit">
            + Agregar
          </button>
        </form>
      </section>

      {/* ---------------- CARROS ---------------- */}
      <section className="bloque-seccion">
        <h3>Carros</h3>
        <p className="muted-chico">
          Los que aparecen en "Carro relacionado". Desactivar uno lo saca del formulario sin
          afectar sus levantamientos ni sus reportes.
        </p>

        {carros.map((c) => (
          <div key={c.id} className={`fila-catalogo ${c.activo ? '' : 'inactivo'}`}>
            <div className="fila-catalogo-nombre">
              <strong>{c.codigo}</strong>
              {!c.activo && <span className="muted-chico"> · oculto</span>}
            </div>
            <div className="acciones-inline">
              <button className="btn-mini" onClick={() => alternar('carros', c)}>
                {c.activo ? 'Ocultar' : 'Mostrar'}
              </button>
              <button
                className="btn-mini peligro"
                onClick={() => eliminar('carros', c, c.codigo)}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}

        <form onSubmit={agregarCarro} className="form-inline">
          <input
            value={nuevoCarro}
            onChange={(e) => setNuevoCarro(e.target.value)}
            placeholder="Código del carro, ej: Z6"
          />
          <button className="btn-secundario" type="submit">
            + Agregar
          </button>
        </form>
      </section>

      {/* ---------------- TIPOS DE MATERIAL ---------------- */}
      <section className="bloque-seccion">
        <h3>Tipos de material</h3>
        <p className="muted-chico">
          Aparecen cuando la categoría tiene encendido "pide tipo material". Aquí puedes agregar
          los que uses: agua, rescate, trauma, ERA, y los que hagan falta.
        </p>

        {tiposMaterial.map((t) => (
          <div key={t.id} className={`fila-catalogo ${t.activo ? '' : 'inactivo'}`}>
            <div className="fila-catalogo-nombre">
              <strong>{t.etiqueta}</strong>
              <span className="muted-chico"> · {t.clave}</span>
              {!t.activo && <span className="muted-chico"> · oculto</span>}
            </div>
            <div className="acciones-inline">
              <button className="btn-mini" onClick={() => renombrarTipoMaterial(t)}>
                Renombrar
              </button>
              <button className="btn-mini" onClick={() => alternar('tipos_material', t)}>
                {t.activo ? 'Ocultar' : 'Mostrar'}
              </button>
              <button
                className="btn-mini peligro"
                onClick={() => eliminar('tipos_material', t, t.etiqueta)}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}

        <form onSubmit={agregarTipoMaterial} className="form-inline">
          <input
            value={nuevoTipoMaterial}
            onChange={(e) => setNuevoTipoMaterial(e.target.value)}
            placeholder="Ej: Material de agua, ERA, Trauma"
          />
          <button className="btn-secundario" type="submit">
            + Agregar
          </button>
        </form>
      </section>

      {/* ---------------- PRIORIDADES ---------------- */}
      <section className="bloque-seccion">
        <h3>Prioridades</h3>

        {prioridades.map((p) => (
          <div key={p.id} className={`fila-catalogo ${p.activo ? '' : 'inactivo'}`}>
            <div className="fila-catalogo-nombre">
              <span className="punto-estado" style={{ background: p.color }} />
              <strong>{p.etiqueta}</strong>
              {!p.activo && <span className="muted-chico"> · oculta</span>}
            </div>
            <div className="acciones-inline">
              <input
                type="color"
                value={p.color}
                onChange={(e) => cambiarColor(p, e.target.value)}
                title="Color de la etiqueta"
                className="selector-color"
              />
              <button
                className="btn-mini"
                onClick={() => alternar('prioridades_levantamiento', p)}
              >
                {p.activo ? 'Ocultar' : 'Mostrar'}
              </button>
              <button
                className="btn-mini peligro"
                onClick={() => eliminar('prioridades_levantamiento', p, p.etiqueta)}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}

        <form onSubmit={agregarPrioridad} className="form-inline">
          <input
            value={nuevaPrioridad}
            onChange={(e) => setNuevaPrioridad(e.target.value)}
            placeholder="Nueva prioridad"
          />
          <button className="btn-secundario" type="submit">
            + Agregar
          </button>
        </form>
      </section>
    </div>
  )
}
