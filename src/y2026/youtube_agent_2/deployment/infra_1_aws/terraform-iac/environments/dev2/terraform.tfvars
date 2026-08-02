aws_region          = "us-west-2"
environment_enabled = false
deploy_lambdas      = false
frontend_url        = "https://youtube-learning-ui.onrender.com"
dockerhub_namespace = "replace-with-dockerhub-user"
image_tag           = "dev2-initial"

# Disabled environment: these become relevant only after environment_enabled=true.
enable_dynamodb_pitr    = false
enable_cloudwatch_logs  = false
enable_xray_tracing     = false
enable_dynamodb_streams = false
enable_ecr_scan_on_push = false
