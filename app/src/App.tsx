const questionFields = [
  {
    id: 'class',
    label: 'Class',
    descriptionUk: 'Оберіть ваш початковий клас персонажа.',
    descriptionEn: 'Pick your character class.',
  },
  {
    id: 'progress-stage',
    label: 'Progress stage',
    descriptionUk: 'Вкажіть поточний етап проходження гри.',
    descriptionEn: 'Pick the current progression stage.',
  },
  {
    id: 'play-style',
    label: 'Play style',
    descriptionUk: 'Оберіть стиль гри, який вам подобається.',
    descriptionEn: 'Pick your preferred playstyle.',
  },
  {
    id: 'game-mode',
    label: 'Game mode',
    descriptionUk: 'Оберіть ігровий режим.',
    descriptionEn: 'Pick the game mode you play.',
  },
  {
    id: 'budget',
    label: 'Budget',
    descriptionUk: 'Вкажіть орієнтовний бюджет на старті.',
    descriptionEn: 'Enter your starting budget.',
  },
] as const

export function App() {
  return (
    <div className="screen">
      <main className="quiz-card">
        <header className="header">
          <p className="eyebrow">PoE 2 Build Advisor</p>
          <h1>PoE 2 Build Advisor</h1>
          <p className="subtitle">
            Цей застосунок буде підбирати білд по всьому шляху: від старту до ендгейму.
            <span className="subtitle-divider">—</span>
            This app will guide your build from the opening to endgame.
          </p>
        </header>

        <section className="questions">
          {questionFields.map((field) => (
            <article key={field.id} className="question">
              <h2>{field.label}</h2>
              <p className="question-description">{field.descriptionUk}</p>
              <p className="question-description en">{field.descriptionEn}</p>
            </article>
          ))}
        </section>

        <button type="button" className="cta">
          Find a build
        </button>
      </main>
    </div>
  )
}
