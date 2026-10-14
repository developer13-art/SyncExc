import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Card, CardContent } from '../../components/ui/Card.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { FormError } from '../../components/forms/FormError.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/Select.jsx';
import { TagInput } from '../../components/forms/TagInput.jsx';
import { useToast } from '../../hooks/useToast.js';
import { communityApi } from '../../api/index.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function CreateAnalysis() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({
    title: '',
    summary: '',
    content: '',
    visibility: 'private',
    tags: [],
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('New Analysis Document'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Community', path: ROUTES.app.community.overview },
        { label: 'Analysis', path: ROUTES.app.community.analysis },
        { label: 'New', path: ROUTES.app.community.createAnalysis },
      ]),
    );
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!form.content.trim()) {
      setError('Content is required');
      return;
    }

    setSubmitting(true);
    try {
      const created = await communityApi.createAnalysis({
        title: form.title.trim(),
        summary: form.summary.trim() || undefined,
        content: form.content,
        visibility: form.visibility,
        tags: form.tags,
      });
      toast.success('Analysis document created');
      navigate(ROUTES.app.community.analysisDoc(created.id), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to={ROUTES.app.community.analysis}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            New analysis document
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Structured research notes with version history. Data points are labeled by
            provenance — platform-provided, externally sourced, or manually entered.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FormError>{error}</FormError>

              <FormField label="Title" htmlFor="analysis-title" required>
                <Input
                  id="analysis-title"
                  autoFocus
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </FormField>

              <FormField label="Summary" htmlFor="analysis-summary">
                <Input
                  id="analysis-summary"
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder="Short summary"
                />
              </FormField>

              <FormField label="Content" htmlFor="analysis-content" required>
                <Textarea
                  id="analysis-content"
                  rows={12}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Write your analysis…"
                  className="font-sans"
                />
              </FormField>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Visibility" htmlFor="analysis-visibility" required>
                  <Select
                    value={form.visibility}
                    onValueChange={(v) => setForm({ ...form, visibility: v })}
                  >
                    <SelectTrigger id="analysis-visibility" className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="workspace">Workspace members</SelectItem>
                      <SelectItem value="public">Public</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Tags" htmlFor="analysis-tags">
                  <TagInput
                    value={form.tags}
                    onChange={(tags) => setForm({ ...form, tags })}
                    placeholder="Add tags"
                  />
                </FormField>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" asChild>
                  <Link to={ROUTES.app.community.analysis}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create document'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}