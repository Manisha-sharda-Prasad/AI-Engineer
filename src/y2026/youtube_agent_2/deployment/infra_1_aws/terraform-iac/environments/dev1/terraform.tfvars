aws_region          = "us-west-2"
environment_enabled = true
deploy_lambdas      = true
frontend_url        = "https://youtube-learning-ui.onrender.com"
dockerhub_namespace = "replace-with-dockerhub-user"
image_tag           = "dev1-initial"

# Cost controls. Enable later when the operational need justifies the cost.
enable_dynamodb_pitr    = false
enable_cloudwatch_logs  = true
enable_xray_tracing     = false
enable_dynamodb_streams = false
enable_ecr_scan_on_push = false
