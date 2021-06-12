class FirstDerivativeFilter {
    constructor() {
        this.buffer = new Array(2);
        this.buffer.fill(0);
    }
    
    /**
     * Push Data into Filter and get the Result.
     * @param {Number} inputValue input Value
     * @returns {Number} return Filter result
     */
    pushData(inputValue) {
        this.buffer.shift();
        this.buffer.push(inputValue);
        return this.buffer[1] - this.buffer[0];
    }
}

class SecondDerivativeFilter {
    constructor() {
        this.firstDerivative = new FirstDerivativeFilter();
        this.buffer = new Array(2);
        this.buffer.fill(0);
    }
    
    /**
     * Push Data into Filter and get the Result.
     * @param {Number} inputValue input Value
     * @returns {Number} return Filter result
     */
    pushData(inputValue) {
        this.buffer.shift();
        this.buffer.push(this.firstDerivative.pushData(inputValue));
        return this.buffer[1] - this.buffer[0];
    }
}

export { FirstDerivativeFilter, SecondDerivativeFilter };