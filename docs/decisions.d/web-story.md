# web-story decisions
- Demo scene 2 target = documented non-envelope profile with the fewest comparable observations for the current group (assessed live via /api/target/assess; first profile as fallback while loading).
- Demo scene 3 caption adapts to the API verdict (supported / extrapolation / insufficient_evidence); gaps are phrased "not represented in the integrated records" and name not-integrated investigations (first two + count).
- Brief page renders the API `sections` with a small text-only Markdown renderer (no HTML); "min None"/"max None" from the API is displayed as "not given".
- Brief link: /brief?group=&target=&candidate=<o2>,<airflow>,<pressure>.
