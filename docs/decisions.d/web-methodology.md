# web-methodology decisions (2026-11-15)

- The page reads only existing hooks (methodology, validation, model metadata, sources, context, groups); no new hooks were needed. Validation fields beyond docs/API.md (gp_vs_majority, sensitivity n_not_sustained, paired_differences, not_modelled, majority_class_baseline) are typed as optional in `components/methodology/types.ts` and shown only when present.
- Default validation group: `pmma_rod__stagnation` if it is validated and modelled, else the modelled group with the most training rows; the user can switch group.
- Static prose describes implemented behaviour only (GP/Laplace, EVR formula, verdict thresholds 3 / 0.6 / 0.85, 75 % / 50 % target aggregation, 15 % compare tolerance). These thresholds are code constants, not API fields, and are labelled as implementation constants.
- Small-sample callout fires when a group has fewer than 30 experiments or fewer than 20 not-sustained observations (UI constant). The "flow-turned-off" callout is data-driven from the sensitivity row.
- Charts are dependency-free SVG in `components/charts/` and use design tokens only; the EVR curve is teal (research candidate), uncertainty sampling plum, the other baselines are ink/muted with distinct dashes.
