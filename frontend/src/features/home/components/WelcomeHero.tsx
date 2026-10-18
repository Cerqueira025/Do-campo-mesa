import BrandMark from '../../../components/brand/BrandMark'
import EntryActions from './EntryActions'
import SessionActions from '../../auth/components/SessionActions'
import './WelcomeHero.scss'
import { useAuth } from '../../auth/useAuth'

function WelcomeHero() {
  const { utilizador } = useAuth()
  return (
    <section className="welcome-hero" aria-labelledby="welcome-title">
      <div className="welcome-hero__inner">
        <div className="welcome-hero__brand-row">
          <BrandMark />
          <nav className="welcome-hero__session" aria-label="Navegação da conta"><SessionActions /></nav>
          <h1 className="welcome-hero__title" id="welcome-title">
            Do <span className="welcome-hero__accent">campo</span> à mesa
          </h1>
        </div>

        <div className="welcome-hero__content">
          <div className="welcome-hero__message">
            <h2 className="welcome-hero__subtitle">Fresco, local e perto de si</h2>
            <p className="welcome-hero__description">{utilizador ? 'Explore os produtos locais e acompanhe a sua conta.' : 'Explore os produtos ou inicie sessão para comprar e vender.'}</p>
          </div>

          <EntryActions />
        </div>
      </div>
    </section>
  )
}

export default WelcomeHero
