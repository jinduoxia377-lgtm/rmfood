# Fix Summary: Retail Product Database Import Issue

## Problem Analysis

The OpenFoodFacts CSV import was failing with the following error:

```
ValueError: 配置校验失败:
  - 未设置 SECRET_KEY
```

This occurred because the configuration validation checked for `SECRET_KEY` before environment variable overrides were applied, causing the import process to fail even when `SECRET_KEY` was properly set via environment variables.

## Root Cause

In `backend/app/core/config.py`, the `Settings.__init__()` method had incorrect ordering of operations:

```python
def __init__(self, **data):
    super().__init__(**data)
    self._fix_nested_config()
    self._validate_config()      # BUG: Validation runs BEFORE env overrides
    self._apply_env_overrides()  # Env overrides (including SECRET_KEY) happen TOO LATE
```

The `_apply_env_overreads()` method reads environment variables like `SECRET_KEY`, `LOG_LEVEL`, etc., but this was called AFTER `_validate_config()`. When the import script set environment variables before importing, they weren't picked up until after validation already failed.

Additionally, the manual `load_dotenv()` call was redundant since pydantic-settings v2 handles `.env` file loading through `model_config`.

## Solution

Fixed the order in `Settings.__init__()` to apply environment overrides before validation:

```python
def __init__(self, **data):
    super().__init__(**data)
    self._fix_nested_config()
    self._apply_env_overrides()  # Now applied BEFORE validation
    self._validate_config()      # Validation sees all environment overrides
```

Also removed the unnecessary manual `load_dotenv()` call.

## Files Modified

- `backend/app/core/config.py`: Reordered method calls in `Settings.__init__()` and removed redundant dotenv loading.

## Verification

Created integration tests confirming:
1. Config loads successfully with explicit SECRET_KEY from environment
2. Config falls back to generating random SECRET_KEY when not set (development mode)
3. The SECRET_KEY from environment is correctly applied and passes validation
4. The import module can be imported without configuration errors

## Impact

This fix enables the OpenFoodFacts CSV import to work correctly by ensuring environment variables are properly processed before configuration validation. The retail product database import (retail_products table) can now proceed without SECRET_KEY validation failures.
