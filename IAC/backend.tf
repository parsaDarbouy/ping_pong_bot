terraform {
  backend "s3" {
    bucket         = "parsa-iac-terraform-state-bucket"
    key            = "eth-ping-pong/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}
