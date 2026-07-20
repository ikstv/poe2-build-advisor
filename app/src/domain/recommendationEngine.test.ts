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

  it('rejects non-object dataset builds', () => {
    const dataset = makeDataset(['not-object' as unknown as Build])
    expect(() => validateBuildDataset(dataset)).toThrow(/must be a non-null object/)
  })

  it('rejects empty availableClasses', () => {
    const dataset = makeDataset([createBuild('alpha')])
    dataset.availableClasses = []
    expect(() => validateBuildDataset(dataset)).toThrow(/must be a non-empty array/)
  })

  it('rejects duplicate availableClasses', () => {
    const dataset = makeDataset([createBuild('alpha')])
    dataset.availableClasses = ['marauder', 'marauder']
    expect(() => validateBuildDataset(dataset)).toThrow(/duplicate found: marauder/)
  })

  it('rejects empty availableClasses members', () => {
    const dataset = makeDataset([createBuild('alpha')])
    dataset.availableClasses = ['marauder', '']
    expect(() => validateBuildDataset(dataset)).toThrow(/must contain non-empty strings/)
  })

  it('rejects build class not in availableClasses', () => {
    const dataset = makeDataset([createBuild('alpha', { class: 'invalid-class' })])
    expect(() => validateBuildDataset(dataset)).toThrow(/is not available for current dataset/)
  })

  it('rejects build with invalid ascendancy', () => {
    const dataset = makeDataset([createBuild('alpha', { ascendancy: 123 as never })])
    expect(() => validateBuildDataset(dataset)).toThrow(/ascendancy must be a string or null/)
  })

  it('rejects invalid playStyles', () => {
    const dataset = makeDataset([createBuild('alpha', { playStyles: ['invalid-style' as never] })])
    expect(() => validateBuildDataset(dataset)).toThrow(/Build playStyles must contain only valid values/)
  })

  it('rejects empty playStyles', () => {
    const dataset = makeDataset([createBuild('alpha', { playStyles: [] })])
    expect(() => validateBuildDataset(dataset)).toThrow(/Build playStyles must be a non-empty array/)
  })

  it('rejects invalid modes', () => {
    const dataset = makeDataset([createBuild('alpha', { modes: ['invalid-mode' as never] })])
    expect(() => validateBuildDataset(dataset)).toThrow(/Build modes must contain only valid values/)
  })

  it('rejects empty modes', () => {
    const dataset = makeDataset([createBuild('alpha', { modes: [] })])
    expect(() => validateBuildDataset(dataset)).toThrow(/Build modes must be a non-empty array/)
  })

  it('rejects invalid minimumBudget values', () => {
    const dataset = makeDataset([createBuild('alpha', { minimumBudget: 'ultra' as Budget })])
    expect(() => validateBuildDataset(dataset)).toThrow(/minimumBudget must be one of starter, low, medium, high/)
  })

  it('rejects NaN scores', () => {
    const dataset = makeDataset([createBuild('alpha', { bossingScore: Number.NaN })])
    expect(() => validateBuildDataset(dataset)).toThrow(/must be a number between 0 and 100/)
  })

  it('rejects Infinity scores', () => {
    const dataset = makeDataset([createBuild('alpha', {
      scoresByStage: {
        start: Number.POSITIVE_INFINITY,
        campaign: 70,
        early_maps: 70,
        endgame: 70,
      },
    })])
    expect(() => validateBuildDataset(dataset)).toThrow(/scoresByStage.start must be a number between 0 and 100/)
  })

  it('rejects out-of-range scores', () => {
    const dataset = makeDataset([createBuild('alpha', { survivabilityScore: 120 })])
    expect(() => validateBuildDataset(dataset)).toThrow(/survivabilityScore must be a number between 0 and 100/)
  })

  it('accepts valid date-only ISO value', () => {
    const dataset = makeDataset([createBuild('alpha', { lastReviewedAt: '2026-01-01' })])
    expect(() => validateBuildDataset(dataset)).not.toThrow()
  })

  it('rejects impossible date-only ISO value', () => {
    const dataset = makeDataset([createBuild('alpha', { lastReviewedAt: '2026-02-30' })])
    expect(() => validateBuildDataset(dataset)).toThrow(/valid ISO 8601 date string/)
  })

  it('rejects impossible ISO date-time', () => {
    const dataset = makeDataset([createBuild('alpha', { lastReviewedAt: '2026-02-30T00:00:00Z' })])
    expect(() => validateBuildDataset(dataset)).toThrow(/valid ISO 8601 date string/)
  })

  it('rejects invalid ISO date format', () => {
    const dataset = makeDataset([createBuild('alpha', { lastReviewedAt: 'not-a-date' })])
    expect(() => validateBuildDataset(dataset)).toThrow(/valid ISO 8601 date string/)
  })

  it('rejects build patch mismatch', () => {
    const dataset: BuildDataset = {
      ...makeDataset([createBuild('alpha')]),
      builds: [createBuild('alpha', { patch: '0.0.0' })],
    }
    expect(() => validateBuildDataset(dataset)).toThrow(/Build patch mismatch/)
  })

  it('rejects duplicate build IDs', () => {
    const dataset = makeDataset([
      createBuild('dupe'),
      createBuild('dupe'),
    ])
    expect(() => validateBuildDataset(dataset)).toThrow(/Duplicate build id detected/)
  })

  it('rejects missing path stage', () => {
    const dataset = makeDataset([createBuild('alpha', {
      path: {
        start: buildPlan,
        campaign: buildPlan,
        endgame: buildPlan,
      } as never,
    })])

    expect(() => validateBuildDataset(dataset)).toThrow(/path must include stage early_maps/)
  })
})

