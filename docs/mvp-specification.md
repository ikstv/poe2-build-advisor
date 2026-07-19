# Специфікація MVP-рекомендацій білду для PoE 2 Build Advisor

## 1) Призначення MVP

Цей документ фіксує затверджену специфікацію мінімально життєздатного продукту (MVP) для PoE 2 Build Advisor.

- Код застосунку на цьому етапі не змінюється: документ визначає, як має працювати система.
- Вхід: шість категоріальних параметрів, включно з поточним `stage`.
- Вихід: прозора рекомендація білду з ранжуванням, поясненням та планом проходження.

## 2) Вхідні параметри та системний контекст

### Користувацькі параметри

- `class` (`any` або будь-який ID з `availableClasses`): `any` або ID класу з активного датасета.
- `playStyle` (`melee`, `ranged`, `spells`, `minions`): обов’язковий фільтр сумісності.
- `goal` (`balanced`, `bossing`, `clear_speed`, `survivability`): керує вагами для ранжування.
- `mode` (`softcore`, `hardcore`): фільтр сумісності режиму.
- `budget` (`starter`, `low`, `medium`, `high`): фільтр за мінімальними витратами.
- `stage` (`start`, `campaign`, `early_maps`, `endgame`): поточний етап гравця.
- `stage` впливає на оцінку через `stageScore` (`scoresByStage`) і визначає, яка частина плану є актуальною зараз.
- Повний `path` повертається повністю від `start` до `endgame` незалежно від поточного `stage`.

### Системні дані

- `targetPatch`:
  - не вводиться користувачем;
  - береться з метаданих активного локального набору даних;
  - жорстко фіксується для сесії рекомендації.
- `availableClasses`:
  - список ID класів, які є в активному датасеті;
  - не є користувацьким параметром.

## 3) Формат результату рекомендації

Результат має містити:

- `primaryBuild`: головний рекомендований білд.
- `score`: числову оцінку від `0` до `100`, відображену з одним знаком після крапки.
- `reason`: пояснення, чому цей білд обраний.
- `path`: повний шлях прогресу від `start` до `endgame`.
- `alternatives`: доступні альтернативні білди в порядку релевантності.
- `patch`: номер патчу, у рамках якого валідні ці дані (`targetPatch`).
- `lastReviewedAt`: дата останньої перевірки даних.

`path` та поля для відображення деталей беруться з `Build.path`:

- `skills`
- `passiveMilestones`
- `gearMilestones`
- `upgradePriorities`

## 4) Прозорий алгоритм рекомендації

### 4.1 Крок 1. Первинна фільтрація

До розгляду допускаються лише білди, які пройшли всі фільтри:

1. Визначення `targetPatch` з активного локального набору даних.
2. Сумісність патчу: `build.patch === targetPatch`.
3. Валідація системного `availableClasses`.
4. Сумісність класу з параметром `class` (`any` дозволяє всі класи).
5. Обов’язкова наявність `playStyle` у `playStyles` білду.
6. Сумісність режиму (`modes` містить обраний `mode`).
7. Бюджет: `build.minimumBudget` у порядку `starter=0`, `low=1`, `medium=2`, `high=3` не перевищує користувацький `budget`.

### 4.2 Крок 2. Оцінка

Для кожного відфільтрованого білду рахуємо:

- `stageScore` — сила на поточному `stage`.
- `bossingScore`
- `clearSpeedScore`
- `survivabilityScore`
- `easeOfUseScore`

### 4.3 Крок 3. Вагове зважування

Використати ваги залежно від `goal`:

- `balanced`: stage 30%, survivability 25%, clearSpeed 20%, bossing 15%, ease 10%;
- `bossing`: bossing 45%, survivability 20%, stage 15%, clearSpeed 10%, ease 10%;
- `clear_speed`: clearSpeed 50%, stage 20%, survivability 15%, ease 10%, bossing 5%;
- `survivability`: survivability 50%, stage 15%, bossing 15%, clearSpeed 10%, ease 10%.

