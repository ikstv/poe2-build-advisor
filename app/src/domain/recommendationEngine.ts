export type Stage = 'start' | 'campaign' | 'early_maps' | 'endgame'

export type PlayStyle = 'melee' | 'ranged' | 'spells' | 'minions'

export type Goal = 'balanced' | 'bossing' | 'clear_speed' | 'survivability'

export type Mode = 'softcore' | 'hardcore'

export type Budget = 'starter' | 'low' | 'medium' | 'high'

export const budgetOrder: Record<Budget, number> = {
  starter: 0,
  low: 1,
  medium: 2,
  high: 3,
}

export interface UserPreferences {
  class: 'any' | string
  stage: Stage
  playStyle: PlayStyle
  goal: Goal
  mode: Mode
  budget: Budget
}

export interface StagePlan {
  skills: string[]
  passiveMilestones: string[]
  gearMilestones: string[]
  upgradePriorities: string[]
}

export type StageScores = Record<Stage, number>

export interface Build {
  id: string
  name: string
  patch: string
  class: string
  ascendancy: string | null
  playStyles: PlayStyle[]
  modes: Mode[]
  minimumBudget: Budget
  scoresByStage: StageScores
  bossingScore: number
  clearSpeedScore: number
  survivabilityScore: number
  easeOfUseScore: number
  dataConfidence: number
  lastReviewedAt: string
  path: {
    start: StagePlan
    campaign: StagePlan
    early_maps: StagePlan
    endgame: StagePlan
  }
  sources: string[]
}

export interface BuildDataset {
  targetPatch: string
  availableClasses: string[]
  builds: Build[]
}

interface BuildWithScore extends Build {
  finalScore: number
}

type ScoredBuild = BuildWithScore

export interface MatchResult {
  type: 'match'
  primaryBuild: ScoredBuild
  score: number
  reason: string
  path: Build['path']
  alternatives: ScoredBuild[]
  patch: string
  lastReviewedAt: string
}

export interface NoMatchResult {
  type: 'no-match'
  reason: string
  patch: string
  relaxableFilters: Array<'budget' | 'mode' | 'playStyle' | 'class'>
}

export type RecommendationResult = MatchResult | NoMatchResult

export type WeightPlan = {
  stage: number
  survivability: number
  clearSpeed: number
  bossing: number
  easeOfUse: number
}

const expectedGoalWeightSum = 100

const goalWeights: Record<Goal, WeightPlan> = {
  balanced: {
    stage: 30,
    survivability: 25,
    clearSpeed: 20,
    bossing: 15,
    easeOfUse: 10,
  },
  bossing: {
    stage: 15,
    survivability: 20,
    clearSpeed: 10,
    bossing: 45,
    easeOfUse: 10,
  },
  clear_speed: {
    stage: 20,
    survivability: 15,
    clearSpeed: 50,
    bossing: 5,
    easeOfUse: 10,
  },
  survivability: {
    stage: 15,
    survivability: 50,
    clearSpeed: 10,
    bossing: 15,
    easeOfUse: 10,
  },
}

const validStages: readonly Stage[] = ['start', 'campaign', 'early_maps', 'endgame']
const validPlayStyles: readonly PlayStyle[] = ['melee', 'ranged', 'spells', 'minions']
const validGoals: readonly Goal[] = ['balanced', 'bossing', 'clear_speed', 'survivability']
const validModes: readonly Mode[] = ['softcore', 'hardcore']
const validBudgets: readonly Budget[] = ['starter', 'low', 'medium', 'high']

const requiredPathStages: Array<keyof Build['path']> = [...validStages]

const isAllowedValue = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== ''

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isSupportedScore = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(context)
  }
  return value
}

const ensureArrayOfStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => isNonEmptyString(entry))

const parseIsoOffsetMinutes = (offset: string): number => {
  if (offset === 'Z') {
    return 0
  }

  const sign = offset[0] === '+' ? 1 : -1
  const [hours, minutes] = offset.slice(1).split(':')
  return sign * (Number(hours) * 60 + Number(minutes))
}

