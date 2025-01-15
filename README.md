# Bot Syncing

This project implements a bot that listens to `Ping()` events emitted by a smart contract deployed on the Sepolia network and responds with `pong()` calls containing the transaction hash. The bot starts at a specified block number and ensures that one `pong()` is sent for each `Ping()` event after the starting block.

## Features
- Listens for `Ping()` events emitted from the contract at address `0xa7f42ff7433cb268dd7d59be62b00c30ded28d3d` (Sepolia).
- Calls `pong()` with the transaction hash of the emitted `Ping()` event.
- Starts at any block and processes events after that block.
- Ensures reliability and restarts without missing any `Ping()` events after network failures or bugs.
- Can be deployed on AWS instances using Infrastructure-as-Code (IAC).

## Requirements
- Sepolia ETH for transactions (can be obtained via [Sepolia Faucet](https://sepoliafaucet.com/)).
- Ethereum provider (Infura or Alchemy).
- AWS account credentials for provisioning infrastructure.

## Environment Variables
You need to set up the following environment variables in both `.env` and `terraform.tfvar` files:

- `PRIVATE_KEY`
- `INFURA_API_KEY`
- `ALCHEMY_KEY`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `WALLET_ADDRESS`

## Setup Instructions

### 1. Install dependencies
Make sure you have `Docker`, `Make`, and `Hardhat` installed on your machine.

### 2. Export credentials
Before running the commands, export your AWS credentials in the terminal:

```bash
export AWS_ACCESS_KEY_ID=<your_aws_access_key>
export AWS_SECRET_ACCESS_KEY=<your_aws_secret_access_key>
export AWS_REGION=<your_aws_region>
```

### 3. Build and deploy
To build the Docker image for the bot and push it to the repository, use the `make` command:

```bash
make all
```

### 4. Provision AWS Instances

To deploy the required infrastructure for running the bot, use the Terraform configurations provided in the `IAC` directory. Follow these steps to provision the AWS instances and related resources:

#### 4.1 Navigate to the IAC Directory
The Terraform configuration files are located in the `IAC` directory. Switch to this directory using the following command:

```bash
cd IAC
```
#### 2.	Initialize Terraform:
Run the following command to initialize Terraform and download the necessary providers:
```bash
terraform init
```

#### 	3.	Apply the Terraform configurations:
Apply the configurations to provision the AWS instances and other resources:
```bash
terraform apply
```

Note: Make sure your AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION) are properly exported or configured in the environment before running these commands.

### 5. Run the Bot

You can run the bot either locally or on an AWS ECS instance. Follow the steps below for each option.

#### 5.1 Run Locally
To run the bot on your local machine, use the following command:

```bash
npx hardhat run scripts/ping_pong.js --network sepolia