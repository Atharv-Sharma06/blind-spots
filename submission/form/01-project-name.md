Blind Spots: Do ISS Fire Tests Cover Moon/Mars Cabin Air?

<!-- Paste the line above into "Project Name" (replaces the placeholder "Project Yaered"). 57 characters. -->

## Alternatives

1. Blind Spots: Where Microgravity Fire Evidence Ends
   (50 characters) This was our first tagline. The product line has since moved on to "Blind Spots: where NASA's ISS
   fire tests end, and what to test next." (PRODUCT_LINE in apps/web/lib/copy.ts), so this option is close to it
   but no longer word for word. It is the safe pick, though it says little about cabins or the next experiment.

2. Blind Spots: ISS Fire-Test Coverage for Moon and Mars Cabins
   (60 characters) This one simply describes what the site shows. A judge skimming a long list gets the idea fast.
   It does not hint at the machine-learning ranking, and it reads a bit like a report title.

## Why the recommended title

We kept the brand exactly as it appears in the site header, "Blind Spots", and put the question we built the site
around after it. The page `<title>` in the code is "Blind Spots: do NASA's space-station fire tests cover this cabin's
air?" (SITE_TITLE in apps/web/lib/copy.ts), and the README opens with "Do NASA's space-station fire tests cover the air
in a Moon or Mars cabin?". The recommended title is a shorter version of the same question.

We liked a question because it does not claim a safety verdict or a certification. It just says what we checked.
"Moon/Mars" matches the landing page, which asks about "future Moon and Mars cabins", and the homepage figure for
"Moon and Mars cabin air".

None of the three options uses the word "NASA" or any NASA logo or mark. We did that on purpose, so the name carries
no hint of NASA endorsement. The summary and the links still say where the data comes from.

The title also lines up with the challenge, "Flame in Freefall". Its objective is to find the investigations most
relevant to the fire safety of crew environments, Moon and Mars bases included.

## Consistency notes (checked 2026-11-15, 18:13 EST)

README.md line 3 reads "**Do NASA's space-station fire tests cover the air in a Moon or Mars cabin?**".

The "Project Name" section of submission/project-page.md still says only "Blind Spots". That works, but on its own
it tells a reader nothing.

The public deployment at https://blindspots.earth now serves the `<title>` "Blind Spots" on its landing
page. The Cabins tool lives at https://blindspots.earth/cabins.
