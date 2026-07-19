import { describe, expect, it } from 'vitest'
import {
  Build,
  BuildDataset,
  MatchResult,
  NoMatchResult,
  UserPreferences,
  validateBuildDataset,
  recommendBuilds,
  Budget,
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

  it('rejects build patch mismatch', () => {
    const dataset = makeDataset([createBuild('alpha', { patch: '0.9.0' })])
    expect(() => validateBuildDataset(dataset)).toThrow(/Build patch mismatch/)
  })

  it('rejects duplicate build ids', () => {
    const dataset = makeDataset([createBuild('dup'), createBuild('dup')])
    expect(() => validateBuildDataset(dataset)).toThrow(/Duplicate build id/)
  })

  it('rejects missing stage keys in path', () => {
    const dataset = makeDataset([
      createBuild('alpha', {
        path: {
          start: buildPlan,
          campaign: buildPlan,
          early_maps: buildPlan,
          endgame: undefined as never,
        },
      }),
    ])
    expect(() => validateBuildDataset(dataset)).toThrow(/Build path must include stage endgame/)
  })

  it('rejects score range violations', () => {
    const dataset = makeDataset([createBuild('alpha', { scoresByStage: { start: 101, campaign: 0, early_maps: 0, endgame: 0 } })])
    expect(() => validateBuildDataset(dataset)).toThrow(/scoresByStage.start/)
  })

  it('rejects invalid review date', () => {
    const dataset = makeDataset([createBuild('alpha', { lastReviewedAt: 'not-a-date' })])
    expect(() => validateBuildDataset(dataset)).toThrow(/ISO date/)
  })
})

describe('recommendBuilds filter logic', () => {
  const filterDataset = makeDataset([
    createBuild('alpha', { class: 'marauder', playStyles: ['melee'], modes: ['softcore'], minimumBudget: 'starter' }),
    createBuild('bravo', { class: 'ranger', playStyles: ['spells'], modes: ['softcore'], minimumBudget: 'low' }),
    createBuild('charlie', { class: 'witch', playStyles: ['melee'], modes: ['hardcore'], minimumBudget: 'high' }),
    createBuild('delta', { class: 'marauder', playStyles: ['melee'], modes: ['softcore'], minimumBudget: 'low' }),
  ])

  it('filters by class', () => {
    const result = recommendBuilds(
      filterDataset,
      makePreferences({ class: 'marauder', playStyle: 'melee', mode: 'softcore', budget: 'high' }),
    ) as MatchResult
    const ids = [result.primaryBuild.id, ...result.alternatives.map((build) => build.id)]
    expect(result.type).toBe('match')
    expect(ids).toEqual(['alpha', 'delta'])
  })

  it('supports class=any', () => {
    const result = recommendBuilds(
      filterDataset,
      makePreferences({ class: 'any', playStyle: 'melee', mode: 'softcore', budget: 'high' }),
    ) as MatchResult
    const ids = [result.primaryBuild.id, ...result.alternatives.map((build) => build.id)]
    expect(result.type).toBe('match')
    expect(ids).toEqual(['alpha', 'delta'])
  })

  it('filters by play style', () => {
    const result = recommendBuilds(
      filterDataset,
      makePreferences({ class: 'any', playStyle: 'spells', mode: 'softcore', budget: 'high' }),
    ) as MatchResult
    expect(result.type).toBe('match')
    expect(result.primaryBuild.id).toBe('bravo')
    expect(result.alternatives).toHaveLength(0)
  })

  it('filters by mode', () => {
    const result = recommendBuilds(
      filterDataset,
      makePreferences({ class: 'any', playStyle: 'melee', mode: 'hardcore', budget: 'high' }),
    ) as MatchResult
    expect(result.type).toBe('match')
    expect(result.primaryBuild.id).toBe('charlie')
  })

  it('filters by budget order', () => {
    const budgets: Budget[] = ['starter', 'low', 'medium', 'high']
    const expectedCounts: Record<Budget, number> = {
      starter: 1,
      low: 2,
      medium: 2,
      high: 2,
    }
    for (const budget of budgets) {
      const result = recommendBuilds(
        filterDataset,
        makePreferences({ budget, class: 'any', playStyle: 'melee', mode: 'softcore' }),
      ) as MatchResult
      const total = expectedCounts[budget]
      expect(result.type).toBe('match')
      expect(total >= 1).toBe(true)
      expect(result.alternatives).toHaveLength(Math.max(0, Math.min(2, total - 1)))
    }
  })
})

