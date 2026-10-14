import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight } from 'lucide-react';

import { Card, CardContent } from '../../components/ui/Card.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ErrorState } from '../../components/ui/ErrorState.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { HelpSearch } from './components/HelpSearch.jsx';
import { useHelpArticles } from '../../hooks/useSupport.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function HelpCenter() {
  const dispatch = useDispatch();
  const [category, setCategory] = useState(null);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Help Center'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Support', path: ROUTES.app.support.overview },
        { label: 'Help center', path: ROUTES.app.support.help },
      ]),
    );
  }, [dispatch]);

  const articlesQuery = useHelpArticles({ category: category ?? undefined });
  const articles = articlesQuery.data?.items ?? [];
  const categories = articlesQuery.data?.categories ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Help Center
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Search articles or browse by category.
            </p>
          </div>
        </div>
      </div>

      <HelpSearch />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside>
          <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Categories
          </p>
          <ul className="flex flex-col gap-0.5">
            <li>
              <button
                type="button"
                onClick={() => setCategory(null)}
                className={`w-full rounded-md px-2.5 py-1.5 text-left text-sm transition ${
                  category === null
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                All articles
              </button>
            </li>
            {categories.map((c) => (
              <li key={c.slug ?? c.id}>
                <button
                  type="button"
                  onClick={() => setCategory(c.slug ?? c.id)}
                  className={`w-full rounded-md px-2.5 py-1.5 text-left text-sm transition ${
                    category === (c.slug ?? c.id)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div>
          {articlesQuery.isLoading ? (
            <LoadingState label="Loading articles" />
          ) : articlesQuery.isError ? (
            <ErrorState
              title="Unable to load articles"
              description="We could not fetch help articles."
              onRetry={articlesQuery.refetch}
            />
          ) : articles.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No articles"
              description="No articles are available in this category yet."
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {articles.map((article) => (
                <Card key={article.id} className="transition hover:border-primary/40">
                  <Link
                    to={ROUTES.app.support.helpArticle(article.slug ?? article.id)}
                    className="flex items-start gap-3 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {article.title}
                      </p>
                      {article.summary ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {article.summary}
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}