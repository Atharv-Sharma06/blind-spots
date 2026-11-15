Blind Spots: Do ISS Fire Tests Cover Moon/Mars Cabin Air?

<!-- Paste the line above into "Project Name" (replaces the placeholder "Project Yaered"). 57 characters. -->

## Alternatives

1. Blind Spots: Where Microgravity Fire Evidence Ends
   (50 characters) Same wording as the README tagline and the product line in apps/web/lib/copy.ts (PRODUCT_LINE).
   It is the safest option if the redesign does not ship. It says less about cabins and the next experiment.

2. Blind Spots: ISS Fire-Test Coverage for Moon and Mars Cabins
   (60 characters) A plain description of what the map shows. It is not a question, which suits judges skimming a
   list of projects, but it does not hint at the machine-learning ranking.

## Why the recommended title

- It keeps the brand exactly as in the site header ("Blind Spots") and puts the redesigned homepage question after it.
  The local page `<title>` is "Blind Spots: do NASA's space-station fire tests cover this cabin's air?"
  (SITE_TITLE in apps/web/lib/copy.ts), so the recommended title is a shorter version of it.
- It is phrased as a question, so it does not claim a safety verdict or certification. "Moon/Mars" matches the cabin card
  label "Moon/Mars Exploration Atmosphere" (.work/redesign/SPEC.md).
- None of the three options uses the word "NASA" or any NASA logo or mark. That keeps any hint of NASA endorsement out of
  the name; the summary and links still say where the data comes from.
- It fits the challenge "Flame in Freefall", whose objective is to find the investigations most relevant to the fire
  safety of crew environments, including Moon and Mars bases.

## Consistency notes (checked 2026-11-15, 15:54 EST)

- README.md line 3: "Blind Spots: where NASA's microgravity fire evidence ends, and what to learn next."
- submission/project-page.md "Project Name" section: "Blind Spots". It still works, but it describes nothing on its own.
- The public deployment https://blind-spots-kappa.vercel.app still shows the old `<title>`: "Blind Spots — where NASA's
  microgravity fire evidence ends". It changes to the question title once the redesign is deployed.
