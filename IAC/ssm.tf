resource "aws_ssm_parameter" "private_key" {
  name        = "/eth-ping-pong/PRIVATE_KEY"
  description = "Private key for Ethereum wallet"
  type        = "SecureString"
  value       = var.private_key
}

resource "aws_ssm_parameter" "infura_api_key" {
  name        = "/eth-ping-pong/INFURA_API_KEY"
  description = "Infura API key"
  type        = "SecureString"
  value       = var.infura_api_key
}
