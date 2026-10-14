import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ProfileHeader } from './components/ProfileHeader.jsx';
import { PostCard } from './components/PostCard.jsx';
import { useCommunityProfile, useCommunityPosts } from '../../hooks/useCommunity.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function MyProfile() {
  const dispatch = useDispatch();
  const toast = useToast();
  const profileQuery = useCommunityProfile();
  const postsQuery = useCommunityPosts({ authorId: profileQuery.profile?.userId });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ displayName: '', bio: '', website: '', location: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dispatch(uiActions.setPageTitle('My Profile'));
    dispatch(
      uiActions.setBreadcrumbs([
        { label: 'Community', path: ROUTES.app.community.overview },
        { label: 'My profile', path: ROUTES.app.community.myProfile },
      ]),
    );
  }, [dispatch]);

  useEffect(() => {
    if (profileQuery.profile) {
      setForm({
        displayName: profileQuery.profile.displayName ?? '',
        bio: profileQuery.profile.bio ?? '',
        website: profileQuery.profile.website ?? '',
        location: profileQuery.profile.location ?? '',
      });
    }
  }, [profileQuery.profile]);

  if (profileQuery.isLoading) {
    return <LoadingState label="Loading profile" />;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await profileQuery.updateProfile(form);
      toast.success('Profile updated');
      setEditing(false);
    } catch (err) {
      toast.error('Save failed', { description: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader
        profile={profileQuery.profile}
        isOwnProfile
        onFollow={() => setEditing(true)}
      />

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField label="Display name" htmlFor="profile-name">
              <Input
                id="profile-name"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </FormField>
            <FormField label="Bio" htmlFor="profile-bio">
              <Textarea
                id="profile-bio"
                rows={3}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </FormField>
            <FormField label="Website" htmlFor="profile-website">
              <Input
                id="profile-website"
                type="url"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </FormField>
            <FormField label="Location" htmlFor="profile-location">
              <Input
                id="profile-location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save profile'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Your posts</h2>
          <Button size="sm" asChild>
            <Link to={ROUTES.app.community.createPost}>New post</Link>
          </Button>
        </div>

        {(postsQuery.posts ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              You haven't posted yet.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {postsQuery.posts.map((post) => (
              <PostCard key={post.id} post={post} currentUserId={profileQuery.profile?.userId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}