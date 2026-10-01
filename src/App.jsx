import { Heart, Trophy, CalendarDays } from "lucide-react"

function App() {
  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="small-text">FOOTBALL TRACKER</p>
          <h1>My Teams ⚽</h1>
        </div>

        <Heart size={28} />
      </header>

      <section className="team-card">
        <div className="team-icon">👑</div>

        <div>
          <p>REAL MADRID</p>
          <span>Los Blancos</span>
        </div>
      </section>

      <section className="team-card">
        <div className="team-icon">🦁</div>

        <div>
          <p>ENGLAND</p>
          <span>Three Lions</span>
        </div>
      </section>

      <div className="section-title">
        <CalendarDays size={20} />
        <h2>Upcoming Matches</h2>
      </div>

      <div className="match-card">
        <span>Real Madrid</span>
        <Trophy size={20} />
        <span>Opponent</span>
      </div>
    </div>
  )
}

export default App