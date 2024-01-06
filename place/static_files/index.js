const BOARD_DIM = 1000;
const WSS_URL = "wss://41y12ty4jb.execute-api.us-east-1.amazonaws.com/production/";

const colorMap = {
	"#000000": 15, 	// Black
	"#800000": 14, 	// Maroon
	"#008000": 13, 	// Green
	"#808000": 12,	 // Olive
	"#000080": 11, 	// Navy
	"#800080": 10, 	// Purple
	"#008080": 9, 	// Teal
	"#808080": 8, 	// Gray
	"#C0C0C0": 7, 	// Silver
	"#FF0000": 6, 	// Red
	"#00FF00": 5, 	// Lime
	"#FFFF00": 4, 	// Yellow
	"#0000FF": 3, 	// Blue
	"#FF00FF": 2, 	// Fuchsia
	"#00FFFF": 1, 	// Aqua
	"#FFFFFF": 0  	// White
};

const rgbMap = {
	15: [0, 0, 0],		// Black
	14: [128, 0, 0],	// Maroon
	13: [0, 128, 0],	// Green
	12: [128, 128, 0],	// Olive
	11: [0, 0, 128],	// Navy
	10: [128, 0, 128],	// Purple
	9: [0, 128, 128],	// Teal
	8: [128, 128, 128],	// Gray
	7: [192, 192, 192],	// Silver
	6: [255, 0, 0],		// Red
	5: [0, 255, 0],		// Lime
	4: [255, 255, 0],	// Yellow
	3: [0, 0, 255],		// Blue
	2: [255, 0, 255],	// Fuchsia
	1: [0, 255, 255],	// Aqua
	0: [255, 255, 255]	// White
};


//---------------------------------------------------------------------------------------------------------------------
var socket;

$(function () {
	(async () => {
		await initBoard();
	})();
	updateColorPreview();

	socket = new WebSocket(WSS_URL);

	socket.onopen = function (event) {
		$('#sendButton').removeAttr('disabled');
		console.log("connected");
	};

	socket.onclose = function (event) {
		alert("closed code:" + event.code + " reason:" + event.reason + " wasClean:" + event.wasClean);
	};

	socket.onmessage = function (event) {
		var o = JSON.parse(event.data);

		let [r, g, b] = rgbMap[o['colour']];
		drawPixel(o['x'], o['y'], r, g, b);
	};

	// $('#canvas').mousemove(function (event) {
	// 	if (!ALLOW_DRAWING) {
	// 		return;
	// 	}

	// 	const x = event.pageX - this.offsetLeft;
	// 	const y = event.pageY - this.offsetTop;

	// 	var msgData = {
	// 		'action': "onMessage",
	// 		'x': x || 0,
	// 		'y': y || 0,
	// 		'colour': colorMap[$('#color').val()] || 0
	// 	};
	// 	socket.send(JSON.stringify(msgData));
	// });

	$('#setForm').submit(function (event) {
		var msgData = {
			'action': "onMessage",
			'x': parseInt($('#x').val()) || 0,
			'y': parseInt($('#y').val()) || 0,
			'colour': colorMap[$('#color').val()] || 0
		};
		socket.send(JSON.stringify(msgData));
		event.preventDefault();
	});
});

async function initBoard() {
	// Function to send the initial message
	async function getBoard() {
		const apiUrl = 'https://bpywroq9mg.execute-api.us-east-1.amazonaws.com/production/';

		try {
			const response = await fetch(apiUrl);

			if (!response.ok) {
				throw new Error(`HTTP error! Status: ${response.status}`);
			}
			return await response.json();
		} catch (error) {
			console.error('Error fetching data:', error);
		}
	}

	let bitmap = await getBoard();

	const board = byteStringToIntArray(bitmap);
	for (let i = 0; i < board.length; i++) {
		if (board[i] == 0) { // If color is white, don't draw it!
			continue;
		}

		let [r, g, b] = rgbMap[board[i]];
		const x = i % BOARD_DIM;          // Calculate the x-coordinate
		const y = Math.floor(i / BOARD_DIM); // Calculate the y-coordinate
		drawPixel(x, y, r, g, b);
	}
}

function drawPixel(x, y, r, g, b) {
	const PIXEL_SIZE = 1;

	x = x * PIXEL_SIZE;
	y = y * PIXEL_SIZE;

	// Calculate the nearest grid point based on pixel size
	var snappedX = Math.floor(x / PIXEL_SIZE) * PIXEL_SIZE;
	var snappedY = Math.floor(y / PIXEL_SIZE) * PIXEL_SIZE;

	var context = document.getElementById('canvas').getContext('2d');
	context.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
	context.fillRect(snappedX, snappedY, PIXEL_SIZE, PIXEL_SIZE);
}

function updateColorPreview() {
	const colorSelect = document.getElementById('color');
	const colorPreview = document.getElementById('colorPreview');
	const selectedColor = colorSelect.value;

	colorPreview.style.backgroundColor = selectedColor;
}

function colourToRGB(colour) {
	// Helper function to convert hex to RGB
	function hexToRgb(hex) {
		// Remove the hash (#) if it exists
		hex = hex.replace(/^#/, '');

		// Parse the hex value into RGB components
		const bigint = parseInt(hex, 16);
		const r = (bigint >> 16) & 255;
		const g = (bigint >> 8) & 255;
		const b = bigint & 255;

		return [r, g, b];
	}

	// Check if the input colour is a valid key in the colorMap
	if (colour >= 0 && colour <= 15) {
		// Get the corresponding hex value from the colorMap
		const hexValue = Object.keys(colorMap).find(key => colorMap[key] === colour);

		// Convert the hex value to RGB integers
		if (hexValue) {
			const rgb = hexToRgb(hexValue);
			return rgb;
		} else {
			console.error(`Invalid colour value: ${colour}`);
			return null;
		}
	} else {
		console.error(`Invalid colour value: ${colour}`);
		return null;
	}
}

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