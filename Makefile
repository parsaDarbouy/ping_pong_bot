# Makefile

# AWS and ECR settings
AWS_REGION := us-east-1
ECR_REPO := eth-ping-pong
AWS_ACCOUNT_ID := $(shell aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY := $(AWS_ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com
IMAGE_TAG := latest

# Docker buildx settings
DOCKER_PLATFORMS := linux/amd64,linux/arm64

.PHONY: all
all: ecr-login docker-buildx build-push

# Login to ECR
.PHONY: ecr-login
ecr-login:
	@echo "Logging into ECR..."
	aws ecr get-login-password --region $(AWS_REGION) | docker login --username AWS --password-stdin $(ECR_REGISTRY)

# Setup Docker buildx
.PHONY: docker-buildx
docker-buildx:
	@echo "Setting up Docker buildx..."
	docker buildx create --use --name multi-arch-builder || true

# Build and push multi-arch image
.PHONY: build-push
build-push:
	@echo "Building and pushing multi-arch image..."
	docker buildx build \
		--platform $(DOCKER_PLATFORMS) \
		--tag $(ECR_REGISTRY)/$(ECR_REPO):$(IMAGE_TAG) \
		--push \
		.

# Clean up
.PHONY: clean
clean:
	docker buildx rm multi-arch-builder || true
	docker system prune -f

# Initialize Terraform
.PHONY: tf-init
tf-init:
	cd terraform && terraform init

# Apply Terraform changes
.PHONY: tf-apply
tf-apply:
	cd terraform && terraform apply

# Full deployment including infrastructure and container
.PHONY: deploy-all
deploy-all: tf-init tf-apply all

# Help
.PHONY: help
help:
	@echo "Available targets:"
	@echo "  all          - Complete build and push process"
	@echo "  ecr-login    - Login to ECR"
	@echo "  docker-buildx- Setup Docker buildx"
	@echo "  build-push   - Build and push multi-arch image"
	@echo "  clean        - Clean up Docker resources"
	@echo "  tf-init      - Initialize Terraform"
	@echo "  tf-apply     - Apply Terraform changes"
	@echo "  deploy-all   - Deploy infrastructure and container"
	@echo "  help         - Show this help message"
