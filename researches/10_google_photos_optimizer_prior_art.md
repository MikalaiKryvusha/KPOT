# Research 10 — Prior art: a Google Photos optimizer (download → re-encode → re-upload → delete)

> **Type:** prior-art review (`AGENT_GUIDE.md` checklist step 9a). Required before the epic in
> `ideas/03_Google_Photos_Optimizer.md`. The epic crosses every threshold in `researches/README.md`:
> a new subsystem, new dependencies (a browser driver, a video encoder), and a **change to the product
> promise**, because KPOT would delete files from a store it cannot roll back.
> **Status:** written 2026-09-27. It is a decision document. It closes no fork. The forks are in §8.
> **Sourcing rule:** every factual claim carries a link that was opened in this session on
> 2026-09-27, written as "(opened 2026-09-27)". Anything I could not confirm from a source is in §7
> (to measure) or §9 (not opened). I state nothing from memory as fact.
> **Staleness:** Google changes these policies often. Facts marked **[volatile]** come from Google
> pages and may already be out of date. Each one shows the page's own last-updated date where the
> page shows one. **One fact has already moved:** the idea file and the brief both assume a
> 60-day trash. Since 2026-09-04 the trash keeps items for **30 days** (§2c).

---

## 0. The fifteen decision-relevant findings

1. **The official API cannot do this job.** Since 2025-03-31 a third-party app can list and read
   only the media it created itself. The Library API also has **no delete method at all** (§2a).
2. **The Picker API does not give originals.** For images, `=d` strips location. For videos, `=dv`
   returns "a high quality, **transcoded** version". Re-encoding that copy compounds the loss.
   A session is also capped at 2000 items that the user picks by hand (§2a).
3. **Only two routes give originals:** Google Takeout (bulk, with a known JSON sidecar mess) and the
   web UI (§2a).
4. **Automating the web UI conflicts with Google's own terms, read literally.** The ToS forbid
   "automated means to access content … in violation of the machine-readable instructions on our web
   pages (for example, robots.txt …)". `photos.google.com/robots.txt` disallows `/photo/`, `/albums`,
   `/search/`, `/archive` and `/trash`. These are the exact paths this feature would drive. This is a
   plain reading, not legal advice (§2a).
5. **Login is hostile to automation.** Google blocks sign-in from browsers "controlled through
   software automation". Since Chrome 136 you cannot automate the user's real default profile, and
   Playwright says so as well (§2a).
6. **A near-identical open-source tool already exists** (`google-photos-shrink`, MIT). It uses
   Takeout for download, the official API for upload, and a reverse-engineered web client with the
   user's cookies for delete and date restore. It refuses shared items and quota-free items, and it
   deletes nothing until the replacement is proven (§2a, §4).
7. **Every re-upload is a new item.** Face groups, shared-album comments and likes, and existing
   share links are lost with no way back. Albums, favorites, archive state and captions must be
   restored by the tool or they are lost too. Date and location edits made in Google Photos are
   **not in the file**, so a naive re-upload reverts them (§2b).
8. **Some items cost the owner nothing today.** Storage-saver items from before 2021-06-01, some
   Pixel uploads, and partner-shared saves all fall in this group. Re-uploading any of them makes it
   **start counting**, so the optimizer must skip them or it will *increase* usage (§2c).
9. **Deleting frees nothing at once.** Items sit in the trash for 30 days [volatile]. Practitioners
   report that space is freed only after the trash is emptied, and Google says the storage figures
   take 48–72 h to update (§2c).
10. **Google Photos accepts WebP, AVIF and HEIC photos, and MOV/MP4/MKV video** [volatile]. JPEG XL is
    not on the list. Original quality is stored "with no change to their quality" (§2d).
11. **WebP q90 is a weak choice for camera photos.** Lossy WebP forces 4:2:0 chroma and 8 bits, and a
    Cloudinary study says it "simply cannot reach" visually lossless quality. Re-encoding also
    destroys embedded extras: Motion Photo video, Ultra HDR gain maps and C2PA signatures (§2e).
12. **The owner's video rules need rework** (§2f):
    - **Bitrate ladder:** HandBrake says "always use constant quality". Tdarr's field heuristic
      halves the bitrate, not −20%.
    - **fps cap at 30:** this would destroy slow-motion and 60 fps clips.
    - **Audio:** re-encoding it is avoidable loss; copying the stream is the norm.
    - **HDR:** iPhone HDR is Dolby Vision 8.4 / HLG / 10-bit, and naive scripts "silently flatten" it.
13. **The owner's "<20% smaller → keep original" rule has field precedent** (ab-av1's
    `--max-encoded-percent`; Tdarr issue #201, where encodes came out *bigger*). But it needs a
    **quality floor** beside it (VMAF / SSIMULACRA2). Also, Google Photos **cannot rename** an item,
    so "rename the original" is not possible in the cloud (§2g).
14. **This machine can measure everything locally.** It has ffmpeg 8.1.1 (a GPL build with libx265,
    SVT-AV1, libvmaf, NVENC on an RTX 5070 Ti) and ImageMagick with AVIF/JXL/WebP write. It **cannot
    write HEIC** (ImageMagick has HEIC read-only, and ffmpeg has no HEIF muxer). Neither **exiftool**
    nor **Playwright** is installed (§1.2).
15. **This feature breaks KPOT's safety promise unless one thing changes.** KPOT's rollback cannot
    restore anything in Google's cloud. The one way to keep "never lose a file the owner cannot get
    back" is for the downloaded original to **land in the owner's local KPOT library** before
    anything is deleted in the cloud (§6).

---

## 1. The question, and the constraints it must be answered against

**Question.** Can KPOT safely reduce what a user's Google Photos library costs in storage? The
proposed method is to fetch originals, re-encode them to modern codecs at near-original quality,
put the smaller copies back, and delete the heavy originals. And if the method as the owner
described it is unsafe, unlawful or naive, what does the field do instead?

| Constraint | Source in the repo |
|---|---|
| Windows 11 first; Cyrillic and long paths | `researches/02`, `researches/08` |
| Node ESM, near-zero dependencies (today: `exifreader`, `jpeg-js`), no build step | `package.json`, `AGENT_GUIDE.md` |
| All processing local; the local UI is a `node:http` server with a token and a Host whitelist | `src/ui/server.mjs`, `researches/07` |
| **"without ever risking a file the owner cannot get back"** | `MASTER_PLAN.md` vision line |
| Four guarantees: plan map, backup commit, dry run, post-run report with rollback | `GOAL.md` |
| Non-technical users; bilingual RU/EN UI (`src/ui/i18n.mjs`) | owner decision 2026-07-28 |
| Portable ZIP under the MIT licence, no Node on the target machine | `plans/09_portable_package.md` |

### 1.1 The current UI stack, in one paragraph

`src/ui/server.mjs` is a `node:http` server bound to localhost. It checks a start-up token (the
Jupyter model) and a Host-header whitelist (the Glances advisory lesson). It keeps one instance,
falls back to another port, and pushes events over SSE. `page.mjs` renders one self-contained HTML
page with no framework, and `i18n.mjs` holds the RU/EN strings. `jobs.mjs` runs long jobs by calling
only `src/app/phases.mjs`. A spec enforces the layering rule: the UI calls nothing below `src/app/`,
and `src/apply/` is the only writer. A Google tab would bring in three things this stack has never
held:
- a heavy browser driver (Playwright plus a downloaded browser);
- external GPL-licensed media binaries (ffmpeg, exiftool);
- a **remote writer**: deletions in a store KPOT can neither snapshot nor roll back. The
  "single writer + backup commit" design has nothing to say about that store.

### 1.2 Local probes (read-only, run 2026-09-27 on this machine)

| Tool | Result |
|---|---|
| `ffmpeg -version` | **8.1.1**, `full_build-www.gyan.dev`, `--enable-gpl --enable-version3`. Includes libx265, libsvtav1, libaom, librav1e, **libvmaf**, libjxl, libwebp, libopus, NVENC / AMF / QSV (libvpl) / MediaFoundation / Vulkan / D3D12 encoders |
| `ffprobe -version` | 8.1.1 (same build) |
| ffmpeg HEVC encoders | `libx265`, `hevc_nvenc`, `hevc_amf`, `hevc_qsv`, `hevc_mf`, `hevc_d3d12va`, `hevc_vulkan`, … |
| ffmpeg AV1 encoders | `libsvtav1`, `libaom-av1`, `librav1e`, `av1_nvenc`, `av1_qsv`, `av1_amf`, … |
| ffmpeg image muxers | `avif`, `webp`, `image2`. **No HEIF/HEIC muxer** |
| ffmpeg quality filters | `libvmaf`, `ssim`, `psnr`, `xpsnr`: VMAF can be measured locally |
| ffmpeg options | `-fps_mode` present; `-vsync` "deprecated, use -fps_mode"; `-autorotate` present |
| GPU | NVIDIA GeForce RTX 5070 Ti (plus virtual display adapters) |
| `exiftool -ver` | **NOT FOUND** |
| `magick -version` | ImageMagick **7.1.2-27 Q16-HDRI**; delegates include heic, jxl, webp. `-list format`: **AVIF rw+, HEIC r-- (read-only), HEIF r--, JXL rw+ (libjxl 0.12.0), WEBP rw+ (libwebp 1.6.0)** |
| `npx --no-install playwright --version` | **Not installed.** npx refused because `playwright@1.63.0` is missing. A browser cache exists at `%LOCALAPPDATA%\ms-playwright` (chromium-1181/-1228, firefox, webkit), left over from another project |
| `cjxl`, `djxl`, `cwebp`, `avifenc`, `heif-enc`, `x265`, `mediainfo` | not found on PATH |
| Node | v24.15.0 |

What this means: every *measurement* in §7 can run locally with no install except exiftool. **HEIC
output is not available on this machine** by any installed route.

---

## 2. The established approach, by sub-problem