describe('validateUserPreferences', () => {
  const dataset = makeDataset([createBuild('alpha')])

  it('accepts class=any and class from availableClasses', () => {
    expect(() => recommendBuilds(dataset, makePreferences({ class: 'any' }))).not.toThrow()
  })

  it('throws for class outside availableClasses', () => {
    expect(() => recommendBuilds(dataset, makePreferences({ class: 'non-existent' }))).toThrow(
      /must be \"any\" or one of available classes/,
    )
  })

  it.each([
    ['stage', 'mid'],
    ['playStyle', 'teleport'],
    ['goal', 'meta'],
    ['mode', 'casual'],
    ['budget', 'luxury'],
  ] as const)('throws for invalid UserPreferences %s value', (field, value) => {
    expect(() => {
      recommendBuilds(dataset, {
        ...makePreferences({}),
        ...(field === 'stage' ? { stage: value as Stage } : {}),
        ...(field === 'playStyle' ? { playStyle: value as never } : {}),
        ...(field === 'goal' ? { goal: value as Goal } : {}),
        ...(field === 'mode' ? { mode: value as never } : {}),
        ...(field === 'budget' ? { budget: value as never } : {}),
      })
    }).toThrow(/User preference/)
  })
})

describe('recommendBuilds filter and sorting logic', () => {
  it('supports class=any with multiple compatible classes', () => {
    const dataset = makeDataset([
      createBuild('alpha', { class: 'marauder' }),
      createBuild('beta', { id: 'beta', class: 'ranger' }),
      createBuild('gamma', { class: 'witch', playStyles: ['spells'] }),
    ])

    const result = recommendBuilds(dataset, makePreferences({
      class: 'any',
      playStyle: 'melee',
      mode: 'softcore',
      budget: 'high',
    })) as MatchResult

    expect(result.type).toBe('match')
    const ids = [result.primaryBuild.id, ...result.alternatives.map((build) => build.id)]
    expect(ids).toEqual(['alpha', 'beta'])
    expect(result.alternatives.length).toBe(1)
  })

  it('applies budget ladder correctly for all levels', () => {
    const budgetDataset = makeDataset([
      createBuild('starter', { minimumBudget: 'starter', class: 'marauder', id: 'starter' }),
      createBuild('low', { minimumBudget: 'low', class: 'marauder', id: 'low' }),
      createBuild('medium', { minimumBudget: 'medium', class: 'marauder', id: 'medium' }),
      createBuild('high', { minimumBudget: 'high', class: 'marauder', id: 'high' }),
    ])

    const starterResult = recommendBuilds(
      budgetDataset,
      makePreferences({ class: 'marauder', budget: 'starter', playStyle: 'melee' }),
    ) as MatchResult
    expect(starterResult.alternatives.length).toBe(0)
    expect([starterResult.primaryBuild.id, ...starterResult.alternatives.map((build) => build.id)]).toEqual(['starter'])

    const lowResult = recommendBuilds(
      budgetDataset,
      makePreferences({ class: 'marauder', budget: 'low', playStyle: 'melee' }),
    ) as MatchResult
    expect(lowResult.alternatives.length).toBe(1)
    expect([lowResult.primaryBuild.id, ...lowResult.alternatives.map((build) => build.id)]).toEqual(['starter', 'low'])

    const mediumResult = recommendBuilds(
      budgetDataset,
      makePreferences({ class: 'marauder', budget: 'medium', playStyle: 'melee' }),
    ) as MatchResult
    expect(mediumResult.alternatives.length).toBe(2)
    expect([mediumResult.primaryBuild.id, ...mediumResult.alternatives.map((build) => build.id)]).toEqual(['starter', 'low', 'medium'])

    const highResult = recommendBuilds(
      budgetDataset,
      makePreferences({ class: 'marauder', budget: 'high', playStyle: 'melee' }),
    ) as MatchResult
    expect(highResult.alternatives.length).toBe(2)
    expect([highResult.primaryBuild.id, ...highResult.alternatives.map((build) => build.id)]).toEqual(['starter', 'low', 'medium'])
  })

  it('returns no-match for high-budget build when budget is medium and match when budget is high', () => {
    const highOnlyDataset = makeDataset([
      createBuild('high-only', { minimumBudget: 'high', class: 'marauder', id: 'high-only' }),
    ])

    const mediumResult = recommendBuilds(
      highOnlyDataset,
      makePreferences({ class: 'marauder', budget: 'medium', playStyle: 'melee' }),
    )
    expect(mediumResult.type).toBe('no-match')

    const highResult = recommendBuilds(
      highOnlyDataset,
      makePreferences({ class: 'marauder', budget: 'high', playStyle: 'melee' }),
    ) as MatchResult
    expect(highResult.type).toBe('match')
    expect(highResult.primaryBuild.id).toBe('high-only')
  })

  it('returns 0 results as no-match', () => {
    const result = recommendBuilds(
      makeDataset([createBuild('alpha')]),
      makePreferences({ class: 'witch', playStyle: 'spells' }),
    )

    expect(result.type).toBe('no-match')
    expect((result as NoMatchResult).relaxableFilters).toEqual(['budget', 'mode', 'playStyle', 'class'])
  })

  it('returns 1 result with 0 alternatives', () => {
    const result = recommendBuilds(
      makeDataset([createBuild('alpha')]),
      makePreferences({ class: 'marauder' }),
    ) as MatchResult

    expect(result.type).toBe('match')
    expect(result.alternatives.length).toBe(0)
    expect([result.primaryBuild.id, ...result.alternatives.map((build) => build.id)]).toEqual(['alpha'])
  })

  it('returns 2 results with 1 alternative', () => {
    const result = recommendBuilds(
      makeDataset([createBuild('alpha'), createBuild('beta')]),
      makePreferences({ class: 'marauder' }),
    ) as MatchResult

    expect(result.type).toBe('match')
    expect(result.alternatives.length).toBe(1)
    const ordered = [result.primaryBuild.id, ...result.alternatives.map((build) => build.id)]
    expect(ordered).toEqual(['alpha', 'beta'])
  })

  it('returns 3+ results with max 2 alternatives', () => {
    const result = recommendBuilds(
      makeDataset([createBuild('alpha'), createBuild('beta'), createBuild('charlie'), createBuild('delta')]),
      makePreferences({ class: 'marauder' }),
    ) as MatchResult

    expect(result.alternatives.length).toBe(2)
    expect([result.primaryBuild.id, ...result.alternatives.map((build) => build.id)]).toHaveLength(3)
  })

  it('provides deterministic full order across build array permutations', () => {
    const base = [
      createBuild('alpha', { minimumBudget: 'medium' }),
      createBuild('beta', { minimumBudget: 'starter' }),
      createBuild('charlie', { minimumBudget: 'high' }),
      createBuild('delta', { minimumBudget: 'low' }),
    ]

    const expectedOrder = ['beta', 'delta', 'alpha']

    const permutations = [
      [0, 1, 2, 3],
      [3, 2, 1, 0],
      [1, 3, 0, 2],
      [2, 0, 3, 1],
    ].map((indices) => indices.map((index) => base[index]))

    for (const currentBuilds of permutations) {
      const result = recommendBuilds(makeDataset([...currentBuilds]), makePreferences({ class: 'marauder' })) as MatchResult
      const ordered = [result.primaryBuild.id, ...result.alternatives.map((build) => build.id)]
      expect(ordered).toEqual(expectedOrder)
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
      createBuild('zeta', { scoresByStage: { start: 90, campaign: 90, early_maps: 90, endgame: 90 } }),
      createBuild('alpha', { scoresByStage: { start: 89.95, campaign: 89.95, early_maps: 89.95, endgame: 89.95 } }),
    ])

    const result = recommendBuilds(precisionDataset, makePreferences({ class: 'any' })) as MatchResult

    expect(result.primaryBuild.id).toBe('zeta')
    expect(result.primaryBuild.finalScore).toBe(55)
    expect(result.score).toBe(55)
    expect(result.alternatives).toHaveLength(1)
    expect(result.alternatives[0]!.id).toBe('alpha')
    expect(result.alternatives[0]!.finalScore).toBe(55)
    expect(result.reason).toContain('higher unrounded finalScore')
    expect(result.reason).toContain('55 > 54.985')
    expect(result.reason).toContain('both display as 55.0')
    expect(result.reason).not.toContain('55 > 55')
    expect(result.reason).not.toContain('stable id tie-break')
    expect(result.reason).toContain('goal=balanced')
    expect(result.reason).toContain('stage=start')
    expect(result.reason).toContain('score=55.0')
    expect(result.reason).toContain('compatibleBuilds=2')
  })

})

