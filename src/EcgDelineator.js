
import { pushDataLowPassFilter14Hz, pushDataLowPassFilter40Hz } from './LowPassFilter';
import { FirstDerivativeFilter, SecondDerivativeFilter } from './DifferentialFilter';
import { OpeningFilter, ClosingFilter } from './MorphologicalFilter';


const samplingFreq = 500;
const windowLength = 2
const windowBufferSize = samplingFreq * windowLength;
const QRSFactor = 0.45;
const PFactor = 0.01;
const TFactor = 0.01;
const PSearchWindow = [0.1 * samplingFreq, 0.2 * samplingFreq];
const TSearchWindow = [0.2 * samplingFreq, 0.4 * samplingFreq];
const ECGBaseOpeningFilterSize = 0.2 * samplingFreq;
const ECGBaseClosingFilterSize = ECGBaseOpeningFilterSize *  1.5;
const PBaseFilterSize = 0.12 * samplingFreq;
const TBaseFilterSize = 0.2 * samplingFreq;
const ECGBaseDelay = (ECGBaseOpeningFilterSize + ECGBaseClosingFilterSize);
const PBaseDelay = (PBaseFilterSize);
const TBaseDelay = (TBaseFilterSize);
const SSearchWindow = 0.1 * samplingFreq;

function SumOfArray(arr){
    return arr.reduce((a,b)=>a+b);  
}

