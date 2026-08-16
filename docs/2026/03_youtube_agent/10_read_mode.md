# Public learning-plan read mode

## Goal

Allow an account owner to publish an existing learning plan and share it with
anyone. Visitors do not need to sign in. They can browse the plan, courses,
modules, and videos, but the experience never writes progress or exposes owner
workspace data.

## Product rules

- Plans are private by default.
- Publishing creates an opaque share ID and a public URL.
- Published plans appear in the public learning-plan gallery. Filtering and
  discovery controls can be added later without changing individual share URLs.
- Visitors can read plan/course/module metadata and open or play public videos.
- Visitors cannot edit, delete, reorder, label, import, generate with AI, manage
  sources, or update playback/progress state.
- Unpublishing immediately makes the public URL unavailable without deleting the
  owner's plan.
- Learning Notes remain public independently of Learning Plan publication.

## URLs

Owner workspace routes remain unchanged:

```text
/plans/:planId
/plans/:planId/courses/:courseId
/plans/:planId/courses/:courseId/learn
```

Public routes use the opaque share ID rather than the Firebase user ID or the
private plan ID:

```text
/public/plans/:shareId
/public/plans/:shareId/courses/:courseId
```

## API contract

Authenticated owner operations:

```text
POST   /api/plans/:planId/publication
DELETE /api/plans/:planId/publication
```

The publish response contains `share_id`, `public_url`, `published_at`, and the
updated private plan. Publishing an already-public plan is idempotent and keeps
the same share ID.

Unauthenticated read operation:

```text
GET /public-api/plans/:shareId
```

The public gallery uses `GET /public-api/plans`, which returns lightweight
sanitized summaries with the plan ID and curriculum counts rather than every
course payload.

Only `GET`, `HEAD`, and CORS preflight are permitted through the public gateway
path. Missing, private, and revoked shares return `404` to avoid disclosing
whether a private plan exists.

## Public data projection

The public API must not serialize the private plan model directly. A dedicated
projection includes only curriculum fields:

- Plan: public share ID, name, description, logo/icon, custom labels, timestamps.
- Course: ID, title, description, logo/icon, custom labels, sequence, timestamps.
- Module: ID, title, custom labels, sequence.
- Video: ID, display title, description, URL, thumbnail, duration, publication
  metadata, tags, category, caption/embedding flags, and sequence.

The projection excludes:

- `watched`, `last_played_position_secs`, and `last_played_at`.
- Workflow labels such as bookmarked, watched, marked-for-delete, and refresh-needed.
- Course continuation state.
- Source channels, playlists, pending/new-video feeds, and sync metadata.
- Firebase user IDs, tokens, AI configuration/requests, and integration data.

The initial implementation stores a public lookup record that contains this
sanitized projection. Owner saves refresh the projection while the plan remains
published, so the public page follows later curriculum edits without exposing
private fields.

## Storage

Private data keeps its existing owner partition. Public records live outside
that partition and are addressed only by the opaque share ID.

For DynamoDB:

```text
PK = PUBLIC_PLAN#{share_id}
SK = PUBLIC_PLAN#{share_id}
entity = public_plan
data = sanitized JSON projection
```

For PostgreSQL/SQLite, a `public_plans` table stores `share_id`, owner ID,
private plan ID, sanitized JSON, and publication timestamps. The owner/plan
columns support republishing and revocation but are never returned publicly.

## Frontend behavior

The owner plan page provides a Publish/Share control with:

- Publish plan.
- Copy public link.
- Open public preview.
- Unpublish.

Public pages load through a separate API and do not insert data into the
authenticated plan Redux collection. The public UI reuses visual styles where
safe but has no mutation controls, drag/drop, progress indicators, playback
persistence, source feeds, AI actions, or JSON editing.

## Security requirements

- Authorization is enforced by backend route separation, not hidden buttons.
- The public gateway accepts only the explicit `/public-api/plans/*` read path.
- Share IDs are cryptographically random and do not contain user/plan IDs.
- Public responses are produced only by the sanitizer.
- Public requests are rate-limited independently of authenticated user limits.
- Unpublish deletes the public lookup/projection.
- Cache headers use a short public TTL and must not cache private API responses.

## Delivery plan

1. Add plan publication fields and public-projection persistence for every
   supported storage backend.
2. Add sanitizer, owner publish/unpublish endpoints, and public GET endpoint.
3. Add narrowly scoped unauthenticated gateway forwarding.
4. Add public API client, routes, and read-only plan/course pages.
5. Add owner publication/share controls.
6. Test tenant isolation, field redaction, revocation, read-only UI behavior,
   routing, and responsive layouts.

## Acceptance criteria

- A signed-in owner can publish a plan and copy its public URL.
- A signed-out visitor can open the URL and browse every course/module/video.
- No public response contains progress or private source/integration data.
- Public browsing performs no mutation or progress API calls.
- Private and unpublished plan IDs cannot be read anonymously.
- Unpublishing invalidates the share URL.
- Existing authenticated editing and Learning Notes behavior remain unchanged.
