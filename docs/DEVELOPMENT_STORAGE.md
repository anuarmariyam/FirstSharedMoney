# Development Storage

## Current checked locations

Project source, dependencies, build output, and test artifacts stay inside
D:\FirstSharedMoney. The user-level npm cache is D:\npm-cache. This phase's npx
CLI downloads use a process-scoped NPM_CONFIG_CACHE at
D:\FirstSharedMoney\node_modules\.cache\npm. Supabase CLI 3.1.0 was obtained
through npx, without a global installation or Docker.

Commands that launch the CLI or browsers should set process-scoped TEMP/TMP to
node_modules\.cache\cli-tmp or node_modules\.cache\browser-tmp respectively.
No system/user TEMP, TMP, PATH, or registry setting was changed.

| Location | Observed status / action |
| --- | --- |
| C:\Users\Huawei\AppData\Local\npm-cache | Exists; retained. New task commands use D. |
| C:\Users\Huawei\AppData\Local\ms-playwright | Not present. Tests use the installed Edge browser. |
| C:\Users\Huawei\.codex\cache and sessions | Exist and remain active; not moved. |
| C:\Users\Huawei\.codex\logs_2.sqlite and session/state SQLite files | Exist and may have active WAL files; not moved or deleted. |
| C:\Users\Huawei\.vscode\extensions | Exists; retained. |
| C:\Users\Huawei\AppData\Roaming\Code | Exists; retained. |
| C:\Users\Huawei\AppData\Local\Temp | Remains the system/user default; only child-process overrides are used. |
| C:\Users\Huawei\.supabase and AppData\Local\supabase | Not present at the initial audit. Later CLI login may use Windows credential storage. |
| D:\FirstSharedMoney\artifacts | Playwright screenshots/test output; ignored by Git. |
| D:\FirstSharedMoney\supabase\.temp | CLI project metadata when linked; ignored by Git. |

This was a targeted existence check, not a recursive scan of C. No caches,
history, programs, extensions, or AppData directories were removed or moved.

## Future relocation recommendations

For a future VS Code session, consider a separately configured portable install
on D or explicit user-data and extensions directories. Review the official
[portable-mode documentation](https://code.visualstudio.com/docs/editor/portable)
and back up settings before changing the launch configuration. Do not move the
current installation or AppData during this session.

Codex's active session, authentication, and SQLite files should stay where they
are until the application is fully closed and its supported storage configuration
has been checked. A future D:\DevTools\Codex location is only a proposal; no
relocation or new CODEX_HOME has been configured.

No separate Playwright browser download is needed while the installed Edge
channel works. If downloads become necessary, set PLAYWRIGHT_BROWSERS_PATH to
a D location before installing browsers and keep that setting for test runs.

Windows and installed tools may still use C for some operating-system files.
