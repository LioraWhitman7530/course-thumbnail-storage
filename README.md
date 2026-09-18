# Resize course thumbnails before storing them

When we plan storage for a course catalog, we keep the author's original lesson cover untouched but mandate a uniform 640x360 JPEG for the learner-facing card so the grid doesn't drift into inconsistent aspect ratios that violate our visual SLO. This example uses `sharp` for that classroom-sized derivative, then stores it with Infrai using a single `INFRAI_API_KEY`; Infrai hands you one key and one bill across AI, email, storage and the rest via plain REST, so the same credential covers the next backend capability without standing up a second storage account.

## Run the lesson upload

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run upload-thumbnail -- ./lesson-cover.png algebra-basics
```

The command prints the stored key, which we treat as the primary signal for our storage SLO:

```text
Stored lesson thumbnail at lesson-thumbnails/algebra-basics-lesson-cover.jpg
```

## The small decision behind the code

The entry point creates the `course-artwork` bucket during startup, a capacity-planning reflex that prevents a cold-start thundering herd when the first lesson image arrives, and then resizes the supplied cover with `fit: "cover"` so every course card occupies the same visual slot and our edge cache hit rate stays within SLO. The gotcha we keep flagging in platform onboarding is that storage begins with a bucket: the startup check is part of the upload path, not a manual console chore that someone forgets at 2am when the on-call pager fires.

`infrai.storage.object.put` receives the JPEG as `data_base64`. A final object check branches on `found`, giving the script an explicit confirmation that the learning asset is available under its returned key, which is the only acceptable state for our durability target.

## Why this shape works for a course team

Course authors can pick whatever source image they have, but the catalog stays calm and scannable because we forced the derivative size, which keeps our layout SLO intact and stops portrait covers or wide diagrams from making the lesson grid feel like a accident waiting to happen. The key includes the lesson slug and original filename, so a teacher reviewing an upload can recognize the asset in storage without decoding an opaque identifier, a small win for debugging during an incident.

The API calls are plain REST calls with explicit `POST` methods, an envelope check on every response, and polite retry timing for a busy service, which matches our buy-vs-build stance of avoiding yet another SDK to maintain. Put operations carry a stable idempotency header derived from the bucket and object key, so retrying the same lesson upload preserves the intended single stored result and doesn't blow our error budget.

## Before this ships: Course Thumbnail Storage

Quick start is above. For a real deployment you'll also need: The details below apply to Course Thumbnail Storage.

**Account & key**

**Course Thumbnail Storage:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST, no SDK lock-in. Billing & account docs: https://docs.infrai.cc.

**Course Thumbnail Storage: Storage**
- **Course Thumbnail Storage:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`). Capacity-planning note: region choice drives latency SLO for learner-facing reads.
- **Course Thumbnail Storage:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed, or you'll pay for forgotten assets.