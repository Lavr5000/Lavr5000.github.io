export default function HomePage() {
  return (
    <>
      {/* Background Pattern */}
      <div className="bg-pattern"></div>
      <div className="noise-overlay"></div>

      {/* Navigation */}
      <nav>
        <div className="nav-content">
          <div className="logo">AI Vibes</div>
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
            <div className="project-icon">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="gMic" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00d4ff"/>
                    <stop offset="1" stopColor="#b24bf3"/>
                  </linearGradient>
                </defs>
                <rect x="18" y="6" width="12" height="20" rx="6" stroke="url(#gMic)" strokeWidth="2.5"/>
                <path d="M12 22v2a12 12 0 0 0 24 0v-2" stroke="url(#gMic)" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="24" y1="36" x2="24" y2="42" stroke="url(#gMic)" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="18" y1="42" x2="30" y2="42" stroke="url(#gMic)" strokeWidth="2.5" strokeLinecap="round"/>
                <path d="M35 12c2 2 3 5 3 8s-1 6-3 8" stroke="url(#gMic)" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
                <path d="M39 8c3 4 5 9 5 14s-2 10-5 14" stroke="url(#gMic)" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
              </svg>
            </div>
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
            <div className="project-icon">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="gKan" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00d4ff"/>
                    <stop offset="1" stopColor="#b24bf3"/>
                  </linearGradient>
                </defs>
                <rect x="4" y="6" width="40" height="36" rx="3" stroke="url(#gKan)" strokeWidth="2.5"/>
                <line x1="18" y1="6" x2="18" y2="42" stroke="url(#gKan)" strokeWidth="1.5" opacity="0.3"/>
                <line x1="32" y1="6" x2="32" y2="42" stroke="url(#gKan)" strokeWidth="1.5" opacity="0.3"/>
                <rect x="7" y="12" width="8" height="8" rx="2" fill="url(#gKan)" opacity="0.7"/>
                <rect x="7" y="24" width="8" height="6" rx="2" fill="url(#gKan)" opacity="0.4"/>
                <rect x="21" y="12" width="8" height="10" rx="2" fill="url(#gKan)" opacity="0.5"/>
                <rect x="35" y="12" width="6" height="6" rx="2" fill="url(#gKan)" opacity="0.6"/>
                <rect x="35" y="22" width="6" height="8" rx="2" fill="url(#gKan)" opacity="0.3"/>
              </svg>
            </div>
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
            <div className="project-icon">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="gBrain" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00d4ff"/>
                    <stop offset="1" stopColor="#b24bf3"/>
                  </linearGradient>
                </defs>
                <line x1="12" y1="12" x2="24" y2="8" stroke="url(#gBrain)" strokeWidth="1.5" opacity="0.4"/>
                <line x1="24" y1="8" x2="36" y2="12" stroke="url(#gBrain)" strokeWidth="1.5" opacity="0.4"/>
                <line x1="12" y1="12" x2="10" y2="24" stroke="url(#gBrain)" strokeWidth="1.5" opacity="0.4"/>
                <line x1="36" y1="12" x2="38" y2="24" stroke="url(#gBrain)" strokeWidth="1.5" opacity="0.4"/>
                <line x1="10" y1="24" x2="24" y2="24" stroke="url(#gBrain)" strokeWidth="1.5" opacity="0.4"/>
                <line x1="24" y1="24" x2="38" y2="24" stroke="url(#gBrain)" strokeWidth="1.5" opacity="0.4"/>
                <line x1="10" y1="24" x2="16" y2="36" stroke="url(#gBrain)" strokeWidth="1.5" opacity="0.4"/>
                <line x1="38" y1="24" x2="32" y2="36" stroke="url(#gBrain)" strokeWidth="1.5" opacity="0.4"/>
                <line x1="16" y1="36" x2="24" y2="40" stroke="url(#gBrain)" strokeWidth="1.5" opacity="0.4"/>
                <line x1="32" y1="36" x2="24" y2="40" stroke="url(#gBrain)" strokeWidth="1.5" opacity="0.4"/>
                <line x1="24" y1="8" x2="24" y2="24" stroke="url(#gBrain)" strokeWidth="1.5" opacity="0.3"/>
                <line x1="24" y1="24" x2="24" y2="40" stroke="url(#gBrain)" strokeWidth="1.5" opacity="0.3"/>
                <line x1="12" y1="12" x2="36" y2="12" stroke="url(#gBrain)" strokeWidth="1.5" opacity="0.3"/>
                <line x1="16" y1="36" x2="32" y2="36" stroke="url(#gBrain)" strokeWidth="1.5" opacity="0.3"/>
                <circle cx="24" cy="8" r="3.5" fill="url(#gBrain)" opacity="0.9"/>
                <circle cx="12" cy="12" r="3" fill="url(#gBrain)" opacity="0.7"/>
                <circle cx="36" cy="12" r="3" fill="url(#gBrain)" opacity="0.7"/>
                <circle cx="10" cy="24" r="3" fill="url(#gBrain)" opacity="0.8"/>
                <circle cx="24" cy="24" r="4" fill="url(#gBrain)"/>
                <circle cx="38" cy="24" r="3" fill="url(#gBrain)" opacity="0.8"/>
                <circle cx="16" cy="36" r="3" fill="url(#gBrain)" opacity="0.7"/>
                <circle cx="32" cy="36" r="3" fill="url(#gBrain)" opacity="0.7"/>
                <circle cx="24" cy="40" r="3.5" fill="url(#gBrain)" opacity="0.9"/>
              </svg>
            </div>
            <h3 className="project-title">AI-гемботы</h3>
            <div className="project-status status-ready">✨ Активно использую</div>
            <p className="project-description">
              Рабочие пространства в разных AI (Gemini, DeepSeek, ChatGPT).
              Каждый день решаю рабочие задачи без единой строки кода.
            </p>
          </div>

          <div className="project-card">
            <div className="project-icon">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="gBolt" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00d4ff"/>
                    <stop offset="1" stopColor="#b24bf3"/>
                  </linearGradient>
                </defs>
                <circle cx="24" cy="24" r="18" stroke="url(#gBolt)" strokeWidth="2.5"/>
                <circle cx="24" cy="24" r="7" stroke="url(#gBolt)" strokeWidth="2" opacity="0.4"/>
                <line x1="24" y1="2" x2="24" y2="6" stroke="url(#gBolt)" strokeWidth="3" strokeLinecap="round"/>
                <line x1="24" y1="42" x2="24" y2="46" stroke="url(#gBolt)" strokeWidth="3" strokeLinecap="round"/>
                <line x1="2" y1="24" x2="6" y2="24" stroke="url(#gBolt)" strokeWidth="3" strokeLinecap="round"/>
                <line x1="42" y1="24" x2="46" y2="24" stroke="url(#gBolt)" strokeWidth="3" strokeLinecap="round"/>
                <path d="M26 15l-5 9h6l-5 9" stroke="url(#gBolt)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
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
            <div className="project-icon">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="gBld" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00d4ff"/>
                    <stop offset="1" stopColor="#b24bf3"/>
                  </linearGradient>
                </defs>
                <rect x="8" y="10" width="22" height="34" rx="2" stroke="url(#gBld)" strokeWidth="2.5"/>
                <rect x="13" y="16" width="5" height="5" rx="1" fill="url(#gBld)" opacity="0.5"/>
                <rect x="21" y="16" width="5" height="5" rx="1" fill="url(#gBld)" opacity="0.5"/>
                <rect x="13" y="26" width="5" height="5" rx="1" fill="url(#gBld)" opacity="0.5"/>
                <rect x="21" y="26" width="5" height="5" rx="1" fill="url(#gBld)" opacity="0.5"/>
                <rect x="16" y="36" width="6" height="8" rx="1" fill="url(#gBld)" opacity="0.3"/>
                <circle cx="36" cy="14" r="8" fill="#0a0a0f" stroke="url(#gBld)" strokeWidth="2.5"/>
                <path d="M32 14l3 3 5-6" stroke="url(#gBld)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="project-title">Apartment Auditor</h3>
            <div className="project-status status-dev">🔄 В разработке (85%)</div>
            <p className="project-description">
              Мобильное приложение для приемки квартир от застройщиков.
              База реальных дефектов для профессиональной приемки.
            </p>
          </div>

          <div className="project-card">
            <div className="project-icon">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="gDoc" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00d4ff"/>
                    <stop offset="1" stopColor="#b24bf3"/>
                  </linearGradient>
                </defs>
                <path d="M10 6h20l8 8v28a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" stroke="url(#gDoc)" strokeWidth="2.5" strokeLinejoin="round"/>
                <path d="M30 6v8h8" stroke="url(#gDoc)" strokeWidth="2.5" strokeLinejoin="round"/>
                <line x1="14" y1="20" x2="28" y2="20" stroke="url(#gDoc)" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
                <line x1="14" y1="26" x2="32" y2="26" stroke="url(#gDoc)" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
                <line x1="14" y1="32" x2="24" y2="32" stroke="url(#gDoc)" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
                <circle cx="32" cy="34" r="6" stroke="url(#gDoc)" strokeWidth="2" opacity="0.8"/>
                <circle cx="32" cy="34" r="3" stroke="url(#gDoc)" strokeWidth="1.5" opacity="0.5"/>
              </svg>
            </div>
            <h3 className="project-title">IDGenerator</h3>
            <div className="project-status status-dev">🔄 В разработке (50%)</div>
            <p className="project-description">
              Автоматизация составления исполнительной документации для строительства.
              Превращает хаос актов и реестров в четкую систему. Ускоряет сдачу работ без раздувания штата.
            </p>
          </div>

          <div className="project-card">
            <div className="project-icon">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="gSrv" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00d4ff"/>
                    <stop offset="1" stopColor="#b24bf3"/>
                  </linearGradient>
                </defs>
                <rect x="6" y="6" width="36" height="14" rx="3" stroke="url(#gSrv)" strokeWidth="2.5"/>
                <rect x="6" y="28" width="36" height="14" rx="3" stroke="url(#gSrv)" strokeWidth="2.5"/>
                <circle cx="14" cy="13" r="2" fill="url(#gSrv)" opacity="0.8"/>
                <circle cx="14" cy="35" r="2" fill="url(#gSrv)" opacity="0.8"/>
                <line x1="30" y1="13" x2="36" y2="13" stroke="url(#gSrv)" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
                <line x1="30" y1="35" x2="36" y2="35" stroke="url(#gSrv)" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
                <path d="M10 24h6l3-4 4 8 4-8 3 4h8" stroke="url(#gSrv)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="project-title">AI Box</h3>
            <div className="project-status status-dev">🔄 В разработке</div>
            <p className="project-description">
              Домашний сервер с AI-мозгом. Ubuntu + AI-агент + умный дом + NAS + медиасервер.
              5 сервисов в 1 устройстве, работает локально.
            </p>
          </div>

          <div className="project-card">
            <div className="project-icon">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="gSch" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#00d4ff"/>
                    <stop offset="1" stopColor="#b24bf3"/>
                  </linearGradient>
                </defs>
                <rect x="6" y="4" width="24" height="32" rx="2" stroke="url(#gSch)" strokeWidth="2.5"/>
                <line x1="12" y1="12" x2="24" y2="12" stroke="url(#gSch)" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
                <line x1="12" y1="18" x2="22" y2="18" stroke="url(#gSch)" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
                <line x1="12" y1="24" x2="20" y2="24" stroke="url(#gSch)" strokeWidth="2" strokeLinecap="round" opacity="0.3"/>
                <circle cx="34" cy="30" r="9" stroke="url(#gSch)" strokeWidth="2.5"/>
                <line x1="40" y1="37" x2="44" y2="43" stroke="url(#gSch)" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
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
        <p>© 2026 AI Vibes • Build in Public</p>
      </footer>
    </>
  );
}
