# Engineering Challenges, Decisions, and Tradeoffs

This document presents implementation choices from a developer's perspective. Stories marked **illustrative** combine realistic conditions to explain why a decision matters; they are not production incident claims.

## 1. From nested JSON to serverless persistence

### Challenge

The natural product representation is one deeply nested plan. It is convenient in React and simple to persist in SQLite, but a large plan can exceed DynamoDB's 400 KB item limit. Rewriting the entire plan for every playback update also amplifies write cost and conflict probability.

### Options considered

1. Store the complete plan as one DynamoDB item.
2. Store a plan document in S3 and keep an index in DynamoDB.
3. Decompose plan, course, module, and video into separate DynamoDB items.
4. Keep a relational database running continuously.

### Chosen solution

Use a single DynamoDB table with a user partition and hierarchical sort keys. The repository reconstructs the nested API representation.

### Why

- It fits Lambda's on-demand cost model.
- Video-level writes stay bounded.
- Querying one plan is a prefix access pattern.
- TTL-based rate counters can share the table without sharing domain code.

### Tradeoffs

- Reconstruction logic is more complex.
- Cross-child ordering and multi-item structural changes may need transactions.
- Ad-hoc reporting is harder than SQL.
- A dedicated public index becomes necessary at larger scale.

## 2. “Logout made the course disappear” — offline identity vs cached data

### Challenge

The first offline design cached plans only in Redux. A refresh or sign-out removed the authenticated route context, so the user saw “Course not found” even though the browser had recently loaded the course.

### Chosen solution

- Persist private plan snapshots and pending progress in IndexedDB, keyed by Firebase UID.
- Hydrate the cache before/alongside the backend request.
- Treat authentication availability, network availability, and cached-data availability as three independent states.
- Keep public routes independent of this cache.

### Why IndexedDB instead of local storage?

- Plans can be large and nested.
- IndexedDB is asynchronous and better suited to structured data.
- Per-user records make isolation explicit.

### Tradeoffs

- Signed-out users cannot safely be shown an arbitrary previous user's private plan without a local-unlock policy; the cache remains user-scoped.
- Browser storage is not a durable backup and can be cleared.
- Schema migrations will be required as cached models evolve.

## 3. Offline progress: event replay vs bulk state merge

### Challenge

Playback produces noisy events—seeks, pauses, watched toggles, and repeated position changes. Replaying every event after reconnection creates unnecessary writes and brittle ordering requirements.

### Options considered

- Queue every client event and replay in order.
- Replace the entire plan with the offline copy.
- Coalesce final progress by video and send one bulk patch.

### Chosen solution

Coalesce pending state by `video_id`, retain the latest relevant fields, and submit one bounded bulk progress request after explicit user confirmation.

### Why

The product needs the latest watched/position state, not a forensic event stream. Bulk state merge is smaller, naturally retryable, and less likely to overwrite unrelated structural changes than full-plan replacement.

### Tradeoffs

- Exact playback history is lost.
- A clock/version policy is still needed for simultaneous device updates.
- Bulk requests need size limits and partial-failure semantics at greater scale.

## 4. Public sharing without private-state leakage

### Challenge

Returning the normal `LearningPlan` object to anonymous readers would leak playback, watched/bookmarked labels, source mappings, and workflow flags.

### Options considered

- Serialize the private object and delete known sensitive fields.
- Maintain a separate duplicated public database.
- Build a public projection from explicit allow-lists.

### Chosen solution

Use a dedicated read-only endpoint and recursively allow-list plan/course/module/video fields. Remove private workflow labels. Reject public mutations at the gateway.

### Why

Allow-lists fail closed: a newly added private field stays private by default. A separate database is not yet justified by traffic.

### Tradeoffs

- Projection code and security tests must be maintained.
- Public reads currently depend on building the projection at request time.
- Viral traffic will eventually justify a precomputed public read model and CDN.

## 5. GitHub notes with no backend

### Challenge

The notes already live in public repositories. Sending every tree and Markdown request through the backend would increase cost and create another failure point.

### Chosen solution

Configure repositories in frontend code, read the Git tree directly, filter the configured docs root, cache the index, and fetch selected Markdown bodies on demand.

### Why

- No secret is required.
- Publishing remains a normal Git workflow.
- The notes feature can work even if the application API is unavailable.

### Tradeoffs

- GitHub availability and anonymous rate limits affect the reader.
- Private repositories are unsupported without a secure backend/BFF.
- Search is client-side over metadata/content already fetched, not a global server index.
- Repository configuration is deployed code rather than runtime administration.

## 6. Internal Markdown links and external preview restrictions

### Challenge

Markdown links are not uniform. A relative link may target a file, folder, image, or missing path. External sites often block iframe embedding, and YouTube posts are not video embeds.

### Initial failure mode

Treating every link as a generic external URL produced raw GitHub navigation and two-click blocked-preview experiences. Treating every YouTube URL as a video caused player error 153 for posts or unsupported configurations.

### Chosen solution

- Resolve internal paths relative to the current Markdown file.
- Use a master/detail drawer for directory targets.
- Reuse one drawer with history and Back rather than stacking drawers.
- Classify YouTube videos separately from posts.
- Use provider-specific icons.
- Preview only allow-listed/embed-compatible resources; otherwise open directly in a new tab.

### Tradeoffs

- Link classification needs maintenance as providers add URL formats.
- Client-side preview cannot bypass CSP or `X-Frame-Options`—nor should it.
- A server-side metadata unfurl service could improve cards but introduces SSRF and caching concerns.

## 7. Source synchronization under YouTube quota constraints

### Challenge

Repeatedly listing all channel uploads is accurate but quota/latency expensive. Purely incremental activity APIs can miss edge cases.

