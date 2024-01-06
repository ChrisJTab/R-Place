const redis = require('redis');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");
const { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand } = require("@aws-sdk/client-dynamodb");

// This is the timeout value for spam protection. This is set in milliseconds since our database stores timestamps in unix time.
const timeout = 300000; 

const redisClient = redis.createClient({ url: 'redis://rediscluster-001.4zqj29.0001.use1.cache.amazonaws.com:6379' });

const dynamo = new DynamoDBClient({ region: 'us-east-1' });

const tableName = "rPlaceLog";

const apiGatewayClient = new ApiGatewayManagementApiClient({
	apiVersion: '2018-11-29',
	endpoint: 'https://41y12ty4jb.execute-api.us-east-1.amazonaws.com/production', // Replace with your API Gateway endpoint
	region: 'us-east-1' // Replace with your AWS region
});

redisClient.on("error", (error) => console.error(`Error : ${error}`));

async function getUserLatestRequest(connectionId) {
    try {
      const queryCommand = new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "connectionId = :id",
        ExpressionAttributeValues: { ":id": { S: connectionId } },
        ScanIndexForward: false, // To get the latest request first
        Limit: 1, // Only retrieve one item (the latest request)
      });
  
      const result = await dynamo.send(queryCommand);
      console.log(result.Items);
      return result.Items;
    } catch (error) {
        console.err(error);
    }
}

async function logUserRequest(connectionId, x, y, c){
	console.log(Date.now().toString())
    const putParams = {
        TableName: tableName,
        Item: {
            connectionId: { S: connectionId },
            timestamp: { N: Date.now().toString() },
            x: { N: x.toString() },
            y: { N: y.toString() },
            c: { N: c.toString() }
        },
    };
    console.log(`Sending ${putParams}`);
    const command = new PutItemCommand(putParams);
    const res = await dynamo.send(command);
	console.log(res);
	return res;
}

async function storePixelColor(x, y, colour) {
	const offset = (y * 1000 + x) * 4;
	var command = ['BITFIELD', 'board', 'SET', 'u4', offset.toString(), colour.toString()];
	console.log(command);
	redisClient.sendCommand(command, (err) => {
		if (err) {
			console.error(err);
		}
	});
}

// Mostly used to test requests
async function getPixelColor(x, y) {
	const offset = (y * 1000 + x) * 4;
	var command = ['BITFIELD', 'board', 'GET', 'u4', offset.toString()];
	console.log(command);
	var value = redisClient.sendCommand(command, (err) => {
		if (err) {
			console.error(err);
		}
	});
	return value;
}

async function sendPixelToClient(connectionId, x, y, colour) {
	const pixelData = {
		x: x,
		y: y,
		colour: colour,
	};
	try {
		// Convert pixel data to a JSON string
		const pixelJson = JSON.stringify(pixelData);
		// Send the pixel data to the client using the API Gateway Management API
		const input = {
			Data: pixelJson,
			ConnectionId: connectionId
		};

		const command = new PostToConnectionCommand(input);
		await apiGatewayClient.send(command).catch((_err) => {
			console.log(
				`failed to broadcast to ${connectionId}`
			);
		});
	} catch (error) {
		console.error(`Error sending pixel to client with connectionId ${connectionId}:`, error);
	}
}

async function getAllConnectionIds() {
	try {
		return await redisClient.LRANGE('connectionIDs', 0, -1);
	} catch (error) {
		throw error;
	}
}

exports.handler = async (event) => {
	try {
		// Access the connectionId from the requestContext
		const InitConnectionId = event.requestContext.connectionId;
		console.log(event);
		// Parse the JSON string into an object
		const parsedBody = JSON.parse(event.body);
		
		// DISCLAIMER: When running the test from the AWS console, you don't need to parse the event.body
		// Use this parsedBody for testing on AWS console
		//const parsedBody = event.body;
		const x = parsedBody.x;
		const y = parsedBody.y;
		const c = parsedBody.colour;

		console.log(`Connection ID: ${InitConnectionId}`);

		try{
			const prev = await getUserLatestRequest(InitConnectionId);
			var time = parseInt(prev[0]?.timestamp.N);
			const currTime = Date.now();
			var difference = currTime-time;
			console.log(`Time differential: ${difference}`);
			if (difference < timeout){
				try{
					const input = {
						Data: {"Timeout": difference},
						ConnectionId: InitConnectionId
					};
					const command = new PostToConnectionCommand(input);
					await apiGatewayClient.send(command);
				}catch(e){
					console.log(`Error broadcasting: ${e}`);
				}finally{
					const response = {
						statusCode: 200,
					};
					return response;
				}
			}
		}catch(e){
			console.error(`Failed to get user's previous update: ${e}`);
		}
		try {
			await redisClient.connect();
		}catch(e){
			console.error(`Error opening redis Client: ${e}`);
		}
		await storePixelColor(x, y, c);
		await logUserRequest(InitConnectionId, x, y, c);

		const connectionIds = await getAllConnectionIds();
		for (const connectionId of connectionIds) {
			await sendPixelToClient(connectionId, x, y, c);
		}

		const response = {
			statusCode: 200,
		};
		return response;
	} catch (error) {
		console.error(`Error: ${error}`);
		return {
			statusCode: 500,
			body: JSON.stringify('Internal Server Error'),
		};
	} finally {
		// Close the Redis connection
		try {
			await redisClient.quit();
		}catch (e){
			console.error(`Error closing redis: ${e}`)
		}
	}
};
