export default function Badge({ texto, color }) {
  return (
    <span
      className="badge"
      style={{ backgroundColor: `${color}22`, color, borderColor: color }}
    >
      {texto}
    </span>
  )
}
