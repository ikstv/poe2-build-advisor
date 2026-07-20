import { describe, expect, it, vi } from 'vitest'
import { loadBuildDataset, loadBuildDatasetFromUnknown } from './loadBuildDataset'
import { validateBuildDataset } from '../domain/recommendationEngine'
import buildsDemo from './builds.demo.json'
import type { BuildDataset } from '../domain/recommendationEngine'

describe('loadBuildDataset', () => {
  it('narrows unknown value to BuildDataset', () => {
    const unknownInput: unknown = buildsDemo
    const dataset = loadBuildDatasetFromUnknown(unknownInput)

    const typedDemo: BuildDataset = dataset
    expect(typedDemo.targetPatch).toBe('demo-patch-0.0.1')
    expect(Array.isArray(typedDemo.builds)).toBe(true)
  })

  it('throws on null dataset', () => {
    expect(() => loadBuildDatasetFromUnknown(null)).toThrow(/Dataset must be an object/)
  })

  it('throws on primitive dataset', () => {
    expect(() => loadBuildDatasetFromUnknown('not-object')).toThrow(/Dataset must be an object/)
    expect(() => loadBuildDatasetFromUnknown(42)).toThrow(/Dataset must be an object/)
  })

  it('loads a valid local demo dataset', () => {
    const dataset = loadBuildDataset()
    expect(dataset.targetPatch).toBe('demo-patch-0.0.1')
    expect(Array.isArray(dataset.builds)).toBe(true)
    expect(dataset.builds.length).toBeGreaterThanOrEqual(4)
  })

  it('uses the explicit demo target patch', () => {
    const dataset = loadBuildDataset()
    expect(dataset.targetPatch).toBe('demo-patch-0.0.1')
    for (const build of dataset.builds) {
      expect(build.patch).toBe(dataset.targetPatch)
    }
  })

  it('ensures unique build ids', () => {
    const dataset = loadBuildDataset()
    const ids = dataset.builds.map((build) => build.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('ensures each build has full path stages', () => {
    const dataset = loadBuildDataset()
    const requiredStages = ['start', 'campaign', 'early_maps', 'endgame'] as const

    for (const build of dataset.builds) {
      for (const stage of requiredStages) {
        const stagePlan = build.path[stage]
        expect(Array.isArray(stagePlan.skills)).toBe(true)
        expect(Array.isArray(stagePlan.passiveMilestones)).toBe(true)
        expect(Array.isArray(stagePlan.gearMilestones)).toBe(true)
        expect(Array.isArray(stagePlan.upgradePriorities)).toBe(true)
      }
    }
  })

  it('reports controlled error for corrupted JSON object', () => {
    const corrupted = { ...buildsDemo, builds: [...buildsDemo.builds, buildsDemo.builds[0]] } as typeof buildsDemo
    expect(() => loadBuildDatasetFromUnknown(corrupted)).toThrow(/Duplicate build id detected/)
  })

  it('throws for corrupted object', () => {
    const corrupted = {
      targetPatch: 'demo-patch-0.0.1',
      availableClasses: ['other-class'],
      builds: [
        {
          id: 'demo-corrupt-build',
          name: 'Demo Corrupt',
          patch: 'demo-patch-0.0.1',
          class: 'demo-melee-class',
          ascendancy: null,
          playStyles: ['melee'],
          modes: ['softcore'],
          minimumBudget: 'starter',
          scoresByStage: {
            start: 10,
            campaign: 20,
            early_maps: 30,
            endgame: 40,
          },
          bossingScore: 10,
          clearSpeedScore: 10,
          survivabilityScore: 10,
          easeOfUseScore: 10,
          dataConfidence: 10,
          lastReviewedAt: '2026-01-01',
          path: {
            start: {
              skills: ['Demo'],
              passiveMilestones: ['Demo'],
              gearMilestones: ['Demo'],
              upgradePriorities: ['Demo'],
            },
            campaign: {
              skills: ['Demo'],
              passiveMilestones: ['Demo'],
              gearMilestones: ['Demo'],
              upgradePriorities: ['Demo'],
            },
            early_maps: {
              skills: ['Demo'],
              passiveMilestones: ['Demo'],
              gearMilestones: ['Demo'],
              upgradePriorities: ['Demo'],
            },
            endgame: {
              skills: ['Demo'],
              passiveMilestones: ['Demo'],
              gearMilestones: ['Demo'],
              upgradePriorities: ['Demo'],
            },
          },
          sources: ['demo-source'],
        },
      ],
    }

    expect(() => loadBuildDatasetFromUnknown(corrupted)).toThrow(/Build class is not available for current dataset/)
  })

  it('does not use fetch/network during dataset load', () => {
    const originalFetch = globalThis.fetch
    const fetchSpy = vi.spyOn(globalThis as typeof globalThis & { fetch: typeof globalThis.fetch }, 'fetch')
    fetchSpy.mockRejectedValue(new Error('network should not be used'))

    expect(() => loadBuildDataset()).not.toThrow()
    expect(fetchSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
    if (typeof originalFetch === 'function') {
      globalThis.fetch = originalFetch
    }
  })
})

describe('demo dataset contract', () => {
  it('validates imported demo dataset with recommendation engine validator', () => {
    expect(() => validateBuildDataset(buildsDemo)).not.toThrow()
  })

  it('does not contain real build names or IDs', () => {
    const dataset = loadBuildDataset()
    for (const build of dataset.builds) {
      expect(build.id).toContain('demo')
      expect(build.name.toLowerCase()).toContain('demo')
    }
  })

  it('covers all play styles in demo dataset', () => {
    const dataset = loadBuildDataset()
    const playStyles = new Set(dataset.builds.flatMap((build) => build.playStyles))

    expect(playStyles.has('melee')).toBe(true)
    expect(playStyles.has('ranged')).toBe(true)
    expect(playStyles.has('spells')).toBe(true)
    expect(playStyles.has('minions')).toBe(true)
    expect(playStyles.size).toBe(4)
  })

  it('uses synthetic class IDs', () => {
    const dataset = loadBuildDataset()
    const availableClasses = new Set(dataset.availableClasses)

    expect(availableClasses.has('demo-melee-class')).toBe(true)
    expect(availableClasses.has('demo-ranged-class')).toBe(true)
    expect(availableClasses.has('demo-spell-class')).toBe(true)
    expect(availableClasses.has('demo-minion-class')).toBe(true)
  })
})
