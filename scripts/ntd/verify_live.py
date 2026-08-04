# -*- coding: utf-8 -*-
"""verify_live.py - prove the NTD channel actually reached the live site.

`gh workflow run deploy-pages.yml` is asynchronous: without this step a weekly
run could go green while the Pages deploy failed - files in the repository,
old site (plan R12, D-12; Codex r4 #3/#4).

Order matters (Codex r7 #1). The check is anchored on the run-unique
`check_id`, NOT on the snapshot hash: in a quiet week the snapshot does not
change, so "live sha == repo sha" would pass INSTANTLY against a stale cached
answer even if nothing was delivered.

    1. wait until https://ai-vibes.ru/idm/last-check.json carries the check_id
       this run just committed;
    2. compare the live manifest's ntd_snapshot_sha256 with the repo manifest;
    3. download the snapshot named by the live manifest and hash its body.

    python scripts/ntd/verify_live.py [--timeout 900]

SCORE suite=ntd-verify-live exp=<x>: waited_s=N check_id_ok=1 manifest_sha_ok=1
      snapshot_sha_ok=1
"""
import argparse
import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
BASE_URL = "https://ai-vibes.ru/idm/"
POLL_SECONDS = 15


def get(url):
    req = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("--exp", default="cron")
    ap.add_argument("--timeout", type=int, default=900)
    ap.add_argument("--repo-root", default=str(REPO_ROOT))
    a = ap.parse_args()

    pub = Path(a.repo_root) / "idm"
    want_id = json.loads((pub / "last-check.json").read_text(
        encoding="utf-8"))["check_id"]
    want_manifest = json.loads((pub / "version.json").read_text(
        encoding="utf-8"))

    t0 = time.time()
    while True:
        waited = int(time.time() - t0)
        try:
            live_id = json.loads(get(BASE_URL + "last-check.json")
                                 )["check_id"]
        except (urllib.error.URLError, ValueError, KeyError) as exc:
            live_id = "<%s>" % type(exc).__name__
        if live_id == want_id:
            break
        if waited >= a.timeout:
            print("VERIFY-LIVE VERDICT: FAIL check_id not delivered in %d s "
                  "(live=%s want=%s)" % (waited, live_id, want_id))
            sys.exit(1)
        print("  ждём выкатку: live check_id=%s (%d c)" % (live_id, waited),
              flush=True)
        time.sleep(POLL_SECONDS)

    live_manifest = json.loads(get(BASE_URL + "version.json"))
    manifest_ok = (live_manifest.get("ntd_snapshot_sha256")
                   == want_manifest["ntd_snapshot_sha256"])
    body = get(live_manifest["ntd_snapshot_url"])
    snapshot_ok = (hashlib.sha256(body).hexdigest()
                   == live_manifest["ntd_snapshot_sha256"])

    print("SCORE suite=ntd-verify-live exp=%s: waited_s=%d check_id_ok=1 "
          "manifest_sha_ok=%d snapshot_sha_ok=%d"
          % (a.exp, int(time.time() - t0), 1 if manifest_ok else 0,
             1 if snapshot_ok else 0))
    ok = manifest_ok and snapshot_ok
    print("VERIFY-LIVE VERDICT:", "PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
