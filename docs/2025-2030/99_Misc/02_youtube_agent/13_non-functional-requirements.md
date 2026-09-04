# Non-Functional Requirements

## 1. Assumptions and scale envelope

The current implementation is a personal/small-audience POC. To make the design interview concrete, use the following **illustrative planning envelope**, not as measured production traffic:

| Dimension | POC today | Growth design target |
| --- | ---: | ---: |
| Registered users | Tens | 100,000 |
| Daily active users | Single digits/tens | 10,000 |
| Plans per user | 1–20 | 20 average, 100 maximum |
| Videos per plan | 10–2,000 | 1,000 average, 10,000 maximum |
| Peak API traffic | Low | 300 requests/second |
| Public-read ratio | Variable | 80% reads / 20% writes |
| Progress writes | User-driven | Up to 20 logical events/minute/active learner |

At 10,000 daily users, 20 plans per user, and 1,000 videos per plan, the logical catalog can reach 200 million video references. Most requests remain scoped to one user and one plan, which makes partitioning by user a natural starting point. Very large users and viral public plans require additional read models described in the roadmap.

## 2. Service-level objectives

These are **design targets** to guide decisions and future measurement.

| Quality | Target |
| --- | --- |
| Private API availability | 99.9% monthly |
| Public plan read availability | 99.95% monthly |
| Cached private-plan opening | Under 500 ms on a typical returning device |
| API p95, metadata operations | Under 500 ms excluding cold starts |
| Public summary p95 | Under 300 ms at the gateway/CDN edge after caching |
| Source synchronization | Visible progress; bounded per-source execution |
| AI request acceptance | Under 1 second; generation completes asynchronously |
| Recovery point objective | Under 24 hours initially; under 5 minutes with PITR/event backup |
| Recovery time objective | Under 4 hours initially; under 1 hour for mature production |

## 3. Reliability and data integrity

- A gateway or backend outage must not erase the browser's last cached private plan.
- Progress updates must be idempotent at the logical video level.
- Repeated offline changes for one video should collapse to the latest state.
- Bulk progress updates must be bounded (the current contract allows up to 2,000 videos).
- Source synchronization must deduplicate by stable YouTube `video_id`.
- Public reads must never depend on an authenticated browser session.
- Long-running AI work must survive process restarts when durable job mode is enabled.
- Queue consumers must use leases and retry timestamps to prevent permanent ownership by a failed worker.

### Consistency model

- UI state is immediately consistent inside one Redux session.
- Offline progress is eventually consistent with the backend after user-approved synchronization.
- Plan metadata and structural edits currently use last-write-wins semantics.
- Public reads may be stale for at least the configured HTTP cache period (currently 60 seconds).
- Multi-device structural conflicts are not automatically merged today.

## 4. Performance

- Paginate public plan lists; never return the entire public catalog.
- Cache remote GitHub note indexes in memory and local storage for a bounded interval.
- Fetch note content on demand rather than downloading all Markdown bodies during indexing.
- Avoid auto-expanding every module or note folder.
- Keep the selected video and navigation tree synchronized without reloading the whole plan.
- Decompose DynamoDB records so a small progress mutation does not require rewriting an unbounded 400 KB aggregate item.
- Use lazy/dynamic loading for expensive diagram and visualization libraries as a future bundle optimization.

## 5. Scalability

- Scale the stateless gateway and domain services independently.
- Keep YouTube and Plans services private; expose only the gateway.
- Use DynamoDB partition keys based on verified user identity for private data locality.
- Use separate public-plan summary/detail projections or a dedicated index as public traffic grows.
- Bound per-user and anonymous-client request rates with shared DynamoDB counters and TTL.
- Use queue-based AI workers to absorb bursts and respect provider rate limits.
- Split very large AI inputs into independently retryable batches.

### Hot-partition risk

`USER#{uid}` is effective for normal private workloads, but a single power user can create a hot partition. A viral public plan can also concentrate reads if public lookup scans or queries owner partitions. At scale, introduce a public-share partition/index and, if needed, shard high-volume child entities by plan or course.

