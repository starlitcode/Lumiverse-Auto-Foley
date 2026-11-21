# Security

## What Auto Foley can reach

- **Lumiverse's own routes, as you.** The panel runs in your Lumiverse page. It lists your TTS connections and their voices, reads the message you perform, speaks lines through your TTS connections, and, when you turn it on, saves the finished audio to the message. These are the same routes Lumiverse's own TTS uses.
- **Generation.** It asks the Director, through a connection you pick.
- **Decision models.** It asks the Decision model, through a connection you pick.
- **One outside host:** `api.elevenlabs.io`, through Lumiverse's CORS proxy, for sound effects and for testing the key. Auto Foley calls no other host.
- **Sounds you add by link.** Your browser plays them from the address you gave, as with any link you open. Auto Foley only keeps the link.

## What it keeps

- Settings, the cast with any pictures you picked, and the sound library, in `spindle.userStorage`, under your account.
- With **Keep made audio** on, the lines it spoke and the last 40 directed messages, in the same place. **Clear kept audio** deletes them.
- The sound effects key, in Lumiverse's secure enclave, under your account. It is never sent back to the panel, never put in settings, and only sent to `api.elevenlabs.io`.

## How to check it

- `dist/` is committed as readable JavaScript, and it is the code Lumiverse runs. It is built from `src/` with `bun run build`, which only takes out the types.
- Every push and pull request runs a check that rebuilds `dist/` and fails if it differs from what is committed.
- `package.json` has no install scripts. Nothing runs when Lumiverse installs the extension.

## Reporting a problem

Open an issue at https://github.com/starlitcode/Lumiverse-Auto-Foley/issues. For something that should not be public, say so in the issue, with no details, and the owner will reply.
