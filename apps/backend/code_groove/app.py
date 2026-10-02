import copy
import json
import re
import time
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import Field
from starlette.middleware.gzip import GZipMiddleware

from code_groove.auth import FirebaseVerifier
from code_groove.errors import GrooveError
from code_groove.http_limits import BodyLimitMiddleware
from code_groove.jobs import JobService
from code_groove.schemas import Contract, Evidence, Id, SemanticMap
from code_groove.settings import ROOT, Settings
from code_groove.source import parse_github_url, run_node
from code_groove.storage import ArtifactStore, MetadataStore, Transaction
from code_groove.validation import validate_candidate

SAMPLES = (
    "cohesive",
    "scattered",
    "mixed",
    "justified",
    "orchestrator",
    "recorded-scattered",
    "recorded-justified",
    "recorded-returns-before",
    "recorded-returns-after",
)


class Source(Contract):
    kind: Literal["github_public", "sample"]
    url: str | None = Field(default=None, max_length=300)
    ref: str | None = Field(default=None, max_length=120, pattern=r"^[\w./-]+$")
    sample_id: (
        Literal[
            "cohesive", "scattered", "mixed", "justified", "orchestrator", "returns-before", "returns-after"
        ]
        | None
    ) = None


class CreateProject(Contract):
    source: Source
    label: str | None = Field(default=None, max_length=80)


class Selection(Contract):
    scene_id: Id
    unit_ids: list[Id] = Field(default_factory=list, max_length=32)
    event_ids: list[Id] = Field(default_factory=list, max_length=96)
    question: str = Field(min_length=1, max_length=1000)


class TaskBody(Contract):
    run_id: Id | None = None
    project_id: Id | None = None


