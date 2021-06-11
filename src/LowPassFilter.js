var Fili = require('fili/dist/fili.min');

var samplingFreq = 500;
var filterOrder = 40;


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

var lowPassFirFilter14 = new Fili.FirFilter(lowPassFir14Coeffs);
var lowPassFirFilter40 = new Fili.FirFilter(lowPassFir40Coeffs);


function pushDataLowPassFilter14Hz(inputValue) {
    return lowPassFirFilter14.singleStep(inputValue);
}

function pushDatalowPassFilter40Hz(inputValue) {
    return lowPassFirFilter40.singleStep(inputValue);
}

export { pushDataLowPassFilter14Hz, pushDatalowPassFilter40Hz };