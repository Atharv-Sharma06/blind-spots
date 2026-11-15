# web-map decisions

- ParameterMap: canvas (hatch/wash rasters per grid, memoised) under SVG overlay. d3-zoom is applied incrementally to the view domain (so anisotropic zoom and controlled viewDomain work); wheel zoom needs Ctrl/Cmd (or pinch) so the page still scrolls; views narrower than 2% of the full extent are refused.
- Prediction is drawn only where verdict != insufficient_evidence; contours are clipped to supported cells; extrapolation cells get a lighter wash. If hypotheticalSurface is given it replaces the p / std-ratio grids and the map says so.
- Context envelopes with null bounds extend to the xDomain/yDomain edges; labels truncate to the rectangle width.
- Props contract is exactly as specified; MapObservation and ViewDomain types are additionally exported.