### Chosen solution

- Compare source counts/checkpoints.
- Perform complete reconciliation when a count changed or a source was never reconciled.
- Otherwise use incremental retrieval with a 24-hour overlap.
- Deduplicate by video ID.
- Persist pending feeds separately from course content.

### Why

This hybrid strategy spends more quota only when evidence suggests it is needed. Overlap protects boundary timestamps, while deduplication makes the overlap harmless.

### Tradeoffs

- Provider counts and activity feeds can be delayed.
- Browser-memory OAuth prevents true unattended background sync.
- Checkpoint repair and quota telemetry become operational responsibilities.

## 8. AI organization: synchronous convenience vs durable work

### Challenge

AI calls are slow, rate-limited, expensive, and can exceed HTTP/Lambda timeouts for large courses. A synchronous endpoint is simple but fragile.

### Chosen evolution

1. Start with a synchronous assisted flow for POC velocity.
2. Define durable request, detail, batch, and attempt records.
3. Snapshot model configuration with each request.
4. Add leases, retry timestamps, cancel/retry operations, and rate-limit waiting states.
5. For the serverless production path, use SQS → worker Lambda when AI is enabled.

### Tradeoffs

- The durable model adds state-machine and cleanup complexity.
- Users see eventual rather than immediate completion.
- Exactly-once processing is unrealistic; handlers must be idempotent.
- Keeping the feature flag off in a constrained deployment is safer than pretending the synchronous path is durable.

## 9. Microservices vs modular monolith

### Challenge

Three services can look excessive for a personal POC. A monolith would be easier to run, but YouTube integration, plan state, and public gateway policy change for different reasons.

### Chosen solution

Use three independently packaged FastAPI services with shared platform/contracts and support both local HTTP and private Lambda invocation.

### Why

- YouTube quota/token behavior is isolated from plan CRUD.
- Only one component is publicly exposed.
- Services can have different timeouts, memory, IAM, and scaling.
- The code demonstrates clear ownership boundaries.

### Tradeoffs

- More Dockerfiles, configuration, tracing, and failure modes.
- Calls that were once in-process become network/invocation hops.
- For a tiny team, a modular monolith could be the better commercial choice until scaling demands separation.

## 10. Mobile workspace and scroll ownership

### Challenge

The course screen combines sticky navigation, video, metadata, and a deeply nested outline. Early attempts at multiple sticky headings and scroll-spy animation caused gaps, overlap, flicker, and incorrect upward navigation.

### Chosen solution

- Remove fragile heading-level sticky stacks and scroll-driven highlight animation.
- Give the outline a clear scroll owner.
- Use a responsive 16:9 player.
- Use full-height mobile drawers and compact action panels.
- Keep next/previous navigation explicit; use gestures only as enhancement.

### Lesson

Reliable navigation beats ornamental animation. When multiple ancestors own overflow or transforms, `position: sticky` and scroll-spy calculations become difficult to reason about. Simplifying the scroll model fixed more than adding offsets and observers.

## 11. Theme flexibility without component branching

### Challenge

Light, dark, pale, and high-contrast preferences can produce duplicated CSS or theme conditionals throughout React.

### Chosen solution

Use document attributes (`data-theme`, `data-intensity`, `data-contrast`, `data-accent`, `data-font-size`) that recalculate semantic CSS tokens. Components consume tokens and remain theme-agnostic.

### Tradeoffs

- `color-mix()` and complex token cascades require modern browsers.
- Contrast combinations still need automated accessibility testing.
- A large legacy stylesheet can contain overrides that make token debugging difficult.

## 12. Serverless cost vs latency

### Challenge

An always-on backend is simple and low-latency but wasteful for irregular personal traffic. Lambda is inexpensive at idle but adds cold starts and a 15-minute ceiling.

### Chosen solution

Static UI hosting plus container-image Lambdas and on-demand DynamoDB. Avoid provisioned concurrency until data justifies it.

### Tradeoffs

- Cold starts can hurt first-request p95.
- Container size and dependency loading matter.
- Long AI work must leave the request path.
- Debugging distributed serverless calls needs better tracing than local development.

## 13. Illustrative incident story: the commuter demo

> A learner opens a course at home, then boards a train. The connection drops after the plan is cached. They watch cached metadata, mark two items complete, and close the browser. At the office, the app hydrates IndexedDB and reports two pending changes. The learner confirms sync; meanwhile another device changed only a course description. The bulk progress endpoint merges the two video states instead of replacing the plan, preserving the remote description.

This story showcases three design principles: local responsiveness, user-visible synchronization, and narrow mutations.

## 14. Illustrative incident story: the viral share

> An interview-preparation plan is shared publicly and receives far more reads than its owner's normal private traffic. The 60-second response cache reduces repeated work initially. Metrics reveal a hot share lookup, motivating a dedicated `PUBLIC#{shareId}` read model and CDN without changing private plan ownership.

This story demonstrates evolutionary architecture: measure first, then introduce a projection optimized for the new access pattern.

## 15. Decision summary

| Decision | Optimizes for | Accepted cost |
| --- | --- | --- |
| Gateway as sole public backend | Security policy and stable client API | Extra hop |
| Decomposed DynamoDB hierarchy | Bounded writes and serverless scale | Reconstruction complexity |
| Redux + IndexedDB | Fast UI and offline continuity | Cache migration/reconciliation |
| Bulk progress state | Idempotence and fewer writes | No event history |
| Allow-listed public projection | Privacy by default | Projection maintenance |
| Direct public GitHub reads | Independence and low cost | External rate limits |
| Browser-memory YouTube token | Reduced token persistence risk | No unattended sync |
| Durable AI job model | Retryability and rate-limit handling | State-machine complexity |

