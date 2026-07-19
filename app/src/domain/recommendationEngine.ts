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
  playStyles: string[]
  modes: string[]
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

type WeightPlan = {
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

const requiredPathStages: Array<keyof Build['path']> = [
  'start',
  'campaign',
  'early_maps',
  'endgame',
]

const isSupportedScore = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0 && value <= 100 && Number.isFinite(value)

const ensureArrayOfStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')

export const validateBuildDataset = (dataset: BuildDataset): void => {
  if (typeof dataset.targetPatch !== 'string' || dataset.targetPatch.trim() === '') {
    throw new Error('Dataset targetPatch must be a non-empty string')
  }

  if (!Array.isArray(dataset.availableClasses) || dataset.availableClasses.length === 0) {
    throw new Error('Dataset availableClasses must be a non-empty array')
  }

  if (!Array.isArray(dataset.builds)) {
    throw new Error('Dataset builds must be an array')
  }

  const ids = new Set<string>()

  for (const build of dataset.builds) {
    if (typeof build.id !== 'string' || build.id.trim() === '') {
      throw new Error('Each build must have a non-empty string id')
    }
    if (ids.has(build.id)) {
      throw new Error(`Duplicate build id detected: ${build.id}`)
    }
    ids.add(build.id)

    if (build.patch !== dataset.targetPatch) {
      throw new Error(`Build patch mismatch: ${build.id}`)
    }

    if (!dataset.availableClasses.includes(build.class)) {
      throw new Error(`Build class is not available for current dataset: ${build.id}`)
    }

    if (!ensureArrayOfStrings(build.sources)) {
      throw new Error(`Build sources must be an array of strings: ${build.id}`)
    }

    if (!ensureArrayOfStrings(build.playStyles)) {
      throw new Error(`Build playStyles must be an array of strings: ${build.id}`)
    }

    if (!ensureArrayOfStrings(build.modes)) {
      throw new Error(`Build modes must be an array of strings: ${build.id}`)
    }

    if (!(build.minimumBudget in budgetOrder)) {
      throw new Error(`Build minimumBudget must be one of allowed values: ${build.id}`)
    }

    const reviewedAt = new Date(build.lastReviewedAt).getTime()
    if (Number.isNaN(reviewedAt)) {
      throw new Error(`Build lastReviewedAt must be valid ISO date string: ${build.id}`)
    }

    const path = build.path
    for (const stage of requiredPathStages) {
      const plan = path?.[stage]
      if (!plan) {
        throw new Error(`Build path must include stage ${stage}: ${build.id}`)
      }
      if (!ensureArrayOfStrings(plan.skills)) {
        throw new Error(`Build path ${stage}.skills must be array of strings: ${build.id}`)
      }
      if (!ensureArrayOfStrings(plan.passiveMilestones)) {
        throw new Error(
          `Build path ${stage}.passiveMilestones must be array of strings: ${build.id}`,
        )
      }
      if (!ensureArrayOfStrings(plan.gearMilestones)) {
        throw new Error(
          `Build path ${stage}.gearMilestones must be array of strings: ${build.id}`,
        )
      }
      if (!ensureArrayOfStrings(plan.upgradePriorities)) {
        throw new Error(
          `Build path ${stage}.upgradePriorities must be array of strings: ${build.id}`,
        )
      }
    }

    const scores = build.scoresByStage
    for (const stage of requiredPathStages) {
      if (!isSupportedScore(scores?.[stage])) {
        throw new Error(`scoresByStage.${stage} must be between 0 and 100: ${build.id}`)
      }
    }

    if (!isSupportedScore(build.bossingScore)) {
      throw new Error(`bossingScore must be between 0 and 100: ${build.id}`)
    }
    if (!isSupportedScore(build.clearSpeedScore)) {
      throw new Error(`clearSpeedScore must be between 0 and 100: ${build.id}`)
    }
    if (!isSupportedScore(build.survivabilityScore)) {
      throw new Error(`survivabilityScore must be between 0 and 100: ${build.id}`)
    }
    if (!isSupportedScore(build.easeOfUseScore)) {
      throw new Error(`easeOfUseScore must be between 0 and 100: ${build.id}`)
    }
    if (!isSupportedScore(build.dataConfidence)) {
      throw new Error(`dataConfidence must be between 0 and 100: ${build.id}`)
    }
  }

  for (const [goal, weights] of Object.entries(goalWeights)) {
    const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0)
    if (totalWeight !== expectedGoalWeightSum) {
      throw new Error(`Goal weights for ${goal} must sum to ${expectedGoalWeightSum}`)
    }
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

  const budgetGap = budgetOrder[a.minimumBudget] - budgetOrder[b.minimumBudget]
  if (budgetGap !== 0) {
    return budgetGap
  }

  const reviewedAtDiff = new Date(b.lastReviewedAt).getTime() - new Date(a.lastReviewedAt).getTime()
  if (reviewedAtDiff !== 0) {
    return reviewedAtDiff
  }

  return a.id.localeCompare(b.id)
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

  return {
    type: 'match',
    primaryBuild: {
      ...primaryBuild,
      finalScore: roundToUiScore(primaryBuild.finalScore),
    },
    score: roundToUiScore(primaryBuild.finalScore),
    reason: 'Matched builds are ranked by goal-specific weighted score and tie-break rules.',
    path: primaryBuild.path,
    alternatives: displayedAlternatives,
    patch: dataset.targetPatch,
    lastReviewedAt: primaryBuild.lastReviewedAt,
  }
}
