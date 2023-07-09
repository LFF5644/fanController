#!/usr/bin/env node
const child_process=require("child_process");
const socketIoClient=require("socket.io-client");
const fs=require("fs");
const serialPort = require('serialport');

const delimiter="\n";
let reading="";

// lib functions
function setTimeoutPromise(ms){return new Promise(resolve=>{
	setTimeout(resolve,ms);
})}
function beep(text=""){
	fs.writeFile("/dev/console","\x07"+text,()=>{});
}
function sendByte(byte){
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
function getTemperature(){
	const temperature=Number(
		child_process.execSync(`ssh ${remoteIp} cat /sys/class/thermal/thermal_zone0/temp`)
			.toString("utf-8")
			.trim()
	)/1000;

	// for debugging \/
	const temperature_fake=Number(fs.readFileSync("tmp.txt","utf-8").trim());
	return temperature;
}
function setFanSpeed(fanSpeedPercent){
	let fanSpeedByte=Math.round(getPercentToValue(fanSpeedPercent,255));
	console.log(`change fan speed to ${fanSpeedPercent}%`);
	fanSpeedByte=sendByte(fanSpeedByte);
	fanSpeedPercent=Math.round(getValueToPercent(fanSpeedByte,255));
	return fanSpeedPercent;
}
function onTemperatureChanged(temperature){
	let fanSpeed=dynamic.fanSpeedPercent;
	
	const minTemperature=38;
	const maxTemperature=45;
	const minFanSpeed=25;
	const maxFanSpeed=100;

	const current=minTemperature-temperature;
	const length=minTemperature-maxTemperature;
	fanSpeed=Math.round(getValueToPercent(current,length));
	if(fanSpeed<minFanSpeed) fanSpeed=minFanSpeed;
	else if(fanSpeed>maxFanSpeed) fanSpeed=maxFanSpeed;
	console.log(`FanSpeedPercent: ${fanSpeed}%, Temperature: ${temperature}`);
	return fanSpeed;
}

const remoteIp="192.168.178.55";

const port = new serialPort.SerialPort({
	path: "/dev/ttyACM0",
	baudRate: 9600,
});

port.on("open",()=>{
	console.log("serial port open");
	setTimeout(()=> setFanSpeed(dynamic.fanSpeedPercent),1e3);
});
port.on("data",buffer=>{
	//process.stdout.write(buffer);
});

let dynamic={
	fanSpeedPercent: null,
	last_temperature: null,
	temperature: null,
};

(async()=>{//main
	while(true){
		const temperature=getTemperature();
		dynamic.temperature=temperature;
		const fanSpeedPercent=onTemperatureChanged(temperature);
		dynamic.last_temperature=temperature;
		dynamic.fanSpeedPercent=setFanSpeed(fanSpeedPercent);
		await setTimeoutPromise(500); // wait 500ms aka. 0.5s
	}
})();
