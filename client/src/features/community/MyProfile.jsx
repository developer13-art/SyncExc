import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '../../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { FormField } from '../../components/forms/FormField.jsx';
import { LoadingState } from '../../components/ui/LoadingState.jsx';
import { ProfileHeader } from './components/ProfileHeader.jsx';
import { PostCard } from './components/PostCard.jsx';
import { communityApi } from '../../api/index.js';
import { queryKeys } from '../../hooks/queryKeys.js';
import { useCommunityProfile, useCommunityPosts } from '../../hooks/useCommunity.js';
import { useToast } from '../../hooks/useToast.js';
import { getErrorMessage } from '../../api/errors.js';
import { uiActions } from '../../app/slices/uiSlice.js';
import { ROUTES } from '../../config/routes.config.js';

export default function MyProfile() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const toast = useToast();
  const profileQuery = useCommunityProfile();
  const postsQuery = useCommunityPosts({ authorId: profileQuery.profile?.userId });
  const followRequestsQuery = useQuery({
    queryKey: ['community', 'follow-requests'],
    queryFn: () => communityApi.listFollowRequests(),
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ displayName: '', bio: '', website: '' });
  const [privacy, setPrivacy] = useState({
    allowFollows: true,
    allowMentions: true,
    allowDirectMessages: false,
    allowRecommendations: true,
  });
  const [saving, setSaving] = useState(false);
  const [privacySaving, setPrivacySaving] = useState(false);

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
      });
      setPrivacy({
        allowFollows: profileQuery.profile.privacy?.allowFollows ?? true,
        allowMentions: profileQuery.profile.privacy?.allowMentions ?? true,
        allowDirectMessages: profileQuery.profile.privacy?.allowDirectMessages ?? false,
        allowRecommendations: profileQuery.profile.privacy?.allowRecommendations ?? true,
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

  const handleFollowRequest = async (followerId, approved) => {
    try {
      await communityApi.resolveFollowRequest(followerId, approved);
      await queryClient.invalidateQueries({ queryKey: ['community', 'follow-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['community', 'profile'] });
      toast.success(approved ? 'Follow request accepted' : 'Follow request declined');
    } catch (err) {
      toast.error('Could not update follow request', { description: getErrorMessage(err) });
    }
  };

  const handlePrivacySave = async () => {
    setPrivacySaving(true);
    try {
      await communityApi.updateMyPrivacy(privacy);
      await queryClient.invalidateQueries({ queryKey: queryKeys.community.myProfile });
      toast.success('Privacy settings updated');
    } catch (err) {
      toast.error('Privacy update failed', { description: getErrorMessage(err) });
    } finally {
      setPrivacySaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Button variant="outline" asChild className="self-start">
        <Link to={ROUTES.app.community.moderation}>Reports and appeals</Link>
      </Button>
      <ProfileHeader
        profile={profileQuery.profile}
        isOwnProfile
        onEdit={() => setEditing(true)}
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

      <Card>
        <CardHeader><CardTitle>Privacy and messaging</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {[
            ['allowFollows', 'Allow people to follow you'],
            ['allowMentions', 'Allow people to mention you'],
            ['allowDirectMessages', 'Accept direct-message requests'],
            ['allowRecommendations', 'Allow personalized community recommendations'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={privacy[key]}
                onChange={(event) =>
                  setPrivacy((current) => ({ ...current, [key]: event.target.checked }))
                }
              />
              {label}
            </label>
          ))}
          <Button
            className="self-start"
            onClick={handlePrivacySave}
            disabled={privacySaving}
          >
            {privacySaving ? 'Saving…' : 'Save privacy settings'}
          </Button>
        </CardContent>
      </Card>

      {(followRequestsQuery.data ?? []).length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Follow requests</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            {followRequestsQuery.data.map((request) => (
              <div key={request.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
                <span className="flex-1 text-sm font-medium">
                  {request.display_name} @{request.handle}
                </span>
                <Button size="sm" onClick={() => handleFollowRequest(request.user_id, true)}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleFollowRequest(request.user_id, false)}>
                  Decline
                </Button>
              </div>
            ))}
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