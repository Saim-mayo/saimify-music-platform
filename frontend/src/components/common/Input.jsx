export default function Input({ label, id, error, ...props }) {
  return (
    <label className="field" htmlFor={id}>
      {label && <span>{label}</span>}
      <input id={id} className={`input ${error ? 'input-error' : ''}`} {...props} />
      {error ? <small className="error-text">{error}</small> : null}
    </label>
  )
}
