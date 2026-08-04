# -*- coding: utf-8 -*-
"""ntd_publish.py - rebuild and publish the IDmaster NTD snapshot (R12, D-11).

Weekly job behind `.github/workflows/idm-ntd-publish.yml`. Publishes into the
site repository, which GitHub Pages serves as https://ai-vibes.ru/ :

    idm/version.json                        manifest, stable name
    idm/ntd-snapshot.<64 hex sha256>.json   snapshot, content-addressed
    idm/last-check.json                     proof this run happened + reached

Two-beat publication (plan R12, R-2): the snapshot is written under a NEW name
first, so no in-flight download is ever swapped, and only then the manifest
points at it. A workbook holding an older (or CDN-cached) manifest keeps
resolving its own snapshot until retention removes it.

Fail-closed (R-9): the manifest is rewritten ONLY if the fresh snapshot passes
every check below. Otherwise the run exits non-zero, the workflow goes red and
the working tree is left untouched - nothing is committed, so nothing that was
already published changes.

    P-1 rows > 0                          collector returned something
    P-2 ntd_snapshot.validate() == []     same validator the workbook runs
    P-3 normalized_dup == 0               ambiguous merge key = human's call
    P-4 reparse hash equal                what we wrote parses back identically
    P-5 rows/active >= MIN_RATIO * prev   registry layout change = shrink guard
    P-6 anchors present                   the SP the workbook pre-fills exist
    P-7 empty titles / unknown statuses    <= MAX_JUNK_SHARE each

Snapshot unchanged (R-5): snapshot and manifest are NOT rewritten
(`published=0`), but `last-check.json` still gets a fresh `check_id`. That
tiny commit is what keeps the weekly schedule alive - GitHub disables
scheduled workflows in public repos after 60 days without repository activity.

    python scripts/ntd/ntd_publish.py --exp schedule --check-id 123-1
    python scripts/ntd/ntd_publish.py --exp preflight --dry-live
    python scripts/ntd/ntd_publish.py --exp probe --probe-refusal

SCORE suite=ntd-publish exp=<x>: rows=N active=N prev_rows=N ratio=F
      anchors=N/N empty_title=F unknown_status=F published=0|1 dry=0|1
      sha=<64 hex> kept=N pruned=N dur_ms=N
"""
import argparse
import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import make_sp_snapshot as MS                                   # noqa: E402
import ntd_snapshot as NS                                       # noqa: E402

REPO_ROOT = HERE.parent.parent
PUB_DIRNAME = "idm"
BASE_URL = "https://ai-vibes.ru/idm/"       # константа: подменять некому
APP_VERSION = "0.6.0"                       # = AppConfig.APP_VERSION (R-3)
MANIFEST_NAME = "version.json"
LASTCHECK_NAME = "last-check.json"
SNAP_PREFIX = "ntd-snapshot."
SNAP_SUFFIX = ".json"
RETENTION_DAYS = 90
MIN_RATIO = 0.9
MAX_JUNK_SHARE = 0.02


class Refused(RuntimeError):
    """A check said no. Nothing is written, so nothing published changes."""


def snap_name(sha):
    return "%s%s%s" % (SNAP_PREFIX, sha, SNAP_SUFFIX)


def is_snap_name(name):
    core = name[len(SNAP_PREFIX):-len(SNAP_SUFFIX)]
    return (name.startswith(SNAP_PREFIX) and name.endswith(SNAP_SUFFIX)
            and len(core) == 64
            and all(c in "0123456789abcdef" for c in core))


# --- what is published right now -------------------------------------------

def published_previous(pub_dir):
    """(rows, active, sha) of the snapshot the CURRENT manifest points at.

    The manifest carries no counters by design, so the numbers come from the
    snapshot FILE it names (Codex r4 #2). No manifest yet = first publication:
    the caller then skips the shrink check explicitly.
    """
    man = pub_dir / MANIFEST_NAME
    if not man.exists():
        return 0, 0, ""
    try:
        data = json.loads(man.read_text(encoding="utf-8"))
    except ValueError:
        return 0, 0, ""
    sha = str(data.get("ntd_snapshot_sha256", ""))
    path = pub_dir / str(data.get("ntd_snapshot_url", "")).rsplit("/", 1)[-1]
    if not path.name or not path.exists():
        return 0, 0, sha
    counts = NS.counts(NS.to_records(NS.load(path)))
    return counts["rows"], counts["by_status"].get("ACTIVE", 0), sha


# --- checks -----------------------------------------------------------------

