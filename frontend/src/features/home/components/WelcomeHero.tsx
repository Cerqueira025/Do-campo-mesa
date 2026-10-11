import BrandMark from '../../../components/brand/BrandMark'
import EntryActions from './EntryActions'
import './WelcomeHero.scss'

function WelcomeHero() {
  return (
    <section className="welcome-hero" aria-labelledby="welcome-title">
      <div className="welcome-hero__inner">
        <div className="welcome-hero__brand-row">
          <BrandMark />
          <h1 className="welcome-hero__title" id="welcome-title">
            Do <span>campo</span> à
            mesa
          </h1>
        </div>

        <div className="welcome-hero__content">
          <div className="welcome-hero__message">
            <h2>Fresco, local e perto de si</h2>
            <p>Inicie sessão para comprar ou vender. Escolha como quer entrar:</p>
          </div>

          <EntryActions />
        </div>
      </div>
    </section>
  )
}

export default WelcomeHero
