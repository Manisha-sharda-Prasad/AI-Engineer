data "aws_caller_identity" "current" {
  count = var.enabled ? 1 : 0
}
data "aws_partition" "current" {}

locals {
  services        = toset(["gateway", "youtube", "plans"])
  create_services = var.enabled && var.deploy_lambdas
  resource_prefix = "${var.project_name}-${var.environment}"
  table_name      = "${local.resource_prefix}-app"
  ssm_prefix      = coalesce(var.ssm_parameter_prefix, "/${var.project_name}/${var.environment}")

  function_names = {
    for service in local.services : service => "${local.resource_prefix}-${service}"
  }

  common_tags = merge(
    {
      Application = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags,
  )

  aws_account_id = try(data.aws_caller_identity.current[0].account_id, "")
}

resource "aws_ecr_repository" "lambda" {
  for_each = var.enabled ? local.services : toset([])

  name                 = "${local.resource_prefix}-${each.key}"
  image_tag_mutability = "MUTABLE"
  force_delete         = var.ecr_force_delete

  image_scanning_configuration {
    scan_on_push = var.enable_ecr_scan_on_push
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = local.common_tags
}

resource "aws_ecr_lifecycle_policy" "lambda" {
  for_each = aws_ecr_repository.lambda

  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep only the newest ${var.ecr_max_image_count} deployment images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = var.ecr_max_image_count
      }
      action = {
        type = "expire"
      }
    }]
  })
}

