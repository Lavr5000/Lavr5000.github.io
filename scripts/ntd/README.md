# scripts/ntd — NTD channel of the IDmaster distribution (project R12)

Publishes two static files that the IDmaster workbook's "Обновить нормативы"
button consumes:

```
https://ai-vibes.ru/idm/version.json                 manifest (stable name)
https://ai-vibes.ru/idm/ntd-snapshot.<64 hex>.json   snapshot (content-addressed)
https://ai-vibes.ru/idm/last-check.json              freshness / delivery proof
```

`.github/workflows/idm-ntd-publish.yml` runs `ntd_publish.py` weekly. It
rebuilds the snapshot from the Rosstandart SP registry, refuses to publish
anything that fails a check, commits only what changed, dispatches the Pages
deploy and then proves with `verify_live.py` that the change actually reached
the live site.

Nothing here touches the site's pages, styles or scripts: only the `idm/`
directory is written.

## Vendored files — DO NOT EDIT HERE

`make_sp_snapshot.py` and `ntd_snapshot.py` are byte-identical copies. Their
source of truth lives in the IDmaster project:

| file | upstream |
| --- | --- |
| `make_sp_snapshot.py` | `Clean-room/Э-UX-R2/rebuild-sandbox/scripts/make_sp_snapshot.py` |
| `ntd_snapshot.py` | `Clean-room/Э-UX-R2/eval-ntd/ntd_snapshot.py` |

Drift is caught by the IDmaster regression gate `ntd-vendor`
(`vendored_sha_equal=2/2`), which compares both files across the two repos.
Edit upstream, then re-copy — never patch the copy.

`anchors.json` holds the SP designations the workbook pre-fills; equality with
`book_schema.STANDARDS_PREFILL` is proven by the same gate
(`anchors_match=6/6`).

## Manual runs

```
# real collect + all checks, writes nothing (what every pull request runs)
python scripts/ntd/ntd_publish.py --exp preflight --dry-live

# exercise the failure path without touching the network
python scripts/ntd/ntd_publish.py --exp probe --probe-refusal
```
