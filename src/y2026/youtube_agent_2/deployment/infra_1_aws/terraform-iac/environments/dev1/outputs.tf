output "gateway_function_url" {
  description = "Public URL to configure as VITE_API_BASE_URL on Render."
  value       = module.app.gateway_function_url
}

output "dynamodb_table_name" {
  description = "Active dev1 DynamoDB table."
  value       = module.app.dynamodb_table_name
}

output "dockerhub_source_images" {
  description = "Docker Hub sources for the deployment mirror."
  value       = module.app.dockerhub_source_images
}

output "ecr_repository_urls" {
  description = "ECR destinations required by Lambda."
  value       = module.app.ecr_repository_urls
}

output "ssm_parameter_prefix" {
  description = "SecureString path available to dev1 functions."
  value       = module.app.ssm_parameter_prefix
}
