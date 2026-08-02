variable "aws_region" {
  description = "AWS Region for dev2."
  type        = string
  default     = "us-west-2"
}

variable "aws_profile" {
  description = "Optional local AWS CLI profile. Leave null for environment or role credentials."
  type        = string
  default     = null
  nullable    = true
}

variable "environment_enabled" {
  description = "Creates dev2 resources when true."
  type        = bool
  default     = false
}

variable "deploy_lambdas" {
  description = "Deploys functions after images exist in ECR."
  type        = bool
  default     = false
}

variable "frontend_url" {
  description = "Render static-site origin."
  type        = string
}

variable "dockerhub_namespace" {
  description = "Docker Hub user or organization containing the three service images."
  type        = string
}

variable "image_tag" {
  description = "Docker image tag for dev2."
  type        = string
  default     = "dev2"
}

variable "enable_dynamodb_pitr" {
  description = "Enables DynamoDB point-in-time recovery."
  type        = bool
  default     = false
}

variable "enable_cloudwatch_logs" {
  description = "Enables Lambda logs."
  type        = bool
  default     = false
}

variable "enable_xray_tracing" {
  description = "Enables X-Ray tracing."
  type        = bool
  default     = false
}

variable "enable_dynamodb_streams" {
  description = "Enables DynamoDB Streams."
  type        = bool
  default     = false
}

variable "enable_ecr_scan_on_push" {
  description = "Enables image scanning on the Lambda deployment mirrors."
  type        = bool
  default     = false
}