def create_app(settings: Settings | None = None, verifier: Callable[[str], str] | None = None) -> FastAPI:
    settings = settings or Settings()
    settings.validate_runtime()
    store, artifacts = MetadataStore(settings), ArtifactStore(settings)
    jobs, verify = JobService(settings, store, artifacts), verifier or FirebaseVerifier(settings)
    app = FastAPI(title="Code Groove", docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(BodyLimitMiddleware)
    app.state.store, app.state.artifacts, app.state.jobs = store, artifacts, jobs

    @app.exception_handler(GrooveError)
    async def handle_error(_request: Request, exc: GrooveError) -> JSONResponse:
        return JSONResponse(
            {"error": {"code": exc.code, "message": exc.message, "retryable": exc.retryable}},
            status_code=exc.status,
        )

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_request: Request, _exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            {"error": {"code": "INVALID_REQUEST", "message": "入力の形式または上限を確認してください。"}},
            status_code=400,
        )

    @app.middleware("http")
    async def protection(request: Request, call_next: Callable) -> Response:
        if settings.app_role == "web" and request.url.path.startswith("/internal/"):
            return JSONResponse(
                {"error": {"code": "NOT_FOUND", "message": "対象が見つかりません。"}}, status_code=404
            )
        length = request.headers.get("content-length", "0")
        if not length.isdigit() or int(length) > 131072:
            return JSONResponse(
                {"error": {"code": "REQUEST_TOO_LARGE", "message": "入力が大きすぎます。"}}, status_code=413
            )
        if request.method in ("POST", "DELETE", "PATCH") and request.url.path.startswith("/api/"):
            allowed = {settings.public_base_url.rstrip("/")}
            if settings.environment == "local":
                allowed |= {"http://localhost:5173", "http://127.0.0.1:5173", "http://testserver"}
            if request.headers.get("origin") and request.headers["origin"] not in allowed:
                return JSONResponse(
                    {"error": {"code": "ORIGIN_DENIED", "message": "この送信元は許可されていません。"}},
                    status_code=403,
                )
        response = await call_next(request)
        response.headers.update(
            {
                "X-Content-Type-Options": "nosniff",
                "Referrer-Policy": "no-referrer",
                "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
                "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data:; font-src 'self'; media-src 'self' blob:; worker-src 'self' blob:; "
                "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; "
                "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
            }
        )
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    def uid(authorization: Annotated[str | None, Header()] = None) -> str:
        if not authorization or not authorization.startswith("Bearer "):
            raise GrooveError("AUTH_REQUIRED", "ログインしてください。", 401)
        user = verify(authorization[7:])
        if not (store.get("accounts", user) or {}).get("enabled"):
            raise GrooveError("ACCOUNT_NOT_ALLOWED", "このアカウントは利用許可されていません。", 403)
        return user

    def own(collection: str, identifier: str, user: str, parent: bool = True) -> dict:
        if not re.fullmatch(r"[a-zA-Z0-9_-]{1,80}", identifier):
            raise GrooveError("NOT_FOUND", "対象が見つかりません。", 404)
        value = store.get(collection, identifier)
        if not value or value.get("owner_uid") != user or value.get("status") in ("deleting", "deleted"):
            raise GrooveError("NOT_FOUND", "対象が見つかりません。", 404)
        if value.get("expires_at", 0) <= time.time():
            raise GrooveError("EXPIRED", "保存期限（7日）が過ぎています。", 410)
        if parent and collection != "projects":
            own("projects", value["project_id"], user, False)
        return value

    def idem(key: Annotated[str | None, Header(alias="Idempotency-Key")] = None) -> str:
        if not key or not re.fullmatch(r"[a-zA-Z0-9_-]{8,128}", key):
            raise GrooveError("IDEMPOTENCY_KEY_REQUIRED", "要求の識別キーが必要です。", 400)
        return key

    User = Annotated[str, Depends(uid)]
    Key = Annotated[str, Depends(idem)]

    @app.get("/health")
    @app.get("/healthz")
    def health() -> dict:
        return {"status": "ok"}

    @app.get("/readyz")
    def ready() -> dict:
        return {"status": "ready", "role": settings.app_role}

    if settings.app_role == "worker":

        @app.post("/internal/tasks/run")
        async def run_task(body: TaskBody) -> dict:
            if not body.run_id:
                raise GrooveError("INVALID_REQUEST", "run_idが必要です。")
            await jobs.handle(body.run_id)
            return {"status": "ok"}

        @app.post("/internal/tasks/delete")
        def delete_task(body: TaskBody) -> dict:
            if not body.project_id:
                raise GrooveError("INVALID_REQUEST", "project_idが必要です。")
            jobs.delete(body.project_id)
            return {"status": "ok"}

        return app

    @app.get("/api/v1/config")
    def config() -> dict:
        return {
            "data": {
                "live_enabled": settings.enable_live_analysis,
                "model_id": settings.gemini_model,
                "firebase": {
                    "apiKey": settings.firebase_api_key,
                    "authDomain": settings.firebase_auth_domain,
                    "projectId": settings.google_cloud_project,
                    "appId": settings.firebase_app_id,
                },
            }
        }

    @app.get("/api/v1/samples")
    def samples() -> dict:
        return {"data": [{"sample_id": name} for name in SAMPLES]}

    @app.get("/api/v1/samples/{sample_id}/bundle")
    def sample_bundle(sample_id: str) -> dict:
        if sample_id not in SAMPLES:
            raise GrooveError("NOT_FOUND", "サンプルが見つかりません。", 404)
        file = (
            ROOT
            / "fixtures"
            / (
                f"recorded-live/{sample_id.removeprefix('recorded-')}.json"
                if sample_id.startswith("recorded-")
                else f"{sample_id}.json"
            )
        )
        bundle = json.loads(file.read_text(encoding="utf-8"))
        if bundle["score"]["scenes"][0]["repo"]["grammar_version"] != "groove-arrangement-v4":
            kit = json.loads((ROOT / "apps/web/public/audio/midnight-jazz-v3/manifest.json").read_text())
            bundle["score"] = run_node("groove-core", {"map": bundle["map"], "kit_hash": kit["kit_hash"]})
        return {"data": bundle}

    @app.post("/api/v1/projects", status_code=202)
    def create_project(body: CreateProject, user: User, key: Key) -> dict:
        if body.source.kind == "github_public":
            if not body.source.url or body.source.sample_id:
                raise GrooveError("INVALID_SOURCE_URL", "公開GitHub URLを指定してください。")
            parse_github_url(body.source.url)
        elif not body.source.sample_id or body.source.url or body.source.ref:
            raise GrooveError("INVALID_SOURCE", "内蔵サンプルを指定してください。")
        return {"data": jobs.create(user, body.model_dump(mode="json"), key)}

    @app.get("/api/v1/projects")
    def list_projects(user: User) -> dict:
        return {
            "data": [
                {k: v for k, v in item.items() if k not in ("owner_uid", "snapshot_key")}
                for item in sorted(
                    store.list("projects", "owner_uid", user), key=lambda p: p["created_at"], reverse=True
                )
                if item["expires_at"] > time.time() and item["status"] not in ("deleting", "deleted")
            ]
        }

    @app.get("/api/v1/projects/{project_id}")
    def get_project(project_id: str, user: User) -> dict:
        return {
            "data": {
                k: v
                for k, v in own("projects", project_id, user).items()
                if k not in ("owner_uid", "snapshot_key")
            }
        }

    def snapshot_for(project: dict) -> dict:
        if not project.get("snapshot_key"):
            raise GrooveError("NOT_READY", "スナップショットを準備しています。", 409)
        return artifacts.get(project["snapshot_key"])

    @app.get("/api/v1/projects/{project_id}/files")
    def get_files(project_id: str, user: User) -> dict:
        return {"data": snapshot_for(own("projects", project_id, user))["index"]}

    @app.get("/api/v1/projects/{project_id}/source")
    def get_source(
        project_id: str, file_id: Id, user: User, start: int = Query(1, ge=1), end: int = Query(200, ge=1)
    ) -> dict:
        snapshot = snapshot_for(own("projects", project_id, user))
        file = next((f for f in snapshot["index"]["files"] if f["file_id"] == file_id), None)
        if not file or end < start or end - start >= 200:
            raise GrooveError("INVALID_SELECTION", "最大200行の範囲を指定してください。")
        return {
            "data": {
                "file_id": file_id,
                "path": file["path"],
                "start": start,
                "source": "\n".join(snapshot["sources"][file["path"]].splitlines()[start - 1 : end]),
            }
        }

    @app.post("/api/v1/projects/{project_id}/analyses", status_code=202)
    def reanalyze(project_id: str, user: User, key: Key) -> dict:
        project = own("projects", project_id, user)
        return {
            "data": jobs.create(user, {"source": project["source"], "refresh": True}, key, project=project)
        }

    def bundle_for(analysis_id: str, user: str) -> dict:
        return artifacts.get(own("analyses", analysis_id, user)["artifact_key"])

    @app.get("/api/v1/projects/{project_id}/bundle")
    def project_bundle(project_id: str, user: User, analysis: str | None = None) -> dict:
        project = own("projects", project_id, user)
        identifier = analysis or project.get("latest_analysis_id")
        if not identifier:
            raise GrooveError("NOT_READY", "実解析が完了していません。", 409)
        meta = own("analyses", identifier, user)
        if meta["project_id"] != project_id:
            raise GrooveError("NOT_FOUND", "対象が見つかりません。", 404)
        snapshot = artifacts.get(meta["snapshot_key"]) if meta.get("snapshot_key") else snapshot_for(project)
        bundle = artifacts.get(meta["artifact_key"])
        if bundle["score"]["scenes"][0]["repo"]["grammar_version"] != "groove-arrangement-v4":
            kit = json.loads((ROOT / "apps/web/public/audio/midnight-jazz-v3/manifest.json").read_text())
            bundle["score"] = run_node("groove-core", {"map": bundle["map"], "kit_hash": kit["kit_hash"]})
        return {"data": {**bundle, "sources": snapshot["sources"]}}

    @app.get("/api/v1/analyses/{analysis_id}")
    def get_analysis(analysis_id: str, user: User) -> dict:
        return {"data": bundle_for(analysis_id, user)["map"]}

    @app.get("/api/v1/analyses/{analysis_id}/score")
    def get_score(analysis_id: str, user: User) -> dict:
        return {"data": bundle_for(analysis_id, user)["score"]}

    @app.post("/api/v1/analyses/{analysis_id}/investigations", status_code=202)
    def investigate(analysis_id: str, body: Selection, user: User, key: Key) -> dict:
        meta = own("analyses", analysis_id, user)
        project = own("projects", meta["project_id"], user)
        bundle = artifacts.get(meta["artifact_key"])
        scene = next((s for s in bundle["score"]["scenes"] if s["scene_id"] == body.scene_id), None)
        selected_events = {e["event_id"]: e for e in bundle["map"]["events"]}
        if (
            not scene
            or not (body.unit_ids or body.event_ids)
            or not set(body.unit_ids) <= set(scene["unit_ids"])
            or any(
                e not in selected_events or selected_events[e]["unit_id"] not in scene["unit_ids"]
                for e in body.event_ids
            )
        ):
            raise GrooveError("INVALID_SELECTION", "現在のシーン内の小節か意味イベントを選択してください。")
        if project.get("latest_analysis_id") != analysis_id:
            raise GrooveError("STALE_BASE_ANALYSIS", "最新の解釈を選択してください。", 409)
        return {
            "data": jobs.create(
                user, {**body.model_dump(), "analysis_id": analysis_id}, key, "investigation", project
            )
        }

    @app.get("/api/v1/investigations/{investigation_id}")
    def get_investigation(investigation_id: str, user: User) -> dict:
        return {"data": artifacts.get(own("investigations", investigation_id, user)["artifact_key"])}

    @app.post("/api/v1/investigations/{investigation_id}/publish-interpretation")
    def publish(investigation_id: str, user: User) -> dict:
        meta = own("investigations", investigation_id, user)
        result = artifacts.get(meta["artifact_key"])
        project = own("projects", meta["project_id"], user)
        previous = result["base_analysis_id"]
        if project.get("latest_analysis_id") != previous:
            raise GrooveError("STALE_BASE_ANALYSIS", "解釈が更新されています。", 409)
        if not result["suggested_reclassification"]:
            raise GrooveError("NO_RECLASSIFICATION", "公開する再分類提案がありません。", 409)
        semantic = copy.deepcopy(bundle_for(previous, user)["map"])
        semantic["responsibilities"].extend(result["new_responsibilities"])
        semantic["evidence"].extend(result["evidence"])
        by_id = {e["event_id"]: e for e in semantic["events"]}
        for change in result["suggested_reclassification"]:
            event = by_id.get(change["event_id"])
            if not event or event["responsibility_id"] != change["from_responsibility_id"]:
                raise GrooveError("INVALID_ANALYSIS", "再分類元が一致しません。")
            event["responsibility_id"] = change["to_responsibility_id"]
            event["evidence_ids"] = list(dict.fromkeys(event["evidence_ids"] + change["evidence_ids"]))
        orders: dict[str, int] = {}
        for event in sorted(semantic["events"], key=lambda e: (e["semantic_order"], e["event_id"])):
            rid = event["responsibility_id"]
            event["semantic_order"] = orders.get(rid, 0)
            orders[rid] = event["semantic_order"] + 1
        identifier = f"analysis_{uuid.uuid4().hex}"
        semantic.update(
            analysis_id=identifier, parent_analysis_id=previous, created_at=datetime.now(UTC).isoformat()
        )
        model = SemanticMap.model_validate(semantic)
        validate_candidate(
            model, snapshot_for(project)["index"], [Evidence(**e) for e in semantic["evidence"]]
        )
        kit = json.loads((ROOT / "apps/web/public/audio/midnight-jazz-v3/manifest.json").read_text())
        score = run_node("groove-core", {"map": semantic, "kit_hash": kit["kit_hash"]})
        artifact_key = f"projects/{project['project_id']}/analyses/{identifier}/bundle.json.gz"
        artifacts.put(artifact_key, {"map": semantic, "score": score})

        def operation(tx: Transaction) -> None:
            current = tx.get("projects", project["project_id"])
            if current["status"] in ("deleting", "deleted") or current.get("latest_analysis_id") != previous:
                raise GrooveError("STALE_BASE_ANALYSIS", "解釈が更新されています。", 409)
            tx.put(
                "analyses",
                identifier,
                {
                    **meta,
                    "artifact_key": artifact_key,
                    "base_analysis_id": previous,
                    "created_at": time.time(),
                    "updated_at": time.time(),
                },
            )
            tx.put(
                "projects",
                project["project_id"],
                {**current, "latest_analysis_id": identifier, "updated_at": time.time()},
            )

        store.atomic(operation)
        return {"data": {"analysis_id": identifier}}

    @app.get("/api/v1/runs/{run_id}")
    def get_run(run_id: str, user: User) -> dict:
        return {
            "data": {
                k: v
                for k, v in own("runs", run_id, user).items()
                if k not in ("owner_uid", "body", "attempt_id", "quota_id", "quota_date")
            }
        }

    @app.get("/api/v1/runs/{run_id}/events")
    def events(
        run_id: str, user: User, after_seq: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=100)
    ) -> dict:
        own("runs", run_id, user)
        values = sorted(store.list("run_events", "run_id", run_id), key=lambda e: e["seq"])
        return {
            "data": [
                {k: e[k] for k in ("seq", "type", "timestamp", "payload")}
                for e in values
                if e["seq"] > after_seq
            ][:limit]
        }

    @app.post("/api/v1/runs/{run_id}/cancel")
    def cancel(run_id: str, user: User) -> dict:
        own("runs", run_id, user)
        return {"data": {"run_id": run_id, "cancel_requested": jobs.cancel(run_id)}}

    @app.post("/api/v1/projects/{project_id}/retry-enqueue", status_code=202)
    def retry_enqueue(project_id: str, user: User) -> dict:
        project = own("projects", project_id, user)
        run = own("runs", project["run_id"], user)
        jobs.enqueue(run)
        return {"data": {"project_id": project_id, "run_id": run["run_id"]}}

    @app.delete("/api/v1/projects/{project_id}", status_code=202)
    def delete_project(project_id: str, user: User) -> dict:
        project = store.get("projects", project_id)
        if project and project.get("owner_uid") == user and project["status"] == "deleting":
            jobs.enqueue_delete(project_id)
        else:
            own("projects", project_id, user)
            store.update("projects", project_id, {"status": "deleting"})
            jobs.enqueue_delete(project_id)
        return {"data": {"project_id": project_id, "status": "deleting"}}

    @app.get("/{path:path}", include_in_schema=False)
    def static(path: str) -> FileResponse:
        if path.startswith(("api/", "internal/")):
            raise GrooveError("NOT_FOUND", "対象が見つかりません。", 404)
        root = (ROOT / "dist/web").resolve()
        candidate = (root / path).resolve()
        if not candidate.is_relative_to(root):
            raise GrooveError("NOT_FOUND", "対象が見つかりません。", 404)
        if candidate.is_file():
            return FileResponse(candidate)
        if (root / "index.html").is_file() and (
            not path or re.fullmatch(r"projects/[a-zA-Z0-9_-]{1,80}/(arrange|inspect)", path)
        ):
            return FileResponse(root / "index.html")
        raise GrooveError("NOT_FOUND", "対象が見つかりません。", 404)

    return app


app = create_app()
