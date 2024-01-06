const redis = require('redis');

const redisClient = redis.createClient({ url: 'redis://rediscluster-001.4zqj29.0001.use1.cache.amazonaws.com:6379' });

redisClient.on("error", (error) => console.error(`Error : ${error}`));

const colourMap = {
	0: [0, 0, 0],
	1: [255, 0, 0],
	2: [0, 255, 0],
	3: [0, 0, 255],
	4: [255, 255, 0],
	5: [128, 0, 128],
	6: [255, 165, 0],
	7: [255, 192, 203],
	8: [165, 42, 42],
	9: [0, 255, 255],
	10: [173, 216, 230],
	11: [0, 100, 0],
	12: [139, 0, 0],
	13: [0, 0, 139],
	14: [128, 128, 128],
	15: [0, 0, 0]
}

const REST_BITFIELD = false;

// -----------------------------------------------------------------------------

function byteStringToIntArray(byteString) {
	const intArray = [];
	let byteValue;
	let binaryString;
	let nibble;
	let intValue;
	for (let i = 0; i < byteString.length; i++) {
		byteValue = byteString[i].charCodeAt(0); // Convert byte to integer
		binaryString = byteValue.toString(2).padStart(8, '0'); // Convert integer to binary string
		// Take the 4 bits starting from the left
		nibble = binaryString.slice(0, 4);
		// Convert the nibble back to an integer
		intValue = parseInt(nibble, 2);
		// Push the integer into the array
		intArray.push(intValue);

		// Right slice
		nibble = binaryString.slice(4, 8)
		intValue = parseInt(nibble, 2);
		intArray.push(intValue);
	}

	return intArray;
}

async function initializeBitfield() {
	// Sets the 4 millionth bit to 0
	var command = ['BITFIELD', 'board', 'SET', 'u1', '3999999', '0'];
	console.log("Creating")
	redisClient.sendCommand(command, (err) => {
		if (err) {
			console.error(err);
		}
	});
}

async function resetBitfield() {
	// Erases the board and then sets the milliont bit to 0
	try {
		await redisClient.set("board", 1);
		await initializeBitfield();
	} catch (e) {
		console.log(`Error: ${e}`);
	}
}

exports.handler = async (event) => {
	try {
		// Access the connectionId from the requestContext
		await redisClient.connect();
		
		if (resetBitfield) {
			await resetBitfield();
		}

		console.log("Getting board")
		const bitmap = await redisClient.get("board")
		// const reply = byteStringToIntArray(bitmap)
		// return { "board": bitmap, map: colourMap };
		return bitmap;
	} catch (error) {
		console.error(`Error: ${error}`);
		return {
			statusCode: 500,
			body: JSON.stringify('BOOM Internal Server Error'),
		};
	} finally {
		// Close the Redis connection
		try {
			await redisClient.quit();
		} catch (error) {
			console.log(`Error: ${error}`);
		}
	}
};
