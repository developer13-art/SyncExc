/**
 * SyncExc Server — Signals event listeners
 */

export function createSignalsListeners({
  events,
  ingestion,
  extraction,
  issueDetection,
  validation,
  eligibility,
  intentHandoff,
  sourceExecution,
  sources,
  db,
  logger,
}) {
  // When a message is received (via outbox), kick off extraction
  events.subscribe(
    'signal.message_received',
    async (envelope) => {
      const { messageId } = envelope.payload || {};
      if (!messageId) return;
      try {
        const extracted = await extraction.extractFromMessage({ messageId });
        if (!extracted.isSignal || !extracted.candidate) return;

        const candidateId = extracted.candidate.id;
        await issueDetection.detectIssues({ candidateId });
        await validation.validateCandidate({ candidateId });

        const sourceResult = await db.query(
          `SELECT id, workspace_id, created_by, status, monitoring_enabled FROM signal_sources WHERE id = $1`,
          [extracted.candidate.source_id]
        );
        const source = sourceResult.rows[0];
        if (!source || source.status !== 'active' || !source.monitoring_enabled) return;
        const config = await sources.registry.getExecutionConfig({
          workspaceId: source.workspace_id,
          sourceId: source.id,
        });
        if (config.mode !== 'authorized_automation') return;

        const existingIntent = await db.query(
          `
          SELECT id FROM trading_execution_intents
          WHERE signal_id = $1
            AND status IN ('created', 'held')
            AND payload->>'executionMode' = 'authorized_automation'
          ORDER BY created_at DESC LIMIT 1
          `,
          [candidateId]
        );
        if (existingIntent.rows[0]) {
          await sourceExecution.executeIntent({ intentId: existingIntent.rows[0].id });
          return;
        }

        const eligibilityResult = await eligibility.decideEligibility({ candidateId });
        if (eligibilityResult?.outcome !== 'eligible_for_handoff') return;

        const intent = await intentHandoff.createIntent({
          userId: source.created_by,
          candidateId,
          workspaceId: source.workspace_id,
          executionMode: 'authorized_automation',
        });
        await sourceExecution.executeIntent({ intentId: intent.id });
      } catch (err) {
        logger.error({ err, messageId }, 'Signal automation pipeline failed');
        throw err;
      }
    },
    { name: 'signals:extract-on-ingest' }
  );

  logger.debug('Signals event listeners registered');

  return {
    async shutdown() {},
  };
}

export default createSignalsListeners;