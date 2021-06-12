
import { pushDataLowPassFilter14Hz, pushDataLowPassFilter40Hz } from './LowPassFilter';
import { FirstDerivativeFilter, SecondDerivativeFilter } from './DifferentialFilter';

var samplingFreq = 500;
var windowLength = 2
var windowBufferSize = samplingFreq * windowLength;
var QRSFactor = 0.5;

function SumOfArray(arr){
    return arr.reduce((a,b)=>a+b);  
}

class EcgDelineator {
    counter = 0;

    constructor() {

        // avgerage QRS
        this.avgQRSBuffer = [1, 1, 1, 1, 1];
        this.avgQRS = SumOfArray(this.avgQRSBuffer) / this.avgQRSBuffer.length;

        // Delay 1 Buffer frame
        this.startupDelay = 0;

        // filter
        this.firstDiffFilter = new FirstDerivativeFilter();
        this.secondDiffFilter = new SecondDerivativeFilter();

        // buffer
        this.ecgBufferIndex = 0;
        this.ecg14HzBuffer = new Array(windowBufferSize).fill(0);
        this.ecg40HzBuffer = new Array(windowBufferSize).fill(0);
        this.firstDiffBuffer = new Array(windowBufferSize).fill(0);
        this.secondDiffBuffer = new Array(windowBufferSize).fill(0);

        //  result
        this.posPeakR = 0;
        this.detectionPeakR = false;
    }

    pushEcgData(inputEcg) {
        let ecg14Hz = pushDataLowPassFilter14Hz(inputEcg);
        let ecg40Hz = pushDataLowPassFilter40Hz(inputEcg);;
        this.ecg14HzBuffer[this.ecgBufferIndex] = ecg14Hz;
        this.ecg40HzBuffer[this.ecgBufferIndex] = ecg40Hz;
        this.firstDiffBuffer[this.ecgBufferIndex] = this.firstDiffFilter.pushData(ecg14Hz);
        this.secondDiffBuffer[this.ecgBufferIndex] = this.secondDiffFilter.pushData(ecg14Hz);

        this.ecgBufferIndex++;
        if (this.ecgBufferIndex >=  windowBufferSize) {
            this.updateAvgQRS(Math.max.apply(null, this.secondDiffBuffer.map(Math.abs)));
            this.ecgBufferIndex = 0;
        }

        this.detectionPeakR = this.judgePeakQRS();
        if (this.detectionPeakR === true) {
            this.counter++;
            this.posPeakR = this.ecgBufferIndex - 1;
        }
    }

    isPeakRDetected() {
        return this.detectionPeakR;
    }

    getPosPeakR() {
        return this.posPeakR;
    }

    updateAvgQRS(inputValue) {
        this.avgQRSBuffer.shift();
        this.avgQRSBuffer.push(inputValue);
        this.avgQRS = SumOfArray(this.avgQRSBuffer) / this.avgQRSBuffer.length;
    }

    getSignOfFirstDiff(index) {
        return Math.sign(this.firstDiffBuffer[index]);
    }

    judgePeakQRS() {
        //console.log("Enter QRS Judge");
        // 1st Diff sign changed?
        if (this.ecgBufferIndex === 0) {
            if (this.getSignOfFirstDiff(windowBufferSize - 2) === this.getSignOfFirstDiff(windowBufferSize - 1))
                return false;
        }
        else if (this.ecgBufferIndex === 1) {
            if (this.getSignOfFirstDiff(windowBufferSize - 1) === this.getSignOfFirstDiff(0))
                return false;
        }
        else {
            if (this.getSignOfFirstDiff(this.ecgBufferIndex - 2) === this.getSignOfFirstDiff(this.ecgBufferIndex - 1))
                return false;
        }

        // 2nd Diff 
        let detect = Math.abs(this.secondDiffBuffer[this.ecgBufferIndex - 1]);
        if ((detect < QRSFactor * this.avgQRS) && (Math.sign(this.secondDiffBuffer[this.ecgBufferIndex - 1] !== -1)))
            return false;
        
        return true;
    }


    /**
     * return Filtered ECG Value;
     * @returns {number} ECG Value
     */
    getEcg40HzData() {
        if (this.ecgBufferIndex === 0)
            return this.ecg40HzBuffer[this.ecg40HzBuffer.length - 1];
        else
            return this.ecg40HzBuffer[this.ecgBufferIndex - 1];
    }

}

export { EcgDelineator };