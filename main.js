#!/usr/bin/env node
const child_process=require("child_process");
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
	console.log(data);
	if(data.startsWith("Data: ")){
		const rawData=data.substring("Data: ".length);
		const protocol=Number(rawData.split("|")[0]);
		const command=parseInt(rawData.split("|")[1],36);

		console.log(protocols[protocol],command);
		
		if(protocol===8&&command===7){
			child_process.exec("amixer sset PCM 5%+");
		}
		else if(protocol===10&&command===49932){
			child_process.exec("amixer sset PCM 5%-");
		}
	}
}

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
