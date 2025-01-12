variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "private_key" {
  description = "Private key for Ethereum wallet"
  type        = string
  sensitive   = true
}

variable "infura_api_key" {
  description = "Infura API key"
  type        = string
  sensitive   = true
}

variable "vpc_id" {
  description = "VPC id"
  type        = string
  sensitive   = false
}

variable "subnet_ids" {
  description = "List of subnet IDs to be used"
  type        = list(string)
}

variable "vpc_cidr_block" {
  description = "VPC vpc cidr block"
  type        = string
  sensitive   = false
}