describe('recommendBuilds scoring and ranking', () => {
  const goalDataset = makeDataset([
    createBuild('balanced', {
      bossingScore: 0,
      clearSpeedScore: 0,
      survivabilityScore: 0,
      easeOfUseScore: 0,
      scoresByStage: {
        start: 100,
        campaign: 100,
        early_maps: 100,
        endgame: 100,
      },
    }),
    createBuild('bossing', {
      bossingScore: 100,
      clearSpeedScore: 0,
      survivabilityScore: 0,
      easeOfUseScore: 0,
      scoresByStage: {
        start: 0,
        campaign: 0,
        early_maps: 0,
        endgame: 0,
      },
    }),
    createBuild('clear', {
      bossingScore: 0,
      clearSpeedScore: 100,
      survivabilityScore: 0,
      easeOfUseScore: 0,
      scoresByStage: {
        start: 0,
        campaign: 0,
        early_maps: 0,
        endgame: 0,
      },
    }),
    createBuild('survive', {
      bossingScore: 0,
      clearSpeedScore: 0,
      survivabilityScore: 100,
      easeOfUseScore: 0,
      scoresByStage: {
        start: 0,
        campaign: 0,
        early_maps: 0,
        endgame: 0,
      },
    }),
  ])

  const basePreferences = makePreferences({ class: 'any', playStyle: 'melee', mode: 'softcore', budget: 'high' })

  it.each([
    ['balanced', 'balanced'],
    ['bossing', 'bossing'],
    ['clear_speed', 'clear'],
    ['survivability', 'survive'],
  ] as const)('ranks goal %s to expected top build', (goal, expectedTop) => {
    const result = recommendBuilds(
      goalDataset,
      { ...basePreferences, goal },
    ) as MatchResult
    expect(result.type).toBe('match')
    expect(result.primaryBuild.id).toBe(expectedTop)
  })

  it('uses full precision for ordering and one-decimal output for UI', () => {
    const precisionDataset = makeDataset([
      createBuild('zeta', {
        bossingScore: 0,
        clearSpeedScore: 0,
        survivabilityScore: 0,
        easeOfUseScore: 0,
        scoresByStage: { start: 90, campaign: 90, early_maps: 90, endgame: 90 },
      }),
      createBuild('alpha', {
        bossingScore: 0,
        clearSpeedScore: 0,
        survivabilityScore: 0,
        easeOfUseScore: 0,
        scoresByStage: { start: 89.9, campaign: 89.9, early_maps: 89.9, endgame: 89.9 },
      }),
    ])
    const result = recommendBuilds(
      precisionDataset,
      makePreferences({ goal: 'balanced' }),
    ) as MatchResult

    expect(result.primaryBuild.id).toBe('zeta')
    expect(result.score).toBe(27)
    expect(result.score).toBe(Math.round(result.score * 10) / 10)
  })

  it('applies dataConfidence first in tie-break', () => {
    const tieDataset = makeDataset([
      createBuild('low-confidence', {
        dataConfidence: 10,
      }),
      createBuild('high-confidence', {
        dataConfidence: 100,
      }),
    ])
    const result = recommendBuilds(
      tieDataset,
      makePreferences({ class: 'any', playStyle: 'melee' }),
    ) as MatchResult
    expect(result.primaryBuild.id).toBe('high-confidence')
  })

  it('then applies lower budget in tie-break', () => {
    const tieDataset = makeDataset([
      createBuild('starter', {
        minimumBudget: 'starter',
        dataConfidence: 100,
      }),
      createBuild('medium', {
        minimumBudget: 'medium',
        dataConfidence: 100,
      }),
    ])
    const result = recommendBuilds(
      tieDataset,
      makePreferences({ class: 'any', playStyle: 'melee' }),
    ) as MatchResult
    expect(result.primaryBuild.id).toBe('starter')
  })

  it('then applies newer lastReviewedAt in tie-break', () => {
    const tieDataset = makeDataset([
      createBuild('older', {
        dataConfidence: 100,
        lastReviewedAt: '2026-01-01T00:00:00Z',
      }),
      createBuild('newer', {
        dataConfidence: 100,
        lastReviewedAt: '2026-06-01T00:00:00Z',
      }),
    ])
    const result = recommendBuilds(
      tieDataset,
      makePreferences({ class: 'any', playStyle: 'melee' }),
    ) as MatchResult
    expect(result.primaryBuild.id).toBe('newer')
  })

  it('finally applies id in tie-break', () => {
    const tieDataset = makeDataset([
      createBuild('zulu', {
        dataConfidence: 100,
        lastReviewedAt: '2026-06-01T00:00:00Z',
        minimumBudget: 'starter',
      }),
      createBuild('alpha', {
        dataConfidence: 100,
        lastReviewedAt: '2026-06-01T00:00:00Z',
        minimumBudget: 'starter',
      }),
    ])
    const result = recommendBuilds(
      tieDataset,
      makePreferences({ class: 'any', playStyle: 'melee' }),
    ) as MatchResult
    expect(result.primaryBuild.id).toBe('alpha')
  })
})

