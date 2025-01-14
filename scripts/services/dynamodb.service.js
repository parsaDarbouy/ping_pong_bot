const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { AWS_CONFIG, PING_PONG_STATUS } = require('../config/constants');


/**
 * DynamoDBService provides methods for interacting with a DynamoDB table,
 * handling ping-pong events, updating statuses, and fetching required data.
 * 
 * Uses AWS SDK DynamoDBClient and DynamoDBDocumentClient for operations.
 */
class DynamoDBService {
  constructor() {
    const client = new DynamoDBClient({ region: AWS_CONFIG.region });
    this.docClient = DynamoDBDocumentClient.from(client);
  }

  /**
   * Stores a ping-pong event in the DynamoDB table.
   *
   * @param {number} blockNumber - The block number of the ping event.
   * @param {string} pingTxHash - The transaction hash of the ping event.
   * @param {string | null} pongTxHash - The transaction hash of the pong event.
   * @param {number | null} pongNonce - The nonce of the pong transaction.
   * @param {string | null} gasPrice - The gas price of the pong transaction.
   * @param {string} [status=PING_PONG_STATUS.PENDING] - The status of the event.
   * @throws {Error} - Throws an error if the operation fails.
   */
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

  /**
   * Updates the pong transaction hash and status for a given block number in DynamoDB.
   *
   * @param {number} blockNumber - The block number to update.
   * @param {string} pongTxHash - The new pong transaction hash.
   * @param {string} status - The status to update.
   * @throws {Error} - Throws an error if the operation fails.
   */
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

  /**
   * Updates the pong nonce and gas price for a given block number in DynamoDB.
   *
   * @param {number} blockNumber - The block number to update.
   * @param {number} pongNonce - The new pong nonce.
   * @param {string} gasPrice - The new gas price.
   * @throws {Error} - Throws an error if the operation fails.
   */
  async updatePong(blockNumber, pongNonce, gasPrice) {
    const params = {
      TableName: AWS_CONFIG.tableName,
      Key: { blockNumber },
      UpdateExpression: "SET pongNonce = :pongNonce , gasPrice = :gasPrice",
      ExpressionAttributeValues: { ":pongNonce": pongNonce, ":gasPrice" : gasPrice },
    };
    await this.docClient.send(new UpdateCommand(params));
  }


  /**
   * Updates the status of a ping-pong event for a given block number in DynamoDB.
   *
   * @param {number} blockNumber - The block number to update.
   * @param {string} status - The status to update.
   * @throws {Error} - Throws an error if the operation fails.
   */
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



  /**
   * Fetches `pongNonce` and `gasPrice` for a given block number from DynamoDB.
   *
   * If the block number is not found, returns default values `{ pongNonce: null, gasPrice: null }`.
   * Logs errors and returns defaults in case of query failures.
   *
   * @param {number} blockNumber - The block number to query.
   * @returns {Promise<{pongNonce: number | null, gasPrice: string | null}>} 
   *   The nonce and gas price, or default values if not found.
   */
  async getNoncePrice(blockNumber) {
    try {
      const scanParams = {
        TableName: AWS_CONFIG.tableName,
        ProjectionExpression: "blockNumber, pongNonce, gasPrice",
        FilterExpression: "blockNumber = :blockNumber",
        ExpressionAttributeValues: {
          ":blockNumber": blockNumber,
        },
      };
  
      const response = await this.docClient.send(new ScanCommand(scanParams));
  
      // If data is found, return it
      if (response.Items && response.Items.length > 0) {
        const { pongNonce, gasPrice } = response.Items[0]; // Assuming blockNumber is unique
        return { pongNonce, gasPrice };
      }
  
      // No data found, return defaults
      console.log(`Block number ${blockNumber} not found. Returning default values.`);
      return { pongNonce: null, gasPrice: null }; // Or set fallback defaults
    } catch (error) {
      console.error("Error querying DynamoDB for pongNonce and gas price:", error.message);
      // Optionally, return defaults in case of an error
      return { pongNonce: null, gasPrice: null };
    }
  }


  /**
   * Fetches the last processed block number from the DynamoDB table.
   *
   * @returns {Promise<number>} - The highest block number found, or 0 if none exist.
   * @throws {Error} - Throws an error if the query fails.
   */
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

  /**
   * Fetches all ping-pong events with a pending status from the DynamoDB table.
   *
   * @returns {Promise<Array>} - An array of pending events.
   * @throws {Error} - Throws an error if the query fails.
   */
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

  /**
   * Updates the status of multiple events in the DynamoDB table.
   *
   * @param {Array} events - An array of events to update.
   * @param {string} status - The status to apply to all events.
   * @returns {Promise<void>} - Resolves when all updates are complete.
   */
  async batchUpdateStatus(events, status) {
    const promises = events.map(event => 
      this.updatePingPongStatus(event.blockNumber, status)
    );
    await Promise.all(promises);
  }
}

module.exports = new DynamoDBService(); 
