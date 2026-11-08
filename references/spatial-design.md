# Design a spatial scene

## Start with the view that earns the space

Name a question a visitor can answer from the opening pose. Sketch that frame at phone width, beside the actual headline or task. Sketch a second frame after one action. What detail becomes visible? Keep enough space around the object for its silhouette to read at both sizes. One well-framed object can carry the whole section.

- For a repair guide, a quarter turn can expose the latch hidden by the housing. Set the pivot at the joint and stop where the fastener can be reached. Keep the assembly step alongside the model.
- For an evidence viewer, let a selection reveal its source. Put measured values and timestamps in text where readers can compare them accurately.
- For a reading tool, shifting two annotated sheets a few pixels apart may already explain which note belongs to which page. CSS perspective can handle that interaction.

## Give a different product its own scene

Take one input, one action and one observable consequence from the brief. Sketch two different ways to show that consequence in the opening view. For audio restoration, a waveform can help a visitor measure a change. A listening control lets them judge it by ear. When comparing mixes, keep the playhead at the same instant so the visitor can hear what changed. Drive playback motion from the transport and level feedback from the mix.

Check the scene with its brand colors removed and its animation paused. Can the visitor still recognize the object and find the control that changes it? Then try the action twice, stop halfway and turn on reduced motion. Tie movement to the product state that actually changed. Label illustrative readings and give the visitor access to the underlying sound, content or measurement.

## Choose the medium and build the form

Use CSS transforms for a few flat layers, or Canvas 2D for a plotted trace whose coordinates lie on a plane. Use a 3D renderer when changes in view, occlusion, lighting or assembly carry information. Reuse a renderer already in the project. Three.js fits a scene with cameras, meshes and imported assets. A small custom WebGL mesh can work for a self-contained procedural object if the team can maintain the shaders. In a component plan, mark the region with `scene3d`, add `interactive` for visitor controls and record any new runtime in `dependencies`.

Derive the geometry from the subject. Sweep a section along a path for a cable, revolve a profile for a machined knob, or import an approved GLB/glTF model when exact geometry matters. For imported assets, check scale, axes, pivot, bounds and part names before styling. Fit the camera around the parts visible in each pose, including the exploded view. For either route, inspect the untextured silhouette at the smallest intended size.

## Direct light, motion and controls together

Choose one material cue from the product. A broad highlight can reveal a curved brushed shell. A narrow moving highlight can connect segments of a signal path. Start with a key light, then add a rim or fill only where one surface merges into another. Inspect the darkest edge against the actual page background. Leave quiet space between the moving highlight, heading and primary action.

Tie motion to a verb such as rotate, align, unfold or trace. Give it a start, a destination and an interruption behavior. Fit the controls to the task: a constrained angle for a hinge, named views for assembly steps, or source selection for a trace. Keep labels, values and actions in the DOM. Pair drag with a keyboard and tap alternative, preserve vertical scrolling and keep a still pose under reduced motion. Give sustained automatic movement a pause control.

## Deliver and verify

Reserve the scene's footprint and show a poster captured from its opening camera. Initialize heavy assets when the route or viewport needs them. Size the drawing buffer to the displayed surface, cap pixel density and measure frames and asset transfer on the intended hardware. Render settled scenes on demand. Stop animation while hidden or offscreen. Release observers, frames, textures and buffers when a mounted viewer is removed.

Exercise selection, rotation and the underlying task at phone and desktop sizes. Disable the renderer and simulate context loss during interaction. Show the poster immediately, keep the content operable and restore the selected state and camera when rendering resumes. Compare the poster and reduced-motion view with the live scene for legibility and layout stability.
