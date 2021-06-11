var connected = false;
var bluetoothDevice = null;
var bleRxBuffer = [];

function bt_connect(){
    navigator.bluetooth.requestDevice({
        optionalServices: [0xa000],
        //'713d0002-503e-4c75-ba94-3148f18d941e'
        acceptAllDevices: true//
    })
    .then(device => {
        console.log(device);
        bluetoothDevice = device;
        bluetoothDevice.addEventListener('gattserverdisconnected', bt_disconnected);
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

function bt_get_array() {
    if (connected === true) {
        let returnBuffer = bleRxBuffer.slice();
        bleRxBuffer = [];
        console.log(returnBuffer);
        return returnBuffer;
    }
    return [];
}

function bt_disconnected(event) {
    console.log("Disconnected by remote device!");
    bluetoothDevice = null;
    connected = false;
}

export { bt_connect, bt_disconnected, bt_get_array };
