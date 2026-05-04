"""Tests for utils.py — Pydantic model generation, prompt interpolation, schema validation."""
import pytest
from pydantic import BaseModel, ValidationError

from utils import (  # type: ignore[import-not-found]
    create_dynamic_pydantic_model,
    interpolate_prompt,
    validate_output_schema,
)


# ----- create_dynamic_pydantic_model -----

class TestCreateDynamicPydanticModel:
    def test_text_field(self):
        Model = create_dynamic_pydantic_model([
            {"name": "summary", "type": "text", "description": "the summary"},
        ])
        assert issubclass(Model, BaseModel)
        instance = Model(summary="hello")
        assert instance.summary == "hello"

    def test_number_field_accepts_int_and_float(self):
        Model = create_dynamic_pydantic_model([
            {"name": "score", "type": "number", "description": ""},
        ])
        # The TYPE_MAPPING uses float, so ints get coerced.
        assert Model(score=42).score == 42.0
        assert Model(score=3.14).score == 3.14

    def test_boolean_field(self):
        Model = create_dynamic_pydantic_model([
            {"name": "valid", "type": "boolean", "description": ""},
        ])
        assert Model(valid=True).valid is True
        assert Model(valid=False).valid is False

    def test_date_field_is_string(self):
        # Per TYPE_MAPPING in utils.py, 'date' maps to str (ISO format string).
        Model = create_dynamic_pydantic_model([
            {"name": "when", "type": "date", "description": ""},
        ])
        assert Model(when="2026-05-04").when == "2026-05-04"

    def test_unknown_type_falls_back_to_string(self):
        # The factory's fallback in TYPE_MAPPING.get(...) is (str, ...).
        Model = create_dynamic_pydantic_model([
            {"name": "weird", "type": "uuid", "description": ""},
        ])
        assert Model(weird="anything").weird == "anything"

    def test_missing_description_uses_empty_string(self):
        # Confirmed safe by the downstream-AI sanity check: description is optional.
        Model = create_dynamic_pydantic_model([
            {"name": "x", "type": "text"},
        ])
        assert Model(x="ok").x == "ok"

    def test_multiple_fields(self):
        Model = create_dynamic_pydantic_model([
            {"name": "a", "type": "text", "description": ""},
            {"name": "b", "type": "number", "description": ""},
            {"name": "c", "type": "boolean", "description": ""},
        ])
        instance = Model(a="hi", b=1, c=True)
        assert instance.model_dump() == {"a": "hi", "b": 1.0, "c": True}

    def test_required_fields_raise_when_missing(self):
        Model = create_dynamic_pydantic_model([
            {"name": "required_text", "type": "text", "description": ""},
        ])
        with pytest.raises(ValidationError):
            Model()

    def test_custom_model_name(self):
        Model = create_dynamic_pydantic_model(
            [{"name": "f", "type": "text", "description": ""}],
            model_name="MyOutput",
        )
        assert Model.__name__ == "MyOutput"


# ----- interpolate_prompt -----

class TestInterpolatePrompt:
    def test_single_placeholder(self):
        result = interpolate_prompt("Hello {name}", {"name": "World"})
        assert result == "Hello World"

    def test_multiple_placeholders(self):
        result = interpolate_prompt(
            "{customer} bought {product}",
            {"customer": "Alice", "product": "laptop"},
        )
        assert result == "Alice bought laptop"

    def test_no_placeholders(self):
        result = interpolate_prompt("Plain text", {"unused": "value"})
        assert result == "Plain text"

    def test_unresolved_placeholder_left_as_is(self):
        # If a placeholder has no matching key, current behavior: leave as-is.
        result = interpolate_prompt("Hello {name}", {})
        assert result == "Hello {name}"

    def test_numeric_value_stringified(self):
        result = interpolate_prompt("Score: {n}", {"n": 42})
        assert result == "Score: 42"

    def test_none_value_stringified(self):
        # Current behavior: str(None) = "None". Documenting the contract.
        result = interpolate_prompt("Val: {x}", {"x": None})
        assert result == "Val: None"

    def test_special_chars_in_value(self):
        result = interpolate_prompt("Quote: {q}", {"q": 'has "quotes" & symbols'})
        assert result == 'Quote: has "quotes" & symbols'


# ----- validate_output_schema -----

class TestValidateOutputSchema:
    def test_valid_schema_passes(self):
        assert validate_output_schema([
            {"name": "x", "type": "text"},
            {"name": "y", "type": "number"},
        ]) is True

    def test_empty_schema_raises(self):
        with pytest.raises(ValueError, match="empty"):
            validate_output_schema([])

    def test_missing_name_raises(self):
        with pytest.raises(ValueError, match="missing 'name'"):
            validate_output_schema([{"type": "text"}])

    def test_missing_type_raises(self):
        with pytest.raises(ValueError, match="missing 'type'"):
            validate_output_schema([{"name": "x"}])

    def test_invalid_type_raises(self):
        with pytest.raises(ValueError, match="invalid type"):
            validate_output_schema([{"name": "x", "type": "uuid"}])

    def test_all_supported_types_accepted(self):
        for t in ("text", "number", "boolean", "date"):
            assert validate_output_schema([{"name": "x", "type": t}]) is True
