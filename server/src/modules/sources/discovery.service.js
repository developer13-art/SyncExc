/**
 * SyncExc Server — Source discovery service
 */

import { NotFoundError, ValidationError } from '../../lib/errors.js';

export function createDiscoveryService({ db, queries, ai, adapterRegistry, events, logger }) {
  async function createDiscoveryJob({ userId, workspaceId, filters, maxCandidates }) {
    const job = await db.tx(async (tx) => {
      return queries.insertDiscoveryJob(tx, {
        workspaceId,
        initiatedBy: userId,
        filters: { ...filters, maxCandidates: maxCandidates || 50 },
      });
    });

    // Enqueue the actual work
    await events.publish(
      db,
      'source.discovery_job_created',
      { jobId: job.id, workspaceId },
      {
        actorId: userId,
        workspaceId,
        resourceType: 'discovery_job',
        resourceId: job.id,
      }
    );

    return job;
  }

  /**
   * Run a discovery job. Called by the job runner.
   */
  async function runDiscoveryJob(jobId) {
    const job = await queries.findDiscoveryJobById(jobId);
    if (!job) throw new NotFoundError('Discovery job');
    if (job.status === 'running') return;

    await queries.updateDiscoveryJob(jobId, {
      status: 'running',
      startedAt: new Date(),
    });

    let candidatesFound = 0;

    try {
      // Use the discovery providers registered in the adapter registry
      const providers = adapterRegistry.listDiscoveryProviders();
      const results = [];

      for (const providerName of providers) {
        try {
          const provider = adapterRegistry.getDiscoveryProvider(providerName);
          const candidates = await provider.search(job.filters);
          results.push(...candidates);
        } catch (err) {
          logger.warn(
            { err, provider: providerName, jobId },
            'Discovery provider failed'
          );
        }
      }

      // Deduplicate against existing sources
      const filtered = await filterDuplicates(job.workspace_id, results);

      // Enrich each candidate with AI classification
      for (const candidate of filtered.slice(0, job.filters.maxCandidates || 50)) {
        const enriched = await enrichCandidate(candidate, job);
        await db.tx(async (tx) => {
          const created = await queries.insertCandidate(tx, {
            discoveryJobId: job.id,
            workspaceId: job.workspace_id,
            name: enriched.name,
            url: enriched.url,
            identifier: enriched.identifier,
            type: enriched.type,
            confidenceScore: enriched.confidence,
            evidence: enriched.evidence,
            metadata: enriched.metadata,
          });

          // Store evidence rows
          for (const evidence of enriched.evidenceList || []) {
            await queries.insertCandidateEvidence(tx, {
              candidateId: created.id,
              kind: evidence.kind,
              data: evidence.data,
            });
          }

          candidatesFound += 1;
        });
      }

      await queries.updateDiscoveryJob(jobId, {
        status: 'completed',
        candidatesFound,
        completedAt: new Date(),
      });

      await events.publish(
        db,
        'source.discovery_completed',
        { jobId, candidatesFound },
        {
          workspaceId: job.workspace_id,
          resourceType: 'discovery_job',
          resourceId: jobId,
        }
      );

      return { candidatesFound };
    } catch (err) {
      logger.error({ err, jobId }, 'Discovery job failed');
      await queries.updateDiscoveryJob(jobId, {
        status: 'failed',
        errorMessage: err.message,
        completedAt: new Date(),
      });
      throw err;
    }
  }

  async function filterDuplicates(workspaceId, candidates) {
    const existing = await queries.listSourcesForWorkspace(workspaceId);
    const existingIdentifiers = new Set();
    for (const source of existing) {
      existingIdentifiers.add(source.url);
      existingIdentifiers.add(source.name);
    }

    return candidates.filter((c) => {
      if (c.url && existingIdentifiers.has(c.url)) return false;
      if (c.name && existingIdentifiers.has(c.name)) return false;
      return true;
    });
  }

  async function enrichCandidate(candidate, job) {
    // Ask AI to classify and describe the candidate
    let aiEnrichment = null;
    if (ai) {
      try {
        const result = await ai.chatJson({
          system: 'You are a signal source classifier. Return JSON only.',
          messages: [
            {
              role: 'user',
              content: `Classify this signal source candidate:
Name: ${candidate.name}
URL: ${candidate.url || 'unknown'}
Description: ${candidate.description || 'none'}

Return JSON: { "type": "telegram|discord|whatsapp|webhook|website|rest_api|email", "confidence": 0-1, "categories": [...], "languages": [...], "reason": "..." }`,
            },
          ],
          rateKey: `discovery:${job.workspace_id}`,
        });
        aiEnrichment = result.data;
      } catch (err) {
        logger.warn({ err }, 'AI enrichment failed for candidate');
      }
    }

    return {
      name: candidate.name,
      url: candidate.url,
      identifier: candidate.identifier || candidate.url,
      type: aiEnrichment?.type || candidate.type || 'website',
      confidence: aiEnrichment?.confidence || 0.5,
      evidence: {
        source: 'ai_classification',
        reason: aiEnrichment?.reason || 'Heuristic classification',
      },
      evidenceList: [
        { kind: 'raw_candidate', data: candidate },
      ],
      metadata: {
        categories: aiEnrichment?.categories || [],
        languages: aiEnrichment?.languages || [],
      },
    };
  }

  async function listJobs({ workspaceId, limit }) {
    return queries.listDiscoveryJobsForWorkspace(workspaceId, { limit });
  }

  async function getJob({ jobId, workspaceId }) {
    const job = await queries.findDiscoveryJobById(jobId);
    if (!job || job.workspace_id !== workspaceId) throw new NotFoundError('Discovery job');
    const candidates = await queries.listCandidatesForWorkspace(workspaceId, {});
    const jobCandidates = candidates.filter((c) => c.discovery_job_id === jobId);
    return { job, candidates: jobCandidates };
  }

  async function listCandidates({ workspaceId, status }) {
    return queries.listCandidatesForWorkspace(workspaceId, { status });
  }

  async function getCandidate({ candidateId, workspaceId }) {
    const candidate = await queries.findCandidateById(candidateId);
    if (!candidate || candidate.workspace_id !== workspaceId) {
      throw new NotFoundError('Candidate');
    }
    return candidate;
  }

  return {
    createDiscoveryJob,
    runDiscoveryJob,
    listJobs,
    getJob,
    listCandidates,
    getCandidate,
  };
}

export default createDiscoveryService;