# Project Demonstration (link field)

Paste this into **Project Demonstration \***:

```
https://blindspots.earth/video/blind-spots-demo-30s.webm
```

One-line description (if a caption is wanted anywhere):

> A screen recording, under 30 seconds, of the Blind Spots tour. The ISS fire tests cover the station's own air, but the
> Moon/Mars Exploration Atmosphere is a blind spot, and our machine-learning model ranks which research candidate would
> teach us the most next.

- Format: WebM (VP9), 1920x1080, 25 fps, no audio (no H.264 encoder on this machine, so no MP4). Chrome, Firefox and
  Edge play it straight from the link; Safari's WebM support varies by version, which is one reason to also upload to
  YouTube (below). Static file on the Vercel site: public, no login, no password, no registration.
- SI watermark: the video carries a visible label "SI-assisted project · built with Claude (Anthropic)" in the top-right
  corner for its whole length (added by the recorder, `.work/video/record.mjs`, not by the app). The site footer and the
  end card also state "Not endorsed by NASA".
- No narration audio, so the audio SI rule does not apply.

## Measured duration (local test)

Test run 2026-11-15 15:56 EST against the local snapshot server (`http://localhost:3709`, same Cabins-page code as the
redesign), headless Chromium, `node ../../.work/video/record.mjs http://localhost:3709 .work/video/test`:

| Check | Value |
|---|---|
| Duration (ffmpeg header) | **28.80 s** (limit 30 s) |
| End card reached at | 26.12 s, held to the end |
| Stream | vp9 (libvpx-vp9), yuv420p, 1920x1080, 25 fps |
| File size | 2,720,032 bytes |
| Console errors during recording | 0 |

The final video is recorded by the lead against the deployed site; its duration is in `<out_dir>/record-report.json`
(`duration.seconds`). Use that number, not this test value, if they differ.

## Alternative link (GitHub file)

If the Vercel link is ever down, paste the file's GitHub page instead (public repo, no login; the page offers the file
via "View raw" / download):

```
https://github.com/Atharv-Sharma06/blind-spots/blob/main/apps/web/public/video/blind-spots-demo-30s.webm
```

Direct raw file (downloads/plays without the GitHub page):

```
https://raw.githubusercontent.com/Atharv-Sharma06/blind-spots/main/apps/web/public/video/blind-spots-demo-30s.webm
```

Both links only show the new video after the new `.webm` is committed and pushed (see "Before pasting" below).

## Optional: YouTube (5 minutes)

YouTube accepts WebM. Unlisted and Public videos both open without login, so either satisfies "no password, permission
or registration" (do not choose Private).

1. https://studio.youtube.com -> Create -> Upload videos -> select `blind-spots-demo-30s.webm`.
2. Title:
   ```
   Blind Spots: do NASA's ISS fire tests cover Moon/Mars cabin air? (30-second demo)
   ```
3. Description:
   ```
   A 30-second tour of Blind Spots, our NASA Space Apps 2026 project. We took NASA's ISS microgravity flame tests
   (the BASS and BASS-II records from NASA Physical Sciences Informatics) and mapped which crew-cabin air they cover.
   The Moon/Mars Exploration Atmosphere (34 % oxygen, 56.5 kPa) is not represented in those records. The tool then
   ranks the computational research candidate that would most reduce the model's uncertainty.

   Live site: https://blindspots.earth
   Source code: https://github.com/Atharv-Sharma06/blind-spots

   SI disclosure: we built this project, including its code and what this recording shows, with SI assistance from
   Claude, by Anthropic. The video carries a visible watermark, "SI-assisted project · built with Claude (Anthropic)".
   It is a screen recording of the real site. No image or footage in it came from an image or video model.

   This is a computational research-planning tool. It is not a certified fire-safety assessment, and it is not
   endorsed by NASA. The ranked candidates are computational research candidates requiring qualified scientific
   review, established safety procedures and formal feasibility assessment.
   ```
4. Audience: "No, it's not made for kids". Altered or synthetic content: answer per YouTube's wording (the footage is a
   real screen recording, not realistic synthetic media).
5. Visibility: **Unlisted** (or Public) -> Save -> copy the `https://youtu.be/...` link.
6. Check it in a private/incognito window before pasting it into the form.

## Before pasting (lead checklist)

1. The link serves whatever `apps/web/public/video/blind-spots-demo-30s.webm` was in the deployed build. Today that file
   is the OLD explorer tour (15:09 recording, 1,594,579 bytes). After recording the new video, copy
   `<out_dir>/blind-spots-demo-30s.webm` over `apps/web/public/video/blind-spots-demo-30s.webm`, commit, push and
   redeploy. Otherwise the link still plays the old tour.
2. `curl -sIL https://blindspots.earth/video/blind-spots-demo-30s.webm` -> 200, `content-type: video/webm`,
   and a `content-length` equal to the new file's size.
3. Open the link in a logged-out headless browser and confirm it plays the Cabins-page tour, not the old explorer one.
4. Restyle (2026-11-15 evening): `/` is now a landing page and the Cabins tool moved to `/cabins`; the tour autostarts on
   `/cabins?demo=1`. `.work/video/record.mjs` still opens `/?demo=1`, which forwards to `/cabins?demo=1` (one extra
   redirect before the tour). The 28.80 s test above was recorded before the restyle; re-check the new recording's
   duration (limit 30 s) and that it shows the new dark look.
