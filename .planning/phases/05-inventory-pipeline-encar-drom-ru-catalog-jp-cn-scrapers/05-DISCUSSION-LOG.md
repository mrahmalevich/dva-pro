# Phase 5: Inventory Pipeline (Encar + drom.ru/catalog + JP/CN scrapers) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 5-inventory-pipeline-encar-drom-ru-catalog-jp-cn-scrapers
**Areas discussed:** Proxy budget + paid-API fallback, drom.ru/catalog access route, Ship-order fallback if Encar stalls, Block-detect response + moderation gate

---

## Area Selection (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Proxy budget + paid-API fallback | Monthly $ ceiling for KR+CN residential proxies + Carapis fallback tolerance | ✓ |
| drom.ru/catalog access route | Partner API vs public-catalog scraper | ✓ |
| Ship-order fallback if Encar stalls | Binding rule for what's cut if Encar fingerprinting eats >3 days | ✓ |
| Block-detect response + moderation gate | Block-detect halt policy + auto-publish vs review queue | ✓ |

**User's choice:** All four areas selected.

---

## Proxy budget + paid-API fallback

### Q1: Monthly $ ceiling for KR+CN residential proxy spend in v1?

| Option | Description | Selected |
|--------|-------------|----------|
| Up to $300/mo combined | Realistic v1: Bright Data / Smartproxy residential at typical Encar 6h + CN daily cadence, ~12-20 GB traffic. Crawlee fingerprint headroom on Cloudflare-protected pages. | ✓ |
| Up to $100/mo combined | Lean tier (Decodo/Smartproxy budget). Tight for Encar Cloudflare bypass. | |
| Up to $600/mo if it removes fingerprint risk | Premium tier. Buys margin even when Encar tightens detection. | |
| Researcher recommends, founder approves before spend | No hard ceiling now; researcher returns priced tiers; founder picks at planning hand-off. | |

**User's choice:** Up to $300/mo combined.

### Q2: Stance on Carapis (paid Encar API) as fallback?

| Option | Description | Selected |
|--------|-------------|----------|
| Backup-only, flip if >3 days stuck | Build self-hosted Crawlee+Playwright first; auto-flip without further approval if blocked >3 calendar days. | ✓ |
| Carapis from day 1 for Encar | Skip self-hosted Encar; permanent vendor dependency. | |
| Hard no — no paid feeds | Self-hosted only; ship without KR live inventory if blocked. | |
| Try self-hosted, decide threshold during exec | No pre-set day count; founder decides live. | |

**User's choice:** Backup-only, flip if >3 days stuck.

### Q3: BeForward (JP) proxy posture?

| Option | Description | Selected |
|--------|-------------|----------|
| RU datacenter + 1 req/3-5s rate-limit | BeForward's anti-bot is mild; runs from same Yandex Compute VM as worker; saves $50-100/mo. | ✓ |
| JP residential proxy from day 1 | Adds $50-100/mo; lower block-risk but probably overspend. | |
| Reuse KR/CN proxy pool's JP IPs | If chosen vendor has JP IPs in same plan, no extra budget line. | |

**User's choice:** RU datacenter + 1 req/3-5s rate-limit.

### Q4: Single-vendor vs best-of-breed within $300 ceiling?

| Option | Description | Selected |
|--------|-------------|----------|
| Single-vendor preferred, pay up to 15% premium | One bill, one dashboard, one auth. Acceptable up to ~$345/mo. | ✓ |
| Best-of-breed per region, no premium | Cheapest reliable per region; doubles vendor management. | |
| Researcher decides on tradeoff merits | No founder preference; researcher picks. | |

**User's choice:** Single-vendor preferred, pay up to 15% premium.

---

## drom.ru/catalog access route

### Q1: Default access path — partner API or public-catalog scraper?

| Option | Description | Selected |
|--------|-------------|----------|
| Research first, decide on outcome | Researcher checks `baza.drom.ru/help/API` ToS + fees + onboarding. Use partner API if reachable in <1wk and <$100/mo; else polite scrape. | ✓ |
| Polite scrape, no partner API | Cheerio + 1 req/10-15s + robots.txt + Crawl-delay. Legally fuzzy in RU. | |
| Partner API only, even if delayed | Block on partner agreement; cleanest legally; may eat 1-2 weeks. | |
| Skip drom entirely in v1 | Master-models DB admin-curated only; significant content burden. | |