const isValidIsoDate = (value: unknown, context: string): void => {
  if (!isNonEmptyString(value)) {
    throw new Error(context)
  }

  const isoDateOnlyRegex = /^(\d{4})-(\d{2})-(\d{2})$/
  const isoDateTimeRegex =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-](\d{2}):(\d{2}))$/

  const dateOnlyMatch = value.match(isoDateOnlyRegex)
  if (dateOnlyMatch !== null) {
    const year = Number(dateOnlyMatch[1])
    const month = Number(dateOnlyMatch[2])
    const day = Number(dateOnlyMatch[3])

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw new Error(context)
    }

    const candidateUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
    if (
      candidateUtc.getUTCFullYear() !== year ||
      candidateUtc.getUTCMonth() !== month - 1 ||
      candidateUtc.getUTCDate() !== day
    ) {
      throw new Error(context)
    }

    const parsed = new Date(`${value}T00:00:00Z`)
    if (parsed.getTime() !== candidateUtc.getTime()) {
      throw new Error(context)
    }
    return
  }

  const match = value.match(isoDateTimeRegex)
  if (match === null) {
    throw new Error(context)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hours = Number(match[4])
  const minutes = Number(match[5])
  const seconds = Number(match[6])
  const milliseconds = match[7] ? Number(match[7].padEnd(3, '0')) : 0
  const offsetText = match[8]

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hours > 23 ||
    minutes > 59 ||
    seconds > 59 ||
    milliseconds < 0 ||
    milliseconds > 999
  ) {
    throw new Error(context)
  }

  const candidateUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, milliseconds))
  if (
    candidateUtc.getUTCFullYear() !== year ||
    candidateUtc.getUTCMonth() !== month - 1 ||
    candidateUtc.getUTCDate() !== day ||
    candidateUtc.getUTCHours() !== hours ||
    candidateUtc.getUTCMinutes() !== minutes ||
    candidateUtc.getUTCSeconds() !== seconds ||
    candidateUtc.getUTCMilliseconds() !== milliseconds
  ) {
    throw new Error(context)
  }

  const parsed = new Date(value)
  const parsedAt = parsed.getTime()
  if (!Number.isFinite(parsedAt)) {
    throw new Error(context)
  }

  const offsetMinutes = parseIsoOffsetMinutes(offsetText)
  const expectedAt = candidateUtc.getTime() - offsetMinutes * 60 * 1000

  if (parsedAt !== expectedAt) {
    throw new Error(context)
  }
}

const getDecisionReason = (
  primary: BuildWithScore,
  alternate: BuildWithScore | undefined,
  preferences: UserPreferences,
  compatibleCount: number,
): string => {
  const toUiScore = (score: number): number => Math.round(score * 10 + Number.EPSILON) / 10
  const roundedScore = toUiScore(primary.finalScore)
  const roundedAlternateScore = alternate ? toUiScore(alternate.finalScore) : undefined

  if (!alternate) {
    return `Primary build ${primary.id} selected because it is the only compatible build for goal=${preferences.goal}, stage=${preferences.stage}, score=${roundedScore}. compatibleBuilds=${compatibleCount}`
  }

  if (primary.finalScore > alternate.finalScore) {
    return `Primary build ${primary.id} was selected over ${alternate.id} by higher finalScore (${roundedScore} > ${roundedAlternateScore}) for goal=${preferences.goal}, stage=${preferences.stage}. compatibleBuilds=${compatibleCount}`
  }

  if (primary.dataConfidence > alternate.dataConfidence) {
    return `Primary build ${primary.id} was selected over ${alternate.id} by higher dataConfidence (${primary.dataConfidence} > ${alternate.dataConfidence}) while finalScore is tied for goal=${preferences.goal}, stage=${preferences.stage}. compatibleBuilds=${compatibleCount}`
  }

  if (budgetOrder[primary.minimumBudget] < budgetOrder[alternate.minimumBudget]) {
    return `Primary build ${primary.id} was selected over ${alternate.id} by lower minimumBudget (${primary.minimumBudget} < ${alternate.minimumBudget}) at equal finalScore and dataConfidence for goal=${preferences.goal}, stage=${preferences.stage}. compatibleBuilds=${compatibleCount}`
  }

  const primaryReviewedAt = new Date(primary.lastReviewedAt).getTime()
  const alternateReviewedAt = new Date(alternate.lastReviewedAt).getTime()
  if (primaryReviewedAt > alternateReviewedAt) {
    return `Primary build ${primary.id} was selected over ${alternate.id} by newer lastReviewedAt (${primary.lastReviewedAt} > ${alternate.lastReviewedAt}) while score, dataConfidence and minimumBudget are equal for goal=${preferences.goal}, stage=${preferences.stage}. compatibleBuilds=${compatibleCount}`
  }

  return `Primary build ${primary.id} was selected over ${alternate.id} by stable id tie-break (${primary.id} < ${alternate.id}) for goal=${preferences.goal}, stage=${preferences.stage}. compatibleBuilds=${compatibleCount}`
}

