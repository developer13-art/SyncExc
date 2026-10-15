/**
 * SyncExc Server — Help center article service
 */

import { NotFoundError, ConflictError, AuthorizationError } from '../../lib/errors.js';

export function createArticleService({ db, queries, events, logger }) {
  async function createArticle({ userId, title, slug, categoryId, content, summary }) {
    if (!title || !slug || !content) {
      throw new ConflictError('title, slug, and content are required');
    }

    return db.tx(async (tx) => {
      const article = await queries.insertArticle(tx, {
        slug,
        title,
        categoryId,
        createdBy: userId,
      });

      await queries.insertArticleVersion(tx, {
        articleId: article.id,
        version: 1,
        content,
        summary,
      });

      await queries.updateArticle(article.id, {
        currentVersion: 1,
      });

      await queries.insertAuditEvent(tx, {
        actorId: userId,
        action: 'article.created',
        resourceType: 'support_article',
        resourceId: article.id,
        after: { title, slug },
      });

      return article;
    });
  }

  async function updateArticle({ userId, articleId, content, summary, title }) {
    const article = await queries.findArticleById(articleId);
    if (!article) throw new NotFoundError('Article');

    const nextVersion = (article.current_version || 1) + 1;

    return db.tx(async (tx) => {
      await queries.insertArticleVersion(tx, {
        articleId,
        version: nextVersion,
        content,
        summary,
      });

      const updated = await queries.updateArticle(articleId, {
        title,
        currentVersion: nextVersion,
      });

      return updated;
    });
  }

  async function publishArticle({ userId, articleId }) {
    const article = await queries.findArticleById(articleId);
    if (!article) throw new NotFoundError('Article');

    return db.tx(async (tx) => {
      const updated = await queries.updateArticle(articleId, {
        state: 'published',
        publishedAt: new Date(),
      });

      await queries.insertAuditEvent(tx, {
        actorId: userId,
        action: 'article.published',
        resourceType: 'support_article',
        resourceId: articleId,
      });

      return updated;
    });
  }

  async function getArticle({ slug }) {
    const article = await queries.findArticleBySlug(slug);
    if (!article) throw new NotFoundError('Article');
    const version = await queries.findArticleVersion(article.id, article.current_version);
    return { article, version };
  }

  async function listArticles({ category, limit }) {
    return queries.listPublishedArticles({ category, limit });
  }

  async function listCategories() {
    return queries.listArticleCategories();
  }

  async function searchArticles({ query, limit }) {
    return queries.searchArticles(query, { limit });
  }

  async function submitArticleFeedback({ userId, articleId, helpful, comment }) {
    return db.tx(async (tx) => {
      return queries.insertArticleFeedback(tx, {
        articleId,
        userId,
        helpful,
        comment,
      });
    });
  }

  return {
    createArticle,
    updateArticle,
    publishArticle,
    getArticle,
    listArticles,
    listCategories,
    searchArticles,
    submitArticleFeedback,
  };
}

export default createArticleService;