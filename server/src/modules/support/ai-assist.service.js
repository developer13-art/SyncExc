/**
 * SyncExc Server — AI-assisted support
 *
 * Uses the LLM to:
 *   - suggest help articles
 *   - summarize conversations
 *   - extract error codes
 *   - detect likely duplicate tickets
 *   - draft responses for agent review
 *   - translate draft replies
 *
 * AI output is always a suggestion. Never an authorization.
 */

import { NotFoundError } from '../../lib/errors.js';

export function createAiAssistService({ db, queries, ai, logger }) {
  async function suggestHelpArticles({ ticketId }) {
    if (!ai) return { suggestions: [] };

    const ticket = await queries.findTicketById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');

    const { data } = await ai.chatJson({
      system: 'You are a support knowledge base assistant. Given a customer support ticket, identify the most likely relevant help topics from the SyncExc product. Return JSON.',
      messages: [
        {
          role: 'user',
          content: `Ticket subject: ${ticket.subject}\nCategory: ${ticket.category}\nDescription: ${ticket.description}\n\nReturn JSON: { "keywords": ["..."], "topics": ["..."] }`,
        },
      ],
      rateKey: `support:${ticketId}`,
    });

    // Search the help center with the extracted keywords
    const suggestions = [];
    const keywords = data.keywords || [];
    for (const keyword of keywords.slice(0, 5)) {
      const results = await queries.searchArticles(keyword, { limit: 3 });
      for (const article of results) {
        if (!suggestions.some((s) => s.id === article.id)) {
          suggestions.push({
            id: article.id,
            slug: article.slug,
            title: article.title,
            summary: article.summary,
          });
        }
      }
    }

    return { suggestions: suggestions.slice(0, 10), extracted: data };
  }

  async function summarizeConversation({ ticketId }) {
    if (!ai) return { summary: null };

    const ticket = await queries.findTicketById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');

    const messages = await queries.listMessages(ticketId);
    const notes = await queries.listInternalNotes(ticketId);

    if (messages.length === 0 && notes.length === 0) {
      return { summary: null };
    }

    const conversation = [
      ...messages.map((m) => ({
        type: 'customer_message',
        author: m.author_display_name || m.author_email,
        at: m.created_at,
        content: m.content,
      })),
      ...notes.map((n) => ({
        type: 'internal_note',
        author: n.author_display_name || n.author_email,
        at: n.created_at,
        content: n.content,
      })),
    ].sort((a, b) => new Date(a.at) - new Date(b.at));

    const { data } = await ai.chatJson({
      system: 'Summarize the support conversation for an agent handoff. Return JSON with "summary", "openQuestions" (array), "actionItems" (array), and "sentiment" ("positive" | "neutral" | "negative").',
      messages: [
        {
          role: 'user',
          content: `Subject: ${ticket.subject}\n\nConversation:\n${JSON.stringify(conversation, null, 2)}`,
        },
      ],
      rateKey: `support:summary:${ticketId}`,
    });

    return { summary: data };
  }

  async function draftResponse({ ticketId, tone = 'professional' }) {
    if (!ai) return { draft: null };

    const ticket = await queries.findTicketById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');

    const messages = await queries.listMessages(ticketId);
    const notes = await queries.listInternalNotes(ticketId);

    const context = {
      subject: ticket.subject,
      category: ticket.category,
      description: ticket.description,
      conversation: messages.map((m) => ({
        from: m.author_display_name || m.author_email,
        at: m.created_at,
        content: m.content,
      })),
      internalNotes: notes.map((n) => ({
        from: n.author_display_name || n.author_email,
        content: n.content,
      })),
    };

    const { data } = await ai.chatJson({
      system: `Draft a support reply on behalf of the SyncExc team. Do NOT invent facts or claim resolution without evidence. Return JSON: { "draft": "...", "needsVerification": ["..."] }`,
      messages: [
        {
          role: 'user',
          content: `Tone: ${tone}\n\nTicket context:\n${JSON.stringify(context, null, 2)}\n\nDraft a response. If you lack information, list what's needed in "needsVerification".`,
        },
      ],
      rateKey: `support:draft:${ticketId}`,
    });

    return { draft: data.draft, needsVerification: data.needsVerification || [] };
  }

  async function detectDuplicate({ ticketId }) {
    if (!ai) return { candidates: [] };

    const ticket = await queries.findTicketById(ticketId);
    if (!ticket) throw new NotFoundError('Ticket');

    // Simple similarity: same requester, same category, close in time
    const result = await db.query(
      `
      SELECT id, reference, subject, created_at
      FROM support_tickets
      WHERE requester_id = $1
        AND category = $2
        AND id <> $3
        AND created_at > now() - interval '14 days'
      ORDER BY created_at DESC
      LIMIT 10
      `,
      [ticket.requester_id, ticket.category, ticketId]
    );

    return { candidates: result.rows };
  }

  return {
    suggestHelpArticles,
    summarizeConversation,
    draftResponse,
    detectDuplicate,
  };
}

export default createAiAssistService;