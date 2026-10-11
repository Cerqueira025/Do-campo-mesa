import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import './SearchBar.scss'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function SearchBar({
  value,
  onChange,
  placeholder = 'Pesquisar produtos',
}: SearchBarProps) {
  return (
    <div className="search-bar">
      <FontAwesomeIcon
        className="search-bar__icon"
        icon={faMagnifyingGlass}
        aria-hidden="true"
      />
      <input
        className="form-control search-bar__input"
        type="search"
        aria-label="Pesquisar produtos"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  )
}

export default SearchBar
