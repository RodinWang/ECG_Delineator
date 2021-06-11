/**
 * This is the BLE function module.
 */

var connected = false;
var bluetoothDevice = null;
var bleRxBuffer = [];

/**
 * Connect with bluetooth device
 */
function btConnect(){
    navigator.bluetooth.requestDevice({
        optionalServices: [0xa000],
        //'713d0002-503e-4c75-ba94-3148f18d941e'
        acceptAllDevices: true//
    })
    .then(device => {
        console.log(device);
        bluetoothDevice = device;
        bluetoothDevice.addEventListener('gattserverdisconnected', btDisconnected);
        return device.gatt.connect();
    })
    .then(server => {
        return server.getPrimaryService(0xa000);
    })
    .then(service => {
        console.log(service);
        return service.getCharacteristic(0xa001);
    })
    .then(chara => {
        console.log(chara);
        chara.startNotifications().then(c => {
            c.addEventListener('characteristicvaluechanged', function(e){
                bleRxBuffer.push(Array.from(new Uint8Array(this.value.buffer)));
                //console.log(bleRxBuffer);
                connected = true;
            });
        })
    })
    .catch(error => {console.log(error)});
};

/**
 * Get the Data Array received from BT device
 * @returns {number[]}Data array received from BT device.
 */
function btGetDataArray() {
    if (connected === true) {
        let returnBuffer = bleRxBuffer.slice();
        bleRxBuffer = [];
        console.log(returnBuffer);
        return returnBuffer;
    }
    return [];
}

/**
 * Disconnect with BT device.
 * @param {*} event event of BT disconnection.
 */
function btDisconnected(event) {
    console.log("Disconnected by remote device!");
    bluetoothDevice = null;
    connected = false;
}

export { btConnect, btDisconnected, btGetDataArray };
