import boto3
import json
import os
import re
import logging
import time
from botocore.config import Config
from botocore.exceptions import ClientError

logger = logging.getLogger("mediscribe.bedrock_client")

BEDROCK_REGION = os.environ.get("BEDROCK_REGION", "us-east-1")
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.anthropic.claude-sonnet-4-6")
MAX_RETRIES = 2
INITIAL_BACKOFF_SECONDS = 1.0
RETRYABLE_ERRORS = {"ThrottlingException", "ModelTimeoutException", "ServiceUnavailableException"}

_config = Config(
    retries={"max_attempts": 0, "mode": "standard"},
    connect_timeout=5,
    read_timeout=120,
)

_bedrock_client = boto3.client(
    "bedrock-runtime",
    region_name=BEDROCK_REGION,
    config=_config,
)


def invoke_bedrock(prompt: str, max_tokens: int = 4096) -> str:
    request_body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    })

    logger.debug("Invoking Bedrock model=%s max_tokens=%d prompt_length=%d", BEDROCK_MODEL_ID, max_tokens, len(prompt))

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = _bedrock_client.invoke_model(
                modelId=BEDROCK_MODEL_ID,
                contentType="application/json",
                accept="application/json",
                body=request_body,
            )
            response_body = json.loads(response["body"].read())
            text = response_body["content"][0]["text"]
            logger.info("Bedrock response received, length=%d", len(text))
            return text

        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code in RETRYABLE_ERRORS and attempt < MAX_RETRIES:
                wait = INITIAL_BACKOFF_SECONDS * (2 ** attempt)
                logger.warning("Bedrock %s, retry %d/%d in %.1fs", error_code, attempt + 1, MAX_RETRIES, wait)
                time.sleep(wait)
            else:
                logger.error("Bedrock call failed: %s", e)
                return json.dumps({"error": f"Bedrock invocation failed: {error_code}"})

        except Exception as e:
            logger.error("Unexpected error calling Bedrock: %s", e)
            return json.dumps({"error": f"Unexpected error: {str(e)}"})

    return json.dumps({"error": "Bedrock invocation failed after all retries"})


def _extract_json_from_markdown(text: str):
    stripped = text.strip()
    try:
        json.loads(stripped)
        return stripped
    except json.JSONDecodeError:
        pass

    match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        return match.group(1).strip()

    match = re.search(r"```\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        return match.group(1).strip()

    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        candidate = text[first_brace:last_brace + 1]
        try:
            json.loads(candidate)
            return candidate
        except json.JSONDecodeError:
            pass

    return None


def invoke_bedrock_json(prompt: str, max_tokens: int = 4096) -> dict:
    raw_response = invoke_bedrock(prompt, max_tokens)

    try:
        parsed = json.loads(raw_response)
        if isinstance(parsed, dict) and "error" in parsed:
            raise RuntimeError(f"Bedrock returned an error: {parsed['error']}")
        return parsed
    except json.JSONDecodeError:
        pass

    extracted = _extract_json_from_markdown(raw_response)
    if extracted:
        try:
            parsed = json.loads(extracted)
            if isinstance(parsed, dict) and "error" in parsed:
                raise RuntimeError(f"Bedrock returned an error: {parsed['error']}")
            return parsed
        except json.JSONDecodeError:
            pass

    logger.error("Failed to parse JSON from Bedrock response: %.500s", raw_response)
    raise ValueError(f"Could not extract valid JSON from Bedrock response. Raw response starts with: {raw_response[:200]}")
