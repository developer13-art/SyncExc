/**
 * SyncExc Server — Application service
 */

import { NotFoundError, ConflictError, ValidationError } from '../../lib/errors.js';

export function createApplicationService({ db, queries, events, logger }) {
  async function createApplication({
    userId,
    workspaceId,
    name,
    description,
    type,
    redirectUris,
    website,
    privacyPolicyUrl,
    supportContact,
  }) {
    if (!['personal', 'organization', 'third_party'].includes(type)) {
      throw new ValidationError(`Invalid application type: ${type}`);
    }

    return db.tx(async (tx) => {
      const application = await queries.insertApplication(tx, {
        workspaceId,
        ownerId: userId,
        name,
        description,
        type,
        website,
        privacyPolicyUrl,
        supportContact,
      });

      // Snapshot version 1
      await queries.insertApplicationVersion(tx, {
        applicationId: application.id,
        version: 1,
        snapshot: application,
      });

      // Redirect URIs (for OAuth)
      if (redirectUris && redirectUris.length > 0) {
        for (const uri of redirectUris) {
          await queries.insertRedirectUri(tx, {
            applicationId: application.id,
            uri,
          });
        }
      }

      await queries.insertAuditEvent(tx, {
        actorId: userId,
        applicationId: application.id,
        action: 'application.created',
        resourceType: 'developer_application',
        resourceId: application.id,
        after: { name, type },
      });

      await events.publish(
        tx,
        'developer.application_created',
        { applicationId: application.id, name, type },
        {
          actorId: userId,
          workspaceId,
          resourceType: 'developer_application',
          resourceId: application.id,
        }
      );

      return application;
    });
  }

  async function getApplication({ applicationId, workspaceId }) {
    const app = await queries.findApplicationById(applicationId);
    if (!app || app.workspace_id !== workspaceId) throw new NotFoundError('Application');
    return app;
  }

  async function listApplications({ workspaceId, state }) {
    return queries.listApplicationsForWorkspace(workspaceId, { state });
  }

  async function updateApplication({ userId, workspaceId, applicationId, updates }) {
    const app = await queries.findApplicationById(applicationId);
    if (!app || app.workspace_id !== workspaceId) throw new NotFoundError('Application');

    return db.tx(async (tx) => {
      const updated = await queries.updateApplication(applicationId, updates);

      await queries.insertApplicationVersion(tx, {
        applicationId,
        version: 2,
        snapshot: updated,
      });

      await queries.insertAuditEvent(tx, {
        actorId: userId,
        applicationId,
        action: 'application.updated',
        resourceType: 'developer_application',
        resourceId: applicationId,
        before: app,
        after: updated,
      });

      return updated;
    });
  }

  async function suspendApplication({ userId, workspaceId, applicationId, reason }) {
    const app = await queries.findApplicationById(applicationId);
    if (!app || app.workspace_id !== workspaceId) throw new NotFoundError('Application');

    return db.tx(async (tx) => {
      const updated = await queries.updateApplication(applicationId, { state: 'suspended' });

      await queries.insertAuditEvent(tx, {
        actorId: userId,
        applicationId,
        action: 'application.suspended',
        resourceType: 'developer_application',
        resourceId: applicationId,
        after: { reason },
      });

      return updated;
    });
  }

  return {
    createApplication,
    getApplication,
    listApplications,
    updateApplication,
    suspendApplication,
  };
}

export default createApplicationService;