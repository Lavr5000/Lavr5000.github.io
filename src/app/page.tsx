import ScrollReveal from './components/ScrollReveal';
import HeroScene from './components/HeroScene';
import StatsCounter from './components/StatsCounter';
import AnimationInit from './components/AnimationInit';

export default function HomePage() {
  return (
    <>
      <AnimationInit />
      {/* Background Pattern */}
      <div className="bg-pattern"></div>

      {/* Navigation */}
      <nav>
        <div className="nav-content">
          <div className="logo">AI Vibes</div>
          <div className="nav-links">
            <a href="#projects">Проекты</a>
            <a href="#approach">Подход</a>
            <a href="#services">Услуги</a>
            <a href="#contact">Контакты</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="badge">
            <span className="badge-pulse"></span>
            AI-инструменты для реальной жизни
          </div>
          <h1>Создаю AI-инструменты, которые реально работают</h1>
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
        <HeroScene />
      </section>

      {/* Stats Section */}
      <section className="stats">
        <div className="stats-grid">
          <div className="stat-item">
            <StatsCounter value={4} />
            <div className="stat-label">Проекта</div>
          </div>
          <div className="stat-item">
            <StatsCounter value={3} />
            <div className="stat-label">В разработке</div>
          </div>
          <div className="stat-item">
            <StatsCounter value={20} suffix="+" />
            <div className="stat-label">Сервисов</div>
          </div>
          <div className="stat-item">
            <StatsCounter value="∞" />
            <div className="stat-label">Build in Public</div>
          </div>
        </div>
      </section>

      {/* Approach Section */}
      <section className="approach-section" id="approach">
        <ScrollReveal>
          <div className="section-header">
            <h2 className="section-title">Мой подход</h2>
            <p className="section-subtitle">Три шага от идеи до работающего продукта</p>
          </div>
        </ScrollReveal>
        <div className="approach-timeline">
          <ScrollReveal delay={100}>
            <div className="approach-step">
              <div className="approach-number">01</div>
              <div className="approach-title">Исследую</div>
              <div className="approach-desc">
                Нахожу реальные проблемы, которые можно решить с помощью AI.
                Не выдумываю задачи — беру из своего опыта в строительстве.
              </div>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <div className="approach-step">
              <div className="approach-number">02</div>
              <div className="approach-title">Создаю</div>
              <div className="approach-desc">
                AI-first подход: Claude Code, Gemini, DeepSeek — каждый инструмент
                рождается в паре с AI. Быстрые итерации, минимум кода.
              </div>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={300}>
            <div className="approach-step">
              <div className="approach-number">03</div>
              <div className="approach-title">Делюсь</div>
              <div className="approach-desc">
                Build in Public — честно, с цифрами и провалами.
                YouTube, Telegram, Boosty — без фильтров.
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Projects Section — Ready */}
      <section className="projects-section" id="projects">
        <ScrollReveal>
          <div className="section-header">
            <h2 className="section-title">Что я создал и использую</h2>
            <p className="section-subtitle">AI-инструменты, которые экономят время каждый день</p>
          </div>
        </ScrollReveal>
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
            <div className="project-status status-ready">Готово &middot; Бесплатно</div>
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
            <div className="project-status status-ready">Готово &middot; Бесплатно</div>
            <p className="project-description">
              Бесплатный инструмент для управления задачами с встроенным AI.
              Визуальные доски, генерация задач, простота и скорость.
            </p>
            <a href="https://kanban-board-peach-three.vercel.app/" className="project-link" target="_blank" rel="noopener noreferrer">
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
            <div className="project-status status-ready">Активно использую</div>
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
            <div className="project-status status-ready">Работает</div>
            <p className="project-description">
              Связка Google Sheets + API запросы к DeepSeek.
              Значительно ускорила проверку, облегчила труд. Стоит копейки.
            </p>
          </div>
        </div>
      </section>

      {/* Projects in Development Section */}
      <section className="projects-section" id="projects-dev">
        <ScrollReveal>
          <div className="section-header">
            <h2 className="section-title">В разработке</h2>
            <p className="section-subtitle">Build in Public — честно, с цифрами и провалами</p>
          </div>
        </ScrollReveal>
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
                <circle cx="36" cy="14" r="8" fill="#0b0b12" stroke="url(#gBld)" strokeWidth="2.5"/>
                <path d="M32 14l3 3 5-6" stroke="url(#gBld)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="project-title">Apartment Auditor</h3>
            <div className="project-status status-dev">В разработке</div>
            <div className="progress-bar-container">
              <div className="progress-bar-label">
                <span>Прогресс</span>
                <span>85%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: '85%' }}></div>
              </div>
            </div>
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
            <div className="project-status status-dev">В разработке</div>
            <div className="progress-bar-container">
              <div className="progress-bar-label">
                <span>Прогресс</span>
                <span>50%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: '50%' }}></div>
              </div>
            </div>
            <p className="project-description">
              Автоматизация составления исполнительной документации для строительства.
              Превращает хаос актов и реестров в четкую систему.
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
            <div className="project-status status-dev">В разработке</div>
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
            <div className="project-status status-plan">В планах</div>
            <p className="project-description">
              SaaS для аудита проектной документации.
              Системный подход: каждый дефект привязан к ЛСР и официальной переписке.
            </p>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="services-section" id="services">
        <ScrollReveal>
          <div className="section-header">
            <h2 className="section-title">Настройка AI-ассистента Claude Code</h2>
            <p className="section-subtitle">
              Настрою Claude Code под ваши задачи — от документов до автоматизации бизнес-процессов.
              Вы получите работающий инструмент, а не просто установленную программу.
            </p>
          </div>
        </ScrollReveal>

        <div className="services-grid">
          <ScrollReveal delay={100}>
            <div className="service-card">
              <div className="service-card-header">
                <h3 className="service-card-name">Базовый</h3>
                <div className="service-card-price">3 000 <span className="price-currency">руб</span></div>
                <p className="service-card-desc">Для тех, кто хочет попробовать</p>
              </div>
              <ul className="service-features">
                <li>Установка Claude Code (CLI + Desktop)</li>
                <li>Консультация по выбору подписки</li>
                <li>Базовая конфигурация под задачи</li>
                <li>Проверка работоспособности</li>
              </ul>
              <div className="service-card-footer">
                <span className="service-timeline">Срок: 1 день</span>
                <a href="https://t.me/ai_vibes_coding_ru" className="btn btn-secondary service-btn" target="_blank" rel="noopener noreferrer">
                  Выбрать
                </a>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className="service-card service-card-popular">
              <div className="service-popular-badge">Популярное</div>
              <div className="service-card-header">
                <h3 className="service-card-name">Стандарт</h3>
                <div className="service-card-price">7 000 <span className="price-currency">руб</span></div>
                <p className="service-card-desc">Для ежедневной работы с документами</p>
              </div>
              <ul className="service-features">
                <li>Всё из «Базового»</li>
                <li>Скиллы документов: Word, Excel, PDF, PPTX</li>
                <li>Автоматизация браузера</li>
                <li>1 час консультации по задачам</li>
                <li>Инструкция (PDF)</li>
              </ul>
              <div className="service-card-footer">
                <span className="service-timeline">Срок: 2 дня</span>
                <a href="https://t.me/ai_vibes_coding_ru" className="btn btn-primary service-btn" target="_blank" rel="noopener noreferrer">
                  Выбрать
                </a>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <div className="service-card">
              <div className="service-card-header">
                <h3 className="service-card-name">Про</h3>
                <div className="service-card-price">15 000 <span className="price-currency">руб</span></div>
                <p className="service-card-desc">Полная автоматизация под ваш бизнес</p>
              </div>
              <ul className="service-features">
                <li>Всё из «Стандарта»</li>
                <li>Кастомные скиллы под бизнес-процессы</li>
                <li>Telegram-интеграция</li>
                <li>2 часа обучения (видеозвонок)</li>
                <li>7 дней поддержки</li>
                <li>Обновление через месяц</li>
              </ul>
              <div className="service-card-footer">
                <span className="service-timeline">Срок: 3 дня</span>
                <a href="https://t.me/ai_vibes_coding_ru" className="btn btn-secondary service-btn" target="_blank" rel="noopener noreferrer">
                  Выбрать
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal delay={150}>
          <div className="services-trust">
            <div className="trust-item">
              <div className="trust-value">250+</div>
              <div className="trust-label">Сессий работы</div>
            </div>
            <div className="trust-item">
              <div className="trust-value">70+</div>
              <div className="trust-label">Скиллов автоматизации</div>
            </div>
            <div className="trust-item">
              <div className="trust-value">4ч → 20мин</div>
              <div className="trust-label">Кейс: ежедневный отчёт</div>
            </div>
            <div className="trust-item">
              <div className="trust-value">1-2ч</div>
              <div className="trust-label">Время настройки</div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <div className="services-cta">
            <h3 className="services-cta-title">Готовы начать?</h3>
            <p className="services-cta-desc">
              Напишите мне в Telegram — обсудим ваши задачи и подберём подходящий пакет. Консультация бесплатная.
            </p>
            <a href="https://t.me/ai_vibes_coding_ru" className="btn btn-primary" target="_blank" rel="noopener noreferrer">
              Написать в Telegram
            </a>
          </div>
        </ScrollReveal>
      </section>

      {/* Contact Section */}
      <section className="contact-section" id="contact">
        <ScrollReveal>
          <h2 className="section-title">На связи</h2>
          <p className="section-subtitle">Следите за развитием AI-инструментов</p>
        </ScrollReveal>
        <ScrollReveal delay={150}>
          <div className="contact-island">
            <div className="contact-links">
              <a href="https://www.youtube.com/@Lavr5000" className="contact-link" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.13C5.12 19.56 12 19.56 12 19.56s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.43z"/>
                  <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" stroke="none"/>
                </svg>
                YouTube
              </a>
              <a href="https://t.me/ai_vibes_coding_ru" className="contact-link" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.2 4.4L2.4 10.8c-.6.2-.6 1.1 0 1.3l4.5 1.5 1.7 5.3c.2.5.8.7 1.2.4l2.5-2 4.8 3.5c.5.4 1.2.1 1.3-.5L21.8 5.4c.2-.7-.5-1.3-1.1-1z" fill="currentColor" stroke="none" opacity="0.9"/>
                  <line x1="9" y1="14" x2="13" y2="10" opacity="0.6"/>
                </svg>
                Telegram
              </a>
              <a href="https://boosty.to/no_code_ai_founder" className="contact-link" target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="currentColor" opacity="0.8">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-1-4-4-1 10-4-4 10z"/>
                </svg>
                Boosty
              </a>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* Footer */}
      <footer>
        <p>&copy; 2026 AI Vibes &middot; Build in Public</p>
      </footer>
    </>
  );
}
