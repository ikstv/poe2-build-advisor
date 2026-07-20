import { describe, expect, it, vi } from 'vitest'
import { loadBuildDataset, loadBuildDatasetFromUnknown } from './loadBuildDataset'
import { validateBuildDataset } from '../domain/recommendationEngine'
import buildsDemo from './builds.demo.json'

describe('loadBuildDataset', () => {
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
})
