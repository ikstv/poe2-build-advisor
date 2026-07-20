import demoBuilds from './builds.demo.json'
import { BuildDataset, validateBuildDataset } from '../domain/recommendationEngine'

export const loadBuildDatasetFromUnknown = (dataset: unknown): BuildDataset => {
  const typedDataset = dataset as BuildDataset
  validateBuildDataset(typedDataset)
  return typedDataset
}

export const loadBuildDataset = (): BuildDataset => {
  return loadBuildDatasetFromUnknown(demoBuilds as unknown)
}
