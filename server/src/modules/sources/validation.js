/**
 * SyncExc Server — Source validation service
 */

import { NotFoundError } from '../../lib/errors.js';

export function createValidationService({ db, queries, adapterRegistry, events, logger }) {
  /**
   * Run a full validation pass for a source.
   * Stages:
   *   - identity: confirm the source reference resolves
   *   - authorization: confirm the access method works
   *   - connectivity: can we fetch content?
   *   - content: is there meaningful content?
   *   - format: can we parse the message structure?
   *   - freshness: how recent is the latest event?
   */
  async function runValidation({ sourceId, userId }) {
    const source = await queries.findSourceById(sourceId);
    if (!source) throw new NotFoundError('Source');

    const connection = await queries.findSourceConnection(sourceId);
    const adapter = adapterRegistry.get(source.type);

    if (!adapter) {
      throw new NotFoundError(`Adapter for type ${source.type}`);
    }

    const stages = [];

    // Stage 1: identity
    stages.push({
      stage: 'identity',
      result: 'passed',
      message: 'Source reference resolves',
    });

    // Stage 2: authorization
    if (connection) {
      stages.push({
        stage: 'authorization',
        result: connection.status === 'active' ? 'passed' : 'failed',
        message: connection.status === 'active' ? 'Access verified' : 'Access not established',
      });
    } else {
      stages.push({
        stage: 'authorization',
        result: 'failed',
        message: 'No connection configured',
      });
    }

    // Stage 3: connectivity + content + format via the adapter
    let connectivityPassed = false;
    let contentPassed = false;
    let formatPassed = false;
    let freshEventAt = null;
    let summary = {};

    if (adapter && connection) {
      try {
        const testResult = await adapter.testConnection({
          source,
          connection,
        });

        connectivityPassed = testResult.reachable;
        contentPassed = testResult.hasContent;
        formatPassed = testResult.parseable;
        freshEventAt = testResult.lastEventAt;
        summary = testResult.summary || {};

        stages.push({
          stage: 'connectivity',
          result: connectivityPassed ? 'passed' : 'failed',
          message: testResult.connectivityMessage || '',
        });

        stages.push({
          stage: 'content_access',
          result: contentPassed ? 'passed' : 'failed',
          message: testResult.contentMessage || '',
        });

        stages.push({
          stage: 'format',
          result: formatPassed ? 'passed' : 'partial',
          message: testResult.formatMessage || '',
        });
      } catch (err) {
        logger.error({ err, sourceId }, 'Adapter test failed');
        stages.push({
          stage: 'connectivity',
          result: 'failed',
          message: err.message,
        });
      }
    } else {
      stages.push({ stage: 'connectivity', result: 'skipped', message: 'No adapter or connection' });
      stages.push({ stage: 'content_access', result: 'skipped' });
      stages.push({ stage: 'format', result: 'skipped' });
    }

    // Stage 4: freshness
    if (freshEventAt) {
      const ageMs = Date.now() - new Date(freshEventAt).getTime();
      stages.push({
        stage: 'freshness',
        result: ageMs < 24 * 60 * 60 * 1000 ? 'passed' : 'warning',
        message: `Last event ${Math.round(ageMs / 60000)} minutes ago`,
      });
    } else {
      stages.push({ stage: 'freshness', result: 'skipped', message: 'No events observed' });
    }

    // Overall
    const failed = stages.filter((s) => s.result === 'failed').length;
    const overallResult = failed === 0 ? 'passed' : failed <= 1 ? 'partial' : 'failed';

    return db.tx(async (tx) => {
      const validation = await queries.insertValidation(tx, {
        sourceId,
        overallResult,
        summary,
        completedAt: new Date(),
      });

      for (const stage of stages) {
        await queries.insertValidationCheck(tx, {
          validationId: validation.id,
          stage: stage.stage,
          result: stage.result,
          message: stage.message,
          evidence: stage.evidence,
        });
      }

      // Update source status based on result
      if (overallResult === 'passed' && source.status === 'pending_validation') {
        await queries.updateSourceStatus(sourceId, 'pending_review');
      }

      await events.publish(
        tx,
        'source.validation_completed',
        { sourceId, overallResult, stages },
        {
          actorId: userId,
          workspaceId: source.workspace_id,
          resourceType: 'signal_source',
          resourceId: sourceId,
        }
      );

      return { validation, stages, overallResult };
    });
  }

  async function listValidations({ sourceId, workspaceId }) {
    const source = await queries.findSourceById(sourceId);
    if (!source || source.workspace_id !== workspaceId) throw new NotFoundError('Source');
    return queries.listValidationsForSource(sourceId);
  }

  return {
    runValidation,
    listValidations,
  };
}

export default createValidationService;