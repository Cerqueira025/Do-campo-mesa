import { faMagnifyingGlass, faStore } from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import Button from '../../../components/ui/Button'
import './EntryActions.scss'

function EntryActions() {
  const [feedback, setFeedback] = useState('')

  return (
    <>
      <div className="entry-actions" role="group" aria-label="Opções de entrada">
        <Button
          icon={faMagnifyingGlass}
          variant="primary"
          onClick={() => setFeedback('A área de produtos estará disponível em breve.')}
        >
          Explorar produtos
        </Button>
        <Button
          icon={faStore}
          variant="secondary"
          onClick={() => setFeedback('A entrada para produtores estará disponível em breve.')}
        >
          Sou produtor
        </Button>
      </div>
      <p className="entry-actions__feedback" role="status" aria-live="polite">
        {feedback}
      </p>
    </>
  )
}

export default EntryActions
