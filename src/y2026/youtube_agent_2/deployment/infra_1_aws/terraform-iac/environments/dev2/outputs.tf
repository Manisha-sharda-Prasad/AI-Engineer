output "gateway_function_url" {
  description = "Dev2 Gateway URL when the environment is enabled."
  value       = module.app.gateway_function_url
}

output "dynamodb_table_name" {
  description = "Dev2 DynamoDB table when enabled."
  value       = module.app.dynamodb_table_name
}

output "dockerhub_source_images" {
  description = "Docker Hub sources for the deployment mirror."
  value       = module.app.dockerhub_source_images
}

output "ecr_repository_urls" {
  description = "ECR destinations required by Lambda when enabled."
  value       = module.app.ecr_repository_urls
}

output "ssm_parameter_prefix" {
  description = "SecureString path available to dev2 functions when enabled."
  value       = module.app.ssm_parameter_prefix
}
