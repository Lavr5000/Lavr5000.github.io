export default function HomePage() {
  return (
    <>
      {/* Background Pattern */}
      <div className="bg-pattern"></div>
      <div className="noise-overlay"></div>

      {/* Navigation */}
      <nav>
        <div className="nav-content">
          <div className="logo">Lavr AI</div>
          <div className="nav-links">
            <a href="#projects">Проекты</a>
            <a href="#contact">Контакты</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="badge">🚀 AI-инструменты для реальной жизни</div>
          <h1>Создаю AI-инструменты,<br/>которые реально работают</h1>
          <p className="hero-subtitle">Transkribator, AI Box и другие проекты</p>
          <p className="hero-description">
            Разрабатываю AI-инструменты для автоматизации рутинных задач.
            От голосового ввода до домашних серверов — всё open source и build in public.
          </p>
          <div className="cta-buttons">
            <a href="#projects" className="btn btn-primary">Смотреть проекты</a>
            <a href="https://t.me/ai_vibes_coding_ru" className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
              Telegram
            </a>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats">
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">4</div>
            <div className="stat-label">созданных проекта</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">3</div>
            <div className="stat-label">в разработке</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">20+</div>
            <div className="stat-label">сервисов в плане</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">∞</div>
            <div className="stat-label">Build in Public</div>
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section className="projects-section" id="projects">
        <div className="section-header">
          <h2 className="section-title">Что я создал и использую</h2>
          <p className="section-subtitle">AI-инструменты, которые экономят время каждый день</p>
        </div>
        <div className="projects-grid">
          <div className="project-card featured">
            <span className="project-icon">🎙</span>
            <h3 className="project-title">Transkribator</h3>
            <div className="project-status status-ready">✨ Готово • Бесплатно</div>
            <p className="project-description">
              Голос → текст на рабочем столе. Нажми горячую клавишу, говори — текст
              появляется в любом окне. 100% офлайн, бесплатно, оптимизировано для русского.
            </p>
            <a href="https://github.com/Lavr5000/Transkribator/releases/latest" className="project-link" target="_blank" rel="noopener noreferrer">
              Скачать бесплатно
            </a>
          </div>

          <div className="project-card featured">
            <span className="project-icon">📋</span>
            <h3 className="project-title">Kanban-доска с AI</h3>
            <div className="project-status status-ready">✨ Готово • Бесплатно</div>
            <p className="project-description">
              Бесплатный инструмент для управления задачами с встроенным AI.
              Визуальные доски, генерация задач, простота и скорость.
            </p>
            <a href="https://lavr-ai-kanban-doska.lavr5000xxx.workers.dev/" className="project-link" target="_blank" rel="noopener noreferrer">
              Попробовать сейчас
            </a>
          </div>

          <div className="project-card">
            <span className="project-icon">🤖</span>
            <h3 className="project-title">AI-геймботы</h3>
            <div className="project-status status-ready">✨ Активно использую</div>
            <p className="project-description">
              Рабочие пространства в разных AI (Gemini, DeepSeek, ChatGPT).
              Каждый день решаю рабочие задачи без единой строки кода.
            </p>
          </div>

          <div className="project-card">
            <span className="project-icon">⚡</span>
            <h3 className="project-title">Автоматизация документации</h3>
            <div className="project-status status-ready">✨ Работает</div>
            <p className="project-description">
              Связка Google Sheets + API запросы к DeepSeek.
              Значительно ускорила проверку, облегчила труд. Стоит копейки.
            </p>
          </div>
        </div>
      </section>

      {/* Projects in Development Section */}
      <section className="projects-section" id="projects-dev">
        <div className="section-header">
          <h2 className="section-title">В разработке</h2>
          <p className="section-subtitle">Build in Public — честно, с цифрами и провалами</p>
        </div>
        <div className="projects-grid">
          <div className="project-card">
            <span className="project-icon">🏢</span>
            <h3 className="project-title">Apartment Auditor</h3>
            <div className="project-status status-dev">🔄 В разработке (60-70%)</div>
            <p className="project-description">
              Мобильное приложение для приемки квартир от застройщиков.
              База реальных дефектов для профессиональной приемки.
            </p>
          </div>

          <div className="project-card">
            <span className="project-icon">🚀</span>
            <h3 className="project-title">IDGenerator</h3>
            <div className="project-status status-dev">🔄 В разработке (20-30%)</div>
            <p className="project-description">
              Автоматизация составления исполнительной документации для строительства.
              Превращает хаос актов и реестров в четкую систему. Ускоряет сдачу работ без раздувания штата.
            </p>
          </div>

          <div className="project-card">
            <span className="project-icon">🖥</span>
            <h3 className="project-title">AI Box</h3>
            <div className="project-status status-dev">🔄 В разработке</div>
            <p className="project-description">
              Домашний сервер с AI-мозгом. Ubuntu + AI-агент + умный дом + NAS + медиасервер.
              5 сервисов в 1 устройстве, работает локально.
            </p>
          </div>

          <div className="project-card">
            <span className="project-icon">🔍</span>
            <h3 className="project-title">Vector</h3>
            <div className="project-status status-plan">📋 В планах</div>
            <p className="project-description">
              SaaS для аудита проектной документации.
              Системный подход: каждый дефект привязан к ЛСР и официальной переписке.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="contact-section" id="contact">
        <h2 className="section-title">На связи</h2>
        <p className="section-subtitle">Следите за развитием AI-инструментов</p>
        <div className="contact-links">
          <a href="https://www.youtube.com/@Lavr5000" className="contact-link" target="_blank" rel="noopener noreferrer">
            YouTube
          </a>
          <a href="https://t.me/ai_vibes_coding_ru" className="contact-link" target="_blank" rel="noopener noreferrer">
            Telegram канал
          </a>
          <a href="https://boosty.to/no_code_ai_founder" className="contact-link" target="_blank" rel="noopener noreferrer">
            Boosty
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <p>© 2026 Lavr AI • Build in Public</p>
      </footer>
    </>
  );
}
