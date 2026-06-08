# Tasks

## 1. Message entity
- [x] 1.1 Add the `messages` table (mirrors comments; type + status text+Zod); additive migration 0018.

## 2. Generator + prompt
- [x] 2.1 `src/prompts/message_v1.ts` versioned prompt (both types).
- [x] 2.2 `src/lib/messages/generate.ts` synchronous `generateMessage(personId, type)` via the LLMProvider port + Structured Outputs; PersonSubject seam + operator profile.

## 3. Read-model + transitions
- [x] 3.1 `src/lib/messages/read.ts`: listMessagesForPerson, markMessageSent, dismissMessage.

## 4. Person workspace UI
- [x] 4.1 Messages section (draft by type + history with mark-sent/dismiss); extract shared GeneratedActions (rule of three).
- [x] 4.2 Server actions generateMessageAction / markMessageSentAction / dismissMessageAction.

## 5. Tests + gate
- [x] 5.1 tests/engagement-messages.test.ts (generate, both types, transitions, new-row-each-call).
- [x] 5.2 `npm run verify` green (215 tests, coverage, depcruise/jscpd clean, build) + code-review pass.
