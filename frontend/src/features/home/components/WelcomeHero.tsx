import BrandMark from '../../../components/brand/BrandMark'
import EntryActions from './EntryActions'
import './WelcomeHero.scss'

function WelcomeHero() {
  return (
    <section className="welcome-hero" aria-labelledby="welcome-title">
      <div className="welcome-hero__inner">
        <BrandMark />

        <div className="welcome-hero__content">
          <p className="welcome-hero__eyebrow">Bem-vindo</p>
          <h1 className="welcome-hero__title" id="welcome-title">
            Do <span>campo</span> à
            <br />
            mesa
          </h1>

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