### 4.4 Крок 4. Нормалізація

1. Валідувати, що всі компонентні бали у межах `0–100`.
2. Обчислити зважену суму за формулою:
   `weightedScore = Σ(metricScore * metricWeight) / 100`
3. Отримати фінальний бал:
   `finalScore = clamp(weightedScore, 0, 100)`.

- Сортування виконується за повною точністю `finalScore` (без заокруглення).
- Для UI показується `score`, округлений до одного знака після десяткової крапки.
- Уся валідація та фінальний розподіл мають бути в межах `0–100`.

### 4.5 Крок 5. Вирішення нічиєї

Якщо кілька білдів мають однаковий `finalScore`, застосувати у фіксованому порядку:

1. `dataConfidence` (вище краще),
2. нижчий бюджет (`Build.minimumBudget`),
3. новіша `lastReviewedAt` (пізніша дата краще),
4. стабільний `id` (лексикографічно).

### 4.6 Крок 6. Поведінка при недостатній кількості результатів

1. 0 білдів:
   - Повернути `noMatch`.
   - Пояснити, що `goal` змінює тільки ваги рейтингування, але не кількість сумісних білдів.
   - Пояснити, що `targetPatch` не послаблюється.
   - Рекомендовані до зміни фільтри: `budget`, `mode`, `playStyle`, `class`.
2. 1–2 білди:
   - Показати лише доступні реальні варіанти.
   - Не підставляти несумісні або вигадані білди.
3. `alternatives` формувати лише з наявних фільтрованих результатів.

## 5) Таблиця ваг для цілі

| Goal | stage | survivability | clearSpeed | bossing | easeOfUse |
| --- | ---: | ---: | ---: | ---: | ---: |
| balanced | 30% | 25% | 20% | 15% | 10% |
| bossing | 15% | 20% | 10% | 45% | 10% |
| clear_speed | 20% | 15% | 50% | 5% | 10% |
| survivability | 15% | 50% | 10% | 15% | 10% |

- Для кожного `goal` сума ваг дорівнює `100%`.

## 6) Моделі даних

### BuildDataset

- `targetPatch` (string)
- `availableClasses` (string[])
- `builds` (Build[])

Контракти:

- Для кожного `Build` у `builds` має виконуватись `Build.patch === targetPatch`.
- `Build.class` має бути в `availableClasses`.

### StagePlan

- `skills` (string[])
- `passiveMilestones` (string[])
- `gearMilestones` (string[])
- `upgradePriorities` (string[])

### Build

- `id` (string)
- `name` (string)
- `patch` (string, e.g. `1.0.0`)
- `class` (string)
- `ascendancy` (string або null)
- `playStyles` (array of string)
- `modes` (array of string)
- `minimumBudget` (string: `starter`, `low`, `medium`, `high`)
- `scoresByStage` (object with keys: `start`, `campaign`, `early_maps`, `endgame`; values 0–100)
- `bossingScore` (number 0–100)
- `clearSpeedScore` (number 0–100)
- `survivabilityScore` (number 0–100)
- `easeOfUseScore` (number 0–100)
- `dataConfidence` (number 0–100)
- `lastReviewedAt` (ISO 8601 date string)
- `path` (object): 
  - `start`: StagePlan
  - `campaign`: StagePlan
  - `early_maps`: StagePlan
  - `endgame`: StagePlan
- `sources` (array of strings, verified source references)

## 7) Обмеження MVP

- Локальна база даних перевірених білдів.
- Ручне наповнення даними.
- Без автоматичного читання даних гри.
- Без веб-скрапінгу.
- Без AI.
- Без автоматичних дій у Path of Exile 2.

## 8) Пов’язано із задачами

- Цей документ фіксує зміст Issue #1.

## 9) Критерії готовності MVP-рекомендації

