import { faMagnifyingGlass, faStore } from '@fortawesome/free-solid-svg-icons'
import Button from '../../../components/ui/Button'
import { useAuth } from '../../auth/useAuth'
import './EntryActions.scss'

function EntryActions() {
  const { utilizador } = useAuth()

  return (
    <>
      <div className="entry-actions" role="group" aria-label="Opções de entrada">
        <Button
          icon={faMagnifyingGlass}
          variant="primary"
          onClick={() => {
            const title = document.getElementById('products-title')
            if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); title.scrollIntoView({ behavior: 'smooth' }) }
          }}
        >
          Explorar produtos
        </Button>
        <Button
          icon={faStore}
          variant="secondary"
          href={utilizador ? '/conta' : '/registo?papel=produtor'}
        >
          {utilizador ? 'A minha conta' : 'Sou produtor'}
        </Button>
      </div>
    </>
  )
}

export default EntryActions
