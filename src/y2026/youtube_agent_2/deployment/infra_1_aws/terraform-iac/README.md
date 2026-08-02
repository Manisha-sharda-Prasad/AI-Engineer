# AWS Terraform infrastructure

This Terraform configuration provisions the serverless AWS portion of the YouTube Learning Organizer. The React/Vite UI remains on Render static hosting.

## Environments

| Environment | Default state | Purpose |
|---|---|---|
| `dev1` | Active | Current AWS development environment |
| `dev2` | Disabled | Reserved environment; applying it creates no resources until explicitly enabled |

Each environment is a separate Terraform root and therefore has separate state. Run Terraform from the selected environment directory.

## Docker Hub and the Lambda ECR requirement

Docker Hub is the source registry. However, AWS Lambda cannot deploy a container directly from Docker Hub: the final Lambda image must be in an ECR repository in the same AWS Region. The module therefore creates three minimal ECR deployment mirrors and retains only one or two recent images.

To eliminate ECR completely, change the application to ZIP-based Lambda packages. That would no longer be a container-based Lambda deployment.

Use a new immutable `image_tag` such as a Git commit SHA for every release. Re-pushing the same tag does not change Terraform's `image_uri`, so Terraform would not trigger a Lambda code update.

## Application runtime

The three services include Mangum handlers and `Dockerfile.lambda` images. The
Gateway verifies Firebase identity, rate-limits through DynamoDB, and invokes
the private YouTube and Plans functions through IAM. Plans and source-sync data
use the normalized DynamoDB repository. Build Linux `arm64` images to match the
Terraform architecture.

## Secrets Manager replacement

Use SSM Parameter Store Standard `SecureString` values under:

```text
/youtube-agent/dev1/
```

Standard parameters have no parameter-storage charge and use the AWS-managed `alias/aws/ssm` KMS key by default. Terraform grants each Lambda read access only to its environment path.

Do not put secret values in `.tfvars` or Lambda environment-variable maps. Terraform state can retain those values. Create or update SecureString parameters independently through the AWS console, an approved CI secret store, or `aws ssm put-parameter`. Suggested names include:

```text
/youtube-agent/dev1/FIREBASE_SERVICE_ACCOUNT_JSON
/youtube-agent/dev1/GROQ_API_KEY
/youtube-agent/dev1/OPENAI_API_KEY
```

Only create parameters actually used by the enabled features.

## Bootstrap and deploy dev1

1. Replace `replace-with-dockerhub-user` in `environments/dev1/terraform.tfvars`.
2. Initialize the environment and create the foundation without Lambdas:

```powershell
cd src/y2026/youtube_agent_2/deployment/infra_1_aws/terraform-iac/environments/dev1
terraform init
terraform apply -var="deploy_lambdas=false"
```

3. From the repository root, build and publish the three Lambda-compatible images to Docker Hub using the `linux/arm64` platform and each service's `Dockerfile.lambda`:

```powershell
docker buildx build --platform linux/arm64 -f src/y2026/youtube_agent_2/backend/services/gateway/Dockerfile.lambda -t <dockerhub-user>/youtube-agent-gateway:<image-tag> --push .
docker buildx build --platform linux/arm64 -f src/y2026/youtube_agent_2/backend/services/youtube/Dockerfile.lambda -t <dockerhub-user>/youtube-agent-youtube:<image-tag> --push .
docker buildx build --platform linux/arm64 -f src/y2026/youtube_agent_2/backend/services/plans/Dockerfile.lambda -t <dockerhub-user>/youtube-agent-plans:<image-tag> --push .
```

Log in to ECR, then mirror them into the deployment repositories. Obtain source and destination maps with:

```powershell
terraform output -json dockerhub_source_images
terraform output -json ecr_repository_urls
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-west-2.amazonaws.com
docker pull <dockerhub-source>
docker tag <dockerhub-source> <ecr-destination>:<image-tag>
docker push <ecr-destination>:<image-tag>
```

4. Deploy the functions and Function URL:

```powershell
terraform apply
terraform output gateway_function_url
```

5. Set Render's `VITE_API_BASE_URL` to the Gateway output and redeploy the static UI.

## Enable dev2 later

Edit `environments/dev2/terraform.tfvars`, set `environment_enabled=true`, configure its image namespace/tag, and follow the same two-stage bootstrap. Until then, `terraform plan` for dev2 proposes no AWS resources.

## Cost-control flags

| Flag | Dev1 | Dev2 | Effect |
|---|---:|---:|---|
| `environment_enabled` | `true` | `false` | Master switch for all environment resources |
| `deploy_lambdas` | `true` | `false` | Separates ECR/DynamoDB bootstrap from function deployment |
| `enable_dynamodb_pitr` | `false` | `false` | Enables paid point-in-time recovery |
| `enable_cloudwatch_logs` | `true` | `false` | Creates logs with three-day retention; disable after stabilization if desired |
| `enable_xray_tracing` | `false` | `false` | Enables paid distributed tracing |
| `enable_dynamodb_streams` | `false` | `false` | Enables change streams for future event processing |
| `enable_ecr_scan_on_push` | `false` | `false` | Enables image vulnerability scanning |
| `enable_reserved_concurrency` | `true` | `true` | Caps concurrency and accidental Lambda spend; no standing compute charge |
| `enable_dynamodb_ttl` | `true` | `true` | Removes expired rate-limit/transient records automatically |

Other inexpensive defaults:

- DynamoDB uses on-demand billing.
- No VPC, NAT Gateway, API Gateway, custom KMS key, provisioned concurrency, or X-Ray.
- ECR uses AWS-managed AES-256 encryption and retains at most two dev1 images or one dev2 image per service.
- Gateway is the only public Lambda; YouTube and Plans are invoked through IAM.

## Validation

From each environment directory:

```powershell
terraform fmt -check -recursive ../..
terraform validate
terraform plan
```
