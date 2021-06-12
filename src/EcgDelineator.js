
import { pushDataLowPassFilter14Hz, pushDataLowPassFilter40Hz } from './LowPassFilter';
import { FirstDerivativeFilter, SecondDerivativeFilter } from './DifferentialFilter';

var samplingFreq = 500;
var windowLength = 2
var windowBufferSize = samplingFreq * windowLength;
var QRSFactor = 0.45;
var PFactor = 0.005;
var TFactor = 0.005;
var PSearchWindow = [0.1 * samplingFreq, 0.2 * samplingFreq];
var TSearchWindow = [0.2 * samplingFreq, 0.4 * samplingFreq];

function SumOfArray(arr){
    return arr.reduce((a,b)=>a+b);  
}

class EcgDelineator {

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
        this.prevPosPeakR = 0;
        this.posPeakR = 0;
        this.detectionPeakR = false;
        this.posPeakP = 0;
        this.detectionPeakP = false;
        this.posPeakT = 0;
        this.detectionPeakT = false;

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
            this.prevPosPeakR = this.posPeakR;
            this.posPeakR = this.ecgBufferIndex - 1;
            this.judgePeakP();
            this.judgePeakT();
        }
    }

    isPeakRDetected() {
        return this.detectionPeakR;
    }

    getPosPeakR() {
        return this.posPeakR;
    }

    isPeakPDetected() {
        return this.detectionPeakP;
    }

    getPosPeakP() {
        return this.posPeakP;
    }

    isPeakTDetected() {
        return this.detectionPeakT;
    }

    getPosPeakT() {
        return this.posPeakT;
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

    indexOfAbsMax(arr) {
        if (arr.length === 0)
            return -1;
    
        var max = Math.abs(arr[0]);
        var maxIndex = 0;
        for (var i = 1; i < arr.length; i++) {
            if (Math.abs(arr[i]) > max) {
                maxIndex = i;
                max = Math.abs(arr[i]);
            }
        }
    
        return maxIndex;
    }

    judgePeakP() {
        let windowBorder = [PSearchWindow[0], PSearchWindow[1]];
        
        let rrInterval = (windowBufferSize + this.posPeakR - this.prevPosPeakR) % windowBufferSize;
        if ( (rrInterval/2) < windowBorder[1])
            windowBorder[1] = Math.floor(rrInterval/2);
        
        let searchWindow;
        this.detectionPeakP = false;
        let indexBase = 0;

        let slice_index = [0, 0];

        slice_index[0] = (this.ecgBufferIndex - windowBorder[1] + this.secondDiffBuffer.length) % this.secondDiffBuffer.length;
        slice_index[1] = (this.ecgBufferIndex - windowBorder[0] + this.secondDiffBuffer.length) % this.secondDiffBuffer.length;
        indexBase = slice_index[0];
        // Get Search Window Data
        if (slice_index[0] > slice_index[1]) {
            var window1 = this.secondDiffBuffer.slice(slice_index[0], this.secondDiffBuffer.length);
            var window2 = this.secondDiffBuffer.slice(0, slice_index[1]);
            searchWindow = window1.concat(window2) ;
        }
        else {
            searchWindow = this.secondDiffBuffer.slice(slice_index[0], slice_index[1]);
        }

        // Find Max Value
        let maxValue = Math.max.apply(null, searchWindow.map(Math.abs));
        if (maxValue >= PFactor * this.avgQRS) {
            this.detectionPeakP = true;
            this.posPeakP = (indexBase + this.indexOfAbsMax(searchWindow)) % this.secondDiffBuffer.length;
        }
    }

    judgePeakT() {
        let windowBorder = [TSearchWindow[0], TSearchWindow[1]];
        
        let rrInterval = (windowBufferSize + this.posPeakR - this.prevPosPeakR) % windowBufferSize;
        if ( (rrInterval/2) < windowBorder[1])
            windowBorder[1] = Math.floor(rrInterval/2);
        
        let searchWindow;
        this.detectionPeakT = false;
        let indexBase = 0;

        let slice_index = [0, 0];

        slice_index[0] = (this.ecgBufferIndex - (rrInterval - windowBorder[0]) + this.secondDiffBuffer.length) % this.secondDiffBuffer.length;
        slice_index[1] = (this.ecgBufferIndex - (rrInterval - windowBorder[1]) + this.secondDiffBuffer.length) % this.secondDiffBuffer.length;
        indexBase = slice_index[0];

        // Get Search Window Data
        if (slice_index[0] > slice_index[1]) {
            var window1 = this.secondDiffBuffer.slice(slice_index[0], this.secondDiffBuffer.length);
            var window2 = this.secondDiffBuffer.slice(0, slice_index[1]);
            searchWindow = window1.concat(window2) ;
        }
        else {
            searchWindow = this.secondDiffBuffer.slice(slice_index[0], slice_index[1]);
        }

        // Find Max Value
        let maxValue = Math.max.apply(null, searchWindow.map(Math.abs));
        if (maxValue >= TFactor * this.avgQRS) {
            this.detectionPeakT = true;
            this.posPeakT = (indexBase + this.indexOfAbsMax(searchWindow)) % this.secondDiffBuffer.length;
        }
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