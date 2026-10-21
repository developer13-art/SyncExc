/**
 * SyncExc Server — Analysis document service
 */

import { NotFoundError, AuthorizationError, ConflictError } from '../../lib/errors.js';

export function createAnalysisService({ db, queries, events, logger }) {
  async function createDocument({
    userId,
    workspaceId,
    title,
    summary,
    content,
    tags,
    visibility,
    sources,
  }) {
    if (!title || !content) {
      throw new ConflictError('Title and content are required', 'MISSING_FIELDS');
    }

    return db.tx(async (tx) => {
      const document = await queries.insertAnalysisDocument(tx, {
        authorId: userId,
        workspaceId,
        title,
        summary,
        tags,
        visibility,
      });

      await queries.insertAnalysisVersion(tx, {
        documentId: document.id,
        version: 1,
        content,
      });

      // Record sources if provided
      if (sources && sources.length > 0) {
        for (const source of sources) {
          await tx.query(
            `
            INSERT INTO community_analysis_sources (document_id, source_type, source_ref, provenance)
            VALUES ($1, $2, $3, $4)
            `,
            [document.id, source.type, source.ref || null, source.provenance || 'user_provided']
          );
        }
      }

      await events.publish(
        tx,
        'community.analysis_created',
        { documentId: document.id, title },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'community_analysis_document',
          resourceId: document.id,
        }
      );

      return document;
    });
  }

  async function getDocument({ documentId, viewerId, workspaceId }) {
    const document = await queries.findAnalysisDocumentById(documentId);
    if (!document) throw new NotFoundError('Document');

    // Owner always has access
    const isOwner = document.author_id === viewerId;

    // Check explicit permission
    const permission = isOwner
      ? null
      : await queries.findAnalysisPermission(documentId, viewerId, workspaceId);

    // Public documents
    let allowed = isOwner || Boolean(permission) || document.visibility === 'public';

    if (!allowed && document.visibility === 'followers' && viewerId) {
      allowed = await queries.isFollowing(viewerId, document.author_id);
    }

    if (
      !allowed &&
      document.visibility === 'workspace_members' &&
      document.workspace_id &&
      document.workspace_id === workspaceId
    ) {
      allowed = true;
    }

    if (!isOwner && viewerId) {
      const blocked =
        (await queries.isBlocked(viewerId, document.author_id)) ||
        (await queries.isBlocked(document.author_id, viewerId));
      if (blocked) allowed = false;
    }
    if (!allowed) throw new AuthorizationError('No access to this document');

    const content = await queries.findAnalysisVersionContent(
      documentId,
      document.current_version
    );
    const sources = await queries.listAnalysisSources(documentId);
    return {
      ...document,
      content,
      version: document.current_version,
      sources: sources.map((source) => ({
        type: source.source_type,
        ref: source.source_ref,
        label: source.source_ref || source.source_type,
        provenance: source.provenance,
      })),
    };
  }

  async function listDocuments({ userId, workspaceId, query, limit, cursor }) {
    return queries.listAnalysisDocuments({ userId, workspaceId, query, limit, cursor });
  }

  async function updateDocument({
    userId,
    documentId,
    content,
    title,
    summary,
    tags,
    workspaceId = null,
  }) {
    const document = await queries.findAnalysisDocumentById(documentId);
    if (!document) throw new NotFoundError('Document');
    if (document.author_id !== userId) {
      const permission = await queries.findAnalysisPermission(documentId, userId, workspaceId);
      if (!permission || !['edit', 'manage_sharing'].includes(permission.permission)) {
        throw new AuthorizationError('Not permitted to edit');
      }
    }

    return db.tx(async (tx) => {
      const hasContentUpdate = content !== undefined;
      const nextVersion = hasContentUpdate
        ? (document.current_version || 1) + 1
        : document.current_version || 1;

      if (hasContentUpdate) {
        await queries.insertAnalysisVersion(tx, {
          documentId,
          version: nextVersion,
          content,
        });
      }

      const updated = await tx.query(
        `
        UPDATE community_analysis_documents
        SET title = COALESCE($2, title),
            summary = COALESCE($3, summary),
            tags = COALESCE($4, tags),
            current_version = $5,
            updated_at = now()
        WHERE id = $1
        RETURNING *
        `,
        [documentId, title || null, summary || null, tags || null, nextVersion]
      );

      return updated.rows[0];
    });
  }

  async function grantPermission({ userId, documentId, granteeUserId, granteeWorkspaceId, permission }) {
    const document = await queries.findAnalysisDocumentById(documentId);
    if (!document) throw new NotFoundError('Document');
    if (document.author_id !== userId) throw new AuthorizationError('Not the author');

    const validPermissions = ['view', 'comment', 'edit', 'manage_sharing', 'publish_externally'];
    if (!validPermissions.includes(permission)) {
      throw new ConflictError(`Invalid permission: ${permission}`);
    }

    return db.tx(async (tx) => {
      return queries.insertAnalysisPermission(tx, {
        documentId,
        granteeUserId,
        granteeWorkspaceId,
        permission,
      });
    });
  }

  async function listVersions({ documentId, viewerId, workspaceId }) {
    await getDocument({ documentId, viewerId, workspaceId });
    return queries.listAnalysisVersions(documentId);
  }

  return {
    createDocument,
    listDocuments,
    getDocument,
    updateDocument,
    grantPermission,
    listVersions,
  };
}

export default createAnalysisService;