export const validateBuildDataset = (dataset: BuildDataset): void => {
  if (!dataset || typeof dataset !== 'object') {
    throw new Error('Dataset must be an object')
  }

  if (typeof dataset.targetPatch !== 'string' || dataset.targetPatch.trim() === '') {
    throw new Error('Dataset targetPatch must be a non-empty string')
  }

  if (!Array.isArray(dataset.availableClasses) || dataset.availableClasses.length === 0) {
    throw new Error('Dataset availableClasses must be a non-empty array')
  }

  const uniqueClasses = new Set<string>()
  for (const className of dataset.availableClasses) {
    if (!isNonEmptyString(className)) {
      throw new Error('Dataset availableClasses must contain non-empty strings')
    }
    if (uniqueClasses.has(className)) {
      throw new Error(`Dataset availableClasses must be unique, duplicate found: ${className}`)
    }
    uniqueClasses.add(className)
  }

  if (!Array.isArray(dataset.builds)) {
    throw new Error('Dataset builds must be an array')
  }

  const ids = new Set<string>()

  for (const build of dataset.builds) {
    if (!isObject(build)) {
      throw new Error('Each build must be a non-null object')
    }

    if (!isNonEmptyString(build.id)) {
      throw new Error('Each build must have a non-empty string id')
    }

    if (ids.has(build.id)) {
      throw new Error(`Duplicate build id detected: ${build.id}`)
    }
    ids.add(build.id)

    if (typeof build.ascendancy !== 'string' && build.ascendancy !== null) {
      throw new Error(`Build ascendancy must be a string or null: ${build.id}`)
    }

    if (typeof build.patch !== 'string' || build.patch.trim() === '') {
      throw new Error(`Build patch must be a non-empty string: ${build.id}`)
    }

    if (build.patch !== dataset.targetPatch) {
      throw new Error(`Build patch mismatch: ${build.id}`)
    }

    if (!isNonEmptyString(build.class)) {
      throw new Error(`Build class must be a non-empty string: ${build.id}`)
    }

    if (!uniqueClasses.has(build.class)) {
      throw new Error(`Build class is not available for current dataset: ${build.id}`)
    }

    if (!isNonEmptyString(build.name)) {
      throw new Error(`Build name must be a non-empty string: ${build.id}`)
    }

    if (!ensureArrayOfStrings(build.sources)) {
      throw new Error(`Build sources must be an array of non-empty strings: ${build.id}`)
    }

    if (!Array.isArray(build.playStyles) || build.playStyles.length === 0) {
      throw new Error(`Build playStyles must be a non-empty array: ${build.id}`)
    }

    if (build.playStyles.some((style) => !isAllowedValue(style, validPlayStyles))) {
      throw new Error(`Build playStyles must contain only valid values: ${build.id}`)
    }

    if (!Array.isArray(build.modes) || build.modes.length === 0) {
      throw new Error(`Build modes must be a non-empty array: ${build.id}`)
    }

    if (build.modes.some((mode) => !isAllowedValue(mode, validModes))) {
      throw new Error(`Build modes must contain only valid values: ${build.id}`)
    }

    if (!Object.hasOwn(budgetOrder, build.minimumBudget)) {
      throw new Error(`Build minimumBudget must be one of starter, low, medium, high: ${build.id}`)
    }

    if (typeof build.path !== 'object' || build.path === null) {
      throw new Error(`Build path must be an object: ${build.id}`)
    }

    for (const stage of requiredPathStages) {
      const plan = build.path[stage]
      if (!plan) {
        throw new Error(`Build path must include stage ${stage}: ${build.id}`)
      }
      if (!Array.isArray(plan.skills) || plan.skills.some((skill) => typeof skill !== 'string')) {
        throw new Error(`Build path ${stage}.skills must be an array of strings: ${build.id}`)
      }
      if (
        !Array.isArray(plan.passiveMilestones) ||
        plan.passiveMilestones.some((skill) => typeof skill !== 'string')
      ) {
        throw new Error(`Build path ${stage}.passiveMilestones must be an array of strings: ${build.id}`)
      }
      if (!Array.isArray(plan.gearMilestones) || plan.gearMilestones.some((skill) => typeof skill !== 'string')) {
        throw new Error(`Build path ${stage}.gearMilestones must be an array of strings: ${build.id}`)
      }
      if (
        !Array.isArray(plan.upgradePriorities) ||
        plan.upgradePriorities.some((skill) => typeof skill !== 'string')
      ) {
        throw new Error(`Build path ${stage}.upgradePriorities must be an array of strings: ${build.id}`)
      }
    }

    if (typeof build.scoresByStage !== 'object' || build.scoresByStage === null) {
      throw new Error(`Build scoresByStage must be an object: ${build.id}`)
    }

    for (const stage of requiredPathStages) {
      isSupportedScore(
        build.scoresByStage[stage],
        `scoresByStage.${stage} must be a number between 0 and 100: ${build.id}`,
      )
    }

    isSupportedScore(build.bossingScore, `bossingScore must be a number between 0 and 100: ${build.id}`)
    isSupportedScore(
      build.clearSpeedScore,
      `clearSpeedScore must be a number between 0 and 100: ${build.id}`,
    )
    isSupportedScore(
      build.survivabilityScore,
      `survivabilityScore must be a number between 0 and 100: ${build.id}`,
    )
    isSupportedScore(
      build.easeOfUseScore,
      `easeOfUseScore must be a number between 0 and 100: ${build.id}`,
    )
    isSupportedScore(
      build.dataConfidence,
      `dataConfidence must be a number between 0 and 100: ${build.id}`,
    )
    isValidIsoDate(
      build.lastReviewedAt,
      `Build lastReviewedAt must be a valid ISO 8601 date string: ${build.id}`,
    )
  }

  for (const [goal, weights] of Object.entries(goalWeights) as [Goal, WeightPlan][]) {
    const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0)
    if (totalWeight !== expectedGoalWeightSum) {
      throw new Error(`Goal weights for ${goal} must sum to ${expectedGoalWeightSum}`)
    }
  }
}