def check(snap, prev_rows, prev_active, anchors):
    recs = NS.to_records(snap)
    counts = NS.counts(recs)
    rows, active = counts["rows"], counts["by_status"].get("ACTIVE", 0)

    if not rows:                                                       # P-1
        raise Refused("collector returned 0 rows")
    errs = NS.validate(snap)                                           # P-2
    if errs:
        raise Refused("schema: %s" % "; ".join(errs[:3]))
    if counts["normalized_dup"]:                                       # P-3
        raise Refused("normalized_dup=%d - ambiguous merge key"
                      % counts["normalized_dup"])

    if prev_rows:                                                      # P-5
        r_rows = rows / float(prev_rows)
        r_active = active / float(prev_active or 1)
        if r_rows < MIN_RATIO or r_active < MIN_RATIO:
            raise Refused("shrink: rows %d->%d (%.3f), active %d->%d (%.3f), "
                          "min_ratio=%.2f"
                          % (prev_rows, rows, r_rows, prev_active, active,
                             r_active, MIN_RATIO))
        ratio = min(r_rows, r_active)
    else:
        ratio = 1.0                       # first publication: nothing to shrink from

    keys = {r["key"] for r in recs}                                    # P-6
    missing = [a for a in anchors if NS.norm_designation(a) not in keys]
    if missing:
        raise Refused("anchors missing: %s" % ", ".join(missing))

    empty = sum(1 for r in recs if not r["title"]) / float(rows)       # P-7
    unknown = sum(1 for r in recs if not r["status_code"]) / float(rows)
    if empty > MAX_JUNK_SHARE or unknown > MAX_JUNK_SHARE:
        raise Refused("junk: empty_title=%.3f unknown_status=%.3f (max %.2f)"
                      % (empty, unknown, MAX_JUNK_SHARE))
    return rows, active, ratio, empty, unknown, len(anchors) - len(missing)


def records_hash(data):
    return hashlib.sha256(json.dumps(NS.to_records(data), ensure_ascii=False,
                                     sort_keys=True).encode()).hexdigest()


def snapshot_bytes(snap):
    return json.dumps(snap, ensure_ascii=False, indent=1).encode("utf-8")


# --- publication ------------------------------------------------------------

def prune(pub_dir, keep_name):
    """Drop snapshots older than retention EXCEPT the one the manifest points
    at: an aged-out file that is still referenced would break every workbook
    holding that manifest (Codex r2 #2)."""
    cutoff = time.time() - RETENTION_DAYS * 86400
    kept = pruned = 0
    for f in sorted(pub_dir.iterdir()):
        if not f.is_file() or not is_snap_name(f.name):
            continue
        if f.name == keep_name or f.stat().st_mtime >= cutoff:
            kept += 1
            continue
        f.unlink()
        pruned += 1
    return kept, pruned


def write_snapshot_and_manifest(pub_dir, snap, sha):
    target = pub_dir / snap_name(sha)
    target.write_bytes(snapshot_bytes(snap))                    # beat 1
    manifest = {"version": APP_VERSION,
                "ntd_snapshot_url": BASE_URL + target.name,
                "ntd_snapshot_sha256": sha}
    (pub_dir / MANIFEST_NAME).write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8")                                       # beat 2
    return target


def write_last_check(pub_dir, check_id, sha, rows, active, published):
    (pub_dir / LASTCHECK_NAME).write_text(json.dumps(
        {"check_id": check_id,
         "checked_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
         "snapshot_sha256": sha, "rows": rows, "active": active,
         "published": published},
        ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("--exp", default="adhoc")
    ap.add_argument("--check-id", default="")
    ap.add_argument("--repo-root", default=str(REPO_ROOT))
    ap.add_argument("--dry-live", action="store_true",
                    help="real collect + checks, write nothing")
    ap.add_argument("--probe-refusal", action="store_true",
                    help="seam: force a refusal to exercise the failure path")
    a = ap.parse_args()

    t0 = time.time()
    pub_dir = Path(a.repo_root) / PUB_DIRNAME
    pub_dir.mkdir(parents=True, exist_ok=True)
    anchors = json.loads((HERE / "anchors.json").read_text(
        encoding="utf-8"))["anchors"]
    check_id = a.check_id or datetime.now(timezone.utc).strftime(
        "local-%Y%m%dT%H%M%SZ")

    try:
        if a.probe_refusal:
            raise Refused("probe-refusal seam: forced failure, no network used")
        prev_rows, prev_active, prev_sha = published_previous(pub_dir)
        snap = MS.collect()
        rows, active, ratio, empty, unknown, found = check(
            snap, prev_rows, prev_active, anchors)

        sha = hashlib.sha256(snapshot_bytes(snap)).hexdigest()
        if records_hash(json.loads(snapshot_bytes(snap))) != records_hash(snap):
            raise Refused("reparse mismatch - written form does not read back")

        published = 0 if sha == prev_sha else 1
        kept = pruned = 0
        if a.dry_live:
            pass                                   # nothing is written at all
        else:
            if published:
                target = write_snapshot_and_manifest(pub_dir, snap, sha)
                kept, pruned = prune(pub_dir, target.name)
            write_last_check(pub_dir, check_id, sha, rows, active, published)
    except (Refused, MS.FetchFailed) as exc:
        print("NTD-PUBLISH VERDICT: FAIL %s" % exc)
        sys.exit(1)

    print("SCORE suite=ntd-publish exp=%s: rows=%d active=%d prev_rows=%d "
          "ratio=%.3f anchors=%d/%d empty_title=%.3f unknown_status=%.3f "
          "published=%d dry=%d sha=%s kept=%d pruned=%d dur_ms=%d"
          % (a.exp, rows, active, prev_rows, ratio, found, len(anchors),
             empty, unknown, published, 1 if a.dry_live else 0, sha, kept,
             pruned, (time.time() - t0) * 1000))
    print("NTD-PUBLISH VERDICT: PASS")


if __name__ == "__main__":
    main()
