## Локальний датасет builds

Ця папка містить локальний інфраструктурний датасет для MVP.

- Дані зберігаються локально у JSON-файлі та не виконують мережевих запитів.
- Завантаження відбувається з локального файлу через `loadBuildDataset` і проходить
  валідацію через `validateBuildDataset` з `recommendation engine`, щоб гарантувати коректність
  перед обчисленням рекомендацій.
- `builds.demo.json` є демонстраційними тестовими даними для перевірки інфраструктури та
  не використовується для надання реальних рекомендацій користувачам.
- У цьому етапі не планується мережева інтеграція, веб-скрапінг або AI-підбір білдів.

## Local build dataset

This directory contains a local foundation dataset for the MVP.

- Data is stored locally in a JSON file and does not perform network requests.
- Loading is performed from the local file via `loadBuildDataset` and validated through
  `validateBuildDataset` from the `recommendation engine` before recommendations are calculated.
- `builds.demo.json` is a demo/testing dataset for infrastructure verification and
  is not used for real user recommendations.
- In this stage, no network integration, web scraping, or AI-based build recommendation is used.
