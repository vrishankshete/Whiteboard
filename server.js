
var log4js = require('log4js');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var _ = require("underscore");
var util = require('util');
var moment = require('moment');
var fs = require('fs');
var dir = './logs';

if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
}

log4js.configure({
 appenders: [
   { type: 'console' },
   //{ type: 'file', filename: 'logs/chat.log', category: 'chat' },
   {
		"type": "dateFile",
		"filename": "logs/chat.log",
		"pattern": "-yyyy-MM-dd",
		"alwaysIncludePattern": false
	}
  ]
});

var logger = log4js.getLogger('chat');
logger.setLevel('auto');

const HOST = '0.0.0.0'
const PORT = 8081;

var rooms = {};
var users = {};
var groups = {};
var sidUnameMap = {};

app.use(express.static(__dirname + '/static'));

function getRandom(){
	var max=9999, min=1000;
	return Math.floor(Math.random()*(max-min+1)+min);
}

app.get('/', function(req,res){
	logger.debug("Home Path");
	logger.debug("BEFORE File sent");
	res.sendFile(__dirname + "/static/" + "index.html");
	logger.debug("AFTER File sent");
	res.redirect('/home');
});

app.get('/home', function(req, res){
		logger.debug("Home / home Path");
		var meetingRef = getRandom();
		meetingRef = meetingRef.toString();
		logger.info("Random : "+meetingRef);
		rooms[meetingRef] = {};
		rooms[meetingRef].users = [];
		rooms[meetingRef].drawings = [];
		res.redirect('/home/' + meetingRef);
	});

app.get('/home/:mid', function(req, res){
		logger.debug("Home / home/ mid Path");
		var meetingRef = req.params.mid;
		//Check if room already exists
		var found = _.findKey(rooms, meetingRef);
		logger.debug("Meeting reference: " + meetingRef + " Found: " + found);
		if(found == -1){
			logger.debug("Room does not exist. Creating a new one for you...");
			res.redirect('/home');
		}
		logger.debug("Room valid:"+ meetingRef);
		logger.debug("Available Rooms: " + util.inspect(rooms));
		res.sendFile(__dirname + "/static/" + "index.html");
	});

io.on('connection', function(socket){
	logger.debug("Client Connected. " + socket.id);
	//console.log("\007");  //BEEP
	var id = socket.id;
	users[id] = {};
	sidUnameMap[socket.id] = null;

	function updateClients(){
		//Need to change to use "rooms" structure instead "users" 
		//var grpUsers = _.omit(users, function(value, key, object){
		//	return value.roomId != users[id].roomId;
		//});
		var roomId = users[id].roomId;
		var grpUsers = rooms[roomId].users;
		io.to(roomId).emit('users', grpUsers);
	}

	socket.on('room id', function(msg){
		var roomId = msg.slice(-4);
		if(isNaN(roomId)){
			return;
		}
		users[id].roomId = roomId;
		if(rooms[roomId]){
			rooms[roomId].users.push(id);
			logger.debug("\n***USERS: " + util.inspect(users));
			logger.debug("\n***ROOMS: " + util.inspect(rooms));
			socket.join(users[id].roomId);
			updateClients();
			socket.emit('initDrawings', rooms[roomId].drawings);
			logger.debug("Sent Drawings: " + util.inspect(rooms[roomId].drawings));
		}
	});

	socket.on('submit name', function(name){
		users[id].name = name;
		sidUnameMap[socket.id] = name;
		updateClients();
	});

	socket.on('disconnect', function(){
		logger.debug("Disconnected");
		var roomId = users[id].roomId;
	
		if(rooms[roomId] === undefined){
			logger.debug("Invalid Room Operation");
			return;
		}
		var indexToBeRemoved = rooms[roomId].users.indexOf(id);
		rooms[roomId].users.splice(indexToBeRemoved, 1);	
		updateClients();
		if(rooms[roomId] && rooms[roomId].users.length === 0){
			//No user left in this room. Delete it.
			delete rooms[roomId];
		}
		delete users[id];
		socket.leave(roomId);
		logger.debug("\n***USERS: " + util.inspect(users));
		logger.debug("\n***ROOMS: " + util.inspect(rooms));
	});

	socket.on('chat message', function(msg){
		logger.debug("Got Msg : " + msg + " From " + id + " in Room : " + users[id].roomId);
		var uName = users[id].name ? users[id].name : id;
		io.to(users[id].roomId).emit('chat message', {time:moment().format(), name:uName, data:msg});
	});

	socket.on('cursorStart', function(msg){
		var name = users[id].name ? users[id].name : id;
		io.to(users[id].roomId).emit('cursorStart', {name:name, drawingData:msg});
	});	

	socket.on('updateCursor', function(msg){
		var name = users[id].name ? users[id].name : id;
		io.to(users[id].roomId).emit('updateCursor', {name:name, drawingData:msg});
	});

	socket.on('addDrawing', function(msg){
		var roomId = users[id].roomId;
		if(!roomId || rooms[roomId]==undefined){
			return;
		}
		var drawing = {
			userId: id,
			name: users[id].name ? users[id].name : id, 
			addedTime: moment().format(),
			lastUpdatedUserId: id,
			lastUpdatedTime: moment().format(),
			drawingData: msg
		};
		rooms[roomId].drawings.push(drawing);
		io.to(users[id].roomId).emit('addDrawing', drawing);
	});

	socket.on('clearAll', function(){
		logger.debug('Clear All');
		var roomId = users[id].roomId;
		if(!roomId){
			return;
		}
		io.to(roomId).emit('clearAll');
		rooms[roomId].drawings = [];
	});	

	socket.on("video data", function(msg){
		var name = users[id].name ? users[id].name : id;
		io.to(users[id].roomId).emit("video data", {name:name, videoData:msg});
	});
});

http.listen(PORT, function(){
	logger.info(`URL: http://${HOST}:${PORT}/home/`);
});