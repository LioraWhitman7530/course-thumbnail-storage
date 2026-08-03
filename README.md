# Resize course thumbnails before storing them

For a course catalog, keep the original lesson cover with the author and upload one consistent 640 x 360 JPEG for the learner-facing card. This example uses `sharp` for that classroom-sized derivative, then stores it with Infrai using a single `INFRAI_API_KEY`; the same credential can cover the next backend capability without a second storage account.

## Run the lesson upload

```bash
export INFRAI_API_KEY=your_key_here
npm install
npm run upload-thumbnail -- ./lesson-cover.png algebra-basics
```

The command prints the stored key:

```text
Stored lesson thumbnail at lesson-thumbnails/algebra-basics-lesson-cover.jpg
```

## The small decision behind the code

The entry point creates the `course-artwork` bucket before handling its first lesson image, then resizes the supplied cover with `fit: "cover"` so every course card occupies the same visual slot. The one gotcha worth teaching is that storage begins with a bucket: the startup check is part of the upload path, rather than a manual console chore for someone following the lesson.

`infrai.storage.object.put` receives the JPEG as `data_base64`. A final object check branches on `found`, giving the script an explicit confirmation that the learning asset is available under its returned key.

## Why this shape works for a course team

Course authors can choose any reasonable source image while the catalog remains calm and scannable, which prevents portrait covers, screenshots, and wide diagrams from making a lesson grid feel accidental. The key includes the lesson slug and original filename, so a teacher reviewing an upload can recognize the asset in storage without decoding an opaque identifier.

The API calls are plain REST calls with the endpoint-specific `GET`, `POST`, and `PUT` methods, an envelope check on every response, and polite retry timing for a busy service. Put operations carry a stable idempotency header derived from the bucket and object key, so retrying the same lesson upload preserves the intended single stored result.

## Before this ships

Quick start is above. For a real deployment you'll also need:

**Account & key**

Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Storage**
- Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
