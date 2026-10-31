# Contributing to Lumovio

Thanks for helping! Bug reports, translations, accessibility fixes and player-compatibility
reports are especially valuable. Everyone here follows the [code of conduct](.github/CODE_OF_CONDUCT.md);
a security problem is reported privately ([SECURITY](.github/SECURITY.md)), never in an issue.

## Before you start

- For anything larger than a small fix, open an issue first so we can agree on the approach. The
  issue forms ask for what helps: the device, the server, the file's codecs.
- Develop against the mock API (`pnpm mock`, see the README). Never commit real credentials,
  tokens or server addresses; `.env*` files other than `.env.example` are ignored on purpose.
- Lumovio does not host, index or link to content itself. People play their *own* copies from
  the servers they connect (Jellyfin, Plex, TorrServer), and any release search runs on their
  own TorrServer. Contributions that add built-in content sources, scrapers or tracker
  integrations to Lumovio will not be accepted.

## Pull requests

1. Keep the change focused. Unrelated refactors make reviews slow.
2. `pnpm typecheck && pnpm test && pnpm build` must pass (CI runs them, and builds the Android
   TV app). Lint the files you changed with `pnpm exec biome lint <files>`; the code base isn't
   biome-formatted as a whole, so please don't reformat untouched code.
3. UI text goes through `next-intl`. Add new keys to `messages/en.json`, and to the other
   languages if you can. No hardcoded strings, including `aria-label`s.
4. Check the change on a narrow phone viewport, with the keyboard only, and, for navigation
   changes, in the TV interface (open `/tv`, see the README): arrows, Enter, Back.
5. Player changes: name the browsers and devices you tested and the codecs and containers of
   your test files.
6. Android TV app changes: name the TV or box and its Android version.

This repository is exported from Lumovio's private monorepo. A pull request is reviewed here,
then applied there with your authorship, and the next export brings it back; so it shows as
closed rather than merged.

## Reporting playback problems

Include the browser and OS, the server type and version, the file's container and codecs
(from `ffprobe` or the server's media info), and what the player showed. Never share server
URLs with credentials in public issues.

## License

By contributing you agree that your contributions are licensed under the Apache License 2.0.
