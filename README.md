# MyWebsite - No-code AI Founder Portfolio

**GitHub:** https://github.com/Lavr5000/MyWebsite

**Live Site:** https://lavr5000.github.io/

**Privacy:** Private repository

---

## 🎯 Project Overview

Минимальное статическое портфолио "No-code AI Founder" с информацией о проектах, созданных без программирования с помощью AI-инструментов.

---

## 🚀 Tech Stack

- **Framework:** Next.js 14 (App Router + Static Export)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (custom CSS variables)
- **Deployment:** GitHub Pages (via GitHub Actions)

**Минимальные зависимости:** только Next.js, React и TypeScript

---

## 🏃 Quick Start

### Prerequisites
- Node.js 18+
- npm

### 1. Clone & Install

```bash
git clone https://github.com/Lavr5000/MyWebsite.git
cd MyWebsite
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 3. Build for Production

```bash
npm run build
```

Static site will be generated in `out/` directory.

---

## 📂 Project Structure

```
my-website/
├── src/
│   └── app/              # Next.js App Router
│       ├── layout.tsx    # Root layout with metadata
│       ├── page.tsx      # Homepage (portfolio)
│       └── globals.css   # Global styles
├── public/               # Static assets (favicons, etc.)
├── package.json
├── next.config.js        # Static export configuration
├── tailwind.config.ts    # Tailwind CSS configuration
└── tsconfig.json         # TypeScript configuration
```

**Минимальная структура:** только 2 файла TypeScript + 1 CSS файл

---

## ✨ Features

- **Lightning Fast:** Статический export, только HTML/CSS/JS
- **Projects Showcase:** Демонстрация проектов
  - Kanban-доска с AI
  - Apartment Auditor
  - IDGenerator
- **Responsive Design:** Адаптивная вёрстка
- **Dark Theme:** Премиум тёмная тема
- **SEO Friendly:** Мета-теги, правильная семантика
- **Performance:** Оптимизированный сбор (138 B page + 87.5 KB JS)

---

## 📦 Deployment

### GitHub Pages (recommended)

Сайт автоматически деплоится на GitHub Pages через GitHub Actions workflow (`deploy-pages.yml`).

**Процесс:**
1. Push в branch `master` → GitHub Actions запускает build
2. Workflow собирает `npm run build` → `out/`
3. Деплой на GitHub Pages автоматически

**Repository:** `Lavr5000/Lavr5000.github.io`

### Manual Deployment

```bash
npm run build
# Upload contents of 'out/' directory to your hosting
```

---

## 🎨 Customization

### Изменить проекты

Отредактируйте `src/app/page.tsx`, секция "Projects Section":

```tsx
<div className="project-card">
  <span className="project-icon">📋</span>
  <h3 className="project-title">Название проекта</h3>
  <div className="project-status status-ready">Статус</div>
  <p className="project-description">Описание</p>
</div>
```

### Изменить цвета

Отредактируйте CSS переменные в `src/app/globals.css`:

```css
:root {
  --bg-primary: #0a0a0f;
  --accent-primary: #00d4ff;
  --accent-secondary: #b24bf3;
  /* ... */
}
```

---

## 📊 Performance

- **First Load JS:** 87.5 KB
- **Page Size:** 138 B
- **Build Time:** ~5 seconds
- **Static Pages:** 100% (no SSR)

---

## 📄 License

Private project

---

## 👤 Author

**Created by:** Lavr5000
**Assisted by:** Claude Code (Anthropic)

**Repository:** https://github.com/Lavr5000/MyWebsite
**Live Site:** https://lavr5000.github.io/