describe('recommendBuilds tie-breaks', () => {
  it('returns reason for only compatible build', () => {
    const result = recommendBuilds(
      makeDataset([createBuild('alpha')]),
      makePreferences({ class: 'marauder' }),
    ) as MatchResult

    expect(result.reason).toContain('only compatible build')
    expect(result.reason).toContain('goal=balanced')
    expect(result.reason).toContain('stage=start')
  })

  it('returns reason for higher finalScore', () => {
    const dataset = makeDataset([
      createBuild('zeta', { scoresByStage: { start: 91, campaign: 90, early_maps: 90, endgame: 90 } }),
      createBuild('alpha', { scoresByStage: { start: 90, campaign: 89, early_maps: 89, endgame: 89 } }),
    ])

    const result = recommendBuilds(dataset, makePreferences({ class: 'any' })) as MatchResult

    expect(result.reason).toContain('higher finalScore')
    expect(result.reason).toContain('goal=balanced')
    expect(result.reason).toContain('compatibleBuilds=2')
  })

  it('returns reason for higher dataConfidence', () => {
    const dataset = makeDataset([
      createBuild('alpha', {
        dataConfidence: 90,
      }),
      createBuild('beta', {
        id: 'beta',
        dataConfidence: 10,
      }),
    ])

    const result = recommendBuilds(dataset, makePreferences({ class: 'any' })) as MatchResult

    expect(result.reason).toContain('higher dataConfidence')
  })

  it('returns reason for lower minimumBudget', () => {
    const dataset = makeDataset([
      createBuild('alpha', {
        dataConfidence: 50,
        minimumBudget: 'high',
        lastReviewedAt: '2026-01-01',
      }),
      createBuild('zeta', {
        id: 'zeta',
        dataConfidence: 50,
        minimumBudget: 'starter',
        lastReviewedAt: '2026-01-01',
      }),
    ])

    const result = recommendBuilds(dataset, makePreferences({ class: 'any' })) as MatchResult

    expect(result.primaryBuild.id).toBe('zeta')
    expect(result.reason).toContain('lower minimumBudget')
  })

  it('returns reason for newer lastReviewedAt', () => {
    const dataset = makeDataset([
      createBuild('alpha', {
        dataConfidence: 50,
        lastReviewedAt: '2025-01-01',
      }),
      createBuild('zulu', {
        id: 'zulu',
        dataConfidence: 50,
        lastReviewedAt: '2026-01-01',
      }),
    ])

    const result = recommendBuilds(dataset, makePreferences({ class: 'any' })) as MatchResult

    expect(result.primaryBuild.id).toBe('zulu')
    expect(result.reason).toContain('newer lastReviewedAt')
  })

  it('returns reason for stable id tie-break', () => {
    const dataset = makeDataset([
      createBuild('zulu', {
        dataConfidence: 50,
        lastReviewedAt: '2026-01-01',
      }),
      createBuild('alpha', {
        dataConfidence: 50,
        lastReviewedAt: '2026-01-01',
        id: 'alpha',
      }),
    ])

    const result = recommendBuilds(dataset, makePreferences({ class: 'any' })) as MatchResult

    expect(result.primaryBuild.id).toBe('alpha')
    expect(result.reason).toContain('stable id tie-break')
  })

  it('uses dataConfidence before lower budget/newer date/id', () => {
    const dataset = makeDataset([
      createBuild('alpha', {
        id: 'alpha',
        scoresByStage: { start: 70, campaign: 70, early_maps: 70, endgame: 70 },
        dataConfidence: 90,
        minimumBudget: 'high',
        lastReviewedAt: '2026-01-01',
      }),
      createBuild('zulu', {
        id: 'zulu',
        scoresByStage: { start: 70, campaign: 70, early_maps: 70, endgame: 70 },
        dataConfidence: 10,
        minimumBudget: 'starter',
        lastReviewedAt: '2026-12-31',
      }),
    ])

    const result = recommendBuilds(dataset, makePreferences({ class: 'any', playStyle: 'melee' })) as MatchResult
    expect(result.primaryBuild.id).toBe('alpha')
  })

  it('uses lower budget before newer date and id when dataConfidence is equal', () => {
    const dataset = makeDataset([
      createBuild('alpha', {
        minimumBudget: 'high',
        scoresByStage: { start: 70, campaign: 70, early_maps: 70, endgame: 70 },
        dataConfidence: 50,
        lastReviewedAt: '2026-01-01',
      }),
      createBuild('zulu', {
        id: 'zulu',
        minimumBudget: 'starter',
        scoresByStage: { start: 70, campaign: 70, early_maps: 70, endgame: 70 },
        dataConfidence: 50,
        lastReviewedAt: '2025-01-01',
      }),
    ])

    const result = recommendBuilds(dataset, makePreferences({ class: 'any', playStyle: 'melee' })) as MatchResult
    expect(result.primaryBuild.id).toBe('zulu')
  })

  it('uses newer review date before id when score/confidence/budget are equal', () => {
    const dataset = makeDataset([
      createBuild('alpha', {
        scoresByStage: { start: 70, campaign: 70, early_maps: 70, endgame: 70 },
        dataConfidence: 50,
        minimumBudget: 'starter',
        lastReviewedAt: '2025-01-01',
        id: 'alpha',
      }),
      createBuild('bravo', {
        scoresByStage: { start: 70, campaign: 70, early_maps: 70, endgame: 70 },
        dataConfidence: 50,
        minimumBudget: 'starter',
        lastReviewedAt: '2026-01-01',
        id: 'bravo',
      }),
    ])

    const result = recommendBuilds(dataset, makePreferences({ class: 'any', playStyle: 'melee' })) as MatchResult
    expect(result.primaryBuild.id).toBe('bravo')
  })

  it('uses stable id as final deterministic tie-break', () => {
    const dataset = makeDataset([
      createBuild('zulu', {
        scoresByStage: { start: 70, campaign: 70, early_maps: 70, endgame: 70 },
        dataConfidence: 50,
        minimumBudget: 'starter',
        lastReviewedAt: '2026-01-01',
        id: 'zulu',
      }),
      createBuild('alpha', {
        scoresByStage: { start: 70, campaign: 70, early_maps: 70, endgame: 70 },
        dataConfidence: 50,
        minimumBudget: 'starter',
        lastReviewedAt: '2026-01-01',
        id: 'alpha',
      }),
    ])

    const result = recommendBuilds(dataset, makePreferences({ class: 'any', playStyle: 'melee' })) as MatchResult
    expect(result.primaryBuild.id).toBe('alpha')
  })
})
