terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.80, < 7.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  access_key = var.environment_enabled ? null : "disabled-environment"
  secret_key = var.environment_enabled ? null : "disabled-environment"

  skip_credentials_validation = !var.environment_enabled
  skip_metadata_api_check     = !var.environment_enabled
  skip_requesting_account_id  = !var.environment_enabled

  default_tags {
    tags = {
      Application = "youtube-agent"
      Environment = "dev1"
      ManagedBy   = "terraform"
    }
  }
}

module "app" {
  source = "../../modules/serverless_app"

  project_name        = "youtube-agent"
  environment         = "dev1"
  enabled             = var.environment_enabled
  deploy_lambdas      = var.deploy_lambdas
  aws_region          = var.aws_region
  frontend_url        = var.frontend_url
  image_tag           = var.image_tag
  lambda_architecture = "arm64"

  dockerhub_images = {
    gateway = "${var.dockerhub_namespace}/youtube-agent-gateway:${var.image_tag}"
    youtube = "${var.dockerhub_namespace}/youtube-agent-youtube:${var.image_tag}"
    plans   = "${var.dockerhub_namespace}/youtube-agent-plans:${var.image_tag}"
  }

  enable_gateway_function_url         = true
  enable_reserved_concurrency         = true
  enable_cloudwatch_logs              = var.enable_cloudwatch_logs
  cloudwatch_log_retention_days       = 3
  enable_xray_tracing                 = var.enable_xray_tracing
  enable_dynamodb_pitr                = var.enable_dynamodb_pitr
  enable_dynamodb_deletion_protection = false
  enable_dynamodb_ttl                 = true
  enable_dynamodb_streams             = var.enable_dynamodb_streams
  enable_ssm_parameter_store          = true
  enable_ecr_scan_on_push             = var.enable_ecr_scan_on_push
  ecr_max_image_count                 = 2
  ecr_force_delete                    = false
}