**User's choice:** Research first, decide on outcome.

### Q2: Scope of master-models pull from drom in v1?

| Option | Description | Selected |
|--------|-------------|----------|
| Founder-curated whitelist (~30-50 brands) | Founders pre-list popular brands; fast ingest, focused matcher fallback. | |
| Comprehensive — entire drom catalog | All brands × generations; future-proof; 1-2 week initial backfill. | ✓ |
| On-demand expansion | Small seed + admin-trigger 'pull model X'; lazy load; adds Phase 6 UI. | |
| Hand-maintained CSV in repo, no scraper | Skip drom; ~150 models manually; zero risk; founder maintenance burden. | |

**User's choice:** Comprehensive — entire drom catalog.

### Q3: Post-backfill refresh cadence?

| Option | Description | Selected |
|--------|-------------|----------|
| Monthly full re-scrape | Models data changes slowly; 1-2 days scrape per cycle. | ✓ |
| Weekly full re-scrape per roadmap | Matches SCRAPE-05 wording; ~80% scrapes see no change; wastes bandwidth. | |
| Quarterly + on-demand admin button | Lowest load; freshness suffers for long-tail. | |
| One-time backfill, no recurring scrape | Admin maintains via Phase 6 UI; max maintenance burden. | |

**User's choice:** Monthly full re-scrape.

### Q4: Cyrillic↔Latin brand/model lookup table seed strategy (SCRAPE-10)?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-build from drom + admin override | drom exposes both forms; populate `brand_aliases` table; Phase 6 admin overrides. | ✓ |
| Founder-curated manually upfront | ~50-100 entry seed file; doesn't scale to long-tail. | |
| Auto-build + Phase 6 admin review queue | Auto entries enter `needs_review=true`; safer but blocks matcher quality. | |
| Researcher decides | No founder constraint. | |

**User's choice:** Auto-build from drom + admin override.

---

## Ship-order fallback if Encar stalls

### Q1: Binding build order for Phase 5 sources?

| Option | Description | Selected |
|--------|-------------|----------|
| drom → Encar → BeForward → Che168 → Autohome | Front-loads safest source + matcher fallback DB; CN scrapers last. | ✓ |
| Encar → drom → BeForward → Che168 → Autohome | Roadmap order; stress-tests shared plumbing on Encar first. | |
| Parallel — Encar + drom + BeForward simultaneously | Three parallel streams; needs second dev pair. | |
| drom + BeForward first, Encar+CN later | Ship safest two first; sacrifices KR live inventory if Encar slips. | |

**User's choice:** drom → Encar → BeForward → Che168 → Autohome.

### Q2: Minimum acceptable scraper state at soft-launch (~Jun 7)?

| Option | Description | Selected |
|--------|-------------|----------|
| drom + Encar + BeForward live; CN deferred to v1.x | 3 sources live; CN markets render 'coming soon'. | |
| drom + Encar minimum; BeForward+CN to v1.x if needed | KR live; JP/CN under-order. | |
| drom only; all live scrapers can ship in v1.x | Master-models DB only; admin-curated cars cover catalog floor. | ✓ |
| All 5 sources required | No deferral; risks pushing soft-launch past Jun 7. | |

**User's choice:** drom only; all live scrapers can ship in v1.x. **Significant — reclassifies SCRAPE-01..04 as best-effort.**

### Q3: Trigger for deferring a live scraper from v1 to v1.x?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard cutoff: end of week 5 (May 31) | Predictable; week 6 reserved for P7+P8. | ✓ |
| Per-source: 5 dev-days budget each | Encar consumes most; CN barely touched. | |
| Continuous: stop when launch checklist needs P5 done | Most flexible; ambiguous 'done'. | |
| Only defer after explicit founder sign-off | High visibility; slow loop. | |

**User's choice:** Hard cutoff: end of week 5 (May 31).

### Q4: v1-blocking scope for shared scraper infrastructure?

| Option | Description | Selected |
|--------|-------------|----------|
| Full plumbing + drom + Encar drop-in proven | Shared abstractions stress-tested by Encar. | |
| Full plumbing + drom only | Shared abstractions + drom; v1.x team builds Encar fresh. | ✓ |
| Plumbing + drom + at least 1 source proven | Executor picks easiest live source. | |
| Plumbing + drom + ALL 4 live scrapers scaffolded | Every parser file exists with passing one-shot test. | |

