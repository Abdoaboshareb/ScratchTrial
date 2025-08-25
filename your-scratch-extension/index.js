// Filename: your-scratch-extension/index.js

const BlockType = require('../../extension-support/block-type');
const ArgumentType = require('../../extension-support/argument-type');
const log = require('../../util/log');

class MeArmController {
    constructor(runtime) {
        this.runtime = runtime;
        // Variables to hold the serial port and writer objects
        this.port = null;
        this.writer = null;
    }

    getInfo() {
        return {
            id: 'meArm',
            name: 'MeArm Controller',
            color1: '#0FBD8C',
            color2: '#0DA57A',
            blocks: [
    {
        opcode: 'connect',
        blockType: BlockType.COMMAND,
        text: 'Connect to MeArm'
    },
    '---', // A separator line
    {
        opcode: 'AbsMode',
        blockType: BlockType.COMMAND,
        text: 'Switch to absolute mode (Send G90)'
    },
    {
        opcode: 'RelMode',
        blockType: BlockType.COMMAND,
        text: 'Switch to Relative mode (Send G91)'
    },
    {
                    opcode: 'moveLinearly',
                    blockType: BlockType.COMMAND,
                    text: 'Move Linearly to X:[X] Y:[Y] Z:[Z] at speed:[F]',
                    arguments: {
                        X: { type: ArgumentType.NUMBER, defaultValue: 100 },
                        Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
                        Z: { type: ArgumentType.NUMBER, defaultValue: 100 },
                        F: { type: ArgumentType.NUMBER, defaultValue: 900 }
                    }
                },
                {
                    opcode: 'Jumpto',
                    blockType: BlockType.COMMAND,
                    text: 'Jump to X:[X] Y:[Y] Z:[Z] at speed:[F]',
                    arguments: {
                        X: { type: ArgumentType.NUMBER, defaultValue: 100 },
                        Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
                        Z: { type: ArgumentType.NUMBER, defaultValue: 100 },
                        F: { type: ArgumentType.NUMBER, defaultValue: 900 }
                    }
                },
                {
                    opcode: 'setGripper',
                    blockType: BlockType.COMMAND,
                    text: 'Set Gripper to angle [ANGLE]',
                    arguments: {
                        ANGLE: { type: ArgumentType.ANGLE, defaultValue: 90 }
                    }
                },
                {
                    opcode: 'openGripper',
                    blockType: BlockType.COMMAND,
                    text: 'Open Gripper'
                },
                {
                    opcode: 'closeGripper',
                    blockType: BlockType.COMMAND,
                    text: 'Close Gripper'
                },
                {
                    opcode: 'wait',
                    blockType: BlockType.COMMAND,
                    text: 'Wait for [SECONDS] seconds',
                    arguments: {
                        SECONDS: { type: ArgumentType.NUMBER, defaultValue: 1 }
                    }
                },
                {
                    opcode: 'reportPosition',
                    blockType: BlockType.REPORTER, // This block returns a value
                    text: 'get current position'
                }

]
        };
    }

    // NEW connect function using the Web Serial API
      connect() {
        if ('serial' in navigator) {
            log.log('Requesting serial port...');
            navigator.serial.requestPort()
                .then(port => {
                    this.port = port;
                    // port.open() returns a promise, so we return it to chain the .then()
                    return port.open({ baudRate: 115200 }); // Make sure baud rate matches your Arduino
                })
                .then(() => {
                    log.log('Serial port opened.');
                    this.writer = this.port.writable.getWriter();
                    log.log('MeArm connected via Web Serial!');
                })
                .catch(err => {
                    // Log any errors that happen during port selection or opening
                    log.error('There was an error: ' + err.message);
                });
        } else {
            alert('Web Serial API not supported in this browser. Please use Chrome or Edge.');
        }
    }

    // NEW sendCommand function using the Web Serial API
    sendCommand(command) {
    if (!this.writer) {
        log.warn('MeArm not connected.');
        return;
    }
    const data = command + '\n';
    const buffer = new TextEncoder().encode(data);

    // The write() method returns a Promise. We can chain a .then() to it.
    // This whole block will be returned to whatever function called it.
    return this.writer.write(buffer)
        .then(() => {
            // This code will only run AFTER the data has been successfully sent.
            log.log(`Sent command: ${data}`);
        });
    }

    moveLinearly({ X, Y, Z, F }) {
        const gcode = `G1 X${X} Y${Y} Z${Z} F${F}`;
        this.sendCommand(gcode);
        return new Promise(resolve => setTimeout(resolve, 500));
    }
     Jumpto({ X, Y, Z, F }) {
        const gcode = `G0 X${X} Y${Y} Z${Z} F${F}`;
        this.sendCommand(gcode);
        return new Promise(resolve => setTimeout(resolve, 500));
    }
    setGripper({ ANGLE }) {
        const gcode = `M106 S${ANGLE}`;
        this.sendCommand(gcode);
        return new Promise(resolve => setTimeout(resolve, 300));
    }
    
    openGripper() {
        return this.setGripper({ ANGLE: 120 }); // Set your "open" angle
    }

    closeGripper() {
        return this.setGripper({ ANGLE: 30 }); // Set your "closed" angle
    }

    wait({ SECONDS }) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve();
            }, SECONDS * 1000);
        });
    }

        AbsMode() {
        // Send the G90 G-code command to the Arduino
        this.sendCommand('G90');
        // Return a promise to wait a moment
        return new Promise(resolve => setTimeout(resolve, 50));
    }
        RelMode() {
        // Send the G91 G-code command to the Arduino
        this.sendCommand('G91');
        // Return a promise to wait a moment
        return new Promise(resolve => setTimeout(resolve, 50));
    }
    reportPosition() {
        if (!this.writer || !this.port.readable) {
            return "ERROR: Not connected";
        }

        // We return the entire Promise chain, so Scratch knows to wait for it.
        return this.sendCommand('M114')
            .then(() => {
                // This part runs AFTER 'M114' has been sent.
                // We wait a moment for the Arduino to respond.
                return new Promise(resolve => setTimeout(resolve, 200));
            })
            .then(() => {
                // This part runs AFTER the 200ms delay.
                const reader = this.port.readable.getReader();
                
                // reader.read() returns a Promise, so we return it.
                return reader.read()
                    .then(({ value, done }) => {
                        // This part runs when data is received.
                        reader.releaseLock(); // IMPORTANT: Release the lock here.
                        if (value) {
                            const response = new TextDecoder().decode(value);
                            return response.split('ok')[0].trim();
                        }
                        return "No response";
                    })
                    .catch(err => {
                        // If there's an error, release the lock and report it.
                        reader.releaseLock();
                        log.error('Read error:', err);
                        return "ERROR: Read failed";
                    });
            });
    }
}

module.exports = MeArmController;