import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search } from 'lucide-react';

import { SearchInput } from '../../../components/forms/SearchInput.jsx';
import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { EmptyState } from '../../../components/ui/EmptyState.jsx';
import { useHelpSearch } from '../../../hooks/useSupport.js';
import { ROUTES } from '../../../config/routes.config.js';

export function HelpSearch({ initialQuery = '', className }) {
  const [query, setQuery] = useState(initialQuery);
  const searchQuery = useHelpSearch({ q: query });

  const results = searchQuery.data?.items ?? [];
  const hasQuery = query.trim().length > 0;

  return (
    <div className={className}>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search help articles and common errors…"
        className="w-full"
      />

      {hasQuery ? (
        <div className="mt-4">
          {searchQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              <div className="h-16 animate-pulse rounded-md bg-muted" />
              <div className="h-16 animate-pulse rounded-md bg-muted" />
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No results"
              description="Try different keywords, or create a support ticket."
              size="sm"
              className="border-0 bg-transparent"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {results.map((article) => (
                <li key={article.id}>
                  <Link
                    to={ROUTES.app.support.helpArticle(article.slug ?? article.id)}
                    className="flex items-start gap-3 rounded-md border border-border p-3 transition hover:border-primary/40"
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {article.title}
                      </p>
                      {article.summary ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {article.summary}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}