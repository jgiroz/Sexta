import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase, BUCKET_FOTOS } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { SUBCATEGORIAS_CARRO } from '../lib/constants'
import { useCatalogos } from '../lib/CatalogosContext'
import { comprimirImagen } from '../lib/imagen'

export default function NuevoLevantamiento() {
  const { session, esCuartelero } = useAuth()
  const { categorias, prioridades } = useCatalogos()
  const navigate = useNavigate()
  const [carros, setCarros] = useState([])
  const [personal, setPersonal] = useState([])
  const [quienReporta, setQuienReporta] = useState('')
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState('otro')
  const [subcategoria, setSubcategoria] = useState('')
  const [carroId, setCarroId] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [prioridad, setPrioridad] = useState('media')
  const [foto, setFoto] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [comprimiendo, setComprimiendo] = useState(false)
  const [error, setError] = useState('')
  const inputCamaraRef = useRef(null)
  const inputGaleriaRef = useRef(null)

  // El comportamiento ya no está atado a la categoría "carro": cada
  // categoría define si pide carro y si pide tipo de material.
  const catActual = categorias.find((c) => c.value === categoria)
  const pideCarro = catActual?.pideCarro ?? categoria === 'carro'
  const pideSubcategoria = catActual?.pideSubcategoria ?? categoria === 'carro'

  useEffect(() => {
    supabase
      .from('carros')
      .select('id, codigo, nombre')
      .eq('activo', true)
      .then(({ data }) => setCarros(data ?? []))
  }, [])

  // La tablet del cuartel es compartida, así que se pregunta quién reporta.
  useEffect(() => {
    if (!esCuartelero) return
    supabase
      .from('personal_cuartel')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => setPersonal(data ?? []))
  }, [esCuartelero])

  const pideQuienReporta = esCuartelero && personal.length > 0

  const cambiarCategoria = (valor) => {
    setCategoria(valor)
    // Si la categoría elegida no pide tipo de material, se limpia.
    const nueva = categorias.find((c) => c.value === valor)
    if (!nueva?.pideSubcategoria) setSubcategoria('')
  }

  const elegirFoto = async (e) => {
    const archivo = e.target.files?.[0] ?? null
    if (!archivo) {
      setFoto(null)
      return
    }
    setComprimiendo(true)
    try {
      const comprimida = await comprimirImagen(archivo)
      setFoto(comprimida)
    } finally {
      setComprimiendo(false)
    }
  }

  const enviar = async (e) => {
    e.preventDefault()
    setError('')

    if (pideCarro && !carroId) {
      setError(`Selecciona el carro cuando la categoría es "${catActual?.label ?? categoria}".`)
      return
    }

    if (pideQuienReporta && !quienReporta) {
      setError('Indica quién está haciendo el reporte.')
      return
    }

    setEnviando(true)
    try {
      let foto_url = null

      if (foto) {
        const ext = foto.name.split('.').pop()
        const ruta = `${session.user.id}/${Date.now()}.${ext}`
        const { error: errSubida } = await supabase.storage
          .from(BUCKET_FOTOS)
          .upload(ruta, foto)
        if (errSubida) throw errSubida
        const { data: pub } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(ruta)
        foto_url = pub.publicUrl
      }

      const { data, error: errInsert } = await supabase
        .from('levantamientos')
        .insert({
          titulo,
          descripcion,
          categoria,
          subcategoria: pideSubcategoria && subcategoria ? subcategoria : null,
          carro_id: carroId || null,
          ubicacion,
          prioridad,
          foto_url,
          reportado_por: session.user.id,
          reportado_por_nombre: quienReporta || null
        })
        .select('id')
        .single()

      if (errInsert) throw errInsert
      navigate(`/levantamiento/${data.id}`)
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar el levantamiento')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pagina">
      <Link to="/" className="btn-link">
        ← Volver
      </Link>
      <h2>Nuevo levantamiento</h2>
      <form onSubmit={enviar} className="form">
        {pideQuienReporta && (
          <label className="campo-destacado">
            ¿Quién hace el reporte?
            <select
              value={quienReporta}
              onChange={(e) => setQuienReporta(e.target.value)}
              required
            >
              <option value="">— Selecciona tu nombre —</option>
              {personal.map((p) => (
                <option key={p.id} value={p.nombre}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          Título
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Expansor dañado en su punta"
            required
          />
        </label>

        <label>
          Descripción
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={4}
            required
          />
        </label>

        <label>
          Categoría
          <select value={categoria} onChange={(e) => cambiarCategoria(e.target.value)}>
            {categorias.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          {pideCarro ? 'Carro' : 'Carro relacionado (opcional)'}
          <select value={carroId} onChange={(e) => setCarroId(e.target.value)}>
            <option value="">{pideCarro ? '— Selecciona el carro —' : '— No aplica —'}</option>
            {carros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre ? `${c.codigo} — ${c.nombre}` : c.codigo}
              </option>
            ))}
          </select>
        </label>

        {pideSubcategoria && (
          <label>
            Tipo de material (opcional)
            <select value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)}>
              <option value="">— No aplica (problema del carro en general) —</option>
              {SUBCATEGORIAS_CARRO.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          Prioridad
          <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
            {prioridades.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Ubicación
          <input
            type="text"
            value={ubicacion}
            onChange={(e) => setUbicacion(e.target.value)}
            placeholder="Ej: Segundo piso, sala de máquinas"
          />
        </label>

        <label>
          Foto (opcional)
          <div className="botones-foto">
            <button
              type="button"
              className="btn-secundario"
              onClick={() => inputCamaraRef.current?.click()}
            >
              📷 Tomar foto
            </button>
            <button
              type="button"
              className="btn-secundario"
              onClick={() => inputGaleriaRef.current?.click()}
            >
              🖼️ Elegir de galería
            </button>
          </div>
          <input
            ref={inputCamaraRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={elegirFoto}
            style={{ display: 'none' }}
          />
          <input
            ref={inputGaleriaRef}
            type="file"
            accept="image/*"
            onChange={elegirFoto}
            style={{ display: 'none' }}
          />
          {foto && <p className="muted-chico">Seleccionada: {foto.name}</p>}
        </label>
        {comprimiendo && <p className="muted-chico">Optimizando imagen…</p>}

        {error && <p className="error">{error}</p>}

        <button className="btn-primario" type="submit" disabled={enviando || comprimiendo}>
          {enviando ? 'Guardando…' : 'Guardar levantamiento'}
        </button>
      </form>
    </div>
  )
}