### 2a. Access to the library

**Official Library API: closed for this use since 2025-03-31 [volatile]**

- Three scopes were removed: `photoslibrary.readonly`, `photoslibrary.sharing`, `photoslibrary`.
  Since then, "You can now only list, search, and retrieve albums and media items that were created
  by your app." Picker API is the replacement for selection
  ([Updates to the Google Photos APIs](https://developers.google.com/photos/support/updates),
  last updated 2025-08-28, opened 2026-09-27).
- The remaining scopes are listed on the
  [authorization scopes page](https://developers.google.com/photos/overview/authorization)
  (last updated 2025-08-28, opened 2026-09-27):
  - `photoslibrary.appendonly`: upload, create albums, and "enrichment additions limited to new
    library content and app-created albums";
  - `…readonly.appcreateddata` and `…edit.appcreateddata`.
- **There is no delete method.** The REST reference lists only these methods: `albums`
  (addEnrichment, batchAddMediaItems, batchRemoveMediaItems, create, get, list, patch) and
  `mediaItems` (batchCreate, batchGet, get, list, patch, search)
  ([Library API reference](https://developers.google.com/photos/library/reference/rest), last updated
  2025-04-01, opened 2026-09-27).
- `batchRemoveMediaItems` removes items from an album, not from the library. It works only when
  "the media items and the album … [were] created by the developer via the API"
  ([method page](https://developers.google.com/photos/library/reference/rest/v1/albums/batchRemoveMediaItems),
  opened 2026-09-27).
- A tool that drives the web UI says the same:
  "The Google Photos Library API has no `mediaItems.delete` endpoint … DOM automation is the only
  practical path" ([shtse8/google-photos-delete-tool](https://github.com/shtse8/google-photos-delete-tool),
  opened 2026-09-27).
- **Uploading through the API still works.** Accepted photo types: "AVIF, BMP, GIF, HEIC, ICO, JPG,
  PNG, TIFF, WEBP, some RAW files", up to 200 MB. Accepted video types: 3GP … MKV, MOV, MP4 …, up
  to 20 GB. "All media items uploaded to Google Photos through the API are stored in full resolution
  at original quality". `batchCreate` takes at most 50 items per call. `description` holds at most
  1000 characters and "should only include meaningful text created by users"
  ([Upload media](https://developers.google.com/photos/library/guides/upload-media), last updated
  2025-10-22, opened 2026-09-27).
- Quotas: Library API 10,000 requests per project per day, and 75,000 media-byte requests per day.
  Picker API 100,000 requests per minute. Going over returns 429
  ([API limits and quotas](https://developers.google.com/photos/overview/api-limits-quotas), last
  updated 2025-11-10, opened 2026-09-27).
- Policy: "Do not request permissions that access broad sections or large portions of user's Photos
  library except for user-initiated export transfers." Also: "Do not make a substitute for Google
  Photos" ([Photos API User Data and Developer Policy](https://developers.google.com/photos/support/api-policy),
  last updated 2025-08-28, opened 2026-09-27).
- An open-source desktop app has a practical OAuth problem. An app that requests sensitive scopes
  without verification shows an "unverified app" screen. It is then capped at "100 new users in
  total", with an exception for apps in development
  ([Unverified apps](https://support.google.com/cloud/answer/7454865?hl=en), opened 2026-09-27).
  Whether `appendonly` counts as sensitive: **not confirmed from a primary page** (§9).

**Picker API: user-selected items, but no original video [volatile]**

- The flow: create a session, send the user to the `pickerUri`, poll, then list the picked items
  ([Get started with the Picker API](https://developers.google.com/photos/picker/guides/get-started-picker),
  last updated 2025-10-06, opened 2026-09-27).
- `maxItemCount`: "If unspecified or set to 0, at most 2000 items can be picked"
  ([sessions reference](https://developers.google.com/photos/picker/reference/rest/v1/sessions),
  last updated 2025-10-06, opened 2026-09-27).
- `=d` keeps "all the Exif metadata **except the location metadata**". `=dv` returns "a high
  quality, **transcoded** version of the original video". Base URLs live for 60 minutes
  ([Picker: media items](https://developers.google.com/photos/picker/guides/media-items), last
  updated 2025-08-28, opened 2026-09-27; the Library API says the same in
  [Access media items](https://developers.google.com/photos/library/guides/access-media-items),
  opened 2026-09-27).
- **Consequence:** the Picker cannot supply the *original* video bytes. Photos come back without GPS.
  So it cannot be the source for a lossless-provenance re-encode.

**Google Takeout: the bulk route to originals**

- Archives come as 2 GB or 50 GB `.zip` or `.tgz` files. An archive "expires in about 7 days". Each
  archive may be downloaded 5 times. Photos exports can be scheduled every two months for a year.
  "Any additional metadata that isn't from the original file, like comments within Google Photos,
  are downloaded to a secondary JSON file"
  ([Google Takeout help](https://support.google.com/accounts/answer/3024190?hl=en), opened 2026-09-27).
- The JSON sidecars hold `title`, `description`, `photoTakenTime`, `geoData`, `geoDataExif`,
  `favorited` and `googlePhotosOrigin`. "descriptions you added are only in the JSON"
  ([metadatafixer: Takeout JSON explained](https://metadatafixer.com/learn/google-takeout-json-files-explained),
  secondary source, opened 2026-09-27).
- The standard post-processor is **gpth** (GooglePhotosTakeoutHelper, Apache-2.0, rewritten in Dart,
  active) ([repo](https://github.com/TheLastGimbus/GooglePhotosTakeoutHelper), opened 2026-09-27).
  Its known pitfalls are in §5.

**The web UI through browser automation: works in practice, conflicts with the terms**

- **ToS** (effective 2026-07-30). Two relevant clauses:
  - It forbids "using automated means to access content from any of our services in violation of
    the machine-readable instructions on our web pages (for example, robots.txt files that disallow
    crawling, training, or other activities)".
  - It allows suspension or termination for material or repeated breach
  ([Google Terms of Service](https://policies.google.com/terms?hl=en), opened 2026-09-27) **[volatile]**.
- **robots.txt of photos.google.com** has `User-agent: *` with `Disallow:` lines for `/photo/`,
  `/albums`, `/album/`, `/archive`, `/search/`, `/trash`, `/settings`, `/shared`, `/people` and more
  ([robots.txt](https://photos.google.com/robots.txt), opened 2026-09-27).
  - Read literally, driving these paths with Playwright is "automated means … in violation of"
    those instructions.
  - One could argue robots.txt governs crawlers, not a user automating their own account.
    **That argument is not ours to settle.** It is a fork for the owner (§8, F2).
- **Sign-in.** Google blocks browsers that "Are being controlled through software automation rather
  than a human" and those "embedded in a different application"
  ([Sign in with a supported browser](https://support.google.com/accounts/answer/7675428?hl=en),
  opened 2026-09-27). Field reports of this block:
  - Playwright [#19420](https://github.com/microsoft/playwright/issues/19420) (2022-12-13, opened
    2026-09-27): "This browser or app may not be secure. Try using a different browser";
  - Playwright [#31212](https://github.com/microsoft/playwright/issues/31212) (2024-06-08, opened
    2026-09-27), with a persistent context;
  - Puppeteer [#4871](https://github.com/puppeteer/puppeteer/issues/4871) (2019, opened 2026-09-27):
    "Couldn't sign you in. For your protection, you can't sign in from this device".
- **The user's real browser profile is off the table.** Since Chrome 136 (announced 2025-03-17),
  `--remote-debugging-port/-pipe` "will no longer function" against the default data directory,
  because infostealers were using it to pull cookies
  ([Chrome for Developers blog](https://developer.chrome.com/blog/remote-debugging-port), opened
  2026-09-27). Playwright: "automating the default Chrome user profile is not supported. Pointing
  `userDataDir` to Chrome's main 'User Data' directory … may result in pages not loading or the
  browser exiting"
  ([Playwright BrowserType docs](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context),
  opened 2026-09-27).
  - The field pattern is a **dedicated profile plus one manual login in a visible window**.
    `gphotosdl -login` "will open a browser window which you should use to login to google photos -
    then close the browser window" ([rclone/gphotosdl](https://github.com/rclone/gphotosdl), opened
    2026-09-27).

**Existing tools and what each documents**

| Tool | Route | What it documents (opened 2026-09-27) |
|---|---|---|
| [gphotos-sync](https://github.com/gilesknap/gphotos-sync) | official API | **Archived** (read-only since 2026-03-17). "Videos are transcoded to lower quality", "Raw or Original photos are converted to 'High Quality'", "GPS info is removed" |
| [rclone googlephotos](https://rclone.org/googlephotos/) (page updated 2026-07-31) | official API | "From March 31, 2025 rclone can only download photos it uploaded". Cannot download original resolution. Strips EXIF location. Videos "really compressed". "Rclone cannot delete files anywhere except under `album`". Offers `--gphotos-proxy` through gphotosdl |
| [gphotosdl](https://github.com/rclone/gphotosdl) | headless browser on the web UI | One image at a time. Limited error handling "may cause indefinite hangs". One profile means one account. "You can't run more than one proxy at once" |
| [gphotos-cdp](https://github.com/perkeep/gphotos-cdp) | Chrome DevTools Protocol | Downloads the main library oldest-first. "does not support the photos moved to Archive, or albums" |
| [Google-Photos-Toolkit](https://github.com/xob0t/Google-Photos-Toolkit) | userscript on the undocumented `batchexecute` web API | Trash, albums, filters "space-consuming media", finds duplicates |
| [google_photos_web_client](https://github.com/xob0t/google_photos_web_client) | Python, reverse-engineered web API | Auth by `cookies.txt` exported from the browser |
| [gpmc](https://github.com/xob0t/gpmc) / [gotohp](https://github.com/xob0t/gotohp) | reverse-engineered **mobile** API | "Unlimited uploads in original quality (can be disabled)", i.e. quota evasion. Hash-based skip of existing files |
| [rephoto](https://github.com/ElDavoo/rephoto) | download + re-upload "without using quota" | Deletes originals **before** re-upload "to avoid hash-deduplication". Restores caption, favorite and archived. **Does not** restore albums or shared-library relations |
| [google-photos-shrink](https://github.com/johnml1135/google-photos-shrink) (MIT, 55 commits) | **Takeout + official API upload + unofficial web client for delete and date restore** | The closest prior art. Detailed in §4 and §5 |
| [shtse8/google-photos-delete-tool](https://github.com/shtse8/google-photos-delete-tool) | DOM automation | Batches up to 500. Treats selector drift as ongoing maintenance: "When Google changes their UI" it ships a data patch |
| [photos-storage-cleaner](https://github.com/xob0t/photos-storage-cleaner) | Selenium + API database | **Archived 2024-07-04**. The author says to use GPTK instead. It "checks if it takes up space or not" per item |
| [gpth](https://github.com/TheLastGimbus/GooglePhotosTakeoutHelper) | Takeout post-processing | JSON mess and dates, see §5 |

### 2b. What a re-upload loses

A re-uploaded file is a **new item**. For each attribute: where it lives, and what happens when the
original is deleted and replaced.

| Attribute | Where it lives | Survives download + re-upload? | Source (opened 2026-09-27) |
|---|---|---|---|
| Face / people grouping | Google's database | **No, and nothing restores the old grouping** (the new item is re-analysed from scratch) | [google-photos-shrink README](https://raw.githubusercontent.com/johnml1135/google-photos-shrink/main/README.md): "face and people groupings, shared album comments and likes, and existing links to items are lost -- no export or API restores them" |
| Shared-album membership, comments, likes | Google's database | **No.** Deleting also removes the item "from Shared albums and conversations you added them to" | [Delete photos & videos](https://support.google.com/photos/answer/6128858?hl=en&co=GENIE.Platform%3DDesktop) |
| Own album membership | Google's database (Takeout folders) | Only if the tool re-adds it. The API can add only to **app-created** albums | [authorization scopes](https://developers.google.com/photos/overview/authorization); [rclone](https://rclone.org/googlephotos/): "Rclone can only upload files to albums it created" |
| Favorite, archived, caption | Google's database (Takeout JSON) | Only if restored. rephoto restores all three through its client. The API `description` field is limited to user text | [rephoto](https://github.com/ElDavoo/rephoto); [Upload media](https://developers.google.com/photos/library/guides/upload-media) |
| **Date/time edited in Google Photos** | **Google's database only** | **No.** "if you share the photo to other apps or download it, the photo may show the original date and time saved by your camera" | [Edit your photos](https://support.google.com/photos/answer/6128850?hl=en&co=GENIE.Platform%3DDesktop); [learngooglephotos](https://learngooglephotos.com/how-to-change-the-date-of-a-picture-using-google-photos/): "this date lives in the Google Photos database, it is not saved to the metadata of the photo itself" |
| **Location edited in Google Photos** | Google's database only | **No.** On download "the original location your device saved shows without any edits you made in Google Photos" | [Understand & edit locations](https://support.google.com/photos/answer/6153599?hl=en&co=GENIE.Platform%3DDesktop) |
| Edits (crop, filters) | Non-destructive; "Revert" restores the initial state | Unknown whether the web "Download" returns the original or the edited render → **measure** (§7) | [Edit your photos](https://support.google.com/photos/answer/6128850?hl=en&co=GENIE.Platform%3DDesktop) |
| Motion Photo (Android) | Inside the file: JPEG/HEIC/AVIF primary plus appended MP4/MOV, located by XMP `Container:Directory` | **Only if the re-encoder rebuilds the container.** The spec warns that XMP may still claim `MotionPhoto=1` "even though the appended video has been stripped" | [Motion Photo format](https://developer.android.com/media/platform/motion-photo-format) |
| Live Photos (iOS) | Google Photos supports them "via Google Photos app on iOS" | Pairing behaviour on web download and re-upload is unknown → **measure** | [File types](https://support.google.com/photos/answer/6193313?hl=en) |
| Ultra HDR photo (Android) | JPEG plus a gain map as an MPF secondary JPEG, with XMP `hdrgm` | Spec is JPEG-only: "The encoded gain map must be stored in a secondary image item as a JPEG". A converter that ignores the gain map drops the HDR rendition (*our inference* from the format definition) | [Ultra HDR format](https://developer.android.com/media/platform/hdr-image-format) |
| C2PA Content Credentials (Pixel 10+) | Inside the JPEG | Google Photos validates and shows them. Whether they stay valid after a third-party re-encode is not addressed. A re-encode changes the bytes, so the credential most likely will not validate (*inference*, to confirm) | [Google blog 2025-09-10](https://blog.google/security/pixel-android-trusted-images-c2pa-content-credentials/) |
| Sort position | By date taken | Correct only if the new file carries the correct capture date (EXIF / QuickTime) | [learngooglephotos](https://learngooglephotos.com/how-to-change-the-date-of-a-picture-using-google-photos/): "your library of pictures is kept in order by date" |
| Share links to the item | Google's database | **No** | google-photos-shrink README (above) |

### 2c. Storage accounting [volatile]

- **Trash is now 30 days.** "Photos and videos that you delete will stay in your trash for 30 days
  before they are permanently deleted"
  ([Delete photos & videos](https://support.google.com/photos/answer/6128858?hl=en&co=GENIE.Platform%3DDesktop);
  also [About your activity & storage](https://support.google.com/photos/answer/10100180?hl=en),
  both opened 2026-09-27). 9to5Google dates the change from 60 to 30 days to **2026-09-04**
  ([9to5Google, 2026-09-08](https://9to5google.com/2026/09/08/google-photos-trash-bin-now-deletes-media-after-30-days-down-from-60-days/),
  opened 2026-09-27).
- **When space is freed.** Google: "After you delete a large number of files, it normally takes up
  to 48–72 hours for Google's systems to accurately update the storage space"
  ([How your Google storage works](https://support.google.com/googleone/answer/9312312?hl=en), opened
  2026-09-27). A practitioner: "Space is not freed until the bin is emptied, and Google's storage
  figures can take hours to catch up"
  ([google-photos-shrink](https://raw.githubusercontent.com/johnml1135/google-photos-shrink/main/README.md),
  opened 2026-09-27). **None of the Google pages I opened says in so many words that trashed items
  count toward quota** → §7.
- **What counts.**
  - Original quality counts, and so does Storage saver after 2021-06-01. "Any photos or videos you
    backed up in High quality, now called Storage saver, before June 1, 2021 don't count"
    ([Backup quality, desktop](https://support.google.com/photos/answer/6220791?hl=en&co=GENIE.Platform%3DDesktop),
    opened 2026-09-27).
  - Pixel 1: unlimited Original. Pixel 2 and 3: Original free up to set dates. Pixel 3a–5:
    Storage saver free and unlimited
    ([Backup quality, Android](https://support.google.com/photos/answer/6220791?hl=en&co=GENIE.Platform%3DAndroid),
    opened 2026-09-27).
  - Also free: "Photos and videos you saved from partner sharing, as long as your partner continues
    to share them" ([Manage your storage](https://support.google.com/photos/answer/9284827?hl=en&co=GENIE.Platform%3DDesktop),
    opened 2026-09-27).
  - **Implication:** re-uploading a free item turns it into a paid one. google-photos-shrink
    refuses "Storage-saver-era free items" and items "Shared into your library by someone else -- it
    costs their storage, not yours".
- **Google's own alternative, "Recover storage".** It lives at photos.google.com → Settings →
  Manage storage → "Convert existing photos & videos to Storage saver".
  - Storage saver: "If a photo is larger than 16 MP, it'll be resized to 16 MP". "Videos higher than
    1080p will be resized to high-definition 1080p".
  - "You can only recover storage once a day".
  - "Some Multi-Picture Format (mpf) .jpgs can't be compressed, for example portraits that you take
    on an Android device"
    ([Backup quality, desktop](https://support.google.com/photos/answer/6220791?hl=en&co=GENIE.Platform%3DDesktop),
    opened 2026-09-27).
  - A practitioner: it is "an 'all or nothing' deal for the items uploaded in Original Quality, and
    it permanently deletes the original files", and the compression "is irreversible"
    ([How-To Geek, 2025-11-02](https://www.howtogeek.com/psa-google-photos-is-lowering-the-quality-of-your-memories/),
    opened 2026-09-27).
  - **Trade-off against the owner's goal.** It fails "keep the original resolution" for anything
    above 16 MP or 1080p. But it converts **in place**, so it plausibly keeps albums, faces and
    comments. That last point is *not stated* by Google → §7.

### 2d. Formats Google Photos accepts [volatile]

- Photos: ".jpg, .heic, .heif, .png, .webp, .gif, .avif, and most RAW files". Videos: ".mpg, .mod,
  .mmv, .tod, .wmv, .asf, .avi, .divx, .mov, .m4v, .3gp, .3g2, .mp4, .m2t, .m2ts, .mts, and .mkv".
  Limits: photos "up to 200 MB or 200 MP", videos "up to 10 GB", items "larger than 256 x 256".
  Supports "10-bit HDR videos", slow-motion, motion photos and live photos
  ([Photo & video file types](https://support.google.com/photos/answer/6193313?hl=en), opened
  2026-09-27).
  - Note: the API upload page says **20 GB** for video. The help page says 10 GB. Treat 10 GB as the
    safe limit.
- **JPEG XL is not on either list.** Chromium restored a JXL decoder (the Rust `jxl-rs`), committed
  by 2026-01-14 ([The Register](https://www.theregister.com/2026/01/14/google_rekindles_relationship_with_jilted/),
  opened 2026-09-27). That is browser support, not Google Photos support. Treat JXL uploads as
  **unsupported** until measured.
- **Codecs are not listed.** The page lists containers only. HEVC works in practice because iPhones
  record it ([Apple: HEIF/HEVC since iOS 11, iPhone 7 and later](https://support.apple.com/en-us/116944),
  published 2025-12-05, opened 2026-09-27) and Google supports 10-bit HDR video. **AV1-in-MP4 and
  Opus-in-MP4 playback are unknown** → §7.
- **No re-encode in Original quality.** "Photos and videos are stored in the same resolution that you
  took them with no change to their quality"
  ([Backup quality](https://support.google.com/photos/answer/6220791?hl=en&co=GENIE.Platform%3DDesktop),
  opened 2026-09-27). Whether web downloads come back **byte-identical** is a claim I found only in
  a search-engine summary of Google issue-tracker threads that I could not open → §7, §9.

### 2e. Photo re-encoding: the field's view

**WebP (the owner's proposal) has hard limits**

- "The maximum pixel dimensions of a WebP image is 16383 x 16383".
- "Lossy WebP works exclusively with an 8-bit Y'CbCr 4:2:0".
- "WebP typically achieves an average of 30% more compression than JPEG"
  ([WebP FAQ](https://developers.google.com/speed/webp/faq), last updated 2026-02-03, opened
  2026-09-27).
- Google's headline figures are "25-34% smaller than comparable JPEG images at equivalent SSIM",
  lossless "26% smaller … compared to PNGs", and transparency "at a cost of just 22% additional
  bytes" ([WebP overview](https://developers.google.com/speed/webp), last updated 2025-08-07,
  opened 2026-09-27).
- Metadata: EXIF, XMP and ICCP travel in RIFF chunks flagged in VP8X
  ([WebP container](https://developers.google.com/speed/webp/docs/riff_container), last updated
  2025-08-07, opened 2026-09-27).

**At archival quality WebP drops out**

In the "Visually Lossless" section (SSIMULACRA2 ≈ 90), Jon Sneyers writes:

> "WebP is not on this chart since it simply cannot reach this quality point, at least not using
> its lossy mode. This is because 4:2:0 chroma subsampling is obligatory in WebP."

At "high quality": "mozjpeg no longer beats WebP, though jpegli still does". JPEG XL is on the
Pareto front at high fidelity. AVIF at its slowest only matches libjxl's second-fastest setting
([Cloudinary, 2024-02-28](https://cloudinary.com/blog/jpeg-xl-and-the-pareto-front), opened
2026-09-27). Earlier comparisons list WebP as lacking "Lossy 4:4:4"
([Cloudinary, 2022-12-14](https://cloudinary.com/blog/contemplating-codec-comparisons), opened
2026-09-27).

**The other candidates**

- **JPEG XL lossless JPEG recompression.** JPEG files can be recompressed to "a JPEG XL file that is
  on average about 20% smaller", and "the bit-exact same JPEG file can be reconstructed"
  ([Cloudinary, 2022-11-02](https://cloudinary.com/blog/the-case-for-jpeg-xl), opened 2026-09-27).
  `cjxl` does this by default for JPEG input, BSD-3
  ([libjxl](https://github.com/libjxl/libjxl), opened 2026-09-27). This is the only *zero-quality-loss,
  reversible* option. **Google Photos does not list JXL**, so it only helps a local archive (see §4-C).
- **jpegli (JPEG → better JPEG).** "a 35% compression ratio improvement at high quality compression
  settings" and full JPEG compatibility, validated by crowdsourced ELO on CID22
  ([Google Open Source blog, 2024-04-03](https://opensource.googleblog.com/2024/04/introducing-jpegli-new-jpeg-coding-library.html),
  opened 2026-09-27). It is still lossy on lossy.
- **AVIF.** Based on HEIF. Supports 8/10/12-bit, 4:4:4, alpha, HDR, and a "Tone Map Derived Image
  Item" for gain maps (spec v1.2.0, 2025-10-16) ([AVIF spec](https://aomediacodec.github.io/av1-avif/),
  opened 2026-09-27). Google Photos accepts it (§2d).
- **HEIC.** ISO/IEC 23008-12. HEVC-coded HEIC carries patent-licensing questions. Windows needs the
  paid "HEVC Video Extensions" ([Wikipedia: HEIF](https://en.wikipedia.org/wiki/High_Efficiency_Image_File_Format),
  opened 2026-09-27). libheif is LGPL. Its HEVC encoders are x265 or kvazaar, and "x265 is GPL"
  ([libheif](https://github.com/strukturag/libheif), opened 2026-09-27). **sharp's prebuilt
  binaries cannot write HEIC**: "Support for patent-encumbered HEIC images using `hevc` compression
  requires the use of a globally-installed libvips compiled with support for libheif, libde265 and
  x265". Its JXL output is "experimental".
- **sharp strips metadata by default.** "By default all metadata will be removed, which includes
  EXIF-based orientation" ([sharp output API](https://sharp.pixelplumbing.com/api-output), opened
  2026-09-27). A naive Node pipeline loses dates and GPS here.

**Measuring "visually lossless"**

- **SSIMULACRA2** scale: 70 = high quality, 80 = very high, 85 = excellent, 90 = "visually lossless"
  (imperceptible in flicker test), 100 = mathematically lossless. Validated on CID22, TID2013,
  KADID-10k and KonFiG-IQA. BSD-3 ([cloudinary/ssimulacra2](https://github.com/cloudinary/ssimulacra2),
  opened 2026-09-27).
- **Butteraugli** targets "barely noticeable differences". The standalone repo was archived
  2023-11-14 ([google/butteraugli](https://github.com/google/butteraugli), opened 2026-09-27).
- **DSSIM**: 0 = identical, AGPL or commercial ([kornelski/dssim](https://github.com/kornelski/dssim),
  opened 2026-09-27). The AGPL matters for bundling.

**Metadata reference tool.** ExifTool is at 13.59 (2026-05-27). It has read/write support for WebP,
HEIC, AVIF, JXL, MP4 and MOV, and a Windows executable package
([exiftool.org](https://exiftool.org/), opened 2026-09-27). **Not installed here.**

**Generational loss.** Every lossy-on-lossy step (JPEG → WebP, AVIF or HEIC) adds a second set of
artifacts. The WebP FAQ itself warns that lossy JPEG → lossy WebP can come out *larger* at high
quality targets ([WebP FAQ](https://developers.google.com/speed/webp/faq), opened 2026-09-27). This
is why the field measures each output against its source (SSIMULACRA2) instead of trusting one
global quality setting.

### 2f. Video re-encoding: the field's view, and the owner's rules against it

**Constant quality versus bitrate targets**

- HandBrake: "Always use constant quality unless you have a specific reason not to"
  ([Adjust quality](https://handbrake.fr/docs/en/latest/workflow/adjust-quality.html), opened
  2026-09-27).
- With average bitrate "you control the size of the output file but give up control over the
  video's quality". If you must use ABR, "use multi-pass encoding"
  ([CQ vs ABR](https://handbrake.fr/docs/en/latest/technical/video-cq-vs-abr.html), opened 2026-09-27).
- HandBrake RF ranges for x264/x265: 18–22 at SD, 19–23 at 720p, 20–24 at 1080p, 22–28 at 2160p.
- **x265** defaults to CRF 28.0 (range 0–51) and preset `medium` (ultrafast … placebo). It has
  `--tune grain`, HDR10 signalling (`--hdr10`, `--master-display`, `--max-cll`), HLG via
  `--transfer arib-std-b67`, `--output-depth 8|10|12`, and `--dolby-vision-profile` /
  `--dolby-vision-rpu` ([x265 CLI docs](https://x265.readthedocs.io/en/master/cli.html), opened
  2026-09-27).
- **Tdarr** (a field tool for bulk library re-encoding) uses a bitrate heuristic, not CRF: "HEVC can
  obtain the same quality at half the bitrate". The default modifier is 0.5×, with min/max
  guardrails. It "will skip files already in HEVC, AV1 & VP9 unless 'reconvert_hevc'", and has a
  separate `hevc_max_bitrate` "to prevent endless re-encoding loops"
  ([Tdarr QSV HEVC plugin](https://docs.tdarr.io/docs/plugins/classic-plugins/index/Tdarr_Plugin_bsh1_Boosh_FFMPEG_QSV_HEVC/),
  opened 2026-09-27). The owner's approach is **not alien to the field**. It is the Tdarr family,
  only with a milder, fixed −20%.
- **Immich** also has policies built on bitrate. "Required" transcodes when the video "is HDR", "is
  not in the yuv420p pixel format", or its codec is not accepted. "Bitrate" also transcodes when
  over `maxBitrate` ([Immich system settings](https://docs.immich.app/administration/system-settings/),
  opened 2026-09-27).
- **VMAF** (Netflix, Emmy-winning, BSD+Patent) is the standard measure. The default model assumes a
  1080p TV at 3H. The FAQ warns against comparing absolute scores across resolutions
  ([Netflix/vmaf](https://github.com/Netflix/vmaf), [FAQ](https://github.com/Netflix/vmaf/blob/master/resource/doc/faq.md),
  opened 2026-09-27). **ab-av1** automates "the best crf to deliver the --min-vmaf" within a
  `--max-encoded-percent`, working on sample encodes. It supports svt-av1, libx265 and libx264, MIT
  ([ab-av1](https://github.com/alexheretic/ab-av1), opened 2026-09-27).
- **NVENC vs x265.** On an RTX 3050 laptop GPU, "VMAF suggests libx265 is still a little bit ahead
  across the board, although the difference narrows at higher bitrates"
  ([Gough's Tech Zone, 2023-12-29](https://goughlui.com/2023/12/29/video-codec-round-up-2023-part-9-hevc_nvenc-h-265-nvidia-nvenc/),
  opened 2026-09-27). This machine has an RTX 5070 Ti. **Measure on the target hardware** (§7).

**HDR, rotation, frame rate, timestamps**

- **iPhone HDR.** A real iPhone clip was "Dolby Vision profile 8.4, HLG, 10-bit HEVC, 59.94 fps
  VFR". Every script in that project had produced "BT.709 tags on HLG pixels", so "HDR was silently
  flattened". The fix was HEVC Main10 "with the source's own colour tags", plus mapping only the
  first audio stream, because iPhone metadata tracks were picked up as audio
  ([kajisho5/ffmpeg-skill PR #5, 2026-09-03](https://github.com/kajisho5/ffmpeg-skill/pull/5), opened
  2026-09-27).
- Apple's own advice for editing HDR is to "export an HLG master file" or use "HEVC 10-bit"
  ([Apple Support 102241](https://support.apple.com/en-us/102241), published 2025-03-20, opened
  2026-09-27).
- **Rotation.** ffmpeg's `-autorotate` is "Enabled by default". When transcoding, "the video will be
  rotated at the filtering stage" ([ffmpeg docs](https://ffmpeg.org/ffmpeg.html), opened 2026-09-27).
  The pixels come out upright, so copying the rotation or Orientation tag back from the source makes
  players rotate twice. One practitioner removed the Orientation tag for exactly this reason
  ([Jason Nicholson, 2025-11-30](https://jasonhnicholson.com/posts/2025/11/2025-11-30-re-encoding-a-google-photo-video-album.html),
  opened 2026-09-27).
- **Frame rate.**
  - `-r` as an output option will "Duplicate or drop frames right before encoding them"
    ([ffmpeg docs](https://ffmpeg.org/ffmpeg.html)).
  - "With correct timestamps, VFR video stays in sync with its audio". CFR conversion "does not fix
    every cause of drift"
    ([ffmpeg-cookbook](https://ffmpeg-cookbook.com/en/articles/variable-framerate-to-constant/),
    opened 2026-09-27).
  - iPhone slow-motion is a high-fps recording whose file marks variable-speed playback. It "starts
    out at one speed, changes to another speed". Tools that mishandle it duplicate frames
    ([Apple Community thread 6583881, 2014](https://discussions.apple.com/thread/6583881), opened
    2026-09-27). Google Photos lists slow-motion as supported (§2d).
- **Timestamps and GPS in MP4/MOV.** ExifTool writes new QuickTime tags to ItemList, then UserData,
  then Keys. QuickTime integer dates "should be stored as UTC" but cameras often store local time
  (the `QuickTimeUTC` API option). GPS lives in `©xyz` (GPSCoordinates) or Keys
  `location.ISO6709` ([ExifTool QuickTime tags](https://exiftool.org/TagNames/QuickTime.html),
  opened 2026-09-27). ffmpeg's mov muxer has `-movflags use_metadata_tags` ("use mdta atom for
  metadata") ([ffmpeg-formats](https://ffmpeg.org/ffmpeg-formats.html), opened 2026-09-27).
- **Audio.** Xiph: "Opus at 128 KB/s (VBR) is pretty much transparent", with 96–128 kb/s
  recommended for stereo music ([Xiph wiki](https://wiki.xiph.org/Opus_Recommended_Settings), opened
  2026-09-27). AAC transparency figures come from hydrogenaudio, which returned 403 (§9).
  A cautionary example: the one practitioner write-up re-encoded audio to **128k AAC mono**
  ([Nicholson](https://jasonhnicholson.com/posts/2025/11/2025-11-30-re-encoding-a-google-photo-video-album.html)).
  That is the opposite of the owner's "audio in excellent quality".

**Licensing of ffmpeg for a portable ZIP**

FFmpeg is LGPL 2.1+. "certain optional components fall under GPL v2, which extends to the entire
project" (for example x264 and x265). The distribution checklist asks for dynamic linking, source
offered from the same server, attribution, and the build method documented
([ffmpeg.org/legal](https://ffmpeg.org/legal.html), opened 2026-09-27). The gyan build probed here is
`--enable-gpl --enable-version3` and statically built (§1.2). Whether shipping it beside MIT code is
acceptable is a **licensing question for the owner**, not settled here (§8, F10).

**The owner's video rules, point by point**

| Owner's rule | Field practice | Verdict | What would improve it |
|---|---|---|---|
| "Not H.265 → optimize" | Tdarr skips HEVC/AV1/VP9. Immich's "Required" also triggers on HDR and non-yuv420p | Sound as a skip rule. Too broad as a *go* rule | Also **skip** HDR/Dolby Vision (unless the HDR path is proven), slow-mo, Motion/Live components, items that don't count toward quota, shared or partner items, and already-KPOT-optimized items (idempotency, Tdarr's "endless re-encoding loops") |
| ">20 Mbps → 20 Mbps; 5–20 → −20%; <5 untouched" | HandBrake: constant quality. Tdarr: 0.5× with min/max. Immich: `maxBitrate` as a trigger, not a target | Bitrate targets ignore resolution, fps and content. −20% is **timid** for H.264 → HEVC and pointless for HEVC → HEVC. A fixed 5 Mbps floor means very different things at 720p and at 4K (*reasoning*, see §7 for calibration) | CRF/CQ with a **VMAF floor** measured on samples (the ab-av1 pattern), plus an optional `maxrate` cap. Or keep the ladder but normalise to bits per pixel per frame and calibrate on the owner's clips |
| "fps > 30 → 30" | Nobody in the sources caps fps by default. `-r` drops frames. Slow-mo and 60 fps are content, not waste | **Reject as a default.** It destroys slow-mo and halves the motion of 60 fps footage. Resolution is kept, but fps is also resolution (in time) | Keep the source fps. At most an explicit opt-in that excludes slow-mo |
| "Audio → AAC or better, excellent quality" | Transparent Opus ≈ 128k. Re-encoding lossy audio is generational loss | Re-encoding audio saves little and costs quality | **Stream-copy** compatible audio (`-c:a copy`). Re-encode only incompatible audio (e.g. PCM) at transparent bitrates |
| "Keep original resolution" | google-photos-shrink downsizes (1080p, 1500 px). Recover storage downsizes (1080p, 16 MP) | Matches the owner's intent. It is also KPOT's point of difference from Google's own tool | Keep it |

### 2g. Acceptance criteria: "worth it?"

- **The owner's rule** is: savings below 20% → keep the original. ab-av1 has the same shape:
  `--max-encoded-percent` plus `--min-vmaf` ([ab-av1](https://github.com/alexheretic/ab-av1), opened
  2026-09-27). Tdarr users asked to "disable overwriting of the original file if the transcoded file
  is larger", because some NVENC HEVC outputs *grew* over H.264 sources
  ([Tdarr #201, 2020-04-15](https://github.com/HaveAGitGat/Tdarr/issues/201), opened 2026-09-27).
  The rule is **sound and should stay**.
- **What it lacks:**
  1. A **quality floor**. A file that shrank 70% because the encoder smeared it passes a pure size
     test. The field pairs size with VMAF (video) or SSIMULACRA2 (photo). "80% quality" in the idea
     file is not measurable. A metric score is.
  2. An **absolute-savings floor**. 20% of a 3 MB photo does not pay for losing its faces, comments
     and share links (§2b). The per-item cost of a re-upload is fixed. The benefit scales with bytes.
  3. **Structural checks**, as google-photos-shrink does. Videos need a dimension match, "duration
     within one second", and a replacement that "resolves by its own content hash to a distinct item"
     before anything is trashed.
- **"Rename the original with the suffix when not worth it" cannot be done in the cloud.** Google
  Photos has no rename: "It's not possible to rename your photos and videos in-app, as Google Photos
  … doesn't even have this option". The suggested workaround is to download, rename and re-upload,
  which is the very operation §2b shows is lossy
  ([Mobile Internist, updated 2025-10-12](https://mobileinternist.com/rename-google-photos/), opened
  2026-09-27; the Google Community threads on this did not render, §9). The workable substitutes are
  a caption marker (the web UI's description field) or a **local ledger** of item IDs already
  judged. The ledger is the only marker KPOT fully controls.

### 2h. Metadata history and provenance

- **XMP Media Management** (`http://ns.adobe.com/xap/1.0/mm/`) is the standard place:
  - `xmpMM:DerivedFrom`: "A reference to the original document from which this one is derived";
  - `xmpMM:History`: "An ordered array of high-level user actions that resulted in this resource";
  - `DocumentID` and `InstanceID` are UUID-based;
  - `OriginalDocumentID` "links a resource to its original source"
  ([Adobe xmp-docs: xmpMM](https://github.com/adobe/xmp-docs/blob/master/XMPNamespaces/xmpMM.md),
  opened 2026-09-27).
  - `History` entries (ResourceEvent) carry action, when, softwareAgent and parameters, which is
    exactly "KPOT vX, params Y, date Z". *(The field list is from the XMP spec as summarised there.
    The exiftool tag table was truncated in my fetch.)*
- **A custom `kpot:` namespace** needs an ExifTool config: "other tags are not writable unless added
  as user-defined tags in the ExifTool config file"
  ([ExifTool XMP tags](https://exiftool.org/TagNames/XMP.html), opened 2026-09-27).
- **Containers.** XMP rides in a WebP 'XMP ' chunk (§2e). MP4/MOV can take XMP plus QuickTime
  ItemList, UserData or Keys (§2f).
- **C2PA** is the modern signed-provenance format. Google Photos reads it and adds it on edits
  ([Google blog](https://blog.google/security/pixel-android-trusted-images-c2pa-content-credentials/),
  opened 2026-09-27). Signing KPOT's edits is out of scope, but breaking an existing credential is a
  loss to report (§2b).
- **What survives a Google upload and download** is **not documented anywhere I could open.** The
  one documented behaviour: API `=d` drops location. That says nothing about web download. This is
  the top item for §7.

---

## 3. The academic and reference basis

| Area | Reference (opened 2026-09-27 unless noted in §9) |
|---|---|
| Video quality metric | VMAF: [Netflix/vmaf](https://github.com/Netflix/vmaf) (BSD+Patent; v0.6.1 and 4K models; v1 models June 2026; NEG mode). Netflix's introductory tech-blog post returned 403 (§9) |
| Image quality metric | SSIMULACRA2 ([repo](https://github.com/cloudinary/ssimulacra2)), validated on CID22 / TID2013 / KADID-10k / KonFiG-IQA. Butteraugli ([repo](https://github.com/google/butteraugli)). DSSIM ([repo](https://github.com/kornelski/dssim)) |
| HEIF | ISO/IEC 23008-12 (editions 2015 → 2022 → 2025/Amd 2:2026 per [Wikipedia](https://en.wikipedia.org/wiki/High_Efficiency_Image_File_Format)). The ISO page returned 403 (§9) |
| AVIF | [AV1 Image File Format v1.2.0](https://aomediacodec.github.io/av1-avif/) (2025-10-16) |
| JPEG XL | ISO/IEC 18181 ([jpeg.org/jpegxl](https://jpeg.org/jpegxl/)). Reversible JPEG transcoding ([Cloudinary](https://cloudinary.com/blog/the-case-for-jpeg-xl)) |
| JPEG encoders | jpegli ([Google OSS blog](https://opensource.googleblog.com/2024/04/introducing-jpegli-new-jpeg-coding-library.html)) |
| Container specs | [WebP RIFF container](https://developers.google.com/speed/webp/docs/riff_container). [Motion Photo 1.0](https://developer.android.com/media/platform/motion-photo-format). [Ultra HDR](https://developer.android.com/media/platform/hdr-image-format) |
| Provenance | XMP xmpMM ([Adobe xmp-docs](https://github.com/adobe/xmp-docs/blob/master/XMPNamespaces/xmpMM.md)). C2PA as deployed by Google ([blog](https://blog.google/security/pixel-android-trusted-images-c2pa-content-credentials/)) |
| Google APIs | [Updates](https://developers.google.com/photos/support/updates), [scopes](https://developers.google.com/photos/overview/authorization), [Picker](https://developers.google.com/photos/picker/guides/media-items), [quotas](https://developers.google.com/photos/overview/api-limits-quotas), [policy](https://developers.google.com/photos/support/api-policy) |
| Encoder practice | [x265 CLI](https://x265.readthedocs.io/en/master/cli.html). [HandBrake quality docs](https://handbrake.fr/docs/en/latest/workflow/adjust-quality.html) |

---

## 4. Alternative architectures, compared against our constraints

**A. The owner's design: web-UI automation end to end (Playwright).** KPOT opens a dedicated
Chromium profile. The user logs in by hand. KPOT walks the grid, downloads originals, re-encodes,
uploads through the web uploader, verifies, trashes the original, and restores the date, album,
favorite and caption through the UI.
- *Proven feasible* in pieces: gphotosdl (download), shtse8 and photos-storage-cleaner (delete),
  Nicholson's manual flow (upload by the web "Upload from computer").
- *Costs:* the ToS and robots.txt conflict (§2a), sign-in blocking (§2a), selector drift as
  permanent maintenance (shtse8), and a heavy new dependency (Playwright plus a browser).

**B. Takeout for download, official API for upload, UI (automated or assisted) for delete.** This is
google-photos-shrink's architecture
([README](https://raw.githubusercontent.com/johnml1135/google-photos-shrink/main/README.md), opened
2026-09-27).
- Takeout gives originals plus JSON (dates, captions, favorites, album folders).
- The upload goes through a sanctioned channel at original quality, and the API can later *read back
  its own uploads* to verify them (appcreateddata scopes).
- Only delete and date restore need the UI. google-photos-shrink does those through the
  cookie-authenticated reverse-engineered client. KPOT could instead show the user a checklist and
  let them delete by hand.
- *Costs:*
  - OAuth client and verification for an open-source app (§2a);
  - the Takeout JSON mess (§5);
  - the API can add items only to **app-created** albums, so the user's existing albums cannot be
    restored through it;
  - the whole library crosses the network twice.

**C. Local-first: "prepare before upload" plus "bring the cloud home".** KPOT never deletes in the
cloud.
- (i) KPOT optimizes what the user is *about to* upload (from the local KPOT library), so nothing
  heavy enters the cloud in the first place.
- (ii) Optionally, a Takeout import brings the Google library **into the local KPOT library**:
  - dates are taken from the JSON, the kind of sidecar work `researches/04_sidecars.md` already
    covers for THM/XMP;
  - JPEGs can be stored as reversible JPEG XL locally (≈20% saved, bit-exact) if the owner wants;
  - the user then decides what to delete in Google by hand, with Google's own "Manage storage →
    large photos and videos" view.
- *Costs:* it saves no cloud space by itself unless the user deletes. It is a different product
  promise.

**D. Google's own "Recover storage".** Zero code: KPOT explains it and links to it. In-place, once a
day, all-or-nothing, irreversible, and capped at 16 MP / 1080p (§2c). It fails "keep the original
resolution", but it plausibly keeps every social and organisational attribute (to verify, §7).

| Constraint | A: UI automation | B: Takeout + API + UI delete | C: Local-first | D: Recover storage |
|---|---|---|---|---|
| Google ToS / robots.txt | **Conflicts (literal reading)** | API upload sanctioned; Takeout sanctioned; delete step conflicts if automated, not if manual | No conflict | No conflict |
| Account risk (flagging, sign-in blocks) | **Highest.** Long automated sessions over thousands of items | Medium (the delete step only) | None | None |
| Near-zero deps / Windows | Playwright + browser + ffmpeg + exiftool | ffmpeg + exiftool + OAuth client (+ UI step) | ffmpeg + exiftool (+ cjxl if JXL) | None |
| "Never lose a file the owner cannot get back" | Only if the original is kept locally before the trash step | Same | **Holds natively.** The original stays local | Originals destroyed by Google (irreversible) |
| Albums / faces / comments / links | Faces, comments, links lost. Albums restorable by UI | Faces, comments, links lost. Albums **not** restorable via API | Nothing lost in the cloud | Plausibly kept (in place) |
| Keeps original resolution | Yes | Yes | Yes | **No** (16 MP / 1080p) |
| Non-technical user effort | Low per run, but fragile | Takeout wait + download + OAuth consent | Low | One click |
| Maintenance tax | **High** (UI selector drift) | Medium (Takeout format drift, e.g. `supplemental-metadata`) | Low | None |

A hybrid is common in practice: **B with a manual delete step** (the user trashes a KPOT-prepared
selection by hand) or **A restricted to read-only** (list, download, verify), with the user pressing
delete.

---

## 5. The failure modes other people documented

| # | Failure | Evidence (quoted briefly; all opened 2026-09-27) |
|---|---|---|
| 1 | **Account disabled, then permanently banned, after bulk uploads through a reverse-engineered client** | gotohp [#98](https://github.com/xob0t/gotohp/issues/98) (2026-09-05). After 1 TB the account was disabled and asked for phone verification. After 260 GB more it was banned with "It looks like this account was created used with multiple other accounts to violate…" *(mobile-API quota-evasion route, not plain web automation, but the same account-level enforcement)* |
| 2 | **Sign-in refused in automated browsers** | Playwright [#19420](https://github.com/microsoft/playwright/issues/19420), [#31212](https://github.com/microsoft/playwright/issues/31212). Puppeteer [#4871](https://github.com/puppeteer/puppeteer/issues/4871). Google's own list of blocked browsers ([7675428](https://support.google.com/accounts/answer/7675428?hl=en)) |
| 3 | **Real-profile automation silently broken** | Chrome 136: remote debugging of the default data dir "will no longer function" ([blog](https://developer.chrome.com/blog/remote-debugging-port)). Playwright: "pages not loading or the browser exiting" ([docs](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context)) |
| 4 | **UI automation rots** | shtse8: selector drift fixed by "a data patch … shipped as a point release". photos-storage-cleaner archived 2024-07-04. gphotos-sync archived. gphotosdl "may cause indefinite hangs" |
| 5 | **API gives degraded copies** | rclone: no original resolution, EXIF location stripped, videos "really compressed". gphotos-sync: "Videos are transcoded", "GPS info is removed". Picker `=dv` "transcoded" |
| 6 | **Takeout JSON naming chaos breaks date recovery** | gpth [#353](https://github.com/TheLastGimbus/GooglePhotosTakeoutHelper/issues/353) (2024-10-27): `.supplemental-metada.json`, `.supplemental-me`, `.supplementa`. Dates came out as "1868 and 2068". The ente importer missed the new suffix ([ente #4953](https://github.com/ente/ente/issues/4953), listing only). Names are truncated at 46 characters ([metadatafixer](https://metadatafixer.com/learn/google-takeout-json-files-explained)) |
| 7 | **Edited dates and locations silently revert** | Google: downloads show "the original date and time saved by your camera" ([6128850](https://support.google.com/photos/answer/6128850?hl=en&co=GENIE.Platform%3DDesktop)) and "the original location your device saved" ([6153599](https://support.google.com/photos/answer/6153599?hl=en&co=GENIE.Platform%3DDesktop)) |
| 8 | **Re-upload loses the social graph** | google-photos-shrink: faces, comments, likes and links "are lost -- no export or API restores them". rephoto does not restore albums or shared-library relations |
| 9 | **Hash de-duplication blocks re-upload of identical bytes** | rephoto deletes originals **before** re-upload "to avoid hash-deduplication". google-photos-shrink requires the replacement to "resolve by its own content hash to a distinct item" |
| 10 | **HDR flattened by re-encode** | kajisho5 PR #5 (2026-09-03): iPhone DV 8.4 / HLG / 10-bit → "HDR was silently flattened", "BT.709 tags on HLG pixels". Apple Community: HDR shown "washed out" on older devices ([255555004](https://discussions.apple.com/thread/255555004), 2024) |
| 11 | **iPhone metadata tracks break naive stream mapping** | kajisho5 PR #5: "`-map 0:a?` broke on iPhone files because metadata tracks were picked up as audio inputs" |
| 12 | **Slow-mo / VFR mishandled** | Apple Community 6583881: 240 fps slow-mo read as variable-speed, "every 6th frame appeared duplicated" in an editor |
| 13 | **Double rotation** | Nicholson removed the Orientation tag "to avoid auto-rotation issues" after re-encoding ([post](https://jasonhnicholson.com/posts/2025/11/2025-11-30-re-encoding-a-google-photo-video-album.html)). ffmpeg rotates pixels by default when transcoding ([docs](https://ffmpeg.org/ffmpeg.html)) |
| 14 | **Metadata stripped by the image library** | sharp: "By default all metadata will be removed, which includes EXIF-based orientation" ([docs](https://sharp.pixelplumbing.com/api-output)) |
| 15 | **Re-encode came out bigger** | Tdarr [#201](https://github.com/HaveAGitGat/Tdarr/issues/201): NVENC HEVC larger than the H.264 source |
| 16 | **Space not freed after deleting** | "Space is not freed until the bin is emptied, and Google's storage figures can take hours to catch up" (google-photos-shrink). Google: 48–72 h to update ([9312312](https://support.google.com/googleone/answer/9312312?hl=en)) |
| 17 | **Re-uploading free items starts billing them** | google-photos-shrink refuses "Storage-saver-era free items" and partner-shared items. Google lists which items are free ([9284827](https://support.google.com/photos/answer/9284827?hl=en&co=GENIE.Platform%3DDesktop)) |
| 18 | **Aggressive "practical" settings** | Nicholson: `hevc_nvenc -cq 35` and **128k AAC mono**, reporting 5–9× savings. google-photos-shrink: AVIF 1500 px q60 and AV1 CRF 36 within 1080p (25.2 GB → 2.3 GB). Both buy their ratios by **giving up** what the owner wants to keep |
| 19 | **Recover storage is one-way** | "all or nothing … permanently deletes the original files" ([How-To Geek](https://www.howtogeek.com/psa-google-photos-is-lowering-the-quality-of-your-memories/)) |

---

## 6. Recommendation, as options for the owner (not decisions)

**What stays true whichever option is chosen:**

1. **The original must land locally before anything is deleted in the cloud.** KPOT's four
   guarantees stop at the local disk. In the cloud, the only nets are Google's trash (30 days,
   volatile) and whatever copy the user keeps. The design that preserves the product promise treats
   "delete from Google" as **"move to the local KPOT library"**. The download that the optimizer
   needs anyway becomes the backup. After that the user owns the original, and KPOT's normal plan,
   backup and rollback apply to it.
2. **Skip by default:** items that don't count toward quota; shared-in or partner-saved items;
   items in shared albums; HDR/Dolby Vision video (until a 10-bit HDR-preserving path is measured
   and proven); slow-mo; Motion Photos and Live Photos; Ultra HDR and C2PA-signed JPEGs; already
   HEVC/AV1/VP9 video; anything already optimized by KPOT (local ledger).
3. **Measure; don't guess.** Every candidate must pass (a) the owner's size rule (≥ 20% smaller, the
   owner's number) **and** (b) a quality floor (VMAF on sample windows for video, SSIMULACRA2 for
   photos) **and** (c) structural checks (dimensions, duration, capture date, GPS, orientation)
   before it counts as "optimized".

**Option 1: local-first (C), with an assisted cloud clean-up.** This fits every KPOT constraint
now. KPOT imports a Takeout into the local library, optimizes locally, and gives the user a
reviewed list with a guide page for deleting in Google by hand. It adds no browser automation, no
ToS conflict and no account risk.

**Option 2: B with a manual or assisted delete.** Takeout down, official API up (verified read-back
of KPOT's own uploads), and the user trashes the originals by hand from a KPOT-prepared checklist.
It needs an OAuth client and a verification decision, and it does not restore albums.

**Option 3: A (the owner's design), bounded.** Automate list, download and verify in a dedicated,
visible profile with a manual login, but leave **delete** to a human click. It accepts the literal
ToS/robots.txt conflict for reads, and a maintenance tax. If full automation of delete is wanted,
that is a separate and explicit owner decision about account risk (F2).

**Option 4: D as the documented "easy button".** KPOT simply explains Recover storage and its
trade-offs (16 MP / 1080p, irreversible) for users who prefer Google's in-place conversion.

**What we would deliberately NOT do, and why:**
- **Not** use the reverse-engineered *mobile* API or any quota-evasion path (gpmc / gotohp
  "unlimited original quality"). That is evasion of Google's billing, and the ban report is in §5 #1.
- **Not** automate the user's default Chrome profile, or harvest their cookies into a file. Chrome
  136 closed the first on purpose, against cookie theft. The second is the same risk, taken
  deliberately.
- **Not** empty the Google trash automatically. The 30-day trash is the last net KPOT does not own.
- **Not** delete a cloud original unless a verified local copy of it exists.
- **Not** downscale, **not** cap fps by default, **not** re-encode audio that can be copied.
- **Not** use lossy WebP for camera photos as the default. At archival quality the field's
  measurements rule it out (§2e). WebP *lossless* for PNG/screenshots is a safe, separate case.
- **Not** promise "80% quality". Promise a measured floor.

---

## 7. What remains unknown and must be MEASURED locally (hand-off list)

Run every cloud-side probe on a **throwaway Google account first**, never on the owner's main one.

| # | Unknown | How to measure |
|---|---|---|
| 1 | Are web downloads byte-identical to what was uploaded? Does "Download" of an *edited* photo return the original or the edit? | Upload a known JPEG, HEIC, MP4 and MOV via the web, download via the web, compare SHA-256 |
| 2 | Which metadata survives the round trip, per format (WebP, AVIF, HEIC, JPEG, MP4/HEVC, MOV/HEVC)? | exiftool diff of DateTimeOriginal, OffsetTime, GPS, Orientation, ICC, XMP `xmpMM:History`, a custom `kpot:` namespace, QuickTime `creation_time`, `©xyz`, Keys location. Record both what the UI shows and what the downloaded file carries (needs exiftool, §1.2) |
| 3 | Does the filename `name_KPOT_OPTIMIZED.ext` survive? | Upload via the web; check the Info panel and the downloaded name |
| 4 | Which codecs are accepted and play back? | HEVC 10-bit HLG in MP4 vs MOV, AV1 in MP4, Opus in MP4, WebP with alpha, AVIF 10-bit, JXL (expected to be refused) |
| 5 | Does a trashed item still count toward quota? How long after emptying the trash does the quota drop? Does a re-uploaded formerly free item start counting (expected yes)? | Watch the quota figure over 72 h after each step |
| 6 | Hash de-duplication: is a byte-identical re-upload of a trashed item skipped, restored, or duplicated? | One controlled upload |
| 7 | Can the *edited* date and location be read from the UI Info panel or Takeout JSON, and re-applied to the new item? | Edit a test item, then read it back both ways; try "Edit date & time" on the replacement |
| 8 | Does Recover storage keep albums, favorites, faces and share links? | **Test account only — irreversible** |
| 9 | What is the library made of? *Hypothesis, not fact:* video dominates the bytes. If so, a video-only v1 captures most of the benefit | Read-only survey: bytes by type, codec, resolution, fps and HDR; the shares that are quota-free, shared, or edited |
| 10 | Encoder calibration on real clips | x265 (medium/slow) vs `hevc_nvenc` vs `libsvtav1` at equal VMAF (e.g. 93/95/97): size ratio and wall-clock on the RTX 5070 Ti, later on weaker GPUs. 8-bit vs 10-bit at equal VMAF. The owner's bitrate ladder vs CRF at the same VMAF |
| 11 | Photo calibration | AVIF vs lossy WebP vs jpegli vs local-only reversible JXL on the owner's JPEG/HEIC; savings at SSIMULACRA2 ≥ 85 and ≥ 90 (needs an ssimulacra2 binary, not installed) |
| 12 | Can automation sign in at all today? | A visible, dedicated-profile Chromium or Chrome channel doing a manual Google sign-in: session lifetime; captchas or "unusual activity" prompts over N hundred item views |
| 13 | VFR and slow-mo handling in ffmpeg 8.1.1 | `-fps_mode passthrough`: A/V sync over long clips; does Google still recognise slow-mo in a re-encoded iPhone file? |
| 14 | Licensing (desk task) | GPL ffmpeg build beside MIT KPOT code in a portable ZIP: obligations per ffmpeg.org/legal, versus requiring a user-installed ffmpeg |

---

## 8. Forks that need the OWNER's decision (phrased neutrally)

<!-- attribution-ok: these are open forks, not decisions; the owner's answers are interview #005 Q1–Q10 (interviews/interview_005_google_photos_optimizer.md) -->
Nine of the eleven forks below were put to the owner as interview #005 (F1+F2 → Q3, F3 → Q1, F4+F5 → Q5,
F6 → Q6, F7 → Q8, F10 → Q9, F11 → Q7) and answered on 2026-09-27; F9 was settled by the idea's own words
(`_KPOT_OPTIMIZED`, epic R11) and F8 is left to the agent's measured `FORK:` line (epic §7). The answers live in
the interview and in the epic's §3.

| Fork | Options |
|---|---|
| **F1. Route to the library** | (a) web-UI automation end to end · (b) Takeout down + official API up + delete by hand or assisted · (c) local-first, KPOT never deletes in the cloud · (d) point users to Google's Recover storage · (e) a staged mix, e.g. (c) now and (b) later |
| **F2. ToS and account-risk posture** | (a) no automation of photos.google.com · (b) read-only automation (list, download, verify), every destructive click made by the human · (c) full automation including delete, accepting the literal robots.txt conflict and the risk |
| **F3. Where the original goes after deletion from the cloud** | (a) into the local KPOT library, always · (b) the user's choice per run · (c) nowhere (Google trash only) |
| **F4. Video quality policy** | (a) the owner's bitrate ladder as written · (b) CRF/CQ with a VMAF floor · (c) CRF with a max-bitrate cap · (d) the ladder recalibrated per resolution after §7-10 |
| **F5. Frame-rate rule** | (a) cap to 30 fps as written · (b) always keep the source fps · (c) opt-in cap that excludes slow-mo |
| **F6. Photos in scope** | (a) video-only first version · (b) AVIF for camera photos · (c) lossy WebP q90 as written · (d) only lossless wins (PNG → WebP lossless) · (e) reversible JXL for the local archive only |
| **F7. Acceptance rule** | (a) size ≥ 20% smaller only · (b) size rule + quality floor · (c) size rule + quality floor + absolute-bytes floor. And how "not worth it" is marked: a caption marker in Google, a local ledger, or both |
| **F8. Encoder default** | (a) CPU x265 (slower, best per bit in the sources) · (b) GPU NVENC/AMF/QSV (fast, somewhat larger) · (c) auto-pick by hardware, with the choice shown |
| **F9. Suffix** | `_KPOT_OPTIMIZED` (the owner's default) · `_KPOT_OPTIMISED` · a shorter tag · no suffix (provenance kept in XMP and the ledger only) |
| **F10. How ffmpeg and exiftool reach the user** | (a) bundled in the portable ZIP (GPL obligations) · (b) downloaded on first use · (c) installed by the user |
| **F11. HDR / Dolby Vision video** | (a) always skip · (b) re-encode as HLG 10-bit, dropping the DV layer · (c) try to carry the DV RPU (needs research: x265 `--dolby-vision-rpu`) |

---

## 9. Sources I could not open (nothing below is stated as fact above)

- `trac.ffmpeg.org/wiki/Encode/H.265`: blocked by an Anubis bot wall. Its CRF-28 vs x264 guidance is
  **not** used.
- Netflix tech blog "Toward a practical perceptual video quality metric" (netflixtechblog.com and
  medium.com): HTTP 403.
- hydrogenaudio wiki pages on AAC and Opus: HTTP 403. AAC transparency bitrates are therefore **not**
  stated.
- ISO page for ISO/IEC 23008-12: HTTP 403. Edition data is taken from Wikipedia.
- Google issue tracker #112096115, #110343547 (API EXIF stripping; web vs API byte-identity): the
  sign-in wall rendered no content. A search-engine summary claimed web downloads are byte-identical.
  **Unverified → §7-1.**
- Google Photos Community threads (Recover storage 281698965; rename 1381513; date metadata
  4335542; HEVC recompression 6114053): only page chrome rendered. Where §2 relies on them it quotes
  secondary sources that did render, and says so.
- droidwin.com (Recover storage): HTTP 403. Android Central (Recover storage): body not rendered.
- Adobe developer XMP page (developer.adobe.com): HTTP 404. The GitHub mirror of the same docs was
  used.
- Whether `photoslibrary.appendonly` is classed as a *sensitive* OAuth scope: no primary page
  confirmed it in this session.
- Apple developer page on HDR (developer.apple.com/news/?id=rwbholxw): the news index rendered, not
  the article. The DV 8.4 / HLG / 10-bit description comes from the kajisho5 PR's real-file probe.

---

## 10. Synthesis for the epic — local recon and the owner's requirements (added by the planning agent, 2026-09-27)

The `/plan-epic` ladder asks the research rung to join three sources. §0–§9 above are the industry
sweep (written by a research subagent; the planning agent re-opened three load-bearing sources and
confirmed them verbatim: the 30-day trash and its 2026-09-04 date, the 2025-03-31 API scope removal,
and google-photos-shrink's pipeline, licence, refusals and losses — plus one detail the sweep left in a
table: that tool's DEFAULT downsizes video to 1920×1080 with AV1 CRF 36, i.e. against the owner's
"keep the original resolution"). This section adds the other two sources.

### 10.1 Local recon — what KPOT already has where the epic lands

| Fact | Evidence | Consequence for the epic |
|---|---|---|
| The UI is ONE self-contained page with two screens (wizard, control panel); there are no tabs yet | `src/ui/page.mjs` (590 lines), `plans/03_interface_epic.md` | "A separate tab" means adding navigation to the panel — a UI change, small |
| KPOT already drives a real browser with ZERO dependencies: headless Edge over the DevTools Protocol, Node's built-in `WebSocket` | EXP-0024, `HOUSE_RULES.md` §3 | If the owner keeps web automation, Playwright is not the only route: `playwright-core` with the installed Edge (`channel: 'msedge'`, no browser download) or raw CDP — decided by a `FORK:` line with recon, not by taste |
| Runtime dependencies: two (`exifreader`, `jpeg-js`); portable ZIP 33.2 MB | `package.json`, `plans/09` | Playwright's bundled browsers (hundreds of MB) and a GPL ffmpeg (~100+ MB) would change the delivery promise |
| RULE 1: only `src/apply/` writes a user's file, and only after a verified backup | `AGENT_GUIDE.md` Architecture | A cloud deletion is a NEW class of write that no backup covers — it needs its own guard, designed, not bolted on |
| The owner's own archive: 551 GB, **video ≈ 415 GB (75 % of bytes)**, 4 943 `.mp4` = 372 GB | `researches/02_real_archive_survey.md` | Supports §7-9's hypothesis that video carries most of the saving — measured on HIS data, not assumed |
| Free space on the archive volume: 197.8 GB (measured 2026-07-26 — a past observation, re-probe before relying) | `MASTER_PLAN.md` decision log, 2026-07-26 | "Bring every cloud original home" needs disk: a 30-day-trash policy and a local landing zone must be sized on real numbers |
| Metadata write path: none today. `exifreader` READS; nothing in KPOT writes EXIF/XMP/QuickTime tags | `src/meta/exif.mjs` | Provenance history and date/GPS preservation need a writer (exiftool or ffmpeg's `-map_metadata`), measured per format |
| ffmpeg 8.1.1 (GPL, x265, NVENC, libvmaf) and ImageMagick are installed on THIS machine; exiftool is not | §1.2 | The R&D phase can calibrate on this machine; the product cannot assume any of it on a user's |

### 10.2 The owner's requirements, and what his earlier answers already settle

| Source | What it says | Status for this epic |
|---|---|---|
| `ideas/03` (the owner, 2026-09-27; verbatim `0c54f64`) | tab in the KPOT web UI · own Google login · Playwright automation · download → analyse → convert → upload → verify → delete original · suffix `_KPOT_OPTIMIZED` · local processing · the video rules · the 20 % acceptance rule · WebP 90 for photos · history in metadata · "critically evaluate these criteria" | the input; §2f/§2g evaluate it as he asked |
| `GOAL.md` + `MASTER_PLAN.md` vision | «without ever risking a file the owner cannot get back»; plan · backup · dry run · report with rollback before any move | the optimizer's cloud deletion is the first operation these four guarantees do NOT cover → a vision-level fork |
| interview #001 Q4 = C (2026-07-24) | «KPOT ничего не удаляет» for junk — quarantine with provenance instead | a PRIOR answer about deletion: the optimizer's delete of cloud originals is the owner's own new wish, so the question is not "delete or not" but "where does the original go first" |
| interview #001 Q1 = A (2026-07-24) | pure JS; ExifTool only as a future OPTIONAL "deep mode", never a hard dependency | a PRIOR answer about external binaries: video transcoding has no pure-JS route, so the question is reformulated as "the prior answer was X; video changes Y" |
| interview #003 Q2 (2026-07-29) | portable ZIP — «скачал - распаковал - готово» | an external encoder must not break "unzip and go" for the users who never open the tab |
| decision log 2026-07-28 | audience = the owner AND ordinary inexperienced PC users; very user-friendly, no jargon | account-risk and ToS posture matter more for users who cannot judge them |

### 10.3 Findings → implications for THIS epic → forks for the owner

1. **The safety promise is the load-bearing fork.** Every route deletes from a store KPOT cannot roll
   back; the only design that keeps `GOAL.md` whole lands the original in the local KPOT library
   BEFORE the cloud delete (§6). → owner fork (interview #005).
2. **The route to Google is a risk decision, not an engineering one.** Official API: cannot list or
   delete. Web automation: works, conflicts with the literal ToS/robots.txt reading, risks the
   account, rots with UI changes. → owner fork, with a test account as the first gate.
3. **Several of the owner's rules should change, and he asked for exactly this critique:** fps cap
   (destroys slow-mo/60 fps), audio re-encode (avoidable loss), a fixed −20 % bitrate (field practice
   is constant quality with a measured floor), WebP 90 for camera photos (cannot reach visually
   lossless). His 20 % size rule stands and gains a quality floor. → owner fork per rule group.
4. **"Rename the original in the cloud" is impossible** (Google Photos has no rename) — the "not worth
   it" mark must live elsewhere (a local ledger, or a caption). → folded into the acceptance fork.
5. **A skip list is non-negotiable engineering hygiene, but its breadth is the owner's**: free-quota
   items (re-upload would START billing them), shared items, HDR/Dolby Vision, slow-mo, Motion/Live
   photos, items with dates or places edited in Google. → owner fork (what he accepts to lose).
6. **Delivery of the encoder** reopens #001 Q1 in a new context. → owner fork.
7. **Engineering choices the agent makes itself, with `FORK:` lines and recon** (not interview
   material): CPU vs GPU encoder (auto-pick by measured VMAF-per-second on the machine, choice shown);
   Takeout vs web download for originals (measure byte identity, §7-1); browser driver (raw CDP vs
   `playwright-core` on installed Edge); metadata writer (exiftool vs ffmpeg). The `_KPOT_OPTIMIZED`
   spelling is a fact, not a fork: US spelling, the norm in software (British: OPTIMISED).
