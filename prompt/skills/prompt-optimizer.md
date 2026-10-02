---
name: prompt-optimizer
description: Rewrite and tighten a system prompt for an LLM app so it follows instructions instead of drifting toward generic output. Use when a prompt is under-performing, when output is bland or ignores constraints, when adding a new model call, or when reviewing prompt changes in this repo. Triggers on "optimize this prompt", "prompt này yếu", "model không nghe", "sửa system prompt", "why does the model ignore".
---

# Prompt Optimizer

Restructuring a system prompt so a model follows it. The structure comes from
the [prompt-optimizer](https://github.com/linshenkx/prompt-optimizer) project,
which is a tool rather than a skill: `npx skills add` rejects it because it has
no `SKILL.md`. The method is what is worth having, and it is applied here.

## The structure that works

A prompt that reads as a wall of rules gets roughly followed. The same rules
under headings get followed reliably, because the model can tell a *rule* from a
*fact* from an *example*, and an instruction inside a labelled section is read as
binding.

```
# Profile        who the model is, who it is talking to
# Skills / Rules what it must and must not do
# Workflows      the order of operations, when the task has more than one step
```

Two things do the work:

- **A role that carries expertise, not a job title.** "A patient tutor who
  knows where students get stuck" changes the output; "an expert teacher" does
  not. See the outline prompt in `src/app/api/gemini/lesson/route.ts` — the
  scene count went from 5 to 14 on the strength of the role line alone.
- **Rules that name the failure they prevent.** "`narration`: do not read LaTeX
  aloud" beats "narration should be natural", because the second is not a rule
  at all. Vague prohibitions are the single most common cause of an instruction
  being ignored.

## Workflow

1. **Find the real failure.** Not what the prompt says — what the model actually
   did. Generations in `scripts/` or a saved lesson are worth more than a
   reading of the prompt. Guessing at the failure wastes the rewrite.
2. **Name the failure in the prompt.** Whatever the model got wrong, say it
   back to it as a prohibition with the specific wrong output attached. This is
   the highest-value edit and it is usually one line.
3. **Give the model a way to satisfy the rule.** A rule it cannot meet is a rule
   it breaks. "Fill every field" fails; here is the exact shape of the row you
   want, the model needs the shape, not the demand.
4. **Separate what is shown from what is read.** Give the model a field for
   internal reasoning (`goal`, `visualNote`) and one it must not put on screen.
   Without the separation it uses the same sentence for both, and the slide ends
   up talking about its own design.
5. **Set a real temperature.** High temperature is fine for prose and wrong for
   anything counted. An outline that must return 14 items wants 0.6, not 0.9.

## Traps in this codebase

- **Gemini `responseSchema` has no nested arrays.** An `array` of `array` is
  silently dropped, so the field comes back empty and looks like a model
  failure. Flatten to one string per row and split it in the validator.
- **A prompt is a request, not a guarantee.** `OUTLINE_SYSTEM` asks for a quiz
  and a summary; the model sometimes omits them. Anything structural is
  enforced in code after the call — see `ensureClosingScenes` — so the deck
  cannot ship without them regardless of what came back.
- **Do not validate your way to an empty result.** A validator that rejects
  "too few scenes" will burn all six attempts and return an error instead of a
  usable lesson. Reject only on failures that are unrecoverable downstream
  (a missing required field); nudge the rest through the prompt and enforce
  cheap fixes in code.
- **A long lesson needs the length ceiling lifted too.** Asking for more content
  while capping the output at 12 scenes just compresses it back. `sceneCount`
  was capped at 12 and is now 24 for exactly this reason.

## Checking a change

`npm run verify` then `npm run build`, then generate a lesson and read the
scenes. The numbers that matter: scene count, how many carry a narration, and
whether a table or a chart appears exactly once rather than on every slide.
