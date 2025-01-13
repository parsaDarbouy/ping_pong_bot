const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { AWS_CONFIG, PING_PONG_STATUS } = require('../config/constants');

class DynamoDBService {
  constructor() {
    const client = new DynamoDBClient({ region: AWS_CONFIG.region });
    this.docClient = DynamoDBDocumentClient.from(client);
  }

  async storePingPongEvent(blockNumber, pingTxHash, pongTxHash, pongNonce, gasPrice, status = PING_PONG_STATUS.PENDING) {
    const params = {
      TableName: AWS_CONFIG.tableName,
      Item: {
        blockNumber,
        pingTxHash,
        pongTxHash,
        pongNonce,
        gasPrice,
        status,
        timestamp: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      },
      ConditionExpression: "attribute_not_exists(blockNumber) OR #st <> :confirmed",
      ExpressionAttributeNames: { "#st": "status" },
      ExpressionAttributeValues: { ":confirmed": PING_PONG_STATUS.CONFIRMED }
    };

    try {
      await this.docClient.send(new PutCommand(params));
      console.log("Successfully stored event data in DynamoDB");
    } catch (error) {
      console.error("Error storing data in DynamoDB:", error);
      throw error;
    }
  }

  async updatePingPongTxHash(blockNumber, pongTxHash, status) {
    const params = {
      TableName: AWS_CONFIG.tableName,
      Key: { blockNumber },
      UpdateExpression: "SET pongTxHash = :pongTxHash, #st = :status",
      ExpressionAttributeValues: { ":pongTxHash": pongTxHash, ":status": status },
      ExpressionAttributeNames: { "#st": "status" }
    };
    await this.docClient.send(new UpdateCommand(params));
  }

  async updatePong(blockNumber, pongNonce, gasPrice) {
    const params = {
      TableName: AWS_CONFIG.tableName,
      Key: { blockNumber },
      UpdateExpression: "SET pongNonce = :pongNonce , gasPrice = :gasPrice",
      ExpressionAttributeValues: { ":pongNonce": pongNonce, ":gasPrice" : gasPrice },
    };
    await this.docClient.send(new UpdateCommand(params));
  }

  async updatePingPongStatus(blockNumber, status) {
    const params = {
      TableName: AWS_CONFIG.tableName,
      Key: { blockNumber },
      UpdateExpression: "SET #st = :status",
      ExpressionAttributeValues: { ":status": status },
      ExpressionAttributeNames: { "#st": "status" }
    };
    await this.docClient.send(new UpdateCommand(params));
  }

  async getNoncePrice(blockNumber) {
    try {
      const scanParams = {
        TableName: AWS_CONFIG.tableName,
        ProjectionExpression: "blockNumber, pongNonce, gasPrice",
        FilterExpression: "blockNumber = :blockNumber",
        ExpressionAttributeValues: {
          ":blockNumber": blockNumber
        }
      };
      
      const response = await this.docClient.send(new ScanCommand(scanParams));
      if (response.Items && response.Items.length > 0) {
        const { pongNonce, gasPrice } = response.Items[0]; // Assuming blockNumber is unique
        return { pongNonce, gasPrice };
      }
      
      throw new Error(`Block number ${blockNumber} not found in the database.`);
    } catch (error) {
      console.error("Error querying DynamoDB for pongNonce and gas price:", error);
      throw error;
    }
  }


  async getLastProcessedBlock() {
    try {
      const scanParams = {
        TableName: AWS_CONFIG.tableName,
        ProjectionExpression: "blockNumber"
      };
      
      const response = await this.docClient.send(new ScanCommand(scanParams));
      if (response.Items && response.Items.length > 0) {
        const highestBlock = Math.max(...response.Items.map(item => item.blockNumber));
        return highestBlock;
      }
      return 0;
    } catch (error) {
      console.error("Error querying DynamoDB for last block:", error);
      throw error;
    }
  }

  async getPendingEvents() {
    const params = {
      TableName: AWS_CONFIG.tableName,
      FilterExpression: "#st <> :confirmed_status",
      ExpressionAttributeValues: {
        ":confirmed_status": PING_PONG_STATUS.CONFIRMED
      },
      ExpressionAttributeNames: {
        "#st": "status"
      }
    };

    try {
      const response = await this.docClient.send(new ScanCommand(params));
      return response.Items || [];
    } catch (error) {
      console.error("Error querying pending events from DynamoDB:", error);
      throw error;
    }
  }

  async batchUpdateStatus(events, status) {
    const promises = events.map(event => 
      this.updatePingPongStatus(event.blockNumber, status)
    );
    await Promise.all(promises);
  }
}

module.exports = new DynamoDBService(); 
