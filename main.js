#!/usr/bin/env node
const child_process=require("child_process");
const socketIoClient=require("socket.io-client");
const fs=require("fs");
const serialPort = require('serialport');

const delimiter="\n";

const blue = "\x1b[34m";
const bright = "\x1b[1m";
const colorReset="\x1b[0m";
const green = "\x1b[32m";
const red = "\x1b[31m";

const minTemperature=36;
const maxTemperature=50;
const minFanSpeed=25;
const maxFanSpeed=100;

// lib functions
function setTimeoutPromise(ms){return new Promise(resolve=>{
	setTimeout(resolve,ms);
})}
function beep(text=""){
	fs.writeFile("/dev/console","\x07"+text,()=>{});
}
function sendByte(byte){
	if(!port.isOpen) console.log("cant send messages to closed serialport!");
	if(byte>255) byte=255;
	else if(byte<0) byte=0;
	else if(typeof(byte)==="boolean"&&byte) byte=255;
	else if(typeof(byte)==="boolean"&&!byte) byte=0;
	const buffer=Buffer.from([byte]);
	port.write(buffer,err=>{
		if(err) console.log(err);
	});
	return byte;
}
function getPercentToValue(percent,full=10){
	// "full" ist der Grundwert also 100%
	// "percent" ist wie viel Prozent von "full"

	// full/100 is 1%
	return (full/100)*percent;
	// return percent from full
	// example full=255, percent=50
	// that returns 127.5
}
function getValueToPercent(value,full=10){
	// "full" ist der Grundwert also 100%
	// "value" ist der Prozentwert

	// 100%/full is 1%
	return (100/full)*value;
	// return number between 0 and 100
}

// normal functions
function getTemperature(){return new Promise(resolve=>{
	//console.log("tmp...");
	child_process.exec(`ssh ${remoteIp} cat /sys/class/thermal/thermal_zone0/temp`,(error,stdout,stderr)=>{
		if(error) console.log(error);
		if(stderr) console.log(stderr);
		const temperature=Number(stdout
			.toString("utf-8")
			.trim()
		)/1000;
		//console.log("tmp is",temperature);
		resolve(temperature);
	});
})}
function setFanSpeed(fanSpeedPercent){
	let fanSpeedByte=Math.round(getPercentToValue(fanSpeedPercent,255));
	fanSpeedByte=sendByte(fanSpeedByte);
	fanSpeedPercent=Math.round(getValueToPercent(fanSpeedByte,255));
	dynamic.fanSpeedPercent_real=fanSpeedPercent;
	return fanSpeedPercent;
}
function onTemperatureChanged(temperature){
	let fanSpeed=dynamic.fanSpeedPercent;

	const current=minTemperature-temperature;
	const length=minTemperature-maxTemperature;
	fanSpeed=Math.round(getValueToPercent(current,length));
	if(fanSpeed<minFanSpeed) fanSpeed=minFanSpeed;
	else if(fanSpeed>maxFanSpeed) fanSpeed=maxFanSpeed;
	return fanSpeed;
}

const remoteIp="192.168.178.55";

const port = new serialPort.SerialPort({
	path: "/dev/ttyACM0",
	baudRate: 9600,
});

port.on("open",()=>{
	console.log("connected to fan controller!");
});
port.on("close",()=>{
	console.log("connection to fan controller lost! try reconnect");
	fn=()=>{
		console.log("reconnecting ...");
		port.open((error)=>error?setTimeout(fn,1e3):"");
	};
	setTimeout(fn,1e3);
});
port.on("error",error=>{
	if(error.message.includes("No such file or directory, cannot open")){
		console.log("cant connect to serial port cant open path!");
		setTimeout(()=>port.open(),1e3);
	}
	else throw error;
});
port.on("data",buffer=>{
	//process.stdout.write(buffer);
});

let dynamic={
	fanSpeedPercent: null,
	fanSpeedPercent_real: null,
	last_temperature: null,
	temperature: null,
};

(async()=>{//main
	while(true){
		const temperature=await getTemperature();
		dynamic.temperature=temperature;
		const fanSpeedPercent=onTemperatureChanged(temperature);
		dynamic.last_temperature=temperature;
		dynamic.fanSpeedPercent=fanSpeedPercent;
		await setTimeoutPromise(500); // wait 500ms aka. 0.5s
	}
})();

setInterval(()=>{
	let fanStatus="keep";
	if(!port.isOpen) return;
	if(dynamic.fanSpeedPercent_real===null) dynamic.fanSpeedPercent_real=100;
	if(dynamic.fanSpeedPercent>dynamic.fanSpeedPercent_real){
		fanStatus="up";
		setFanSpeed(dynamic.fanSpeedPercent_real+1);
	}
	else if(dynamic.fanSpeedPercent<dynamic.fanSpeedPercent_real){
		fanStatus="down";
		setFanSpeed(dynamic.fanSpeedPercent_real-1);
	}
	//else return;

	let temperature=Math.round(dynamic.temperature*10)/10;
	if(temperature>=maxTemperature) temperature=red+temperature+colorReset;
	if(temperature<=minTemperature) temperature=blue+temperature+colorReset;

	let fanSpeedPercent=String(dynamic.fanSpeedPercent).padStart(2,"0");
	if(fanSpeedPercent===maxFanSpeed) fanSpeedPercent=red+fanSpeedPercent;
	else if(fanSpeedPercent===minFanSpeed) fanSpeedPercent=blue+fanSpeedPercent;

	let fanSpeedPercent_real=String(dynamic.fanSpeedPercent_real).padStart(2,"0");
	if(fanSpeedPercent_real===maxFanSpeed) fanSpeedPercent_real=red+fanSpeedPercent+colorReset;
	else if(fanSpeedPercent_real===minFanSpeed) fanSpeedPercent_real=blue+fanSpeedPercent+colorReset;

	if(fanStatus==="keep") fanStatus=green+bright+"="+colorReset;
	else if(fanStatus==="down") fanStatus=blue+bright+"-"+colorReset;
	else if(fanStatus==="up") fanStatus=red+bright+"+"+colorReset;

	process.stdout.write(`\rTemperature: ${temperature}°C, FAN: ${fanSpeedPercent}% current ${fanSpeedPercent_real}% ${fanStatus} `);
},300);
