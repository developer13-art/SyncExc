/**
 * SyncExc Server — Disclosure service
 */

export function createDisclosureService({ db, queries, logger }) {
  async function publishDisclosure({ userId, providerId, scope, version, content }) {
    return db.tx(async (tx) => {
      return queries.insertDisclosure(tx, {
        providerId,
        scope,
        version,
        content,
      });
    });
  }

  async function listForProvider({ providerId }) {
    return queries.listDisclosuresForProvider(providerId);
  }

  async function accept({ userId, disclosureId }) {
    return queries.insertDisclosureAcceptance(null, {
      disclosureId,
      userId,
    });
  }

  return {
    publishDisclosure,
    listForProvider,
    accept,
  };
}

export default createDisclosureService;