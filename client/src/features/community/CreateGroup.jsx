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
import { useCommunityGroups } from '../../hooks/useCommunity.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function CreateGroup() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const { createGroup } = useCommunityGroups();

  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    type: 'public',
    topics: [],
  });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('Create Group'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Community', path: ROUTES.app.community.overview },
        { label: 'Groups', path: ROUTES.app.community.groups },
        { label: 'New', path: ROUTES.app.community.createGroup },
      ]),
    );
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Group name is required');
      return;
    }
    if (form.description.trim().length === 0) {
      setError('Group description is required');
      return;
    }
    const slug = (form.slug.trim() || form.name.trim())
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-|-$/g, '');
    if (slug.length < 3) {
      setError('Group name or slug must contain at least 3 letters or numbers');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createGroup({
        name: form.name.trim(),
        slug,
        description: form.description.trim(),
        type: form.type,
        topics: form.topics,
      });

      toast.success('Group created');
      navigate(ROUTES.app.community.group(created.id), { replace: true });
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
          <Link to={ROUTES.app.community.groups}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create a group
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You become the group owner and can appoint moderators later. Group roles never grant
            workspace or trading privileges.
          </p>
        </div>

        <Card>
          <CardContent className="p-6 pt-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FormError>{error}</FormError>

              <FormField label="Group name" htmlFor="group-name" required>
                <Input
                  id="group-name"
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Algorithmic Trading"
                />
              </FormField>

              <FormField
                label="Slug"
                htmlFor="group-slug"
                hint="Optional. Auto-generated from the name if omitted."
              >
                <Input
                  id="group-slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="algo-trading"
                />
              </FormField>

              <FormField label="Description" htmlFor="group-description">
                <Textarea
                  id="group-description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FormField>

              <FormField label="Group type" htmlFor="group-type" required>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger id="group-type" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="approval_based">
                      Private (requires approval)
                    </SelectItem>
                    <SelectItem value="organization">Organization</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Topics" htmlFor="group-topics">
                <TagInput
                  value={form.topics}
                  onChange={(topics) => setForm({ ...form, topics })}
                  placeholder="Add topics"
                />
              </FormField>

              <div className="flex justify-end gap-2">
                <Button variant="outline" asChild>
                  <Link to={ROUTES.app.community.groups}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create group'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}