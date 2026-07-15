import { useEffect, useState } from 'react'

function esStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function esIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream
}

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [instalado, setInstalado] = useState(esStandalone())
  const [mostrarInstrucciones, setMostrarInstrucciones] = useState(false)

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    const onInstalled = () => {
      setInstalado(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (instalado) return null

  const clicInstalar = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setInstalado(true)
      setDeferredPrompt(null)
      return
    }
    setMostrarInstrucciones(true)
  }

  return (
    <>
      <button className="btn-instalar" onClick={clicInstalar}>
        📲 Instalar app
      </button>

      {mostrarInstrucciones && (
        <div className="modal-fondo" onClick={() => setMostrarInstrucciones(false)}>
          <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
            <h3>Instalar la app</h3>

            {esIOS() ? (
              <ol className="modal-pasos">
                <li>Toca el botón <strong>Compartir</strong> (el cuadrado con flecha hacia arriba) en Safari.</li>
                <li>Baja y elige <strong>"Agregar a inicio"</strong>.</li>
                <li>Confirma tocando <strong>"Agregar"</strong> arriba a la derecha.</li>
              </ol>
            ) : (
              <ol className="modal-pasos">
                <li>Toca el menú <strong>⋮</strong> (tres puntos) arriba a la derecha de Chrome.</li>
                <li>Elige <strong>"Instalar app"</strong> o <strong>"Agregar a pantalla de inicio"</strong>.</li>
                <li>Confirma tocando <strong>"Instalar"</strong>.</li>
              </ol>
            )}

            <button className="btn-primario" onClick={() => setMostrarInstrucciones(false)}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  )
}
