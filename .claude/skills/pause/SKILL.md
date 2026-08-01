---
name: pause
description: SOFT-PARK the current chat — a temporary pause with the intent to CONTINUE IN THIS SAME CHAT. Bring the task in flight to a logical stopping point, verify the tree is green, park neatly WITHOUT the heavy wrap-up (no push, no STATUS/README ceremony) and post a precise parking note in the chat. Use when the human says "pause", "park it", "hold on, back soon", "пауза", "припаркуйся", "прервёмся ненадолго". For the FULL session closure (STATUS, commits, pushes, handoff to other chats) use /end-chat instead. Trigger aliases (ru): «пауза», «сделаем паузу», «припаркуйся», «прервёмся ненадолго»
---

## Step 1. Reach a logical stopping point — never park mid-surgery

Finish the smallest coherent unit of the work in flight: the tree must **build green and pass its
checks**. If you are mid-edit and the tree is broken, the parking point is AFTER the minimal set of
edits that makes it green again — say so in the chat and finish that first (minutes, not hours).
Do NOT start anything new.

## Step 2. Preserve the work — locally and lightly

- If the tree is green and carries uncommitted work: make a **local commit without pushing**
  (`wip: <what> — soft parking` + your standard co-author trailer). A local commit costs nothing
  and survives a crash; a push is a session-closure act and belongs to `/end-chat`.
- Do NOT update `STATUS.md`, README or other status documents — that ceremony is exactly what this
  skill exists to skip. The parking note in the chat (step 3) is the continuation medium.

## Step 3. The parking note — the chat IS the memory here

Post one compact note in the chat:
- **Where we stand:** what just got finished and verified (one line per item).
- **Exactly where to resume:** the next concrete action, with file/command names — written so that
  "продолжаем"/"continue" picks up with zero re-derivation.
- Anything time-sensitive the human should know before they leave.

Then stop. No further actions, no background work.

# /pause — end the work session

The human is pausing. Run the wrap-up routine **in order**. Narrate each step briefly in the chat.
Don't skip steps. If a step fails — stop, tell the human, don't continue blindly.

## Step 3. (Re)build / regenerate artifacts

`<Run the project build and any artifact regeneration (e.g. a rendered README.pdf). For this framework's
own project: `node tools/build-framework.mjs` regenerates KAIF.md, and `node tools/readme-pdf.mjs`
regenerates README.pdf.>`

**For KPOT:** there is no build step and no rendered artifact to regenerate. Run `npm test` — it must
pass. If it fails, stop and show the errors — don't commit broken state.

## Step 4. Commit and push

KPOT has no commit tool. Use plain git, on `main` (no feature branches):
`git add -A && git commit -m "..." && git push origin main`.

Message style (from `AGENT_GUIDE.md`): `feat:` / `fix:` / `docs:` / `refactor:` / `ci:` + one line.
End the message with:
```
Co-Authored-By: <the model actually doing the work> <noreply@anthropic.com>
```

## Notes

- The difference in one line: **/pause = the chat continues later; /end-chat = the chat says goodbye.**
- If the pause unexpectedly becomes permanent (the human never returns to this chat), nothing is
  lost: the local commit holds the work, and the next session's `/resume` reads the tree and
  `git log` as usual.
