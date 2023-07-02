#!/usr/bin/env node
const child_process=require("child_process");
const socketIoClient=require("socket.io-client");
const fs=require("fs");
const serialPort = require('serialport');

const delimiter="\n";
let reading="";

const protocols=[
	"UNKNOWN",
	null,null,null,null,null,null,null,
	"NEC",
	null,
	"Onkyo",
]

function beep(text=""){
	fs.writeFile("/dev/console","\007"+text,()=>{});
}
function receiveData(data){
	console.log("Microcontroller: "+data);
	if(data.startsWith("Data: ")){
		const rawData=data.substring("Data: ".length);
		const protocol=Number(rawData.split("|")[0]);
		const command=parseInt(rawData.split("|")[1],36);

		console.log(protocols[protocol],command);
		
		if(protocol===8&&command===7){ // volume key up
			child_process.exec("amixer sset PCM 5%+");
		}
		else if(protocol===10&&command===49932){ // volume key down
			child_process.exec("amixer sset PCM 5%-");
		}
		else if(protocol===10&&command===58889){ // track key up
			let socket;
			if(musikPlayer_use==="local") socket=socketMusikPlayer;
			else socket=socketMusikPlayer_remote;

			socket.emit("action-playback","nextTrack");
		}
		else if(protocol===8&&command===94){ // track key down
			let socket;
			if(musikPlayer_use==="local") socket=socketMusikPlayer;
			else socket=socketMusikPlayer_remote;

			socket.emit("action-playback","previousTrack");
		}
		else if(protocol===8&&command===71){ // change device key
			if(musikPlayer_use==="local"){
				musikPlayer_use="remote";
				beep("   REMOTE   ");
				setTimeout(beep,200,"   REMOTE   ");
			}
			else{
				musikPlayer_use="local";
				beep("   LOCAL   ");
			}
		}
		else if(protocol===8&&command===69){ // pause/play
			let socket;
			if(musikPlayer_use==="local") socket=socketMusikPlayer;
			else socket=socketMusikPlayer_remote;

			const isPlaying=musikPlayerCurrentlyPlaying[musikPlayer_use].isPlaying;

			if(isPlaying) socket.emit("action-playback","pause");
			else socket.emit("set-playback");
		}
	}
}

const remoteIp="192.168.178.55";

let musikPlayer_use="local";
const musikPlayerCurrentlyPlaying={
	local:{},
	remote:{},
}
const socketMusikPlayer=socketIoClient.io("http://localhost:4561");
socketMusikPlayer.on("currentlyPlaying",currentlyPlaying=>musikPlayerCurrentlyPlaying.local=currentlyPlaying);

const socketMusikPlayer_remote=socketIoClient.io("http://"+remoteIp+":4561");
socketMusikPlayer_remote.on("currentlyPlaying",currentlyPlaying=>musikPlayerCurrentlyPlaying.remote=currentlyPlaying);

const port = new serialPort.SerialPort({ path: "/dev/ttyACM0", baudRate: 9600,})

port.on("open", () => {
	console.log("serial port open");
});
port.on("data",buffer=>{
	const data=buffer.toString("utf-8");
	if(data.split(delimiter).length>1){
		receiveData(reading+data.split(delimiter)[0]);
		if(data.split(delimiter).length>2){
			for(const data of data.split(delimiter)){
				receiveData(data);
			}
		}
		reading="";
	}
	else{
		reading+=data;
	}
});

