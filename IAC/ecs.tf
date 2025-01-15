resource "aws_ecs_cluster" "ping_pong" {
  name = "eth-ping-pong"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "ping_pong" {
  family                   = "eth-ping-pong"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }
  container_definitions = jsonencode([
    {
      name      = "ping-pong"
      image     = "${aws_ecr_repository.ping_pong.repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = 80
          hostPort      = 80
        },
        {
          containerPort = 443
          hostPort      = 443
        }
      ]
      environment = [
        {
          name  = "NETWORK"
          value = "sepolia"
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        },
        {
          name = "wallet_Address"
          value = var.wallet_Address
        }

      ]
      secrets = [
        {
          name      = "PRIVATE_KEY"
          valueFrom = aws_ssm_parameter.private_key.arn
        },
        {
          name      = "INFURA_API_KEY"
          valueFrom = aws_ssm_parameter.infura_api_key.arn
        }
      ]


      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ping_pong.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

}



resource "aws_ecs_service" "ping_pong" {
  name            = "eth-ping-pong"
  cluster         = aws_ecs_cluster.ping_pong.id
  task_definition = aws_ecs_task_definition.ping_pong.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.allow_tls.id]
    assign_public_ip = true
  }
}