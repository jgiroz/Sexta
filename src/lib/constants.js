export const CATEGORIAS = [
  { value: 'infraestructura', label: 'Cuartel' },
  { value: 'carro', label: 'Carro bomba' },
  { value: 'epp', label: 'EPP' },
  { value: 'otro', label: 'Otro' }
]

export const SUBCATEGORIAS_CARRO = [
  { value: 'material_menor', label: 'Material menor' },
  { value: 'material_motorizado', label: 'Material motorizado' }
]

export const ESTADOS = [
  { value: 'pendiente', label: 'Pendiente', color: '#e67e22' },
  { value: 'asignado', label: 'Asignado', color: '#2980b9' },
  { value: 'en_progreso', label: 'En progreso', color: '#8e44ad' },
  { value: 'resuelto', label: 'Resuelto', color: '#27ae60' },
  { value: 'cerrado', label: 'Cerrado', color: '#7f8c8d' }
]

export const PRIORIDADES = [
  { value: 'baja', label: 'Baja', color: '#95a5a6' },
  { value: 'media', label: 'Media', color: '#f1c40f' },
  { value: 'alta', label: 'Alta', color: '#e67e22' },
  { value: 'urgente', label: 'Urgente', color: '#c0392b' }
]

export function etiquetaDe(lista, value) {
  return lista.find((i) => i.value === value)?.label ?? value
}

export function colorDe(lista, value) {
  return lista.find((i) => i.value === value)?.color ?? '#333'
}
