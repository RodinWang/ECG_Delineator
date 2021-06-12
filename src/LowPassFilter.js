/**
 * This module contains the Low Pass FIR Filter.
 */

var Fili = require('fili/dist/fili.min');

var samplingFreq = 500;
var filterOrder = 50;


/* Low Pass Filter */
var firCalculator= new Fili.FirCoeffs();

/* FIR Filter Coefficients */
var lowPassFir14Coeffs = firCalculator.lowpass({
    order: filterOrder,
    Fs: samplingFreq,
    Fc: 14
})
var lowPassFir40Coeffs = firCalculator.lowpass({
    order: filterOrder,
    Fs: samplingFreq,
    Fc: 40
})

/* FIR Filter */
var lowPassFirFilter14 = new Fili.FirFilter(lowPassFir14Coeffs);
var lowPassFirFilter40 = new Fili.FirFilter(lowPassFir40Coeffs);

/**
 * This function can store the inputValue in a buffer 
 * and output the result of the 14Hz Low Pass FIR Filter.
 * @param {Number} inputValue Filter input value
 * @returns {Number} result of 14Hz Low Pass Filter
 */
function pushDataLowPassFilter14Hz(inputValue) {
    return lowPassFirFilter14.singleStep(inputValue);
}

/**
 * This function can store the inputValue in a buffer 
 * and output the result of the 40Hz Low Pass FIR Filter.
 * @param {Number} inputValue Filter input value
 * @returns {Number} result of 40Hz Low Pass Filter
 */
function pushDataLowPassFilter40Hz(inputValue) {
    return lowPassFirFilter40.singleStep(inputValue);
}

export { pushDataLowPassFilter14Hz, pushDataLowPassFilter40Hz };