const redis = require('redis');

const redisClient = redis.createClient({url: 'redis://rediscluster-001.4zqj29.0001.use1.cache.amazonaws.com:6379'});

redisClient.on("error", (error) => console.error(`Error : ${error}`));

exports.handler = async (event) => {
  try {
    // Access the connectionId from the requestContext
    const connectionId = event.requestContext.connectionId;
    
    console.log(`Connection ID: ${connectionId}`);
    
    await redisClient.connect();
    
    // Remove the connectionId from Redis
    redisClient.LREM('connectionIDs', 0, connectionId)

    const response = {
      statusCode: 200,
      body: JSON.stringify('Disconnected successfully!'),
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
    await redisClient.quit();
  }
};