describe('recommendBuilds cardinality and determinism', () => {
  it('returns proper no-match state', () => {
    const result = recommendBuilds(
      makeDataset([createBuild('alpha')]),
      makePreferences({ class: 'witch', playStyle: 'ranged', mode: 'softcore', budget: 'starter' }),
    )
    expect(result.type).toBe('no-match')
    const noMatch = result as NoMatchResult
    expect(noMatch.relaxableFilters).toEqual(['budget', 'mode', 'playStyle', 'class'])
    expect(noMatch.reason).toContain('targetPatch')
  })

  it('returns existing builds for one and two results', () => {
    const oneTwoDataset = makeDataset([
      createBuild('only', { playStyles: ['spells'] }),
      createBuild('first', { playStyles: ['ranged'], minimumBudget: 'low' }),
      createBuild('second', { playStyles: ['ranged'], minimumBudget: 'high' }),
    ])

    const oneMatch = recommendBuilds(
      oneTwoDataset,
      makePreferences({ playStyle: 'spells', budget: 'starter' }),
    ) as MatchResult
    expect(oneMatch.alternatives).toHaveLength(0)

    const twoMatch = recommendBuilds(
      oneTwoDataset,
      makePreferences({ playStyle: 'ranged', budget: 'high' }),
    ) as MatchResult
    expect(twoMatch.alternatives).toHaveLength(1)
  })

  it('returns exactly two alternatives for three-plus', () => {
    const manyDataset = makeDataset([
      createBuild('one', { playStyles: ['melee'] }),
      createBuild('two', { playStyles: ['melee'] }),
      createBuild('three', { playStyles: ['melee'] }),
      createBuild('four', { playStyles: ['melee'] }),
    ])
    const result = recommendBuilds(
      manyDataset,
      makePreferences({ playStyle: 'melee', budget: 'high' }),
    ) as MatchResult
    expect(result.alternatives).toHaveLength(2)
  })

  it('is deterministic between runs', () => {
    const dataset = makeDataset([createBuild('alpha'), createBuild('bravo', { minimumBudget: 'low' })])
    const first = recommendBuilds(dataset, makePreferences({ playStyle: 'melee', budget: 'high' }))
    const second = recommendBuilds(dataset, makePreferences({ playStyle: 'melee', budget: 'high' }))
    expect(first).toEqual(second)
  })
})
