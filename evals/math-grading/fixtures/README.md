# math-grading eval fixtures

The math-grading tool is a **vision** tool: it grades a photo/scan of handwritten
math. The eval case `derivative-eqf4` references `handwritten-derivative.png` here.

Drop a real image at that path before running the eval:

```
evals/math-grading/fixtures/handwritten-derivative.png
```

A good fixture is a phone photo or scan of a student differentiating a composite
function with the chain rule, showing intermediate steps (ideally with one small
slip, so the grader has something concrete to catch). PNG or JPEG.

The harness base64-encodes the file and sends it to a vision-capable model. If the
file is missing, that case fails with a clear message and the rest of the run
continues. (This directory is otherwise gitignored via `evals/output/` only —
fixtures here ARE committed if you add them.)
