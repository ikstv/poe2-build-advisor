# PoE 2 Build Advisor

## 🇺🇦 Українська

Windows-застосунок, що допомагає підібрати ефективний білд для **Path of Exile 2** — від початку гри до ендгейму.

### Мета першої версії

- Зібрати перевірені білди в єдину базу даних.
- Підібрати білд за класом, стилем гри, режимом, бюджетом і поточним етапом прогресу.
- Показати послідовний план розвитку: старт → кампанія → ранній ендгейм → мапи → боси.
- Пояснити пріоритети для навичок, пасивних умінь, спорядження та наступних покращень.

### Принципи проєкту

- Усі тексти документації, Issue, Pull Request і коментарі в коді пишемо спочатку українською, а нижче додаємо англійський переклад.
- Назви файлів, класів, функцій, змінних і технічні ключі пишемо англійською.
- Рекомендації прив'язані до версії (патчу) гри: «найсильніший» білд змінюється після балансних оновлень.
- Перший реліз використовує прозорий рейтинговий алгоритм на основі перевірених даних.

### Документація

- [MVP Специфікація (Українська та English)](docs/mvp-specification.md)

---

## 🇬🇧 English

A Windows application that helps choose an effective **Path of Exile 2** build, from the start of the game through endgame.

### First-version goal

- Collect verified builds in one data source.
- Recommend a build based on class, play style, game mode, budget, and current progression stage.
- Show a clear progression path: start → campaign → early endgame → maps → bosses.
- Explain priorities for skills, passive nodes, equipment, and the next upgrades.

### Project principles

- All documentation, Issues, Pull Requests, and code comments are written in Ukrainian first, followed by the English translation.
- File names, classes, functions, variables, and technical keys are written in English.
- Recommendations are tied to the game version (patch), because the “strongest” build changes after balance updates.
- The first release uses a transparent ranking algorithm based on verified data.

### Documentation

- [MVP Specification (Ukrainian and English)](docs/mvp-specification.md)

## 🔧 Запуск Windows desktop-версії з Tauri (PoE 2 Build Advisor Foundation)

- Перейдіть у папку програми: `cd app`
- Встановіть залежності: `npm install`
- Запустіть білд frontend: `npm run build`
- Перевірте Tauri-конфігурацію: `npm run tauri:check`
- Зберіть застосунок: `npm run tauri:build`
- Під час розробки можна запускати `npm run dev` для Vite або `npm run tauri` для взаємодії через Tauri CLI.

### Мінімальні залежності для Windows

- Rust stable
- Microsoft C++ Build Tools з компонентом **Desktop development with C++**
- Microsoft Edge WebView2

## 🔧 Running the PoE 2 Build Advisor desktop foundation (Tauri)

- Go to the app folder: `cd app`
- Install dependencies: `npm install`
- Build the frontend: `npm run build`
- Validate the Tauri configuration: `npm run tauri:check`
- Build the desktop app: `npm run tauri:build`
- During development, use `npm run dev` for Vite, or `npm run tauri` to run Tauri CLI commands.

### Windows dependencies

- Rust stable
- Microsoft C++ Build Tools with **Desktop development with C++** component
- Microsoft Edge WebView2
