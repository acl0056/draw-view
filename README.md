# draw-view

A browser-based freehand drawing component that converts raw mouse or touch
input into smooth HTML5 Canvas strokes in real time.

Rather than directly connecting every captured point, draw-view estimates local
stroke tangents, constructs piecewise cubic curves, and removes redundant input
points within a configurable error tolerance. Corner detection prevents sharp
changes in direction from being smoothed away.

## Features

- Real-time smoothing while the user draws
- Tangent-based piecewise cubic curve interpolation
- Error-bounded reduction of redundant input points
- Corner detection
- Mouse and touch gesture support
- Configurable stroke color and radius
- Undo and redo
- Serializable, versioned drawing documents

[View the demo](https://practicube.com/draw/index.html)

## Project status

This is an older, stable experiment preserved in its original JavaScript and
jQuery-based implementation. The demo interface is intentionally minimal; the
main focus of the project is the live stroke-fitting and smoothing algorithm.
