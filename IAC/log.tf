resource "aws_cloudwatch_log_group" "ping_pong" {
  name              = "/ecs/eth-ping-pong"
  retention_in_days = 30
}
