import { pushDataLowPassFilter14Hz, pushDataLowPassFilter40Hz } from './LowPassFilter';
import { FirstDerivativeFilter, SecondDerivativeFilter } from './DifferentialFilter';
import { OpeningFilter, ClosingFilter } from './MorphologicalFilter';
import { global } from './global';

const samplingFreq = global.samplingFreq;
const windowLength = 2
const windowBufferSize = samplingFreq * windowLength;
const QRSFactor = 0.45;
const PFactor = 0.01;
const TFactor = 0.01;
const QSearchWindowSize = 0.1 * samplingFreq;
const SSearchWindowSize = 0.1 * samplingFreq;
const PSearchWindowSize = [0.1 * samplingFreq, 0.2 * samplingFreq];
const TSearchWindowSize = [0.2 * samplingFreq, 0.4 * samplingFreq];
const ECGBaseOpeningFilterSize = 0.2 * samplingFreq;
const ECGBaseClosingFilterSize = ECGBaseOpeningFilterSize *  1.5;
const PBaseFilterSize = 0.12 * samplingFreq;
const TBaseFilterSize = 0.2 * samplingFreq;
const ECGBaseDelay = (ECGBaseOpeningFilterSize + ECGBaseClosingFilterSize);
const PBaseDelay = (PBaseFilterSize);
const TBaseDelay = (TBaseFilterSize);

function SumOfArray(arr){
    return arr.reduce((a,b)=>a+b);  
}

