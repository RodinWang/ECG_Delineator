/**
 * This is the BLE function module.
 */
var bluetoothDevice = null;

/**
 * Connect with bluetooth device
 */
function btConnect(func){
    navigator.bluetooth.requestDevice({
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
        console.log(server);
        return server.getPrimaryService(0xFF05);
    })
    .then(service => {
        console.log(service);
        return service.getCharacteristic(0xAA05);
    })
    .then(chara => {
        console.log(chara);
        chara.startNotifications().then(c => {
            c.addEventListener('characteristicvaluechanged', function(e){
                let ecgFromBLE = Array.from(new Uint8Array(this.value.buffer));
                ecgFromBLE.forEach(func);
            });
        })
    })
    .catch(error => {console.log(error)});
};

/**
 * Disconnect with BT device.
 * @param {*} event event of BT disconnection.
 */
function btDisconnected(event) {
    console.log("Disconnected by remote device!");
    if (!bluetoothDevice) {
        return;
    }
    if (bluetoothDevice.gatt.connected) {
        bluetoothDevice.gatt.disconnect();
    }
    bluetoothDevice = null;
}

export { btConnect, btDisconnected };
