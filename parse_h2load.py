#!/usr/bin/env python3
"""Parse h2load's plain-text stdout into a structured JSON result line.

Usage: parse_h2load.py <h2load_output_file> <config> <group> <port>
"""
import json
import re
import sys


def to_ms(value: str) -> float:
    m = re.match(r"([\d.]+)(us|ms|s)$", value.strip())
    if not m:
        raise ValueError(f"cannot parse duration: {value!r}")
    num, unit = float(m.group(1)), m.group(2)
    return {"us": num / 1000.0, "ms": num, "s": num * 1000.0}[unit]


def main() -> None:
    out_path, config, group, port = sys.argv[1:5]
    text = open(out_path, encoding="utf-8", errors="replace").read()

    req_line = re.search(
        r"requests:\s*(\d+) total,\s*(\d+) started,\s*(\d+) done,\s*(\d+) succeeded,"
        r"\s*(\d+) failed,\s*(\d+) errored,\s*(\d+) timeout",
        text,
    )
    if not req_line:
        raise SystemExit(f"could not find requests summary in {out_path}")
    total, started, done, succeeded, failed, errored, timeout = (
        int(x) for x in req_line.groups()
    )
    error_count = failed + errored + timeout

    connect_line = re.search(
        r"time for connect:\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)", text
    )
    request_line = re.search(
        r"time for request:\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)", text
    )
    rps_line = re.search(r"req/s\s*:\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)", text)

    if not (connect_line and request_line and rps_line):
        raise SystemExit(f"could not find latency/rps summary lines in {out_path}")

    avg_connect_ms = to_ms(connect_line.group(3))
    avg_request_ms = to_ms(request_line.group(3))
    avg_rps_per_client = float(rps_line.group(3))

    result = {
        "config": config,
        "group": group,
        "port": int(port),
        "requests_total": total,
        "requests_succeeded": succeeded,
        "error_count": error_count,
        "avg_connection_establishment_time_ms": round(avg_connect_ms, 4),
        "avg_request_latency_ms": round(avg_request_ms, 4),
        "requests_per_second_per_client": round(avg_rps_per_client, 4),
    }
    print(json.dumps(result))


if __name__ == "__main__":
    main()
