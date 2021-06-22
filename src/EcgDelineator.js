import { pushDataLowPassFilter14Hz, pushDataLowPassFilter40Hz, resetLowPassFilter14Hz, resetLowPassFilter40Hz } from './LowPassFilter';
import { FirstDerivativeFilter, SecondDerivativeFilter } from './DifferentialFilter';
import { OpeningFilter, ClosingFilter } from './MorphologicalFilter';
import { global } from './global';

const samplingFreq = global.samplingFreq;
const windowLength = 2
const windowBufferSize = samplingFreq * windowLength;
const QRSFactor = 0.5;
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
const RRIntervalLimited = (0.25 * samplingFreq);
const PWaveLength = (0.12 * samplingFreq);
const TWaveLength = (0.2 * samplingFreq);

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

function getAllIndexes(arr, val) {
    var indexes = [], i;
    for(i = 0; i < arr.length; i++)
        if (arr[i] === val)
            indexes.push(i);
    return indexes;
}

class EcgDelineator {

    constructor() {

        // avgerage QRS
        this.avgQRSBuffer = [0.5, 0.5, 0.5, 0.5];
        this.avgQRS = SumOfArray(this.avgQRSBuffer) / this.avgQRSBuffer.length;

        // Delay 2 Buffer frame
        this.startupDelay = 0;

        this.onEndDetection = [];

        resetLowPassFilter14Hz();
        resetLowPassFilter40Hz();

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
        this.rawEcgData = 0;
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
        this.rawEcgData = inputEcg;
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
            if (this.startupDelay < 2)
                this.startupDelay++;
        }

        if (this.startupDelay >= 2) {
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
    }

    getRawEcgData() {
        return this.rawEcgData;
    }

    getRRInterval() {
        return (this.posPeakR - this.prevPosPeakR + this.ecg40HzBuffer.length) % this.ecg40HzBuffer.length;
    }

    isPeakRDetected() {
        return this.detectionPeakR;
    }

    getPosPeakR() {
        return this.posPeakR + 2;
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
        if ((detect < (QRSFactor * this.avgQRS)) && (Math.sign(this.secondDiffBuffer[this.ecgBufferIndex - 1] !== -1)))
            return false;
            
        var RR = (this.ecgBufferIndex - this.posPeakR + this.secondDiffBuffer.length) % this.secondDiffBuffer.length;
        if ((RR) < RRIntervalLimited )
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
        if ( (Math.abs(minValue) > (Math.abs(diffWindow[diffWindow.length-1]) * 0.025)) &&
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
        if ( (Math.abs(minValue) > (Math.abs(diffWindow[0]) * 0.025)) &&
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
        if (maxValue >= (PFactor * this.avgQRS)) {
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
        if (maxValue >= (TFactor * this.avgQRS)) {
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
            this.posOnEndQRS[0] = (indexBase + qSearchWindow.indexOf(Math.max(...qSearchWindow))) % this.ecg40HzBuffer.length;

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
                    this.posOnEndQRS[0] = (indexBase + i) % this.ecg40HzBuffer.length;
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
                sSearchWindow = rWindow1.concat(rWindow2);
            }
            else {
                sSearchWindow = this.ecg40HzBuffer.slice(windowBorder[0], windowBorder[1]);
            }

            this.posOnEndQRS[1] = (indexBase + sSearchWindow.indexOf(Math.max(...sSearchWindow))) % this.ecg40HzBuffer.length;

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
                    this.posOnEndQRS[1] = (indexBase + i) % this.ecg40HzBuffer.length;
                    break;
                }
            }
        }

        this.detectionOnEndQRS = true;
    }

    detectOnEndP() {
        let pSearchWindow;
        let baseSearchWindow;
        
        // find window border
        let windowBorder = [this.posPeakP - Math.floor(PWaveLength/2), this.posPeakP];

        if (windowBorder[0] < 0)
            windowBorder[0] = windowBorder[0] + this.ecg40HzBuffer.length;
        
        let indexBase = windowBorder[0];
        
        let pBaseWindowBorder = [ ( windowBorder[0] + PBaseDelay + this.pBaseBuffer.length) % this.pBaseBuffer.length,
                                    ( windowBorder[1] + PBaseDelay + this.pBaseBuffer.length) % this.pBaseBuffer.length];

        // Get Search Window Data
        if (windowBorder[0] > windowBorder[1]) {
            var pWindow1 = this.ecg40HzBuffer.slice(windowBorder[0], this.ecg40HzBuffer.length);
            var pWindow2 = this.ecg40HzBuffer.slice(0, windowBorder[1]);
            pSearchWindow = pWindow1.concat(pWindow2) ;
        }
        else {
            pSearchWindow = this.ecg40HzBuffer.slice(windowBorder[0], windowBorder[1]);
        }

        if (pBaseWindowBorder[0] > pBaseWindowBorder[1]) {
            var pBaseWindow1 = this.pBaseBuffer.slice(pBaseWindowBorder[0], this.pBaseBuffer.length);
            var pBaseWindow2 = this.pBaseBuffer.slice(0, pBaseWindowBorder[1]);
            baseSearchWindow = pBaseWindow1.concat(pBaseWindow2) ;
        }
        else {
            baseSearchWindow = this.pBaseBuffer.slice(pBaseWindowBorder[0], pBaseWindowBorder[1]);
        }
        
        // find P On-Set
        let diffWindow = diffNumber(pSearchWindow, baseSearchWindow);

        let minValue = Math.min(...diffWindow);
        let indexes = getAllIndexes(diffWindow, minValue);
        this.posOnEndP[0] = (indexBase + indexes[indexes.length-1]) % this.ecg40HzBuffer.length;

        // find window border
        windowBorder = [this.posPeakP, (this.posPeakP + Math.floor(PWaveLength/2)) % this.ecg40HzBuffer.length];
        
        indexBase = windowBorder[0];
        
        pBaseWindowBorder = [ ( windowBorder[0] + PBaseDelay + this.pBaseBuffer.length) % this.pBaseBuffer.length,
                              ( windowBorder[1] + PBaseDelay + this.pBaseBuffer.length) % this.pBaseBuffer.length];

        // Get Search Window Data
        if (windowBorder[0] > windowBorder[1]) {
            pWindow1 = this.ecg40HzBuffer.slice(windowBorder[0], this.ecg40HzBuffer.length);
            pWindow2 = this.ecg40HzBuffer.slice(0, windowBorder[1]);
            pSearchWindow = pWindow1.concat(pWindow2) ;
        }
        else {
            pSearchWindow = this.ecg40HzBuffer.slice(windowBorder[0], windowBorder[1]);
        }

        if (pBaseWindowBorder[0] > pBaseWindowBorder[1]) {
            pBaseWindow1 = this.pBaseBuffer.slice(pBaseWindowBorder[0], this.pBaseBuffer.length);
            pBaseWindow2 = this.pBaseBuffer.slice(0, pBaseWindowBorder[1]);
            baseSearchWindow = pBaseWindow1.concat(pBaseWindow2) ;
        }
        else {
            baseSearchWindow = this.pBaseBuffer.slice(pBaseWindowBorder[0], pBaseWindowBorder[1]);
        }
        
        // find P On-Set
        diffWindow = diffNumber(pSearchWindow, baseSearchWindow);

        minValue = Math.min(...diffWindow);
        indexes = getAllIndexes(diffWindow, minValue);
        this.posOnEndP[1] = (indexBase + indexes[0]) % this.ecg40HzBuffer.length;

        this.detectionOnEndP = true;
    }

