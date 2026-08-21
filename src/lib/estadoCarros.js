import { ESTADOS_CERRADOS } from './constants'

// ------------------------------------------------------------
// Estado operativo de un carro.
//   ROJO    -> el mando lo marcó fuera de servicio
//   NARANJO -> tiene fallas abiertas reportadas
//   VERDE   -> operativo y sin novedades
// ------------------------------------------------------------
export const ESTADO_CARRO = {
  operativo: { clave: 'operativo', etiqueta: 'Operativo', color: '#27ae60' },
  con_falla: { clave: 'con_falla', etiqueta: 'Con novedades', color: '#e67e22' },
  fuera_servicio: { clave: 'fuera_servicio', etiqueta: 'Fuera de servicio', color: '#c0392b' }
}

export function estadoDeCarro(carro, levantamientosAbiertos = 0) {
  if (carro?.fuera_servicio) return ESTADO_CARRO.fuera_servicio
  if (levantamientosAbiertos > 0) return ESTADO_CARRO.con_falla
  return ESTADO_CARRO.operativo
}

// Cuenta, por carro, los levantamientos que siguen abiertos.
export function contarAbiertosPorCarro(levantamientos = []) {
  const conteo = {}
  levantamientos
    .filter((l) => !ESTADOS_CERRADOS.includes(l.estado) && l.carro_id)
    .forEach((l) => {
      conteo[l.carro_id] = (conteo[l.carro_id] ?? 0) + 1
    })
  return conteo
}
