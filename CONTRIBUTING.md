# Contributing to House Pot

Thanks for helping improve House Pot. This project is a Hacktoberfest “Build for a Friend” kitchen app: **approve first, then listen**.

## Before you start

- Read [`README.md`](./README.md) for setup, architecture, and API overview.
- Challenge narrative and demo expectations: [`SUBMISSION.md`](./SUBMISSION.md).
- Follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Local development

```bash
npm ci
cp .env.example .env.local   # never commit .env.local
npm run dev
```

Optional: Ollama (`gemma3:4b`), MongoDB Atlas URI, `ELEVENLABS_API_KEY` for narration, Python + `requirements.txt` for Whisper/TabPFN locally.

## Pull requests

1. Fork and branch from `main` (`feat/…`, `fix/…`, or `docs/…`).
2. Keep changes focused; match existing TypeScript and Tailwind patterns.
3. Run checks before opening a PR:

   ```bash
   npm run lint
   npm test
   npm run build
   ```

4. Do **not** commit secrets, `.env.local`, or production API keys.
5. If you change UI or integrations probes, update README or SUBMISSION when behavior is user-visible.
6. Describe what you tested (local propose → approve → narrate, or API-only).

## Demo assets

Judges use `public/demo.mp4` and `public/demo-screenshots/`. Regenerate only when asked or when the live UI changed materially:

```bash
BASE_URL=https://house-pot.onrender.com npm run demo:screenshots
npm run demo:from-screenshots   # requires ELEVENLABS_API_KEY in .env.local
```

## Reporting issues

- **Bugs and features:** [GitHub Issues](https://github.com/smriad/house-pot/issues).
- **Security:** see [`.github/SECURITY.md`](./.github/SECURITY.md) (private report preferred).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE).
