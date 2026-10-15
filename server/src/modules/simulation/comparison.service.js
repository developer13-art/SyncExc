/**
 * SyncExc Server — Comparison service
 */

import { NotFoundError, ConflictError } from '../../lib/errors.js';

export function createComparisonService({ db, queries, metricsService, logger }) {
  async function compare({ userId, workspaceId, baselineRunId, comparisonRunId }) {
    const baseline = await queries.findRunById(baselineRunId);
    const comparison = await queries.findRunById(comparisonRunId);

    if (!baseline || !comparison) throw new NotFoundError('Run');

    const baselineEnv = await queries.findEnvironmentById(baseline.environment_id);
    const comparisonEnv = await queries.findEnvironmentById(comparison.environment_id);

    if (!baselineEnv || baselineEnv.workspace_id !== workspaceId) throw new NotFoundError('Run');
    if (!comparisonEnv || comparisonEnv.workspace_id !== workspaceId) throw new NotFoundError('Run');

    const warnings = [];

    // Warn about incompatible datasets
    if (baseline.config.datasetVersionId !== comparison.config.datasetVersionId) {
      warnings.push('Runs use different datasets');
    }
    if (baseline.config.fillModel !== comparison.config.fillModel) {
      warnings.push('Runs use different fill models');
    }
    if (baseline.config.takerFeeBps !== comparison.config.takerFeeBps) {
      warnings.push('Runs use different fee assumptions');
    }

    const baselineMetrics = await metricsService.computeMetrics({ runId: baselineRunId });
    const comparisonMetrics = await metricsService.computeMetrics({ runId: comparisonRunId });

    const numericKeys = [
      'netPnl',
      'grossPnl',
      'totalCosts',
      'maxDrawdown',
      'winRate',
      'profitFactor',
      'averageWin',
      'averageLoss',
      'fillCount',
      'orderCount',
      'rejections',
    ];

    const differences = {};
    for (const key of numericKeys) {
      const b = baselineMetrics[key];
      const c = comparisonMetrics[key];
      differences[key] = {
        baseline: b,
        comparison: c,
        delta: typeof b === 'number' && typeof c === 'number' ? c - b : null,
      };
    }

    return db.tx(async (tx) => {
      return queries.insertComparison(tx, {
        workspaceId,
        baselineRunId,
        comparisonRunId,
        differences,
        warnings,
      });
    });
  }

  async function getComparison({ comparisonId, workspaceId }) {
    const comparison = await queries.findComparisonById(comparisonId);
    if (!comparison || comparison.workspace_id !== workspaceId) throw new NotFoundError('Comparison');
    return comparison;
  }

  async function listComparisons({ workspaceId }) {
    return queries.listComparisons(workspaceId);
  }

  return {
    compare,
    getComparison,
    listComparisons,
  };
}

export default createComparisonService;