    detectOnEndT() {
        let tSearchWindow;
        let baseSearchWindow;
        
        // find window border
        let windowBorder = [this.posPeakT - Math.floor(TWaveLength/2), this.posPeakT];

        if (windowBorder[0] < 0)
            windowBorder[0] = windowBorder[0] + this.ecg40HzBuffer.length;
        
        let indexBase = windowBorder[0];
        
        let tBaseWindowBorder = [ ( windowBorder[0] + TBaseDelay + this.tBaseBuffer.length) % this.tBaseBuffer.length,
                                  ( windowBorder[1] + TBaseDelay + this.tBaseBuffer.length) % this.tBaseBuffer.length];

        // Get Search Window Data
        if (windowBorder[0] > windowBorder[1]) {
            var tWindow1 = this.ecg40HzBuffer.slice(windowBorder[0], this.ecg40HzBuffer.length);
            var tWindow2 = this.ecg40HzBuffer.slice(0, windowBorder[1]);
            tSearchWindow = tWindow1.concat(tWindow2) ;
        }
        else {
            tSearchWindow = this.ecg40HzBuffer.slice(windowBorder[0], windowBorder[1]);
        }

        if (tBaseWindowBorder[0] > tBaseWindowBorder[1]) {
            var tBaseWindow1 = this.tBaseBuffer.slice(tBaseWindowBorder[0], this.tBaseBuffer.length);
            var tBaseWindow2 = this.tBaseBuffer.slice(0, tBaseWindowBorder[1]);
            baseSearchWindow = tBaseWindow1.concat(tBaseWindow2) ;
        }
        else {
            baseSearchWindow = this.tBaseBuffer.slice(tBaseWindowBorder[0], tBaseWindowBorder[1]);
        }
        
        // find T On-Set
        let diffWindow = diffNumber(tSearchWindow, baseSearchWindow);

        let minValue = Math.min(...diffWindow);
        let indexes = getAllIndexes(diffWindow, minValue);
        this.posOnEndT[0] = (indexBase + indexes[indexes.length-1]) % this.ecg40HzBuffer.length;

        // find window border
        windowBorder = [this.posPeakT, (this.posPeakT + Math.floor(TWaveLength/2)) % this.ecg40HzBuffer.length];
        
        indexBase = windowBorder[0];
        
        tBaseWindowBorder = [ ( windowBorder[0] + TBaseDelay + this.tBaseBuffer.length) % this.tBaseBuffer.length,
                              ( windowBorder[1] + TBaseDelay + this.tBaseBuffer.length) % this.tBaseBuffer.length];

        // Get Search Window Data
        if (windowBorder[0] > windowBorder[1]) {
            tWindow1 = this.ecg40HzBuffer.slice(windowBorder[0], this.ecg40HzBuffer.length);
            tWindow2 = this.ecg40HzBuffer.slice(0, windowBorder[1]);
            tSearchWindow = tWindow1.concat(tWindow2) ;
        }
        else {
            tSearchWindow = this.ecg40HzBuffer.slice(windowBorder[0], windowBorder[1]);
        }

        if (tBaseWindowBorder[0] > tBaseWindowBorder[1]) {
            tBaseWindow1 = this.tBaseBuffer.slice(tBaseWindowBorder[0], this.tBaseBuffer.length);
            tBaseWindow2 = this.tBaseBuffer.slice(0, tBaseWindowBorder[1]);
            baseSearchWindow = tBaseWindow1.concat(tBaseWindow2) ;
        }
        else {
            baseSearchWindow = this.tBaseBuffer.slice(tBaseWindowBorder[0], tBaseWindowBorder[1]);
        }
        
        // find P On-Set
        diffWindow = diffNumber(tSearchWindow, baseSearchWindow);

        minValue = Math.min(...diffWindow);
        indexes = getAllIndexes(diffWindow, minValue);
        this.posOnEndT[1] = (indexBase + indexes[0]) % this.ecg40HzBuffer.length;

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