export const validateUserPreferences = (dataset: BuildDataset, preferences: UserPreferences): void => {
  if (!preferences || typeof preferences !== 'object') {
    throw new Error('User preferences must be an object')
  }

  if (typeof preferences.class !== 'string' || preferences.class.trim() === '') {
    throw new Error('User preference class must be "any" or a non-empty string')
  }

  if (preferences.class !== 'any' && !dataset.availableClasses.includes(preferences.class)) {
    throw new Error(`User preference class must be "any" or one of available classes: ${preferences.class}`)
  }

  if (!isAllowedValue(preferences.stage, validStages)) {
    throw new Error(`User preference stage must be one of start, campaign, early_maps, endgame: ${preferences.stage}`)
  }

  if (!isAllowedValue(preferences.playStyle, validPlayStyles)) {
    throw new Error(`User preference playStyle must be one of melee, ranged, spells, minions: ${preferences.playStyle}`)
  }

  if (!isAllowedValue(preferences.goal, validGoals)) {
    throw new Error(`User preference goal must be one of balanced, bossing, clear_speed, survivability: ${preferences.goal}`)
  }

  if (!isAllowedValue(preferences.mode, validModes)) {
    throw new Error(`User preference mode must be one of softcore, hardcore: ${preferences.mode}`)
  }

  if (!isAllowedValue(preferences.budget, validBudgets)) {
    throw new Error(`User preference budget must be one of starter, low, medium, high: ${preferences.budget}`)
  }
}