resource "aws_dynamodb_table" "app" {
  count = var.enabled ? 1 : 0

  name                        = local.table_name
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "PK"
  range_key                   = "SK"
  table_class                 = var.dynamodb_table_class
  deletion_protection_enabled = var.enable_dynamodb_deletion_protection
  stream_enabled              = var.enable_dynamodb_streams
  stream_view_type            = var.enable_dynamodb_streams ? "NEW_AND_OLD_IMAGES" : null

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  ttl {
    attribute_name = "expires_at"
    enabled        = var.enable_dynamodb_ttl
  }

  point_in_time_recovery {
    enabled = var.enable_dynamodb_pitr
  }

  server_side_encryption {
    enabled = true
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each = local.create_services && var.enable_cloudwatch_logs ? local.services : toset([])

  name              = "/aws/lambda/${local.function_names[each.key]}"
  retention_in_days = var.cloudwatch_log_retention_days
  tags              = local.common_tags
}

resource "aws_iam_role" "lambda" {
  for_each = local.create_services ? local.services : toset([])

  name = "${local.function_names[each.key]}-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
  tags = local.common_tags
}

data "aws_iam_policy_document" "lambda" {
  for_each = local.create_services ? local.services : toset([])

  dynamic "statement" {
    for_each = var.enable_cloudwatch_logs ? [1] : []
    content {
      sid = "WriteLambdaLogs"
      actions = [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
      ]
      resources = [
        "arn:${data.aws_partition.current.partition}:logs:${var.aws_region}:${local.aws_account_id}:log-group:/aws/lambda/${local.function_names[each.key]}:*",
      ]
    }
  }

  dynamic "statement" {
    for_each = each.key == "gateway" ? [1] : []
    content {
      sid     = "InvokePrivateServices"
      actions = ["lambda:InvokeFunction"]
      resources = [
        "arn:${data.aws_partition.current.partition}:lambda:${var.aws_region}:${local.aws_account_id}:function:${local.function_names["youtube"]}",
        "arn:${data.aws_partition.current.partition}:lambda:${var.aws_region}:${local.aws_account_id}:function:${local.function_names["plans"]}",
      ]
    }
  }

  dynamic "statement" {
    for_each = each.key == "gateway" ? [1] : []
    content {
      sid = "MaintainRateLimits"
      actions = [
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
      ]
      resources = [aws_dynamodb_table.app[0].arn]
    }
  }

  dynamic "statement" {
    for_each = each.key == "plans" ? [1] : []
    content {
      sid = "ManageApplicationData"
      actions = [
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:DeleteItem",
        "dynamodb:DescribeTable",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:TransactGetItems",
        "dynamodb:TransactWriteItems",
        "dynamodb:UpdateItem",
      ]
      resources = [
        aws_dynamodb_table.app[0].arn,
        "${aws_dynamodb_table.app[0].arn}/index/*",
      ]
    }
  }

  dynamic "statement" {
    for_each = var.enable_ssm_parameter_store ? [1] : []
    content {
      sid = "ReadEnvironmentParameters"
      actions = [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath",
      ]
      resources = [
        "arn:${data.aws_partition.current.partition}:ssm:${var.aws_region}:${local.aws_account_id}:parameter/${trim(local.ssm_prefix, "/")}/*",
      ]
    }
  }

  dynamic "statement" {
    for_each = var.enable_ssm_parameter_store ? [1] : []
    content {
      sid       = "DecryptEnvironmentParameters"
      actions   = ["kms:Decrypt"]
      resources = ["*"]

      condition {
        test     = "StringEquals"
        variable = "kms:ViaService"
        values   = ["ssm.${var.aws_region}.amazonaws.com"]
      }
    }
  }

  dynamic "statement" {
    for_each = var.enable_xray_tracing ? [1] : []
    content {
      sid = "WriteXRayTraces"
      actions = [
        "xray:PutTelemetryRecords",
        "xray:PutTraceSegments",
      ]
      resources = ["*"]
    }
  }
}

resource "aws_iam_role_policy" "lambda" {
  for_each = aws_iam_role.lambda

  name   = "${local.function_names[each.key]}-runtime"
  role   = each.value.id
  policy = data.aws_iam_policy_document.lambda[each.key].json
}

resource "aws_lambda_function" "service" {
  for_each = local.create_services ? var.lambda_configuration : {}

  function_name = local.function_names[each.key]
  description   = "${title(each.key)} service for ${var.project_name} ${var.environment}"
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.lambda[each.key].repository_url}:${var.image_tag}"
  role          = aws_iam_role.lambda[each.key].arn
  architectures = [var.lambda_architecture]
  memory_size   = each.value.memory_mb
  timeout       = each.value.timeout_seconds

  reserved_concurrent_executions = var.enable_reserved_concurrency ? each.value.reserved_concurrency : -1

  tracing_config {
    mode = var.enable_xray_tracing ? "Active" : "PassThrough"
  }

  environment {
    variables = merge(
      {
        APP_ENV              = var.environment
        FRONTEND_URL         = var.frontend_url
        STORAGE_BACKEND      = "dynamodb"
        DYNAMODB_TABLE_NAME  = local.table_name
        SSM_PARAMETER_PREFIX = local.ssm_prefix
        SERVICE_NAME         = each.key
      },
      each.key == "gateway" ? {
        DOWNSTREAM_INVOKE_MODE        = "lambda"
        GATEWAY_YOUTUBE_FUNCTION_NAME = local.function_names["youtube"]
        GATEWAY_PLANS_FUNCTION_NAME   = local.function_names["plans"]
      } : {},
      var.additional_environment_variables,
    )
  }

  depends_on = [
    aws_ecr_lifecycle_policy.lambda,
    aws_iam_role_policy.lambda,
    aws_cloudwatch_log_group.lambda,
  ]

  tags = local.common_tags
}

resource "aws_lambda_function_url" "gateway" {
  count = local.create_services && var.enable_gateway_function_url ? 1 : 0

  function_name      = aws_lambda_function.service["gateway"].function_name
  authorization_type = "NONE"
  invoke_mode        = "BUFFERED"

  cors {
    allow_credentials = false
    allow_headers     = ["authorization", "content-type"]
    allow_methods     = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_origins     = [var.frontend_url]
    expose_headers    = ["content-type"]
    max_age           = 300
  }
}

resource "aws_lambda_permission" "gateway_function_url" {
  count = local.create_services && var.enable_gateway_function_url ? 1 : 0

  statement_id           = "AllowPublicFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.service["gateway"].function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

resource "aws_lambda_permission" "gateway_invoke_via_url" {
  count = local.create_services && var.enable_gateway_function_url ? 1 : 0

  statement_id             = "AllowInvokeViaFunctionUrl"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.service["gateway"].function_name
  principal                = "*"
  invoked_via_function_url = true
}