## 6. Security and privacy

### Authentication and authorization

- Verify Firebase ID tokens at the gateway for every protected operation.
- Derive the UID from the verified token; do not accept a client-provided owner ID.
- Public endpoints are read-only and explicitly allow only GET, HEAD, and OPTIONS.
- Forward identity to private Lambda services through the trusted invocation envelope, not arbitrary browser headers.
- Use least-privilege IAM: gateway invokes private services; Plans owns application data; YouTube owns provider access.

### Token handling

- Keep Firebase session handling in the Firebase SDK.
- Keep YouTube access tokens in JavaScript memory only.
- Do not persist authorization headers, Firebase ID tokens, or YouTube tokens in Redux, IndexedDB, local storage, logs, or DynamoDB.
- Store server-side secrets in SSM `SecureString` parameters with narrowly scoped KMS/IAM access.

### Public-data minimization

- Build public plan responses through field allow-lists.
- Remove workflow labels such as `watched`, `bookmarked`, `mark_for_delete`, and `refresh_needed`.
- Exclude playback position, source channels, pending feeds, and ownership data.
- Treat public projection tests as security regression tests, not merely serialization tests.

### Content safety

- Sanitize rendered Markdown/HTML and use an explicit iframe allow-list.
- Do not assume arbitrary websites permit embedding; honor browser CSP and `X-Frame-Options` behavior.
- Open blocked external resources directly in a new tab with safe `rel` attributes.
- Never place GitHub tokens in frontend repository configuration.

## 7. Maintainability

- Enforce dependency direction: a service may import shared contracts/platform code but not another service's application package.
- Keep domain logic separate from FastAPI routes and persistence adapters.
- Keep frontend remote calls in an API client and shared state in Redux slices.
- Preserve feature-specific docs and link them from the system-design overview.
- Use infrastructure as code for reproducible AWS environments.
- Retain local SQLite/HTTP modes for fast development while production uses Lambda/DynamoDB.

## 8. Observability

Current infrastructure supports CloudWatch logs and optional X-Ray. A production-ready target should add:

- A request/correlation ID propagated gateway → service → datastore/provider.
- Structured logs without tokens or full sensitive payloads.
- Metrics for latency, status code, throttling, cold starts, DynamoDB capacity, source-sync yield, and AI job age.
- Alarms on elevated 5xx, public-read failures, queue age, dead-letter messages, and authentication anomalies.
- Business metrics such as plans published, videos completed, sync acceptance rate, and proposal corrections.

## 9. Accessibility and responsive quality

- All primary actions remain keyboard reachable and semantically labelled.
- Visible focus indicators must survive every theme and high-contrast mode.
- New animation must respect `prefers-reduced-motion`.
- Mobile touch targets should be at least 44 × 44 CSS pixels where the control is not part of a dense desktop-only rail.
- The application must avoid page-level horizontal overflow at common phone widths.
- Text inputs on iOS should use a computed font size of at least 16 px to prevent focus zoom.
- Video frames retain a 16:9 ratio and the outline owns its own scroll area where appropriate.

## 10. Cost efficiency

- Static UI hosting avoids always-on compute.
- Lambda and on-demand DynamoDB align cost with low/irregular POC traffic.
- Reserved concurrency provides a safety ceiling.
- Avoid provisioned concurrency until cold-start data proves it necessary.
- YouTube API quota and AI tokens are scarcer resources than ordinary plan reads; incremental fetches, batching, and explicit confirmation protect both cost and quota.

## 11. Testability

- Unit-test domain operations and public projections.
- Contract-test gateway routing and service boundaries.
- Repository-test DynamoDB key construction and aggregate reconstruction.
- Integration-test authenticated and anonymous route behavior.
- Browser-test offline hydration, pending-progress recovery, public read mode, Markdown navigation, Mermaid, and responsive workspaces.
- Load-test public listing/detail separately from private mutation traffic.

