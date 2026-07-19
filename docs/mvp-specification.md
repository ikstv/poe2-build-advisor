# Специфікація MVP-рекомендацій білду для PoE 2 Build Advisor

## 1) Призначення MVP

Цей документ фіксує затверджену специфікацію мінімально життєздатного продукту (MVP) для PoE 2 Build Advisor.

- Код застосунку на цьому етапі не змінюється: документ визначає, як має працювати система.
- Вхід: шість категоріальних параметрів, включно з поточним `stage`.
- Вихід: прозора рекомендація білду з ранжуванням, поясненням та планом проходження.

## 2) Вхідні параметри

### 2.1 class

- `class`: `any` або ID класу з `availableClasses` активного локального набору даних поточного патчу.
- Значення `any` означає, що обмеження за класом не застосовується.

### 2.2 availableClasses

- `availableClasses`: список ID класів, які доступні в активному локальному наборі даних поточного патчу.
- Параметр `class` має бути одним із цих ID або `any`.

### 2.3 stage

- `stage`: `start`, `campaign`, `early_maps`, `endgame`.
- Визначає, з якого етапу користувач перебуває зараз.
- Повний progression `path` завжди відображається повністю, але `stage` впливає на поточний `stageScore`.

### 2.4 playStyle

- `playStyle`: `melee`, `ranged`, `spells`, `minions`.
- Обов’язковий фільтр сумісності.
- Білд проходить далі лише якщо `playStyle` входить до `playStyles` білду.

### 2.5 goal

- `goal`: `balanced`, `bossing`, `clear_speed`, `survivability`.
- Керує вагами оцінки.

### 2.6 mode

- `mode`: `softcore`, `hardcore`.
- Режим обмежує набори білдів, сумісні з очікуваною безпекою/живучістю.

### 2.7 budget

- `budget`: `starter`, `low`, `medium`, `high`.
- Порядок бюджету: `starter = 0`, `low = 1`, `medium = 2`, `high = 3`.
- Білд проходить фільтр, якщо числове значення `minimumBudget` не перевищує значення `budget` користувача.

### 2.8 targetPatch (системний контекст)

- `targetPatch` не вводиться користувачем.
- Додається системою з метаданих активного локального набору даних.
- До розгляду допускаються лише білди з `patch === targetPatch`.

## 3) Формат результату рекомендації

Результат має містити:

- `primaryBuild`: головний рекомендований білд.
- `score`: числову оцінку від `0` до `100`, відображену з одним знаком після крапки.
- `reason`: пояснення, чому цей білд обраний.
- `path`: повний шлях прогресу від `start` до `endgame`.
- `skills`: список ключових навичок/умінь для фокусу.
- `passiveMilestones`: ключові пасивні вміння та віхи.
- `gearMilestones`: критичні цілі спорядження по етапах.
- `upgradePriorities`: наступні пріоритети апгрейду після базового плану.
- `alternatives`: доступні альтернативні білди в порядку релевантності.
- `patch`: номер патчу, у рамках якого валідні ці дані (`targetPatch`).
- `lastReviewedAt`: дата останньої перевірки даних.

## 4) Прозорий алгоритм рекомендації

### 4.1 Крок 1. Первинна фільтрація

До розгляду допускаються лише білди, які пройшли всі фільтри:

1. Визначення `targetPatch` з активного локального набору даних.
2. Сумісність патчу: `patch === targetPatch`.
3. Сумісність класу з параметром `class` (`any` дозволяє всі класи).
4. Обов’язкова наявність `playStyle` у `playStyles` білду.
5. Сумісність режиму (`modes` містить обраний `mode`).
6. Бюджет: числове значення `minimumBudget` білду не перевищує числове значення `budget` користувача.
7. Перевірка, що `class` (якщо не `any`) існує в `availableClasses` активного набору даних.

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

1. Валідувати, що всі компонентні бали, включно з `weightedScore`, у межах 0–100.
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
2. нижчий бюджет (`starter` < `low` < `medium` < `high`),
3. новіша `lastReviewedAt` (пізніша дата краще),
4. стабільний `id` (лексикографічно).

### 4.6 Крок 6. Поведінка при недостатній кількості результатів

1. 0 білдів:
   - Повернути `noMatch`.
   - Пояснити, які фільтри можна змінити в першу чергу (`budget`, `mode`, `goal`, `playStyle`, `class`).
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

## 6) Початкова модель білду

`Build`:

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
- `skills` (array of strings)
- `passiveMilestones` (array of objects: `stage`, `goal`, `items`)
- `gearMilestones` (array of objects: `stage`, `items`)
- `upgradePriorities` (array of strings)
- `sources` (array of strings, посилання або опис перевірених джерел)

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

- Наявні вхідні параметри, їхній enum і валідація.
- Проходження фільтрів `targetPatch`, `class`, `playStyle`, `mode`, `budget`.
- Алгоритм відбору й ранжування реалізований за зафіксованими вагами та правилами нічиєї.
- Коректне `path` від `start` до `endgame`, `stage` впливає на поточний бал.
- Поведінка при `0`, `1` та `2` результатах реалізована без вигадувань.
- Усі бали та `finalScore` залишаються в межах `0–100`, а вивід має округлення до одного знака.

