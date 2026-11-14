import AppHeader from "../components/layout/AppHeader";
import PublicAuctions from "../features/auctions/PublicAuctions";
import "./AuctionsPage.scss";

export default function AuctionsPage() {
  return (
    <>
      <AppHeader />
      <main
        className="page-content auctions-page"
        id="main-content"
        tabIndex={-1}
      >
        <h1>Leilões</h1>
        <PublicAuctions listing />
      </main>
    </>
  );
}