const clampScore = (score: number): number => {
  if (score < 0) {
    return 0
  }
  if (score > 100) {
    return 100
  }
  return score
}

const roundToUiScore = (score: number): number =>
  Math.round(score * 10 + Number.EPSILON) / 10

const scoreBuild = (build: Build, preferences: UserPreferences): number => {
  const weights = goalWeights[preferences.goal]
  const stageScore = build.scoresByStage[preferences.stage]

  const weightedScore =
    (stageScore * weights.stage +
      build.bossingScore * weights.bossing +
      build.clearSpeedScore * weights.clearSpeed +
      build.survivabilityScore * weights.survivability +
      build.easeOfUseScore * weights.easeOfUse) /
    100

  return clampScore(weightedScore)
}

const sortBuilds = (a: BuildWithScore, b: BuildWithScore): number => {
  const scoreDiff = b.finalScore - a.finalScore
  if (scoreDiff !== 0) {
    return scoreDiff
  }

  if (a.dataConfidence !== b.dataConfidence) {
    return b.dataConfidence - a.dataConfidence
  }

  const budgetDiff = budgetOrder[a.minimumBudget] - budgetOrder[b.minimumBudget]
  if (budgetDiff !== 0) {
    return budgetDiff
  }

  const reviewedAtDiff = new Date(b.lastReviewedAt).getTime() - new Date(a.lastReviewedAt).getTime()
  if (reviewedAtDiff !== 0) {
    return reviewedAtDiff
  }

  if (a.id < b.id) {
    return -1
  }
  if (a.id > b.id) {
    return 1
  }
  return 0
}

const createNoMatchResult = (dataset: BuildDataset): NoMatchResult => ({
  type: 'no-match',
  reason:
    'No builds pass the selected filters. Goal only changes ranking weights and cannot increase matching build count. targetPatch is never relaxed.',
  patch: dataset.targetPatch,
  relaxableFilters: ['budget', 'mode', 'playStyle', 'class'],
})

export const recommendBuilds = (
  dataset: BuildDataset,
  preferences: UserPreferences,
): RecommendationResult => {
  validateBuildDataset(dataset)
  validateUserPreferences(dataset, preferences)

  const filteredBuilds = dataset.builds.filter((build) => {
    if (preferences.class !== 'any' && build.class !== preferences.class) {
      return false
    }
    if (!build.playStyles.includes(preferences.playStyle)) {
      return false
    }
    if (!build.modes.includes(preferences.mode)) {
      return false
    }

    return budgetOrder[build.minimumBudget] <= budgetOrder[preferences.budget]
  })

  if (filteredBuilds.length === 0) {
    return createNoMatchResult(dataset)
  }

  const scoredBuilds: BuildWithScore[] = filteredBuilds.map((build) => ({
    ...build,
    finalScore: scoreBuild(build, preferences),
  }))

  scoredBuilds.sort(sortBuilds)

  const [primaryBuild, ...rest] = scoredBuilds
  const displayedAlternatives = rest.slice(0, 2).map((build) => ({
    ...build,
    finalScore: roundToUiScore(build.finalScore),
  }))
  const compatibleCount = scoredBuilds.length

  const roundedPrimaryScore = roundToUiScore(primaryBuild.finalScore)
  const decisionReason = getDecisionReason(primaryBuild, rest[0], preferences, compatibleCount)

  return {
    type: 'match',
    primaryBuild: {
      ...primaryBuild,
      finalScore: roundedPrimaryScore,
    },
    score: roundedPrimaryScore,
    reason: decisionReason,
    path: primaryBuild.path,
    alternatives: displayedAlternatives,
    patch: dataset.targetPatch,
    lastReviewedAt: primaryBuild.lastReviewedAt,
  }
}
