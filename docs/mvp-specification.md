# Специфікація MVP-рекомендацій білду для PoE 2 Build Advisor

## 1) Призначення MVP

Цей документ фіксує затверджену специфікацію мінімально життєздатного продукту (MVP) для PoE 2 Build Advisor.

- Код застосунку на цьому етапі не змінюється: документ визначає, як має працювати система.
- Вхід: п’ять категоріальних параметрів користувача + поточний етап прогресу.
- Вихід: прозора рекомендація білду з ранжуванням, поясненням та планом проходження.

## 2) Вхідні параметри

### 2.1 class

- `class`: конкретний клас (`warrior`, `ranger`, `witch`, `monk`, `rogue`, `scion`, або `any`).
- Значення `any` означає, що клас не обмежується.

### 2.2 stage

- `stage`: `start`, `campaign`, `early_maps`, `endgame`.
- Визначає, з якого етапу користувач стартує.

### 2.3 playStyle

- `playStyle`: `melee`, `ranged`, `spells`, `minions`.
- Може бути використаний для додаткового ранжування в межах класу.

### 2.4 goal

- `goal`: `balanced`, `bossing`, `clear_speed`, `survivability`.
- Керує вагами оцінки.

### 2.5 mode

- `mode`: `softcore`, `hardcore`.
- Вибір режиму обмежує набори білдів, сумісні з ризиком смерті персонажа.

### 2.6 budget

- `budget`: `starter`, `low`, `medium`, `high`.
- Використовується для фільтрації білдів за мінімальною бюджетною вимогою.

## 3) Формат результату рекомендації

Результат має містити:

- `primaryBuild`: головний рекомендований білд.
- `score`: числову оцінку від `0` до `100`.
- `reason`: пояснення чому вибраний білд найкращий під поточний запит.
- `path`: послідовність розвитку `start → campaign → early_maps → endgame`.
- `skills`: список ключових навичок/умінь для фокусу.
- `passives`: список ключових пасивних вмінь.
- `gear`: критичні цілі спорядження по етапах.
- `nextUpgrades`: наступні цілі апгрейду після базового плану.
- `alternatives`: дві альтернативні збірки (від кращої до гіршої в межах релевантного топу).
- `patch`: номер патчу, у рамках якого валідні ці дані.
- `lastCheckedAt`: дата останньої перевірки даних.

## 4) Прозорий алгоритм рекомендації

### 4.1 Крок 1. Первинна фільтрація

До розгляду допускаються лише білди, які пройшли всі фільтри:

1. Сумісність патчу із поточним таргетним патчем.
2. Сумісність класу з параметром `class` (`any` дозволяє усі класи).
3. Наявність `playStyle` у наборі `playStyles`.
4. Сумісність режиму (`modes` містить обраний `mode`).
5. Бюджет: `minimumBudget` білду не перевищує обраний `budget`.

### 4.2 Крок 2. Оцінка

Для кожного відфільтрованого білду рахуємо:

- `stageScore` — сила та ритм на поточному `stage`.
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

1. Нормалізувати кожен компонентний бал до 0–100 (вхідні значення мають бути в цьому діапазоні, або нормалізовані до нього).
2. Обчислити зважену суму за формулою:
   `weightedScore = Σ(metricScore * metricWeight) / 100`
3. Додатково застосувати корекцію за довірою до даних:
   `confidenceBonus = (dataConfidence - 50) / 10`, але не більше 5 і не менше -5.
4. Отримати фінальний бал:
   `finalScore = clamp(weightedScore + confidenceBonus, 0, 100)`.

### 4.5 Крок 5. Вирішення нічиєї

Якщо кілька білдів мають однаковий `finalScore`, застосувати у фіксованому порядку:

1. `dataConfidence` (вище краще),
2. нижчий бюджет (`starter` < `low` < `medium` < `high`),
3. новіша `lastReviewedAt` (пізніша дата краще),
4. стабільний `id` (лексикографічно).

## 5) Таблиця ваг для цілі

| Goal | stage | survivability | clearSpeed | bossing | easeOfUse |
| --- | ---: | ---: | ---: | ---: | ---: |
| balanced | 30% | 25% | 20% | 15% | 10% |
| bossing | 15% | 20% | 10% | 45% | 10% |
| clear_speed | 20% | 15% | 50% | 5% | 10% |
| survivability | 15% | 50% | 10% | 15% | 10% |

## 6) Початкова модель білду

`Build`:

- `id` (string)
- `name` (string)
- `patch` (string, e.g. `1.0.0`)
- `class` (string, базовий клас)
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
- `sources` (array of strings, посилання або опис джерел перевірених даних)

