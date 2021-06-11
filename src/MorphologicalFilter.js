/**
 * This Module contains the Filters use for getting the ECG baseline.
 */

class ErosionFilter {
    constructor(windowSize) {
        this.buffer = new Array(windowSize);
        this.buffer.fill(NaN);
        this.bufferIndex = 1;
    }
    /**
     * Push the data into the erosion filter and output the result
     * Note: the result will be delayed, the time will change with the window size.
     * @param {Number} inputValue Value push into Filter.
     * @returns output of the Filter.
     */
    pushData(inputValue) {
        var minValue;
        if (this.bufferIndex <= this.buffer.length) {
            this.buffer[this.bufferIndex-1] = inputValue;
            minValue = Math.min(...this.buffer.slice(0, this.bufferIndex));
            this.bufferIndex = this.bufferIndex + 1;
        }   
        else {
            this.buffer.shift();
            this.buffer.push(inputValue);
            minValue = Math.min(...this.buffer);
        }
        return minValue;
    }
}

class DilationFilter {
    constructor(windowSize) {
        this.buffer = new Array(windowSize);
        this.buffer.fill(NaN);
        this.bufferIndex = 1;
    }

    /**
     * Push the data into the dilation filter and output the result
     * Note: the result will be delayed, the time will change with the window size.
     * @param {Number} inputValue Value push into Filter.
     * @returns output of the Filter.
     */
    pushData(inputValue) {
        var maxValue;
        if (this.bufferIndex <= this.buffer.length) {
            this.buffer[this.bufferIndex-1] = inputValue;
            maxValue = Math.max(...this.buffer.slice(0, this.bufferIndex));
            this.bufferIndex = this.bufferIndex + 1;
        }   
        else {
            this.buffer.shift();
            this.buffer.push(inputValue);
            maxValue = Math.max(...this.buffer);
        }
        return maxValue;
    }
}

class OpeningFilter {
    constructor(windowSize) {
        this.erosionFilter = new ErosionFilter(windowSize);
        this.dilationFilter = new DilationFilter(windowSize);
    }

    /**
     * Push the data into the opening filter and output the result
     * Note: the result will be delayed, the time will change with the window size.
     * @param {Number} inputValue Value push into Filter.
     * @returns output of the Filter.
     */
    pushData(inputValue) {
        return this.dilationFilter.pushData(this.erosionFilter.pushData(inputValue));
    }
}

class ClosingFilter {
    constructor(windowSize) {
        this.erosionFilter = new ErosionFilter(windowSize);
        this.dilationFilter = new DilationFilter(windowSize);
    }

    /**
     * Push the data into the closing filter and output the result
     * Note: the result will be delayed, the time will change with the window size.
     * @param {Number} inputValue Value push into Filter.
     * @returns output of the Filter.
     */
    pushData(inputValue) {
        return this.erosionFilter.pushData(this.dilationFilter.pushData(inputValue));
    }
}

export { ErosionFilter, DilationFilter, OpeningFilter, ClosingFilter };