**User's choice:** Full plumbing + drom only.

---

## Block-detect response + moderation gate

### Q1: When a scraper detects a block (5 consecutive thin/empty responses or captcha keywords), what's the response?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-halt + alert founder + 24h cooldown | Pause cron, email founder, mark `last_run_status='blocked'`, auto-resume after 24h with rotated proxy. | ✓ |
| Auto-halt + alert + manual resume only | Pause indefinitely; admin button un-pauses; safest but may go dark for days. | |
| Metric-only, keep running with longer delays | Self-heal if transient; deeper IP ban if not. | |
| Auto-halt + alert + auto-rotate proxy + retry | Try new IP once with double-delay; consumes proxy budget faster. | |

**User's choice:** Auto-halt + alert founder + 24h cooldown.

### Q2: Are scraped cars auto-published, or do they sit in a review queue until admin approves?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-publish; admin hides bad ones reactively | New cars public immediately; `needs_review=true` field for filter only. | ✓ |
| Admin review queue blocks publication | New cars `needs_review=true` AND `is_active=false`; significant founder workload. | |
| Auto-publish, but admin daily-review reminder | Same as auto-publish + Phase 6 'cars added in last 24h' summary. | |
| Auto-publish from drom only; live scrapers gated | Different policy per source; doesn't matter much since live scrapers may all be v1.x. | |

**User's choice:** Auto-publish; admin hides bad ones reactively.

### Q3: Per-source soft-delete window (after how many hours/days unseen)?

| Option | Description | Selected |
|--------|-------------|----------|
| 72h Encar/Che168/Autohome, 7d BeForward, N/A drom | Source-specific; survives 1-2 day outages. | |
| Universal 48h for all live scrapers | Aggressive freshness; one-day failure halves catalog. | |
| Universal 7d | Lenient; stale sold cars linger. | |
| Configurable per-source via Phase 6 SettingsAdmin | Founders dial each source independently; defers tuning post-launch. | ✓ |

**User's choice:** Configurable per-source via Phase 6 SettingsAdmin (with Phase 5 baking in defaults: 72h Encar/Che168/Autohome, 7d BeForward, N/A drom).

### Q4: Image rehost format strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Convert to webp (+ keep size as-is) | Saves ~40% bandwidth; faster mobile UI; smaller PDF embeds. | ✓ |
| Keep original format passthrough | Zero CPU cost; higher bandwidth + bigger PDFs. | |
| Convert + resize to max 1600px wide | webp + cap; loses HiDPI fidelity. | |
| Researcher decides on tradeoffs | Researcher picks based on actual image sizes. | |

**User's choice:** Convert to webp (+ keep size as-is).

---

## Final wrap-up

**Question:** "We've discussed Proxy budget, drom access, Ship-order, and Block-detect. Which gray areas remain unclear?"

**User's choice:** I'm ready for context — proceed to write CONTEXT.md.

---

## Claude's Discretion

Areas explicitly delegated to researcher and planner without founder pre-binding:
- Specific residential proxy vendor selection (within $300 + 15% premium ceiling)
- drom.ru partner API vs scrape final path (within <1wk / <$100/mo rule)
- Worker topology (single worker process running all pg-boss schedulers vs per-source worker container)
- Cron mechanism (pg-boss recurring jobs vs OS cron)
- BeForward HTML parser shape (Cheerio vs minimal Playwright) — research-spike
- CBR FX feed fallback behavior when CBR XML unreachable
- Image storage path layout details under `images/cars/{source}/{source_id}/`

## Deferred Ideas

Ideas considered during discussion but not folded into Phase 5 scope:
- Per-source moderation policy (auto-publish for drom + admin-review for live scrapers) — single auto-publish policy applies to all sources in v1
- Image resize cap (max 1600px width) — v1 keeps original dimensions
- Per-source 5-day budget per scraper (vs single May 31 cutoff) — single calendar cutoff is cleaner
- Founder-curated whitelist for drom (~30-50 brands) — comprehensive scope chosen instead
- Admin review queue gate (`needs_review=true` blocks publication) — auto-publish stands
- JP residential proxy — RU datacenter + rate-limit is sufficient for BeForward
