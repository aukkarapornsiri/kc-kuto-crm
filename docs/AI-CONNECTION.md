# CRM AI connection

Settings > Integration & AI > AI Settings supports OpenAI Responses, Anthropic Messages and Gemini GenerateContent. An active administrator or super administrator manages the application-wide connection. Other active users need the existing `ai.can_view` permission to generate text.

1. Select a provider and enter a model ID your provider account can access.
2. Enter an API key, output limit (128–4096 tokens) and optional system instructions.
3. Save, then select **Test and enable**. This sends a small provider request and may incur charges. The connection is enabled only after a real non-empty response.
4. Use AI chat or existing AI generation features. Disable the connection to stop new requests.

Blank API key on an unchanged provider preserves the saved key. Changing provider requires a new key. Changes to provider, key, model or generation settings invalidate the previous test. Keys are encrypted in Supabase Vault; browser clients only receive a boolean indicating that a key exists. The application scope is a server constant, not a user-editable profile company name.

The `crm-ai` Edge Function validates the bearer session with Supabase Auth, then reads current active status and permissions from the database. Its platform JWT pre-check is disabled because authentication is explicitly performed in the handler. Endpoints are fixed to the three providers; arbitrary endpoint URLs and redirects are not accepted. Provider bodies and keys are excluded from error responses. Each user is limited to 10 AI requests/minute, with a 45-second provider timeout. Vault updates use revision checks against concurrent edits.

Chat sends the entered prompt; other AI features supply their explicit prompt/context. No CRM database mutation tools are exposed to the model. Provider credentials and an accessible model are required; deployment alone does not mean that an external provider has been connected.

Validation: provider adapter and redaction tests, mocked Edge authentication/lifecycle tests, browser settings/demo/mobile tests, live Vault transaction and rate-limit checks (rolled back), live unauthenticated endpoint rejection. No live provider generation test was performed without customer credentials.

To run Edge tests, first bundle `supabase/functions/crm-ai/index.ts` with esbuild (`--bundle --platform=neutral --format=esm --external:npm:*`), then set `AI_EDGE_BUNDLE` to that file for `node --test tests/ai-edge.test.cjs`.
