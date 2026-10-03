# Jev Studio

Open `/chat/jev` after signing in, or select **Jev Studio** in the sidebar. The dedicated workspace runs TypeSafe AI's Jev evaluation model through Vercel AI Gateway and AI SDK's experimental evaluation API. It does not use the chat-completions endpoint.

## Connect

1. Create an AI Gateway API key in your Vercel account and ensure the account has credit/access to `typesafe-ai/jev`.
2. Set `AI_GATEWAY_API_KEY` in `server/.env` for local development, or the root `.env` for Docker Compose. For Kubernetes, set `secrets.app.data.AI_GATEWAY_API_KEY`, or include the key in your existing application Secret. The secrets preparation script also reads it from the root environment file.
3. Restart the server, then click **Refresh connection**. A configured status only confirms a key is present; the first evaluation verifies credentials and provider access.
4. Choose a template, edit the state and questions, and click **Run evaluation**. Calls consume Gateway credit and the application's daily AI request/token quota.

Keep the key server-only. Never use a `VITE_` prefix or paste credentials into the state editor. Removing the key disables live evaluation without affecting chat. The page and its templates remain available without a key. No database migration is required.

## What you can explore

- **Choice:** select from named options and inspect their probability distribution. Enter each option as `name | descriptive criteria` on its own line.
- **Score:** grade against 2–10 ordered descriptions, one per line. Scores are probability-weighted and zero-indexed, so four levels range from 0 to 3.
- **Yes / No:** AI SDK's Boolean question maps to TypeSafe's Noul primitive. The result is a probability of “yes,” not a confidence score.
- **Templates:** support triage, source-grounded answer checking, and prompt screening. These are starting examples, not validated safeguards or automatic authorization policies.
- **Review threshold:** adjusts the local display only. Choice/Score use the provider's separate confidence metadata; missing confidence requires review. Boolean uses the larger of yes/no probabilities. Calibrate real decision thresholds on labeled examples before using them in an operational workflow.
- **Export:** downloads the submitted inputs and results as JSON. Editing the form after a run does not alter the result snapshot. Refreshing/leaving the page clears the workspace; evaluations are not saved as conversations.

Questions are evaluated independently against the same state; one question cannot reference another question's answer. Use focused instructions and descriptive options. Typed answers can still be factually wrong. Confidence measures distribution concentration, not correctness. Rounded probabilities are displayed as returned and may not sum to exactly 100%.

The UI intentionally caps state at 32,000 characters and the complete evaluation at 64,000 characters, which are application limits rather than the provider's token context limits. Up to 16 questions and 255 Choice options are accepted. Text and JSON object/array state are supported. Text-only, English inputs are the best starting point for these templates.

## Server behavior and verification

`GET /api/jev/status` and `POST /api/jev/evaluate` require the existing user session. Evaluation also uses the AI rate limiter, validates the shared contract, reserves daily usage, applies a 20-second provider deadline and forwards cancellation. There are no automatic retries. Raw provider errors, headers and credentials are not returned to the browser. Usage is settled from provider counts; unknown outcomes conservatively retain estimated token usage. Explicit provider rejections release their reservation.

Tests use AI SDK's evaluation mock model and browser API fixtures; they do not spend credit. Live provider quality, latency and authentication require a configured Gateway key and a real run. The experimental evaluation API is covered by tests for typed answers, confidence, rounding, validation, quota refusal, errors and cancellation.

## References

- [Vercel: classify, route and score with Jev and AI SDK](https://vercel.com/kb/guide/typesafe-jev-and-ai-sdk)
- [TypeSafe: Introducing System One models and Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
- [API reference](https://docs.typesafe.ai/api), [state](https://docs.typesafe.ai/concepts/state), [models](https://docs.typesafe.ai/models)
- [Choice](https://docs.typesafe.ai/primitives/choice), [Score](https://docs.typesafe.ai/primitives/score), [Noul](https://docs.typesafe.ai/primitives/noul), [confidence](https://docs.typesafe.ai/confidence)
- [Confidence routing](https://docs.typesafe.ai/patterns/confidence-routing), [composite scoring](https://docs.typesafe.ai/patterns/composite-scoring), [fan-out](https://docs.typesafe.ai/patterns/fan-out)
- [Citation checks](https://docs.typesafe.ai/cookbooks/citation_check), [RAG passage classification](https://docs.typesafe.ai/cookbooks/classifying_rag_passages), [LLM guardrails](https://docs.typesafe.ai/cookbooks/llm_guardrails)
