import argparse
import json
import time

import httpx

from infra.gcp import BUILD_BUCKET, PROJECT, REGION, ROOT, STATE, cloud, deploy


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--revision", required=True)
    args = parser.parse_args()
    if len(args.revision) != 40 or any(c not in "0123456789abcdef" for c in args.revision):
        parser.error("Use a full Git commit SHA")
    state = json.loads(STATE.read_text())
    image = f"{REGION}-docker.pkg.dev/{PROJECT}/code-groove/runtime:{args.revision}"
    build = cloud(
        "builds",
        "submit",
        ".",
        "--config=cloudbuild.yaml",
        f"--substitutions=_IMAGE={image}",
        f"--service-account=projects/{PROJECT}/serviceAccounts/{state['accounts']['build']}",
        f"--gcs-source-staging-dir=gs://{BUILD_BUCKET}/source",
        "--async",
        json_output=True,
    )
    print(f"Cloud Build {build['id']}", flush=True)
    for _ in range(240):
        status = cloud("builds", "describe", build["id"], json_output=True)["status"]
        if status == "SUCCESS":
            break
        if status in ("FAILURE", "CANCELLED", "TIMEOUT", "INTERNAL_ERROR", "EXPIRED"):
            raise RuntimeError(f"Build ended: {status}")
        time.sleep(5)
    else:
        raise RuntimeError("Build polling deadline exceeded")
    deploy(image)
    saved = json.loads((ROOT / ".local/deploy-settings.json").read_text())
    response = httpx.get(f"{saved['web_url']}/healthz", timeout=30)
    response.raise_for_status()
    if response.json().get("status") != "ok":
        raise RuntimeError("Health response invalid")
    print("Deployment health verified", flush=True)


if __name__ == "__main__":
    main()