- Наявні вхідні параметри, системний контекст, їхній enum і валідація.
- Реалізовано `BuildDataset` і правила узгодженості (`Build.patch === targetPatch`, `Build.class ∈ availableClasses`).
- Проходження фільтрів `targetPatch`, `class`, `playStyle`, `mode`, `budget`.
- Результат ранжування дотримується зафіксованих ваг, правила tie-break.
- Коректне `path` від `start` до `endgame`; `stage` впливає лише на поточний скор.
- Поведінка при `0`, `1`, `2` результатах без вигадування/підміни даних.
- Усі метрики та `finalScore` залишаються в межах `0–100`, а вивід має округлення до одного знака.

---

# PoE 2 Build Advisor MVP recommendation specification

## 1) MVP purpose

This document defines the approved minimum viable product (MVP) specification for the PoE 2 Build Advisor.

- The application code is not changed at this stage: this document defines how recommendation behavior should work.
- Inputs are six categorical inputs, including the current progression stage.
- Output is a transparent ranked build recommendation with an explanation and progression plan.

## 2) Inputs and system context

### User inputs

- `class` (`any` or class ID from `availableClasses`): `any` or a class ID from active dataset data.
- `playStyle` (`melee`, `ranged`, `spells`, `minions`): mandatory compatibility filter.
- `goal` (`balanced`, `bossing`, `clear_speed`, `survivability`): controls score weights.
- `mode` (`softcore`, `hardcore`): mode-compatibility filter.
- `budget` (`starter`, `low`, `medium`, `high`): minimum budget compatibility filter.
- `stage` (`start`, `campaign`, `early_maps`, `endgame`): current player stage.
- `stage` only affects scoring through `stageScore` (`scoresByStage`) and indicates which stage details are currently relevant.
- Full `path` is returned from `start` to `endgame` regardless of current `stage`.

### System context

- `targetPatch`:
  - is not user input;
  - is read from active local dataset metadata;
  - is fixed for the recommendation run.
- `availableClasses`:
  - list of class IDs available in the active dataset;
  - is not a user input.

## 3) Recommendation output

Output must include:

- `primaryBuild`: the top recommended build.
- `score`: numeric score from `0` to `100`, shown with one decimal digit.
- `reason`: explanation of why this build is selected.
- `path`: full progression path from `start` to `endgame`.
- `alternatives`: available alternative builds in order of relevance.
- `patch`: patch version used for this recommendation (`targetPatch`).
- `lastReviewedAt`: date of last data verification.

`path` and detail fields are read from `Build.path`:

- `skills`
- `passiveMilestones`
- `gearMilestones`
- `upgradePriorities`

## 4) Transparent recommendation algorithm

### 4.1 Step 1. Initial filtering

Only builds that pass all filters are considered:

1. Resolve `targetPatch` from the active local dataset.
2. Patch compatibility: `build.patch === targetPatch`.
3. Validate system `availableClasses`.
4. Class compatibility with `class` (`any` allows all classes).
5. Mandatory play style presence in `playStyles`.
6. Mode compatibility (`modes` contains selected `mode`).
7. Budget check: `build.minimumBudget` with `starter=0`, `low=1`, `medium=2`, `high=3` does not exceed user `budget`.

### 4.2 Step 2. Scoring

For each filtered build:

- `stageScore` — power on the current `stage`.
- `bossingScore`
- `clearSpeedScore`
- `survivabilityScore`
- `easeOfUseScore`

### 4.3 Step 3. Weighted combination

Use `goal`-specific weights:

- `balanced`: stage 30%, survivability 25%, clearSpeed 20%, bossing 15%, ease 10%;
- `bossing`: bossing 45%, survivability 20%, stage 15%, clearSpeed 10%, ease 10%;
- `clear_speed`: clearSpeed 50%, stage 20%, survivability 15%, ease 10%, bossing 5%;
- `survivability`: survivability 50%, stage 15%, bossing 15%, clearSpeed 10%, ease 10%.

