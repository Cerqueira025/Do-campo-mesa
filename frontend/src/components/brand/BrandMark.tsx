import { faSeedling } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import './BrandMark.scss'

function BrandMark({ variant = 'badge' }: { variant?: 'badge' | 'plain' }) {
  return (
    <span
      className={`brand-mark${variant === 'plain' ? ' brand-mark--plain' : ''}`}
      role="img"
      aria-label="Marca Do Campo à Mesa: uma planta a crescer"
    >
      <FontAwesomeIcon
        className="brand-mark__icon"
        icon={faSeedling}
        aria-hidden="true"
      />
    </span>
  )
}

export default BrandMark
