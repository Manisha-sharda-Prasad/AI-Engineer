variable "project_name" {
  description = "Short name used as the prefix for AWS resources."
  type        = string
  default     = "youtube-agent"
}

variable "environment" {
  description = "Deployment environment name, for example dev1 or dev2."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,15}$", var.environment))
    error_message = "environment must be 2-16 lowercase letters, digits, or hyphens."
  }
}

variable "enabled" {
  description = "Creates resources for this environment when true."
  type        = bool
}

variable "deploy_lambdas" {
  description = "Creates Lambda functions after Lambda-compatible images have been mirrored into ECR."
  type        = bool
  default     = true
}

variable "aws_region" {
  description = "AWS Region in which resources are created."
  type        = string
}

variable "frontend_url" {
  description = "Exact Render static-site origin allowed by the Gateway Function URL CORS policy."
  type        = string

  validation {
    condition     = can(regex("^https://", var.frontend_url))
    error_message = "frontend_url must be an HTTPS origin."
  }
}

variable "dockerhub_images" {
  description = "Docker Hub source image for each service. Images are mirrored into ECR before Lambda deployment."
  type        = map(string)

  validation {
    condition = (
      length(var.dockerhub_images) == 3 &&
      alltrue([for key in ["gateway", "youtube", "plans"] : contains(keys(var.dockerhub_images), key)])
    )
    error_message = "dockerhub_images must contain exactly gateway, youtube, and plans."
  }
}

variable "image_tag" {
  description = "Tag used for the minimal ECR deployment mirror."
  type        = string
  default     = "latest"
}

variable "lambda_architecture" {
  description = "Lambda CPU architecture. Docker images must be built for the matching architecture."
  type        = string
  default     = "arm64"

  validation {
    condition     = contains(["arm64", "x86_64"], var.lambda_architecture)
    error_message = "lambda_architecture must be arm64 or x86_64."
  }
}

variable "lambda_configuration" {
  description = "Memory, timeout, and reserved-concurrency ceiling for each Lambda."
  type = map(object({
    memory_mb            = number
    timeout_seconds      = number
    reserved_concurrency = number
  }))
  default = {
    gateway = {
      memory_mb            = 512
      timeout_seconds      = 30
      reserved_concurrency = 5
    }
    youtube = {
      memory_mb            = 512
      timeout_seconds      = 90
      reserved_concurrency = 5
    }
    plans = {
      memory_mb            = 512
      timeout_seconds      = 90
      reserved_concurrency = 5
    }
  }

  validation {
    condition = (
      length(var.lambda_configuration) == 3 &&
      alltrue([for key in ["gateway", "youtube", "plans"] : contains(keys(var.lambda_configuration), key)])
    )
    error_message = "lambda_configuration must contain exactly gateway, youtube, and plans."
  }
}

variable "enable_gateway_function_url" {
  description = "Exposes the Gateway Lambda through a public HTTPS Function URL."
  type        = bool
  default     = true
}

variable "enable_reserved_concurrency" {
  description = "Applies per-function concurrency ceilings to limit accidental spend."
  type        = bool
  default     = true
}

variable "enable_cloudwatch_logs" {
  description = "Creates CloudWatch log groups and grants Lambda permission to write logs."
  type        = bool
  default     = true
}

variable "cloudwatch_log_retention_days" {
  description = "Number of days Lambda logs are retained."
  type        = number
  default     = 3
}

variable "enable_xray_tracing" {
  description = "Enables active AWS X-Ray tracing for Lambda functions."
  type        = bool
  default     = false
}

variable "enable_dynamodb_pitr" {
  description = "Enables DynamoDB point-in-time recovery."
  type        = bool
  default     = false
}

variable "enable_dynamodb_deletion_protection" {
  description = "Prevents accidental DynamoDB table deletion."
  type        = bool
  default     = false
}

variable "enable_dynamodb_ttl" {
  description = "Enables TTL cleanup for expiring rate-limit and transient records."
  type        = bool
  default     = true
}

variable "enable_dynamodb_streams" {
  description = "Enables DynamoDB Streams for future event-driven processing."
  type        = bool
  default     = false
}

variable "dynamodb_table_class" {
  description = "DynamoDB table class. STANDARD is appropriate for the active small workload."
  type        = string
  default     = "STANDARD"

  validation {
    condition     = contains(["STANDARD", "STANDARD_INFREQUENT_ACCESS"], var.dynamodb_table_class)
    error_message = "dynamodb_table_class must be STANDARD or STANDARD_INFREQUENT_ACCESS."
  }
}

variable "enable_ssm_parameter_store" {
  description = "Grants functions access to low-cost SSM Parameter Store SecureString values under the environment prefix."
  type        = bool
  default     = true
}

variable "ssm_parameter_prefix" {
  description = "Optional SSM parameter path. Defaults to /<project>/<environment>."
  type        = string
  default     = null
  nullable    = true
}

variable "enable_ecr_scan_on_push" {
  description = "Enables ECR basic image scanning on push."
  type        = bool
  default     = false
}

variable "ecr_max_image_count" {
  description = "Maximum images retained per deployment mirror repository."
  type        = number
  default     = 2

  validation {
    condition     = var.ecr_max_image_count >= 1
    error_message = "ecr_max_image_count must be at least 1."
  }
}

variable "ecr_force_delete" {
  description = "Allows Terraform to delete non-empty ECR repositories. Keep false for safer environments."
  type        = bool
  default     = false
}

variable "additional_environment_variables" {
  description = "Non-secret environment variables added to all Lambda functions."
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "Additional tags applied to supported AWS resources."
  type        = map(string)
  default     = {}
}
