import { Link } from 'react-router-dom';
import { Calendar, Link2, MapPin, Settings } from 'lucide-react';

import { Card, CardContent } from '../../../components/ui/Card.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { formatDate } from '../../../lib/formatters/date.formatter.js';
import { ROUTES } from '../../../config/routes.config.js';

export function ProfileHeader({
  profile,
  isOwnProfile,
  isFollowing,
  hasPendingFollowRequest,
  onFollow,
  onUnfollow,
  canMessage = false,
  className,
}) {
  if (!profile) {
    return null;
  }

  const initials = (profile.displayName ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Card className={`overflow-hidden ${className ?? ''}`}>
      <div
        role="img"
        aria-label="Profile cover"
        className="h-24 bg-gradient-to-r from-primary/25 via-primary/10 to-muted sm:h-32"
      />
      <CardContent className="relative p-5 pt-0 sm:p-6 sm:pt-0">
        <div className="-mt-10 flex flex-wrap items-end gap-4 sm:-mt-12 sm:gap-5">
          <Avatar
            size="xl"
            src={profile.avatarUrl}
            fallback={initials}
            className="h-20 w-20 border-4 border-card text-xl sm:h-24 sm:w-24"
          />

          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {profile.displayName}
              </h1>
              {profile.verified ? <Badge variant="info">Verified</Badge> : null}
            </div>

            {profile.handle ? (
              <p className="mt-1 text-sm text-muted-foreground">@{profile.handle}</p>
            ) : null}

            {profile.bio ? (
              <p className="mt-3 text-sm text-foreground">{profile.bio}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              {profile.location ? (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {profile.location}
                </span>
              ) : null}
              {profile.website ? (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Link2 className="h-3 w-3" /> {profile.website}
                </a>
              ) : null}
              {profile.createdAt ? (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Joined {formatDate(profile.createdAt)}
                </span>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-6 text-sm">
              <Stat label="Posts" value={profile.postCount ?? 0} />
              <Stat label="Followers" value={profile.followersCount ?? 0} />
              <Stat label="Following" value={profile.followingCount ?? 0} />
            </div>

            {profile.interests?.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {profile.interests.map((interest) => (
                  <Badge key={interest} variant="muted">
                    {interest}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 pb-1">
            {isOwnProfile ? (
              <Button variant="outline" asChild>
                <Link to={ROUTES.app.community.myProfile}>
                  <Settings className="h-4 w-4" /> Edit profile
                </Link>
              </Button>
            ) : hasPendingFollowRequest ? (
              <Button variant="outline" disabled>Requested</Button>
            ) : isFollowing ? (
              <Button variant="outline" onClick={onUnfollow}>
                Unfollow
              </Button>
            ) : (
              <Button onClick={onFollow}>Follow</Button>
            )}
            {!isOwnProfile && canMessage ? (
              <Button variant="outline" asChild>
                <Link to={`${ROUTES.app.community.messages}?recipientId=${profile.userId}`}>
                  Message
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <span className="font-semibold text-foreground">{value.toLocaleString()}</span>{' '}
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}