## 7) Обмеження MVP

- Локальна база даних перевірених білдів.
- Ручне наповнення даними.
- Без автоматичного читання даних гри.
- Без веб-скрапінгу.
- Без AI.
- Без автоматичних дій у Path of Exile 2.

## 8) Пов’язано із задачами

- Цей документ є реалізацією змісту Issue #1.

## 9) Критерії готовності MVP-рекомендації

- Наявні вхідні параметри та їх валідація.
- Алгоритм відбору й ранжування реалізований відповідно до таблиць ваг.
- Повертається головна рекомендація + два альтернативні варіанти + повний маршрут ігрового прогресу.
- Усі результати відтворювані і пояснюються.

---

# PoE 2 Build Advisor MVP recommendation specification

## 1) MVP purpose

This document defines the approved minimum viable product (MVP) specification for the PoE 2 Build Advisor.

- The application code is not changed at this stage: this document defines how recommendation behavior should work.
- Inputs are six categorical user parameters plus current progression stage.
- Output is a transparent ranked build recommendation with an explanation and progression plan.

## 2) Input parameters

### 2.1 class

- `class`: a specific class (`warrior`, `ranger`, `witch`, `monk`, `rogue`, `scion`, or `any`).
- `any` means no class restriction.

### 2.2 stage

- `stage`: `start`, `campaign`, `early_maps`, `endgame`.
- Indicates where the player currently is in progression.

### 2.3 playStyle

- `playStyle`: `melee`, `ranged`, `spells`, `minions`.
- Used to bias selection within the chosen class.

### 2.4 goal

- `goal`: `balanced`, `bossing`, `clear_speed`, `survivability`.
- Controls weight assignment during scoring.

### 2.5 mode

- `mode`: `softcore`, `hardcore`.
- Restricts builds by survivability and build safety assumptions for game mode.

### 2.6 budget

- `budget`: `starter`, `low`, `medium`, `high`.
- Filters build options by minimum budget requirements.

## 3) Recommendation output

Output must include:

- `primaryBuild`: the top recommended build.
- `score`: numerical score from `0` to `100`.
- `reason`: explanation of why this build is selected.
- `path`: progression path `start → campaign → early_maps → endgame`.
- `skills`: key skills / skill priorities.
- `passives`: key passive nodes and milestones.
- `gear`: major gear milestones.
- `nextUpgrades`: next planned upgrade steps after the base build.
- `alternatives`: two alternative builds ordered by score.
- `patch`: patch version used for this recommendation.
- `lastCheckedAt`: date of last data verification.

## 4) Transparent recommendation algorithm

### 4.1 Step 1. Initial filtering

Only builds that satisfy all filters are considered:

1. Patch compatibility with current requested patch.
2. Class compatibility with `class` (`any` allows all classes).
3. Presence of `playStyle` in `playStyles`.
4. Mode compatibility (`modes` contains selected `mode`).
5. Budget compatibility: `minimumBudget` must be <= requested `budget`.

### 4.2 Step 2. Scoring

For each filtered build:

- `stageScore` — strength at the current `stage`.
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

1. Normalize each component score to 0–100 (inputs are assumed to be in 0–100 or normalized beforehand).
2. Compute weighted total:
   `weightedScore = Σ(metricScore * metricWeight) / 100`.
3. Apply data confidence adjustment:
   `confidenceBonus = (dataConfidence - 50) / 10`, capped to [−5, +5].
4. Final score:
   `finalScore = clamp(weightedScore + confidenceBonus, 0, 100)`.

### 4.5 Step 5. Tie-breaking

If scores tie, apply in order:

1. `dataConfidence` descending,
2. lower budget first (`starter` < `low` < `medium` < `high`),
3. newer `lastReviewedAt` (later date first),
4. stable `id` (lexicographically).

## 5) Weight table

| Goal | stage | survivability | clearSpeed | bossing | easeOfUse |
| --- | ---: | ---: | ---: | ---: | ---: |
| balanced | 30% | 25% | 20% | 15% | 10% |
| bossing | 15% | 20% | 10% | 45% | 10% |
| clear_speed | 20% | 15% | 50% | 5% | 10% |
| survivability | 15% | 50% | 10% | 15% | 10% |

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

## 9) MVP acceptance criteria

- Inputs and validation are defined and enforced.
- Ranking and weighting logic matches the documented weights.
- Output includes primary recommendation, two alternatives, reasons, path, build path details, and upgrades.
- Results are reproducible and explainable.
