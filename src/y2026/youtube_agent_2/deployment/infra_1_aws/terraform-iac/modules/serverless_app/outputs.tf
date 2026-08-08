output "environment_enabled" {
  description = "Whether this environment creates AWS resources."
  value       = var.enabled
}

output "dynamodb_table_name" {
  description = "DynamoDB table used for application records and rate limits."
  value       = try(aws_dynamodb_table.app[0].name, null)
}

output "gateway_function_url" {
  description = "Public Gateway Function URL, or null when not deployed."
  value       = try(aws_lambda_function_url.gateway[0].function_url, null)
}

output "lambda_function_names" {
  description = "Names of the deployed Lambda functions."
  value       = { for key, function in aws_lambda_function.service : key => function.function_name }
}

output "dockerhub_source_images" {
  description = "Docker Hub images that must be mirrored into the corresponding ECR repositories."
  value       = var.enabled ? var.dockerhub_images : {}
}

output "ecr_repository_urls" {
  description = "Required minimal ECR deployment mirrors for Lambda container images."
  value       = { for key, repository in aws_ecr_repository.lambda : key => repository.repository_url }
}

output "ssm_parameter_prefix" {
  description = "Parameter Store path from which Lambda functions may retrieve SecureString values."
  value       = var.enabled && var.enable_ssm_parameter_store ? local.ssm_prefix : null
}
