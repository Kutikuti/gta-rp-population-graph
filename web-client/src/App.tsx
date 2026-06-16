import "./App.css";

export function App() {
  return (
    <main className="app-shell">
      <section className="workspace" aria-labelledby="workspace-title">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Annuaire RP</p>
            <h1 id="workspace-title">GTA-RP Population Graph</h1>
          </div>
          <div className="status-pill">Socle initialise</div>
        </div>

        <div className="layout-preview">
          <aside className="filters-panel" aria-label="Recherche et filtres">
            <span>Recherche</span>
            <span>Filtres</span>
            <span>Tags</span>
          </aside>

          <section className="graph-panel" aria-label="Graphe des personnages">
            <div className="node node-main">Personnage</div>
            <div className="node node-secondary">Groupe</div>
            <div className="node node-tertiary">Streamer</div>
          </section>

          <aside className="details-panel" aria-label="Fiche personnage">
            <span>Fiche</span>
            <span>Relations</span>
            <span>Historique</span>
          </aside>
        </div>
      </section>
    </main>
  );
}
