"""Load Lambda configuration from an SSM Parameter Store path once per process."""

from __future__ import annotations

import os
import re
from functools import lru_cache


@lru_cache(maxsize=1)
def load_parameter_store() -> None:
    prefix = os.getenv("SSM_PARAMETER_PREFIX", "").strip().rstrip("/")
    if not prefix or os.getenv("LOAD_SSM_PARAMETERS", "true").lower() == "false":
        return

    import boto3

    client = boto3.client("ssm")
    next_token: str | None = None
    while True:
        request = {"Path": prefix, "Recursive": True, "WithDecryption": True}
        if next_token:
            request["NextToken"] = next_token
        response = client.get_parameters_by_path(**request)
        for parameter in response.get("Parameters", []):
            name = parameter["Name"].removeprefix(f"{prefix}/")
            name = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")
            os.environ.setdefault(name.upper(), parameter["Value"])
        next_token = response.get("NextToken")
        if not next_token:
            return
