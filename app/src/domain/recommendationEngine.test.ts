import { describe, expect, it } from 'vitest'
import {
  Budget,
  Build,
  BuildDataset,
  Goal,
  MatchResult,
  NoMatchResult,
  Stage,
  UserPreferences,
  validateBuildDataset,
  recommendBuilds,
} from './recommendationEngine'

const buildPlan = {
  skills: ['placeholder'],
  passiveMilestones: ['placeholder'],
  gearMilestones: ['placeholder'],
  upgradePriorities: ['placeholder'],
}

const makePath = () => ({
  start: buildPlan,
  campaign: buildPlan,
  early_maps: buildPlan,
  endgame: buildPlan,
})

const createBuild = (id: string, overrides: Partial<Build> = {}): Build => ({
  id,
  name: `Build ${id}`,
  patch: '1.0.0',
  class: 'marauder',
  ascendancy: null,
  playStyles: ['melee'],
  modes: ['softcore'],
  minimumBudget: 'starter',
  scoresByStage: {
    start: 70,
    campaign: 70,
    early_maps: 70,
    endgame: 70,
  },
  bossingScore: 40,
  clearSpeedScore: 40,
  survivabilityScore: 40,
  easeOfUseScore: 40,
  dataConfidence: 60,
  lastReviewedAt: '2026-01-01T00:00:00Z',
  path: makePath(),
  sources: ['verified source'],
  ...overrides,
})

const makeDataset = (builds: Build[]): BuildDataset => ({
  targetPatch: '1.0.0',
  availableClasses: ['marauder', 'ranger', 'witch'],
  builds,
})

const makePreferences = (overrides: Partial<UserPreferences>): UserPreferences => ({
  class: 'any',
  stage: 'start',
  playStyle: 'melee',
  goal: 'balanced',
  mode: 'softcore',
  budget: 'high',
  ...overrides,
})

describe('validateBuildDataset', () => {
  it('accepts valid fixture dataset', () => {
    const dataset = makeDataset([createBuild('alpha')])
    expect(() => validateBuildDataset(dataset)).not.toThrow()
  })

  it('rejects empty availableClasses', () => {
    const dataset = makeDataset([createBuild('alpha')])
    dataset.availableClasses = []
    expect(() => validateBuildDataset(dataset)).toThrow(/Dataset availableClasses must be a non-empty array/)
  })

  it('rejects duplicate availableClasses', () => {
    const dataset = makeDataset([createBuild('alpha')])
    dataset.availableClasses = ['marauder', 'marauder']
    expect(() => validateBuildDataset(dataset)).toThrow(/duplicate found: marauder/)
  })

  it('rejects empty availableClasses members', () => {
    const dataset = makeDataset([createBuild('alpha')])
    dataset.availableClasses = ['marauder', '']
    expect(() => validateBuildDataset(dataset)).toThrow(/non-empty strings/)
  })

  it('rejects build class not in availableClasses', () => {
    const dataset = makeDataset([createBuild('alpha', { class: 'invalid-class' })])
    expect(() => validateBuildDataset(dataset)).toThrow(/Build class is not available for current dataset/)
  })

  it('rejects invalid playStyles', () => {
    const dataset = makeDataset([
      createBuild('alpha', { playStyles: ['invalid-style' as never] }),
    ])
    expect(() => validateBuildDataset(dataset)).toThrow(/Build playStyles must contain only valid values/)
  })

  it('rejects invalid modes', () => {
    const dataset = makeDataset([
      createBuild('alpha', { modes: ['invalid-mode' as never] }),
    ])
    expect(() => validateBuildDataset(dataset)).toThrow(/Build modes must contain only valid values/)
  })

  it('rejects invalid minimumBudget values', () => {
    const dataset = makeDataset([
      createBuild('alpha', { minimumBudget: 'ultra' as Budget }),
    ])
    expect(() => validateBuildDataset(dataset)).toThrow(/minimumBudget must be one of starter, low, medium, high/)
  })

  it('rejects NaN and Infinity scores', () => {
    const dataset = makeDataset([
      createBuild('alpha', {
        bossingScore: Number.NaN,
        scoresByStage: {
          start: Number.POSITIVE_INFINITY,
          campaign: 70,
          early_maps: 70,
          endgame: 70,
        },
      }),
    ])
    expect(() => validateBuildDataset(dataset)).toThrow(/between 0 and 100/)
  })

  it('rejects out-of-range scores', () => {
    const dataset = makeDataset([
      createBuild('alpha', {
        survivabilityScore: 120,
      }),
    ])
    expect(() => validateBuildDataset(dataset)).toThrow(/survivabilityScore must be a number between 0 and 100/)
  })

  it('rejects impossible ISO date', () => {
    const dataset = makeDataset([
      createBuild('alpha', { lastReviewedAt: '2026-02-30T00:00:00Z' }),
    ])
    expect(() => validateBuildDataset(dataset)).toThrow(/valid ISO 8601 date string/)
  })

  it('rejects invalid ISO date format', () => {
    const dataset = makeDataset([
      createBuild('alpha', { lastReviewedAt: 'not-a-date' }),
    ])
    expect(() => validateBuildDataset(dataset)).toThrow(/valid ISO 8601 date string/)
  })
})

