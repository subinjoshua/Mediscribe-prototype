"""Create DynamoDB tables for local testing without SAM deploy."""

import os

import boto3
from botocore.exceptions import ClientError

REGION = os.environ.get("AWS_REGION", "us-east-1")

TABLES = [
    {
        "TableName": "MediScribe-Patients",
        "BillingMode": "PAY_PER_REQUEST",
        "AttributeDefinitions": [
            {"AttributeName": "PK", "AttributeType": "S"},
            {"AttributeName": "SK", "AttributeType": "S"},
            {"AttributeName": "GSI1PK", "AttributeType": "S"},
            {"AttributeName": "GSI1SK", "AttributeType": "S"},
        ],
        "KeySchema": [
            {"AttributeName": "PK", "KeyType": "HASH"},
            {"AttributeName": "SK", "KeyType": "RANGE"},
        ],
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "GSI1",
                "KeySchema": [
                    {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                    {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
            }
        ],
    },
    {
        "TableName": "MediScribe-Drugs",
        "BillingMode": "PAY_PER_REQUEST",
        "AttributeDefinitions": [
            {"AttributeName": "drugName", "AttributeType": "S"},
        ],
        "KeySchema": [
            {"AttributeName": "drugName", "KeyType": "HASH"},
        ],
    },
    {
        "TableName": "MediScribe-Alerts",
        "BillingMode": "PAY_PER_REQUEST",
        "AttributeDefinitions": [
            {"AttributeName": "hospitalId", "AttributeType": "S"},
            {"AttributeName": "alertTimestamp", "AttributeType": "S"},
        ],
        "KeySchema": [
            {"AttributeName": "hospitalId", "KeyType": "HASH"},
            {"AttributeName": "alertTimestamp", "KeyType": "RANGE"},
        ],
    },
]


def create_table(client, table_def):
    table_name = table_def["TableName"]
    print(f"Creating table {table_name}...")
    try:
        client.create_table(**table_def)
        print(f"  Waiting for {table_name} to become ACTIVE...")
        client.get_waiter("table_exists").wait(TableName=table_name)
        print(f"  {table_name} is ACTIVE.")
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceInUseException":
            print(f"  Table {table_name} already exists, skipping.")
        else:
            raise


def main():
    print(f"Setting up DynamoDB tables in {REGION}...")
    client = boto3.client("dynamodb", region_name=REGION)
    for table_def in TABLES:
        create_table(client, table_def)
    print("All tables ready.")


if __name__ == "__main__":
    main()
