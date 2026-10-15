/**
 * SyncExc Server — Deterministic validation service
 *
 * Runs after extraction. Independent of AI — this is the deterministic
 * gate that all signals must pass.
 */

import {
  validateSymbol,
  validatePrice,
  validateOrderPayload,
} from '@syncexc/shared';

const RULE_SET_VERSION = 'v1';

export function createValidationService({ db, queries, connections, events, logger }) {
  async function validateCandidate({ candidateId }) {
    const candidate = await queries.findCandidateById(candidateId);
    if (!candidate) return null;

    const targets = await queries.listTargetsForCandidate(candidateId);
    const source = await db.query(`SELECT * FROM signal_sources WHERE id = $1`, [candidate.source_id]);
    const sourceRow = source.rows[0];

    const checks = [];

    // 1. Instrument format
    const instrumentCheck = validateSymbol(candidate.instrument);
    checks.push({
      checkKey: 'instrument_format',
      result: instrumentCheck.valid ? 'passed' : 'failed',
      severity: 'critical',
      message: instrumentCheck.valid ? 'Instrument format is valid' : instrumentCheck.error,
    });

    // 2. Instrument tradability (lookup in exchange_instruments)
    if (candidate.instrument) {
      const instrumentRows = await db.query(
        `SELECT * FROM exchange_instruments WHERE normalized_symbol = $1 AND trading_status = 'active' LIMIT 1`,
        [candidate.instrument]
      );
      checks.push({
        checkKey: 'instrument_tradable',
        result: instrumentRows.rows.length > 0 ? 'passed' : 'warning',
        severity: 'high',
        message: instrumentRows.rows.length > 0
          ? 'Instrument is tradable'
          : 'Instrument not found in exchange registry',
      });
    }

    // 3. Direction present and valid
    if (!['long', 'short'].includes(candidate.direction)) {
      checks.push({
        checkKey: 'direction_valid',
        result: 'failed',
        severity: 'critical',
        message: 'Direction must be long or short',
      });
    } else {
      checks.push({
        checkKey: 'direction_valid',
        result: 'passed',
        severity: 'info',
      });
    }

    // 4. Entry price format
    if (candidate.entry) {
      const entryCheck = validatePrice(candidate.entry);
      checks.push({
        checkKey: 'entry_format',
        result: entryCheck.valid ? 'passed' : 'failed',
        severity: 'high',
        message: entryCheck.valid ? 'Entry price is valid' : entryCheck.error,
      });
    } else if (candidate.entry_range) {
      checks.push({
        checkKey: 'entry_format',
        result: 'passed',
        severity: 'info',
        message: 'Entry range provided',
      });
    } else {
      checks.push({
        checkKey: 'entry_required',
        result: 'warning',
        severity: 'high',
        message: 'No entry price or range provided',
        remediation: 'Provide a scalar entry or range, or configure a policy that supplies it',
      });
    }

    // 5. Stop-loss direction consistency
    if (candidate.stop_loss && candidate.entry) {
      const sl = Number(candidate.stop_loss);
      const entry = Number(candidate.entry);
      const valid = candidate.direction === 'long' ? sl < entry : sl > entry;
      checks.push({
        checkKey: 'stop_loss_direction',
        result: valid ? 'passed' : 'failed',
        severity: 'high',
        message: valid ? 'Stop-loss consistent with direction' : 'Stop-loss contradicts direction',
      });
    }

    // 6. Target direction consistency
    if (targets.length > 0 && candidate.entry) {
      const entry = Number(candidate.entry);
      const allValid = targets.every((t) =>
        candidate.direction === 'long' ? Number(t.value) > entry : Number(t.value) < entry
      );
      checks.push({
        checkKey: 'targets_direction',
        result: allValid ? 'passed' : 'failed',
        severity: 'medium',
        message: allValid ? 'All targets consistent with direction' : 'Some targets contradict direction',
      });
    }

    // 7. Source approval
    if (sourceRow) {
      checks.push({
        checkKey: 'source_approved',
        result: sourceRow.status === 'active' || sourceRow.status === 'approved' ? 'passed' : 'warning',
        severity: 'high',
        message: `Source status: ${sourceRow.status}`,
      });
    }

    // 8. Freshness
    const message = await queries.findMessageById(candidate.message_id);
    if (message) {
      const ageMinutes = (Date.now() - new Date(message.provider_timestamp).getTime()) / 60000;
      const fresh = ageMinutes < 30;
      checks.push({
        checkKey: 'freshness',
        result: fresh ? 'passed' : 'warning',
        severity: fresh ? 'info' : 'medium',
        message: `Signal is ${Math.round(ageMinutes)} minutes old`,
      });
    }

    // Determine overall outcome
    const criticalFailures = checks.filter((c) => c.result === 'failed' && c.severity === 'critical');
    const highFailures = checks.filter((c) => c.result === 'failed' && c.severity === 'high');

    let outcome;
    if (criticalFailures.length > 0 || highFailures.length > 0) {
      outcome = 'failed';
    } else if (checks.some((c) => c.result === 'warning')) {
      outcome = 'partial';
    } else {
      outcome = 'passed';
    }

    const validation = await db.tx(async (tx) => {
      const v = await queries.insertValidation(tx, {
        candidateId,
        ruleSetVersion: RULE_SET_VERSION,
        outcome,
        summary: {
          totalChecks: checks.length,
          passed: checks.filter((c) => c.result === 'passed').length,
          failed: checks.filter((c) => c.result === 'failed').length,
          warnings: checks.filter((c) => c.result === 'warning').length,
        },
      });

      for (const check of checks) {
        await queries.insertValidationResult(tx, {
          validationId: v.id,
          checkKey: check.checkKey,
          result: check.result,
          severity: check.severity,
          message: check.message,
          remediation: check.remediation,
        });
      }

      // Update candidate status
      if (outcome === 'passed') {
        await queries.updateCandidate(candidateId, { status: 'validating' });
      } else if (outcome === 'failed') {
        await queries.updateCandidate(candidateId, { status: 'blocked' });
      } else {
        await queries.updateCandidate(candidateId, { status: 'review_required' });
      }

      return v;
    });

    return { validation, checks, outcome };
  }

  return {
    validateCandidate,
  };
}

export default createValidationService;