function diffNumber(arr1, arr2){
    return arr1.map(function (num, idx) { return num- arr2[idx] }).slice();
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

        this.onEndDetection = [];

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
        this.posPeakQ = 0;
        this.detectionPeakQ = false;
        this.posPeakS = 0;
        this.detectionPeakS = false;
        this.posPeakP = 0;
        this.detectionPeakP = false;
        this.posPeakT = 0;
        this.detectionPeakT = false;
        this.posOnEndQRS = [0, 0];
        this.detectionOnEndQRS = false;
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

        this.detectionPeakR = this.detectPeakR();
        if (this.detectionPeakR === true) {
            this.prevPosPeakR = this.posPeakR;
            this.posPeakR = this.ecgBufferIndex;
            this.onEndDetection.push((this.posPeakR + ECGBaseDelay + SSearchWindowSize) % this.ecg40HzBuffer.length);
            this.detectPeakP();
            this.detectPeakT();
        }

        // On-End
        if (this.onEndDetection[0] === this.ecgBufferIndex) {
            this.onEndDetection.shift();
            if (this.detectionPeakP) {
                this.detectOnEndP();
            }

            if (this.detectionPeakT) {
                this.detectOnEndT();
            }

            this.detectPeakQ();
            this.detectPeakS();
            this.detectOnEndQRS();
        }
    }

    isPeakRDetected() {
        return this.detectionPeakR;
    }

    getPosPeakR() {
        return this.posPeakR;
    }

    isOnEndQRSDetected() {
        return this.detectionOnEndQRS;
    }

    getPosOnEndQRS() {
        return this.posOnEndQRS.slice();
    }

    isPeakQDetected() {
        return this.detectionPeakQ;
    }

    getPosPeakQ() {
        return this.posPeakQ;
    }

    isPeakSDetected() {
        return this.detectionPeakS;
    }

    getPosPeakS() {
        return this.posPeakS;
    }

    isPeakPDetected() {
        return this.detectionPeakP;
    }

    getPosPeakP() {
        return this.posPeakP;
    }

    isOnEndPDetected() {
        return this.detectionOnEndP;
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
        return this.detectionOnEndT;
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

    detectPeakR() {
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
        
        this.detectionOnEndQRS = false;
        this.detectionPeakQ = false;
        this.detectionPeakS = false;
        this.detectionOnEndT = false;
        this.detectionOnEndP = false;
        return true;
    }

    detectPeakQ() {
        
        let qSearchWindow;
        let ecgSearchWindow;
        this.detectionPeakQ = false;
        
        // find window border
        let windowBorder = [this.posPeakR - QSearchWindowSize, this.posPeakR];

        if (windowBorder[0] < 0)
            windowBorder[0] = windowBorder[0] + this.ecg40HzBuffer.length;
        
        let indexBase = windowBorder[0];
        
        let ecgBaseWindowBorder = [ ( windowBorder[0] + ECGBaseDelay + this.ecgBaseBuffer.length) % this.ecgBaseBuffer.length,
                                    ( windowBorder[1] + ECGBaseDelay + this.ecgBaseBuffer.length) % this.ecgBaseBuffer.length];

        // Get Search Window Data
        if (windowBorder[0] > windowBorder[1]) {
            var qWindow1 = this.ecg40HzBuffer.slice(windowBorder[0], this.ecg40HzBuffer.length);
            var qWindow2 = this.ecg40HzBuffer.slice(0, windowBorder[1]);
            qSearchWindow = qWindow1.concat(qWindow2) ;
        }
        else {
            qSearchWindow = this.ecg40HzBuffer.slice(windowBorder[0], windowBorder[1]);
        }

        if (ecgBaseWindowBorder[0] > ecgBaseWindowBorder[1]) {
            var ecgBaseWindow1 = this.ecgBaseBuffer.slice(ecgBaseWindowBorder[0], this.ecgBaseBuffer.length);
            var ecgBaseWindow2 = this.ecgBaseBuffer.slice(0, ecgBaseWindowBorder[1]);
            ecgSearchWindow = ecgBaseWindow1.concat(ecgBaseWindow2) ;
        }
        else {
            ecgSearchWindow = this.ecgBaseBuffer.slice(ecgBaseWindowBorder[0], ecgBaseWindowBorder[1]);
        }
        
        // find Peak Q
        let diffWindow = diffNumber(qSearchWindow, ecgSearchWindow);

        let minValue = Math.min(...diffWindow);
        if ( (Math.abs(minValue) > (Math.abs(diffWindow[diffWindow.length-1]) * 0.05)) &&
             (Math.sign(minValue) === -1)){
            this.detectionPeakQ = true;
            this.posPeakQ = (indexBase + qSearchWindow.indexOf(Math.min(...qSearchWindow)) + this.ecg40HzBuffer.length) % this.ecg40HzBuffer.length
        }
    }

    detectPeakS() {
        let sSearchWindow;
        let ecgSearchWindow;
        this.detectionPeakS = false;
        
        // find window border
        let windowBorder = [this.posPeakR, this.posPeakR + SSearchWindowSize];

        if (windowBorder[1] > this.ecg40HzBuffer.length)
            windowBorder[1] = windowBorder[1] - this.ecg40HzBuffer.length;
        
        let indexBase = windowBorder[0];
        
        let ecgBaseWindowBorder = [ ( windowBorder[0] + ECGBaseDelay + this.ecgBaseBuffer.length) % this.ecgBaseBuffer.length,
                                    ( windowBorder[1] + ECGBaseDelay + this.ecgBaseBuffer.length) % this.ecgBaseBuffer.length];

        // Get Search Window Data
        if (windowBorder[0] > windowBorder[1]) {
            var sWindow1 = this.ecg40HzBuffer.slice(windowBorder[0], this.ecg40HzBuffer.length);
            var sWindow2 = this.ecg40HzBuffer.slice(0, windowBorder[1]);
            sSearchWindow = sWindow1.concat(sWindow2) ;
        }
        else {
            sSearchWindow = this.ecg40HzBuffer.slice(windowBorder[0], windowBorder[1]);
        }

        if (ecgBaseWindowBorder[0] > ecgBaseWindowBorder[1]) {
            var ecgBaseWindow1 = this.ecgBaseBuffer.slice(ecgBaseWindowBorder[0], this.ecgBaseBuffer.length);
            var ecgBaseWindow2 = this.ecgBaseBuffer.slice(0, ecgBaseWindowBorder[1]);
            ecgSearchWindow = ecgBaseWindow1.concat(ecgBaseWindow2) ;
        }
        else {
            ecgSearchWindow = this.ecgBaseBuffer.slice(ecgBaseWindowBorder[0], ecgBaseWindowBorder[1]);
        }
        
        // find Peak S
        let diffWindow = diffNumber(sSearchWindow, ecgSearchWindow);
        let minValue = Math.min(...diffWindow);
        if ( (Math.abs(minValue) > (Math.abs(diffWindow[0]) * 0.05)) &&
             (Math.sign(minValue) === -1)){
            this.detectionPeakS = true;
            this.posPeakS = (indexBase + sSearchWindow.indexOf(Math.min(...sSearchWindow)) + this.ecg40HzBuffer.length) % this.ecg40HzBuffer.length
        }
    }

    detectPeakP() {
        let windowBorder = [PSearchWindowSize[0], PSearchWindowSize[1]];
        
        let rrInterval = (windowBufferSize + this.posPeakR - this.prevPosPeakR) % windowBufferSize;
        if ( (rrInterval/2) < windowBorder[1])
            windowBorder[1] = Math.floor(rrInterval/2);
        
        let searchWindow;
        this.detectionPeakP = false;
        let indexBase = 0;

        let slice_index = [0, 0];

        slice_index[0] = (this.posPeakR - windowBorder[1] + this.secondDiffBuffer.length) % this.secondDiffBuffer.length;
        slice_index[1] = (this.posPeakR - windowBorder[0] + this.secondDiffBuffer.length) % this.secondDiffBuffer.length;
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

    detectPeakT() {
        let windowBorder = [TSearchWindowSize[0], TSearchWindowSize[1]];
        
        let rrInterval = (windowBufferSize + this.posPeakR - this.prevPosPeakR) % windowBufferSize;
        if ( (rrInterval/2) < windowBorder[1])
            windowBorder[1] = Math.floor(rrInterval/2);
        
        let searchWindow;
        this.detectionPeakT = false;
        let indexBase = 0;

        let slice_index = [0, 0];

        slice_index[0] = (this.posPeakR - (rrInterval - windowBorder[0]) + this.secondDiffBuffer.length) % this.secondDiffBuffer.length;
        slice_index[1] = (this.posPeakR - (rrInterval - windowBorder[1]) + this.secondDiffBuffer.length) % this.secondDiffBuffer.length;
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

    detectOnEndQRS() {
        var rWindow1, rWindow2;
        var ecgBaseWindow1, ecgBaseWindow2;
        var i;

        if (this.detectionPeakQ) {
            let qSearchWindow;

            // find window border
            let windowBorder = [this.posPeakQ - Math.floor(0.02 * samplingFreq), this.posPeakQ];
    
            if (windowBorder[0] < 0)
                windowBorder[0] = windowBorder[0] + this.ecg40HzBuffer.length;
            
            let indexBase = windowBorder[0];
    
            // Get Search Window Data
            if (windowBorder[0] > windowBorder[1]) {
                rWindow1 = this.ecg40HzBuffer.slice(windowBorder[0], this.ecg40HzBuffer.length);
                rWindow2 = this.ecg40HzBuffer.slice(0, windowBorder[1]);
                qSearchWindow = rWindow1.concat(rWindow2) ;
            }
            else {
                qSearchWindow = this.ecg40HzBuffer.slice(windowBorder[0], windowBorder[1]);
            }
            this.posOnEndQRS[0] = indexBase + qSearchWindow.indexOf(Math.max(qSearchWindow));

        }
        else {
            let rSearchWindow;
            let ecgSearchWindow;
            
            // find window border
            let windowBorder = [this.posPeakR - QSearchWindowSize, this.posPeakR];
    
            if (windowBorder[0] < 0)
                windowBorder[0] = windowBorder[0] + this.ecg40HzBuffer.length;
            
            let indexBase = windowBorder[0];
            
            let ecgBaseWindowBorder = [ ( windowBorder[0] + ECGBaseDelay + this.ecgBaseBuffer.length) % this.ecgBaseBuffer.length,
                                        ( windowBorder[1] + ECGBaseDelay + this.ecgBaseBuffer.length) % this.ecgBaseBuffer.length];
    
            // Get Search Window Data
            if (windowBorder[0] > windowBorder[1]) {
                rWindow1 = this.ecg40HzBuffer.slice(windowBorder[0], this.ecg40HzBuffer.length);
                rWindow2 = this.ecg40HzBuffer.slice(0, windowBorder[1]);
                rSearchWindow = rWindow1.concat(rWindow2) ;
            }
            else {
                rSearchWindow = this.ecg40HzBuffer.slice(windowBorder[0], windowBorder[1]);
            }
    
            if (ecgBaseWindowBorder[0] > ecgBaseWindowBorder[1]) {
                ecgBaseWindow1 = this.ecgBaseBuffer.slice(ecgBaseWindowBorder[0], this.ecgBaseBuffer.length);
                ecgBaseWindow2 = this.ecgBaseBuffer.slice(0, ecgBaseWindowBorder[1]);
                ecgSearchWindow = ecgBaseWindow1.concat(ecgBaseWindow2) ;
            }
            else {
                ecgSearchWindow = this.ecgBaseBuffer.slice(ecgBaseWindowBorder[0], ecgBaseWindowBorder[1]);
            }
            // find  Peak R on-set
            let diffWindow = diffNumber(rSearchWindow, ecgSearchWindow);
            for (i = diffWindow.length - 1; i >= 0; i--) {
                if (diffWindow[i] <= (0.05 * diffWindow[diffWindow.length-1])) {
                    this.posOnEndQRS[0] = indexBase + i + 1;
                    break;
                }
            }
        }


        if (this.detectionPeakS) {
            let sSearchWindow;
            
            // find window border
            let windowBorder = [this.posPeakS, this.posPeakS + Math.floor(0.02 * samplingFreq)];
    
            if (windowBorder[1] > this.ecg40HzBuffer.length)
                windowBorder[1] = windowBorder[1] - this.ecg40HzBuffer.length;
            
            let indexBase = windowBorder[0];
            
    
            // Get Search Window Data
            if (windowBorder[0] > windowBorder[1]) {
                rWindow1 = this.ecg40HzBuffer.slice(windowBorder[0], this.ecg40HzBuffer.length);
                rWindow2 = this.ecg40HzBuffer.slice(0, windowBorder[1]);
                sSearchWindow = rWindow1.concat(rWindow2) ;
            }
            else {
                sSearchWindow = this.ecg40HzBuffer.slice(windowBorder[0], windowBorder[1]);
            }

            this.posOnEndQRS[1] = indexBase + sSearchWindow.indexOf(Math.max(sSearchWindow));

        }
        else {
            let rSearchWindow;
            let ecgSearchWindow;
            
            // find window border
            let windowBorder = [this.posPeakR, this.posPeakR + SSearchWindowSize];
    
            if (windowBorder[1] > this.ecg40HzBuffer.length)
                windowBorder[1] = windowBorder[1] - this.ecg40HzBuffer.length;
            
            let indexBase = windowBorder[0];
            
            let ecgBaseWindowBorder = [ ( windowBorder[0] + ECGBaseDelay + this.ecgBaseBuffer.length) % this.ecgBaseBuffer.length,
                                        ( windowBorder[1] + ECGBaseDelay + this.ecgBaseBuffer.length) % this.ecgBaseBuffer.length];
    
            // Get Search Window Data
            if (windowBorder[0] > windowBorder[1]) {
                rWindow1 = this.ecg40HzBuffer.slice(windowBorder[0], this.ecg40HzBuffer.length);
                rWindow2 = this.ecg40HzBuffer.slice(0, windowBorder[1]);
                rSearchWindow = rWindow1.concat(rWindow2) ;
            }
            else {
                rSearchWindow = this.ecg40HzBuffer.slice(windowBorder[0], windowBorder[1]);
            }
    
            if (ecgBaseWindowBorder[0] > ecgBaseWindowBorder[1]) {
                ecgBaseWindow1 = this.ecgBaseBuffer.slice(ecgBaseWindowBorder[0], this.ecgBaseBuffer.length);
                ecgBaseWindow2 = this.ecgBaseBuffer.slice(0, ecgBaseWindowBorder[1]);
                ecgSearchWindow = ecgBaseWindow1.concat(ecgBaseWindow2) ;
            }
            else {
                ecgSearchWindow = this.ecgBaseBuffer.slice(ecgBaseWindowBorder[0], ecgBaseWindowBorder[1]);
            }
            
            // find R On-End
            let diffWindow = diffNumber(rSearchWindow, ecgSearchWindow);
            for (i = 0; i < diffWindow.length; i++) {
                if (diffWindow[i] <= (0.05 * diffWindow[0])) {
                    this.posOnEndQRS[1] = indexBase + i + 4;
                    break;
                }
            }
        }

        this.detectionOnEndQRS = true;
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