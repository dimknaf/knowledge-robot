"""
Utility functions for dynamic CSV agent processing.

This module provides helper functions for:
- Creating dynamic Pydantic models from frontend schemas
- Interpolating prompts with CSV row data
- Generating structured parsing prompts
"""

from typing import Dict, List, Any, Type
from pydantic import BaseModel, Field, create_model
import logging

logger = logging.getLogger(__name__)

# Type mapping: frontend type → Python/Pydantic type
TYPE_MAPPING = {
    'text': (str, ...),
    'number': (float, ...),
    'boolean': (bool, ...),
    'date': (str, ...)  # ISO format string
}


def create_dynamic_pydantic_model(
    output_fields: List[Dict[str, str]],
    model_name: str = 'DynamicAgentOutput'
) -> Type[BaseModel]:
    """
    Create a Pydantic model dynamically from frontend output schema.

    Args:
        output_fields: List of field definitions from frontend
            Example: [
                {"name": "sentiment", "type": "text", "description": "..."},
                {"name": "score", "type": "number", "description": "..."}
            ]
        model_name: Name for the generated model

    Returns:
        Dynamically created Pydantic BaseModel class
    """
    field_definitions = {}

    for field in output_fields:
        field_name = field.get('name')
        field_type_str = field.get('type', 'text')
        field_description = field.get('description', '')

        # Get Python type from mapping
        field_type, default = TYPE_MAPPING.get(
            field_type_str,
            (str, ...)  # Default to string if unknown type
        )

        # Create field definition
        field_definitions[field_name] = (
            field_type,
            Field(default=default, description=field_description)
        )

        logger.debug(f"Added field: {field_name} ({field_type_str} → {field_type})")

    # Create and return the model
    DynamicModel = create_model(model_name, **field_definitions)
    logger.info(f"Created dynamic model '{model_name}' with {len(field_definitions)} fields")

    return DynamicModel


def interpolate_prompt(
    template: str,
    row_data: Dict[str, Any]
) -> str:
    """
    Replace {column_name} placeholders with actual values from CSV row.

    Args:
        template: Prompt template with {column_name} placeholders
        row_data: Dictionary of CSV row data

    Returns:
        Interpolated prompt string

    Example:
        >>> template = "Analyze {customer}'s review: {review}"
        >>> row_data = {"customer": "John", "review": "Great product!"}
        >>> interpolate_prompt(template, row_data)
        "Analyze John's review: Great product!"
    """
    result = template

    for key, value in row_data.items():
        placeholder = f"{{{key}}}"
        # Convert value to string and replace
        result = result.replace(placeholder, str(value))

    logger.debug(f"Interpolated prompt: {result[:100]}...")
    return result


def validate_output_schema(output_schema: List[Dict[str, str]]) -> bool:
    """
    Validate that the output schema from frontend is properly formatted.

    Args:
        output_schema: List of field definitions to validate

    Returns:
        True if valid, raises ValueError if invalid
    """
    if not output_schema:
        raise ValueError("Output schema cannot be empty")

    for i, field in enumerate(output_schema):
        if 'name' not in field:
            raise ValueError(f"Field {i} missing 'name' property")

        if 'type' not in field:
            raise ValueError(f"Field '{field.get('name')}' missing 'type' property")

        if field['type'] not in TYPE_MAPPING:
            raise ValueError(
                f"Field '{field.get('name')}' has invalid type '{field['type']}'. "
                f"Must be one of: {list(TYPE_MAPPING.keys())}"
            )

    return True


def convert_to_output_type(value: Any, field_type: str) -> Any:
    """
    Convert a value to the specified output type.

    Args:
        value: Value to convert
        field_type: Target type ('text', 'number', 'boolean', 'date')

    Returns:
        Converted value
    """
    try:
        if field_type == 'text':
            return str(value)
        elif field_type == 'number':
            return float(value) if '.' in str(value) else int(value)
        elif field_type == 'boolean':
            if isinstance(value, bool):
                return value
            return str(value).lower() in ('true', '1', 'yes')
        elif field_type == 'date':
            return str(value)  # Assume already in ISO format
        else:
            return str(value)
    except Exception as e:
        logger.warning(f"Error converting value '{value}' to type '{field_type}': {e}")
        return value