---

# PoE 2 Build Advisor MVP recommendation specification

## 1) MVP purpose

This document defines the approved minimum viable product (MVP) specification for the PoE 2 Build Advisor.

- The application code is not changed at this stage: this document defines how recommendation behavior should work.
- Inputs are six categorical inputs, including the current progression stage.
- Output is a transparent ranked build recommendation with an explanation and progression plan.

## 2) Input parameters

### 2.1 class

- `class`: `any` or a class ID from `availableClasses` of the active local dataset for the current patch.
- `any` means no class restriction.

### 2.2 availableClasses

- `availableClasses`: the list of class IDs exposed by the active local dataset for the current patch.
- The `class` value must be one of these IDs or `any`.

### 2.3 stage

- `stage`: `start`, `campaign`, `early_maps`, `endgame`.
- Indicates where the player is right now.
- Full progression `path` is always displayed from start to endgame, while `stage` only affects the current score.

### 2.4 playStyle

- `playStyle`: `melee`, `ranged`, `spells`, `minions`.
- Mandatory compatibility filter.
- A build is eligible only if `playStyle` exists in the build's `playStyles`.

### 2.5 goal

- `goal`: `balanced`, `bossing`, `clear_speed`, `survivability`.
- Controls weight assignment during scoring.

### 2.6 mode

- `mode`: `softcore`, `hardcore`.
- Restricts builds by survivability and mode-specific safety assumptions.

### 2.7 budget

- `budget`: `starter`, `low`, `medium`, `high`.
- Budget order: `starter = 0`, `low = 1`, `medium = 2`, `high = 3`.
- A build passes the budget filter when build `minimumBudget` does not exceed the user's `budget`.

### 2.8 targetPatch (system context)

- `targetPatch` is not entered by the user.
- The app reads it from active local dataset metadata.
- Only builds with `patch === targetPatch` are included in ranking.

## 3) Recommendation output

Output must include:

- `primaryBuild`: the top recommended build.
- `score`: numeric score from `0` to `100`, shown with one decimal digit.
- `reason`: explanation of why this build is selected.
- `path`: full progression path from `start` to `endgame`.
- `skills`: key skills / skill priorities.
- `passiveMilestones`: key passive nodes and milestones.
- `gearMilestones`: major gear milestones.
- `upgradePriorities`: next upgrade priorities after the base plan.
- `alternatives`: available alternative builds in order of relevance.
- `patch`: patch version used for this recommendation (`targetPatch`).
- `lastReviewedAt`: date of last data verification.

## 4) Transparent recommendation algorithm

### 4.1 Step 1. Initial filtering

Only builds that pass all filters are considered:

1. Resolve `targetPatch` from the active local dataset.
2. Patch compatibility: `patch === targetPatch`.
3. Class compatibility with `class` (`any` allows all classes).
4. Mandatory play style presence in `playStyles`.
5. Mode compatibility (`modes` contains selected `mode`).
6. Budget compatibility: build `minimumBudget` does not exceed user's budget.
7. Class validation: if `class !== any`, it must be present in active `availableClasses`.

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

1. Validate all metric scores (and weighted results) are in the range of `0–100`.
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
2. lower budget first (`starter` < `low` < `medium` < `high`),
3. newer `lastReviewedAt` (later date first),
4. stable `id` (lexicographically).

### 4.6 Step 6. Low-match behavior

1. If there are `0` builds:
   - Return a `noMatch` state.
   - Explain which filters can be loosened first (`budget`, `mode`, `goal`, `playStyle`, `class`).
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

## 6) Initial Build model

`Build`:

- `id` (string)
- `name` (string)
- `patch` (string, e.g. `1.0.0`)
- `class` (string)
- `ascendancy` (string or null)
- `playStyles` (array of string)
- `modes` (array of string)
- `minimumBudget` (string: `starter`, `low`, `medium`, `high`)
- `scoresByStage` (object with keys `start`, `campaign`, `early_maps`, `endgame`; values 0–100)
- `bossingScore` (number 0–100)
- `clearSpeedScore` (number 0–100)
- `survivabilityScore` (number 0–100)
- `easeOfUseScore` (number 0–100)
- `dataConfidence` (number 0–100)
- `lastReviewedAt` (ISO 8601 date string)
- `skills` (array of strings)
- `passiveMilestones` (array of objects: `stage`, `goal`, `items`)
- `gearMilestones` (array of objects: `stage`, `items`)
- `upgradePriorities` (array of strings)
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

- All inputs, enums, and validation are defined.
- The filter pipeline includes `targetPatch`, `class`, `playStyle`, `mode`, and budget.
- Ranking and tie-breaking follow the weight table and `dataConfidence` first logic.
- Output includes the full path from `start` to `endgame`, with current `stage` affecting scoring only.
- Correct handling for `0`, `1`, and `2` matches without fabricating builds.
- All metrics and `finalScore` remain within `0–100`, and displayed score is rounded to one decimal.
