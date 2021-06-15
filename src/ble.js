/**
 * This is the BLE function module.
 */
var bluetoothDevice = null;

/**
 * Connect with bluetooth device
 */
function btConnect(func){
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
    bluetoothDevice = null;
}

export { btConnect, btDisconnected };
