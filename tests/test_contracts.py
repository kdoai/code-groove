import pytest
from code_groove.schemas import Span
from code_groove.settings import Settings
from pydantic import ValidationError


def test_span_rejects_unsafe_id_and_extra_fields():
    with pytest.raises(ValidationError):
        Span(file_id="../key", path="src/x.ts", start_line=1, end_line=1)
    with pytest.raises(ValidationError):
        Span(file_id="safe", path="src/x.ts", start_line=1, end_line=1, secret="x")


def test_production_refuses_fixture_and_local_storage():
    with pytest.raises(RuntimeError):
        Settings(environment="production").validate_runtime()