function indexOfAbsMax(arr) {
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

class EcgDelineator {

    constructor() {

        // avgerage QRS
        this.avgQRSBuffer = [1, 1, 1, 1, 1];
        this.avgQRS = SumOfArray(this.avgQRSBuffer) / this.avgQRSBuffer.length;

        // Delay 1 Buffer frame
        this.startupDelay = 0;

        this.onEndDetection = 0;

        // filter
        this.firstDiffFilter = new FirstDerivativeFilter();
        this.secondDiffFilter = new SecondDerivativeFilter();
        this.ecgBaseOpeningFilter = new OpeningFilter(ECGBaseOpeningFilterSize);
        this.ecgBaseClosingFilter = new ClosingFilter(ECGBaseClosingFilterSize);
        this.pBaseOpeningFilter = new OpeningFilter(PBaseFilterSize);
        this.tBaseOpeningFilter = new OpeningFilter(TBaseFilterSize);

        // buffer
        this.ecgBufferIndex = 0;
        this.ecg14HzBuffer = new Array(windowBufferSize).fill(0);
        this.ecg40HzBuffer = new Array(windowBufferSize).fill(0);
        this.firstDiffBuffer = new Array(windowBufferSize).fill(0);
        this.secondDiffBuffer = new Array(windowBufferSize).fill(0);
        this.ecgBaseBuffer = new Array(windowBufferSize).fill(0);
        this.pBaseBuffer = new Array(windowBufferSize).fill(0);
        this.tBaseBuffer = new Array(windowBufferSize).fill(0);

        //  result
        this.prevPosPeakR = 0;
        this.posPeakR = 0;
        this.detectionPeakR = false;
        this.posPeakP = 0;
        this.detectionPeakP = false;
        this.posPeakT = 0;
        this.detectionPeakT = false;
        this.posOnEndR = [0, 0];
        this.detectionOnEndR = false;
        this.posOnEndP = [0, 0];
        this.detectionOnEndP = false;
        this.posOnEndT = [0, 0];
        this.detectionOnEndT = false;
    }

    pushEcgData(inputEcg) {
        let ecg14Hz = pushDataLowPassFilter14Hz(inputEcg);
        let ecg40Hz = pushDataLowPassFilter40Hz(inputEcg);;
        this.ecg14HzBuffer[this.ecgBufferIndex] = ecg14Hz;
        this.ecg40HzBuffer[this.ecgBufferIndex] = ecg40Hz;
        this.firstDiffBuffer[this.ecgBufferIndex] = this.firstDiffFilter.pushData(ecg14Hz);
        this.secondDiffBuffer[this.ecgBufferIndex] = this.secondDiffFilter.pushData(ecg14Hz);
        this.ecgBaseBuffer[this.ecgBufferIndex] = this.ecgBaseClosingFilter.pushData(this.ecgBaseOpeningFilter.pushData(ecg40Hz));
        this.pBaseBuffer[this.ecgBufferIndex] = this.pBaseOpeningFilter.pushData(ecg40Hz);
        this.tBaseBuffer[this.ecgBufferIndex] = this.tBaseOpeningFilter.pushData(ecg40Hz);

        this.ecgBufferIndex++;
        if (this.ecgBufferIndex >=  windowBufferSize) {
            this.updateAvgQRS(Math.max.apply(null, this.secondDiffBuffer.map(Math.abs)));
            this.ecgBufferIndex = 0;
        }

        this.detectionPeakR = this.judgePeakQRS();
        if (this.detectionPeakR === true) {
            this.prevPosPeakR = this.posPeakR;
            this.posPeakR = this.ecgBufferIndex - 1;
            this.onEndDetection = (this.posPeakR + ECGBaseDelay + SSearchWindow) % this.ecg40HzBuffer.length;
            this.judgePeakP();
            this.judgePeakT();
        }

        // QRS On-End
        if (this.onEndDetection === this.ecgBufferIndex) {
            if (this.detectionPeakP) {
                this.detectOnEndP();
            }

            if (this.detectionPeakT) {
                this.detectOnEndT();
            }
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

    isOnEndPDetected() {
        return this.detectOnEndP;
    }

    getPosOnEndP() {
        return this.posOnEndP.slice();
    }

    isPeakTDetected() {
        return this.detectionPeakT;
    }

    getPosPeakT() {
        return this.posPeakT;
    }

    isOnEndTDetected() {
        return this.detectOnEndT;
    }

    getPosOnEndT() {
        return this.posOnEndT.slice();
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
        
        this.detectionOnEndR = false;
        this.detectionOnEndT = false;
        this.detectionOnEndP = false;
        return true;
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
            this.posPeakP = (indexBase + indexOfAbsMax(searchWindow)) % this.secondDiffBuffer.length;
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
            this.posPeakT = (indexBase + indexOfAbsMax(searchWindow)) % this.secondDiffBuffer.length;
        }
    }

    detectOnEndR() {

    }

    detectOnEndP() {
        var pIndex = this.posPeakP - 5;
        var peakDiff = this.ecg40HzBuffer[pIndex] - this.pBaseBuffer[(pIndex + PBaseDelay) % this.pBaseBuffer.length];
        var diffValue1 = this.ecg40HzBuffer[pIndex] - this.pBaseBuffer[(pIndex + PBaseDelay)  % this.pBaseBuffer.length];
        var diffValue2 = this.ecg40HzBuffer[(pIndex - 1 + this.ecg40HzBuffer.length) % this.ecg40HzBuffer.length]
                        - this.pBaseBuffer[(pIndex - 1 + PBaseDelay + this.pBaseBuffer.length) % this.pBaseBuffer.length];
        while ((diffValue1 >= diffValue2) && (diffValue1 >= (0.0025 * peakDiff))) {
            pIndex = (pIndex-1+this.ecg40HzBuffer.length) % this.ecg40HzBuffer.length;
            diffValue1 = this.ecg40HzBuffer[pIndex] - this.pBaseBuffer[(pIndex + PBaseDelay) % this.pBaseBuffer.length];
            diffValue2 = this.ecg40HzBuffer[(pIndex - 1 + this.ecg40HzBuffer.length) % this.ecg40HzBuffer.length]
                        - this.pBaseBuffer[(pIndex-1 + PBaseDelay + this.pBaseBuffer.length) % this.pBaseBuffer.length];
        }
        this.posOnEndP[0] = pIndex;

        pIndex = this.posPeakP + 5;
        diffValue1 = this.ecg40HzBuffer[pIndex] - this.pBaseBuffer[(pIndex + PBaseDelay)  % this.pBaseBuffer.length];
        diffValue2 = this.ecg40HzBuffer[(pIndex + 1 + this.ecg40HzBuffer.length) % this.ecg40HzBuffer.length]
                        - this.pBaseBuffer[(pIndex+1 + PBaseDelay + this.pBaseBuffer.length)% this.pBaseBuffer.length];
        while ((diffValue1 >= diffValue2) && (diffValue1 >= (0.0025 * peakDiff))) {
            pIndex = (pIndex + 1 + this.ecg40HzBuffer.length) % this.ecg40HzBuffer.length;
            diffValue1 = this.ecg40HzBuffer[pIndex] - this.pBaseBuffer[(pIndex + PBaseDelay) % this.pBaseBuffer.length];
            diffValue2 = this.ecg40HzBuffer[(pIndex + 1 + this.ecg40HzBuffer.length) % this.ecg40HzBuffer.length]
                        - this.pBaseBuffer[(pIndex + 1 + PBaseDelay + this.pBaseBuffer.length) % this.pBaseBuffer.length];
        }
        this.posOnEndP[1] = pIndex;

        this.detectionOnEndP = true;
    }

    detectOnEndT() {
        var pIndex = this.posPeakT - 5;
        var peakDiff = this.ecg40HzBuffer[pIndex] - this.tBaseBuffer[(pIndex + TBaseDelay) % this.tBaseBuffer.length];
        var diffValue1 = this.ecg40HzBuffer[pIndex] - this.tBaseBuffer[(pIndex + TBaseDelay)  % this.tBaseBuffer.length];
        var diffValue2 = this.ecg40HzBuffer[(pIndex - 1 + this.ecg40HzBuffer.length) % this.ecg40HzBuffer.length]
                        - this.tBaseBuffer[(pIndex - 1 + TBaseDelay + this.tBaseBuffer.length) % this.tBaseBuffer.length];
        while ((diffValue1 >= diffValue2) && (diffValue1 > (0.0025 * peakDiff))) {
            pIndex = (pIndex-1+this.ecg40HzBuffer.length) % this.ecg40HzBuffer.length;
            diffValue1 = this.ecg40HzBuffer[pIndex] - this.tBaseBuffer[(pIndex + TBaseDelay) % this.tBaseBuffer.length];
            diffValue2 = this.ecg40HzBuffer[(pIndex - 1 + this.ecg40HzBuffer.length) % this.ecg40HzBuffer.length]
                        - this.tBaseBuffer[(pIndex-1 + TBaseDelay + this.tBaseBuffer.length) % this.tBaseBuffer.length];
        }
        this.posOnEndT[0] = pIndex;

        pIndex = this.posPeakT + 5;
        diffValue1 = this.ecg40HzBuffer[pIndex] - this.tBaseBuffer[(pIndex + TBaseDelay)  % this.tBaseBuffer.length];
        diffValue2 = this.ecg40HzBuffer[(pIndex + 1 + this.ecg40HzBuffer.length) % this.ecg40HzBuffer.length]
                        - this.tBaseBuffer[(pIndex+1 + TBaseDelay + this.tBaseBuffer.length)% this.tBaseBuffer.length];
        while ((diffValue1 >= diffValue2) && (diffValue1 > (0.0025 * peakDiff))) {
            pIndex = (pIndex + 1 + this.ecg40HzBuffer.length) % this.ecg40HzBuffer.length;
            diffValue1 = this.ecg40HzBuffer[pIndex] - this.tBaseBuffer[(pIndex + TBaseDelay) % this.tBaseBuffer.length];
            diffValue2 = this.ecg40HzBuffer[(pIndex + 1 + this.ecg40HzBuffer.length) % this.ecg40HzBuffer.length]
                        - this.tBaseBuffer[(pIndex + 1 + TBaseDelay + this.tBaseBuffer.length) % this.tBaseBuffer.length];
        }
        this.posOnEndT[1] = pIndex;

        this.detectionOnEndT = true;
    }



    /**
     * return Filtered ECG Value;
     * @returns {number} ECG Value
     */
    getEcg40HzData() {
        var index = (this.ecgBufferIndex - 1 + this.ecg40HzBuffer.length) % this.ecg40HzBuffer.length;
        return this.ecg40HzBuffer[index];
    }

    getBaseline() {
        var index = (this.ecgBufferIndex - 1 + this.ecgBaseBuffer.length) % this.ecgBaseBuffer.length;
        return this.ecgBaseBuffer[index];

    }

}

export { EcgDelineator };