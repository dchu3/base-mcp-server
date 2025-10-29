# Repository Guidelines

## Project Structure & Module Organization
TypeScript sources live in `src/`, with `index.ts` bootstrapping the MCP server, `server.ts` registering tools, and focused modules such as `blockscout.ts`, `tools/`, `config.ts`, and `routers.ts` handling API, validation, and routing concerns. Reusable helpers belong in `utils.ts` to keep handlers slim. Tests mirror this layout under `tests/unit/` and `tests/integration/`, while automation scripts go in `scripts/` (for example `scripts/dev.sh` and `scripts/build.sh`). Keep generated bundles inside `dist/` and exclude them from commits.

## Build, Test, and Development Commands
Use Node.js 20+. Install dependencies with `npm install`. During development run `npm run dev` (tsx watch) or `npm run start` for the compiled bundle. Build distributables with `npm run build` (tsup). Validate code quality via `npm run lint` and `npm run format:check`. Execute the test suite with `npm run test`, and add `--runInBand` when debugging integration hits against live Blockscout endpoints.

## Coding Style & Naming Conventions
Follow the repository ESLint and Prettier configs: 2-space indentation, semicolons enabled, single quotes in TypeScript, and sorted imports where practical. Exported types/interfaces use `PascalCase`, functions and variables use `camelCase`, and constants are `SCREAMING_SNAKE_CASE` only when truly immutable. Co-locate zod schemas with their handlers in `tools/` and prefer explicit return types for exported functions. Run `npm run format` before pushing.

## Testing Guidelines
Vitest is the primary framework. Unit specs belong in `tests/unit/<module>.spec.ts` and integration flows in `tests/integration/`, guarded by environment flags when hitting real APIs. Aim for 90%+ line coverage on pure utility and schema modules; justify gaps in PR notes when external latency or rate limits apply. Mock Blockscout responses to keep CI deterministic, and snapshot only stable payloads.

## Commit & Pull Request Guidelines
Write commit subjects in the imperative mood (e.g., `Add Blockscout client retries`) and keep them under 72 characters. Group related changes together; avoid mixing formatting and feature work in one commit. Pull requests should describe the user-facing impact, list relevant environment variables, and link issues when available. Include screenshots or CLI transcripts if behavior changes. Confirm that lint, format, and tests succeed locally before requesting review.

## Configuration & Environment
Copy `.env.example` to `.env` for local work. Document new keys inline and set sensible defaults so `npm run dev` works without manual tweaks. Respect `BASE_NETWORK` switching between mainnet and Base Sepolia, and allow overrides via CLI flags or env variables without code changes. When adding secrets or tokens, never commit them—use placeholders and update the sample file instead.