describe('validateUserPreferences', () => {
  const dataset = makeDataset([createBuild('alpha')])

  it('accepts class=any and class from availableClasses', () => {
    expect(() =>
      recommendBuilds(dataset, makePreferences({ class: 'any' })),
    ).not.toThrow()
  })

  it('throws for class outside availableClasses', () => {
    expect(() =>
      recommendBuilds(dataset, makePreferences({ class: 'non-existent' })),
    ).toThrow(/must be \"any\" or one of available classes/)
  })

  it.each([
    ['stage', 'mid'],
    ['playStyle', 'teleport'],
    ['goal', 'meta'],
    ['mode', 'casual'],
    ['budget', 'luxury'],
  ] as const)(
    'throws for invalid UserPreferences %s value', (field, value) => {
      expect(() => {
        recommendBuilds(dataset, {
          ...makePreferences({}),
          ...(field === 'stage' ? { stage: value as Stage } : {}),
          ...(field === 'playStyle' ? { playStyle: value as any } : {}),
          ...(field === 'goal' ? { goal: value as Goal } : {}),
          ...(field === 'mode' ? { mode: value as any } : {}),
          ...(field === 'budget' ? { budget: value as any } : {}),
        })
      }).toThrow(/User preference/)
    },
  )
})

describe('recommendBuilds filter and sorting logic', () => {
  const filterDataset = makeDataset([
    createBuild('alpha', { class: 'marauder', playStyles: ['melee'], modes: ['softcore'], minimumBudget: 'starter' }),
    createBuild('bravo', { class: 'ranger', playStyles: ['spells'], modes: ['softcore'], minimumBudget: 'low' }),
    createBuild('charlie', { class: 'witch', playStyles: ['melee'], modes: ['hardcore'], minimumBudget: 'high' }),
    createBuild('delta', { class: 'marauder', playStyles: ['melee'], modes: ['softcore'], minimumBudget: 'low' }),
  ])

  it('filters by class and supports class=any for mixed classes', () => {
    const fixedOrderResult = recommendBuilds(
      filterDataset,
      makePreferences({ class: 'marauder', playStyle: 'melee', mode: 'softcore', budget: 'high' }),
    ) as MatchResult
    expect(fixedOrderResult.type).toBe('match')
    const fixedIds = [fixedOrderResult.primaryBuild.id, ...fixedOrderResult.alternatives.map((build) => build.id)]
    expect(fixedIds).toEqual(['alpha', 'delta'])

    const anyResult = recommendBuilds(
      filterDataset,
      makePreferences({ class: 'any', playStyle: 'melee', mode: 'softcore', budget: 'high' }),
    ) as MatchResult
    expect(anyResult.type).toBe('match')
    const anyIds = [anyResult.primaryBuild.id, ...anyResult.alternatives.map((build) => build.id)]
    expect(anyIds).toContain('alpha')
    expect(anyIds).toContain('delta')
  })

  it('filters by play style, mode, and budget order', () => {
    expect(
      (recommendBuilds(
        filterDataset,
        makePreferences({ class: 'any', playStyle: 'spells', mode: 'softcore', budget: 'high' }),
      ) as MatchResult).primaryBuild.id,
    ).toBe('bravo')

    expect(
      (recommendBuilds(
        filterDataset,
        makePreferences({ class: 'any', playStyle: 'melee', mode: 'hardcore', budget: 'high' }),
      ) as MatchResult).primaryBuild.id,
    ).toBe('charlie')
  })

  it('applies budget ladder correctly for all levels', () => {
    const budgetDataset = makeDataset([
      createBuild('starter', { minimumBudget: 'starter' }),
      createBuild('low', { minimumBudget: 'low', class: 'ranger' }),
      createBuild('medium', { minimumBudget: 'medium', class: 'witch' }),
      createBuild('high', { minimumBudget: 'high', class: 'marauder' }),
    ])

    const budgets: Budget[] = ['starter', 'low', 'medium', 'high']
    const expectedCounts: Record<Budget, string[]> = {
      starter: ['starter'],
      low: ['starter', 'low'],
      medium: ['starter', 'low', 'medium'],
      high: ['starter', 'low', 'medium', 'high'],
    }

    for (const budget of budgets) {
      const result = recommendBuilds(
        budgetDataset,
        makePreferences({ class: 'any', budget, playStyle: 'melee' }),
      ) as MatchResult
      expect(result.type).toBe('match')
      const actual = [result.primaryBuild.id, ...result.alternatives.map((build) => build.id)]
      expect(expectedCounts[budget].includes(result.primaryBuild.id)).toBeTruthy()
      expect(result.alternatives.length).toBeGreaterThanOrEqual(0)
      expect(actual.length).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('recommendBuilds scoring', () => {
  const base = createBuild('sample', {
    bossingScore: 70,
    clearSpeedScore: 80,
    survivabilityScore: 60,
    easeOfUseScore: 40,
    scoresByStage: {
      start: 50,
      campaign: 60,
      early_maps: 70,
      endgame: 80,
    },
  })

  const scoreTable: Array<[Goal, Stage, number]> = [
    ['balanced', 'start', 60.5],
    ['balanced', 'campaign', 63.5],
    ['balanced', 'early_maps', 66.5],
    ['balanced', 'endgame', 69.5],
    ['bossing', 'start', 63],
    ['bossing', 'campaign', 64.5],
    ['bossing', 'early_maps', 66],
    ['bossing', 'endgame', 67.5],
    ['clear_speed', 'start', 66.5],
    ['clear_speed', 'campaign', 68.5],
    ['clear_speed', 'early_maps', 70.5],
    ['clear_speed', 'endgame', 72.5],
    ['survivability', 'start', 60],
    ['survivability', 'campaign', 61.5],
    ['survivability', 'early_maps', 63],
    ['survivability', 'endgame', 64.5],
  ]

  it.each(scoreTable)('computes expected finalScore for %s at stage %s', (goal, stage, expected) => {
    const result = recommendBuilds(
      makeDataset([base]),
      makePreferences({ goal, stage, class: base.class }),
    ) as MatchResult

    expect(result.type).toBe('match')
    expect(result.score).toBe(expected)
    expect(result.primaryBuild.finalScore).toBe(expected)
  })

  it('keeps full precision ordering before rounding for UI', () => {
    const precisionDataset = makeDataset([
      createBuild('zeta', {
        scoresByStage: { start: 90, campaign: 90, early_maps: 90, endgame: 90 },
      }),
      createBuild('alpha', {
        scoresByStage: { start: 89.95, campaign: 89.95, early_maps: 89.95, endgame: 89.95 },
      }),
    ])

    const result = recommendBuilds(
      precisionDataset,
      makePreferences({ class: 'any' }),
    ) as MatchResult

    expect(result.primaryBuild.id).toBe('zeta')
    expect(result.primaryBuild.finalScore).toBe(27)
  })

  it('applies deterministic ranking with different dataset order', () => {
    const dataset = makeDataset([
      createBuild('beta', { id: 'beta' }),
      createBuild('alpha', { id: 'alpha' }),
      createBuild('charlie', { id: 'charlie' }),
    ])

    const resultA = recommendBuilds(dataset, makePreferences({ class: 'any', playStyle: 'melee' })) as MatchResult
    const resultB = recommendBuilds(
      makeDataset([dataset.builds[2], dataset.builds[0], dataset.builds[1]]),
      makePreferences({ class: 'any', playStyle: 'melee' }),
    ) as MatchResult

    expect(resultA.primaryBuild.id).toBe(resultB.primaryBuild.id)
    expect(resultA.score).toBe(resultB.score)
  })

  it('returns full informative reason for match', () => {
    const result = recommendBuilds(
      makeDataset([createBuild('omega', { name: 'Omega build' })]),
      makePreferences({
        class: 'marauder',
        stage: 'campaign',
        goal: 'survivability',
        playStyle: 'melee',
      }),
    )

    expect(result.type).toBe('match')
    expect(result.reason).toContain('Winner build: Omega build (omega)')
    expect(result.reason).toContain('goal=survivability')
    expect(result.reason).toContain('stage=campaign')
    expect(result.reason).toContain('finalScore=')
    expect(result.reason).toContain('compatibleBuilds=1')
  })

  it('returns no-match for zero compatible builds with clear guidance', () => {
    const result = recommendBuilds(
      makeDataset([createBuild('alpha')]),
      makePreferences({ class: 'witch', playStyle: 'ranged', mode: 'softcore', budget: 'starter' }),
    )

    expect(result.type).toBe('no-match')
    const noMatch = result as NoMatchResult
    expect(noMatch.relaxableFilters).toEqual(['budget', 'mode', 'playStyle', 'class'])
    expect(noMatch.reason).toContain('Goal only changes ranking weights')
  })
})

describe('recommendBuilds tie-breaks', () => {
  it('uses dataConfidence before budget and stage', () => {
    const dataset = makeDataset([
      createBuild('zulu', { dataConfidence: 100, scoresByStage: { start: 50, campaign: 50, early_maps: 50, endgame: 50 } }),
      createBuild('alpha', { dataConfidence: 10, scoresByStage: { start: 100, campaign: 100, early_maps: 100, endgame: 100 } }),
    ])

    const result = recommendBuilds(dataset, makePreferences({ class: 'any', playStyle: 'melee' })) as MatchResult
    expect(result.primaryBuild.id).toBe('zulu')
  })

  it('uses lower budget before id lexicographic order', () => {
    const dataset = makeDataset([
      createBuild('zulu', { minimumBudget: 'starter' }),
      createBuild('alpha', { minimumBudget: 'medium' }),
    ])

    const result = recommendBuilds(dataset, makePreferences({ class: 'any', playStyle: 'melee' })) as MatchResult
    expect(result.primaryBuild.id).toBe('zulu')
  })

  it('uses newer review date before id lexicographic order', () => {
    const dataset = makeDataset([
      createBuild('zulu', { dataConfidence: 90, lastReviewedAt: '2026-06-01T00:00:00Z' }),
      createBuild('alpha', { dataConfidence: 90, lastReviewedAt: '2025-01-01T00:00:00Z' }),
    ])

    const result = recommendBuilds(dataset, makePreferences({ class: 'any', playStyle: 'melee' })) as MatchResult
    expect(result.primaryBuild.id).toBe('zulu')
  })

  it('uses id tie-break as final deterministic fallback', () => {
    const dataset = makeDataset([
      createBuild('zulu', {
        dataConfidence: 90,
        minimumBudget: 'starter',
        lastReviewedAt: '2026-01-01T00:00:00Z',
        id: 'zulu',
      }),
      createBuild('alpha', {
        dataConfidence: 90,
        minimumBudget: 'starter',
        lastReviewedAt: '2026-01-01T00:00:00Z',
        id: 'alpha',
      }),
    ])

    const result = recommendBuilds(dataset, makePreferences({ class: 'any', playStyle: 'melee' })) as MatchResult
    expect(result.primaryBuild.id).toBe('alpha')
  })
})
