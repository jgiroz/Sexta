// Redimensiona y comprime una imagen en el navegador antes de subirla,
// para no llenar el almacenamiento gratuito de Supabase con fotos pesadas.
export function comprimirImagen(archivo, { maxDimension = 1280, calidad = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    if (!archivo || !archivo.type?.startsWith('image/')) {
      resolve(archivo)
      return
    }

    const img = new Image()
    const url = URL.createObjectURL(archivo)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          height = maxDimension
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(archivo)
            return
          }
          const nombre = archivo.name.replace(/\.[^.]+$/, '') + '.jpg'
          resolve(new File([blob], nombre, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        calidad
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(archivo) // si algo falla, sube el original en vez de bloquear al usuario
    }

    img.src = url
  })
}
