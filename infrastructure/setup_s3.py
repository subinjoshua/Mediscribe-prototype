"""Create S3 bucket with CORS configuration for local testing without SAM deploy."""

import os

import boto3
from botocore.exceptions import ClientError

REGION = os.environ.get("AWS_REGION", "us-east-1")


def main():
    sts = boto3.client("sts", region_name=REGION)
    account_id = sts.get_caller_identity()["Account"]
    bucket_name = f"mediscribe-uploads-{account_id}"

    s3 = boto3.client("s3", region_name=REGION)

    # Create bucket
    print(f"Creating bucket {bucket_name}...")
    try:
        create_args = {"Bucket": bucket_name}
        if REGION != "us-east-1":
            create_args["CreateBucketConfiguration"] = {
                "LocationConstraint": REGION
            }
        s3.create_bucket(**create_args)
        print(f"  Bucket {bucket_name} created.")
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
            print(f"  Bucket {bucket_name} already exists, skipping creation.")
        else:
            raise

    # Block all public access
    print("Blocking public access...")
    s3.put_public_access_block(
        Bucket=bucket_name,
        PublicAccessBlockConfiguration={
            "BlockPublicAcls": True,
            "IgnorePublicAcls": True,
            "BlockPublicPolicy": True,
            "RestrictPublicBuckets": True,
        },
    )

    # Apply CORS configuration
    print("Applying CORS configuration...")
    s3.put_bucket_cors(
        Bucket=bucket_name,
        CORSConfiguration={
            "CORSRules": [
                {
                    "AllowedOrigins": [
                        "http://localhost:5173",
                        "http://localhost:3000",
                    ],
                    "AllowedMethods": ["GET", "PUT", "POST"],
                    "AllowedHeaders": ["*"],
                }
            ]
        },
    )

    print(f"Bucket {bucket_name} is ready.")


if __name__ == "__main__":
    main()
