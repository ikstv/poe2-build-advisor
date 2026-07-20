import demoBuilds from './builds.demo.json'
import type { BuildDataset } from '../domain/recommendationEngine'
import { validateBuildDataset } from '../domain/recommendationEngine'

export const loadBuildDatasetFromUnknown = (dataset: unknown): BuildDataset => {
  validateBuildDataset(dataset)
  return dataset
}

export const loadBuildDataset = (): BuildDataset => {
  return loadBuildDatasetFromUnknown(demoBuilds)
}