### 4.4 Step 4. Normalization

1. Validate all metric scores are in the `0–100` range.
2. Compute weighted score:
   `weightedScore = Σ(metricScore * metricWeight) / 100`
3. Final score:
   `finalScore = clamp(weightedScore, 0, 100)`.

- Sorting uses `finalScore` with full precision (no rounding).
- UI display shows `score` rounded to one decimal place.
- All values remain within `0–100`.

### 4.5 Step 5. Tie-breaking

If filtered builds have equal `finalScore`, apply in order:

1. `dataConfidence` descending,
2. lower budget (`Build.minimumBudget`),
3. newer `lastReviewedAt` (later date first),
4. stable `id` (lexicographically).

### 4.6 Step 6. Low-match behavior

1. If there are `0` builds:
   - Return a `noMatch` state.
   - Explain that `goal` changes only ranking weights and cannot increase matching build count.
   - Explain that `targetPatch` is never loosened.
   - Recommended filters to relax: `budget`, `mode`, `playStyle`, `class`.
2. If there are `1` or `2` builds:
   - Return only available real matches.
   - Do not substitute incompatible or fictional builds.
3. `alternatives` includes only existing filtered results.

## 5) Weight table

| Goal | stage | survivability | clearSpeed | bossing | easeOfUse |
| --- | ---: | ---: | ---: | ---: | ---: |
| balanced | 30% | 25% | 20% | 15% | 10% |
| bossing | 15% | 20% | 10% | 45% | 10% |
| clear_speed | 20% | 15% | 50% | 5% | 10% |
| survivability | 15% | 50% | 10% | 15% | 10% |

- For each `goal`, weights sum to exactly `100%`.

## 6) Data models

### BuildDataset

- `targetPatch` (string)
- `availableClasses` (string[])
- `builds` (Build[])

Contracts:

- For every `Build` in `builds`, `Build.patch === targetPatch` must hold.
- `Build.class` must be in `availableClasses`.

### StagePlan

- `skills` (string[])
- `passiveMilestones` (string[])
- `gearMilestones` (string[])
- `upgradePriorities` (string[])

### Build

- `id` (string)
- `name` (string)
- `patch` (string, e.g. `1.0.0`)
- `class` (string)
- `ascendancy` (string or null)
- `playStyles` (array of string)
- `modes` (array of string)
- `minimumBudget` (string: `starter`, `low`, `medium`, `high`)
- `scoresByStage` (object with keys: `start`, `campaign`, `early_maps`, `endgame`; values 0–100)
- `bossingScore` (number 0–100)
- `clearSpeedScore` (number 0–100)
- `survivabilityScore` (number 0–100)
- `easeOfUseScore` (number 0–100)
- `dataConfidence` (number 0–100)
- `lastReviewedAt` (ISO 8601 date string)
- `path` (object):
  - `start`: StagePlan
  - `campaign`: StagePlan
  - `early_maps`: StagePlan
  - `endgame`: StagePlan
- `sources` (array of strings, verified source references)

## 7) MVP limitations

- Local database of verified builds.
- Manual content entry only.
- No automatic in-game data reading.
- No scraping.
- No AI.
- No automated actions in Path of Exile 2.

## 8) Issue linkage

- This specification fulfills the scope defined in Issue #1.

## 9) MVP recommendation acceptance criteria

- All user inputs, system context fields, enums, and validation are defined.
- BuildDataset is defined and includes consistency rules (`Build.patch === targetPatch`, `Build.class ∈ availableClasses`).
- Filter pipeline includes `targetPatch`, `class`, `playStyle`, `mode`, `budget`.
- Ranking and tie-breaking follow the weight table and `dataConfidence` first.
- Output includes full `path` from `start` to `endgame`; `stage` affects only current score.
- Correct behavior for `0`, `1`, and `2` matches with no fabricated replacements.
- All metrics and `finalScore` remain within `0–100`, and displayed score is rounded to one decimal.
