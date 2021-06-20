import React from "react";
import { global } from './global';

const ECG_COLOR = "#0000FF";
const R_COLOR = "rgb(200,0,0)";
const T_COLOR = "#FF00FF";
const P_COLOR = "#009900";
const SECOND_DIFF_DELAY = 3;

class ECGDiagram extends React.Component{

    sampleFreq = global.samplingFreq; // Hz
	frameLength = 4; // Sec
	drawPointsUnit = 40; //points
	data = Array(this.sampleFreq*this.frameLength);
	drawPointsIndex = 0;
    canvasRef1 = null;
    canvasRef2 = null;
    currentRPeak = 0;

    signalReverse(data){
		data = Math.abs(data-255);
		return data;
	}

    constructor(props) {
        super(props);
        this.canvasRef1 = React.createRef();
        this.canvasRef2 = React.createRef();
    }

    componentDidMount() {
        // Get Canvas Object
        const c2 = this.canvasRef2.current;
        const ctx2 = c2.getContext("2d");
        ctx2.imageSmoothingEnabled = ctx2.mozImageSmoothingEnabled = ctx2.webkitImageSmoothingEnabled = false
        ctx2.strokeStyle = ECG_COLOR;
        ctx2.lineWidth = 3;

        this.drawBG();
        this.drawGrid();
    }

    drawBG() {
        const c1 = this.canvasRef1.current;
        const ctx1 = c1.getContext("2d");
		// Create gradient
		var gradient = ctx1.createLinearGradient(0, 0, 0, 3*c1.height/2);
		gradient.addColorStop(0, "#C0C0C0FF");
		gradient.addColorStop(1, "#13547a");

		// Fill with gradient
		ctx1.fillStyle = gradient;
		ctx1.fillRect(0, 0, c1.width, c1.height);
	}

    drawGrid() {
        const c1 = this.canvasRef1.current;
        const ctx1 = c1.getContext("2d");
		ctx1.strokeStyle = "#C0C0C0FF";
		ctx1.lineWidth = 1;
		var vlu = c1.width / (this.frameLength);  // 1 sec
		for(var vli = 0; vli <= this.frameLength; vli++) {
			ctx1.moveTo(vli*vlu.toFixed(2)-1.0, 0);
			ctx1.lineTo(vli*vlu.toFixed(2)-1.0, c1.height);
			ctx1.stroke();
		}
	}

    updateChart() {
        const c2 = this.canvasRef2.current;
        const ctx2 = c2.getContext("2d");
        var x_value1, x_value2;
        var clearWidth = this.drawPointsUnit * (c2.width / (this.sampleFreq * this.frameLength)); 
        var input_value = this.props.data.ECG.ecgSignal[this.props.data.ECG.ecgSignal.length-1];
		this.data[this.drawPointsIndex] = this.signalReverse(input_value);
        
        ctx2.beginPath();
        if (this.drawPointsIndex === 0) {            
            x_value2 = this.drawPointsIndex * (c2.width / (this.sampleFreq * this.frameLength));
            ctx2.clearRect(0, 0, clearWidth + 1, c2.height);
            ctx2.moveTo( 0, this.data[0]);
            ctx2.lineTo( x_value2.toFixed(2) , this.data[0]);
        }
        else {
            x_value1 = (this.drawPointsIndex - 1)* (c2.width / (this.sampleFreq * this.frameLength));
		    x_value2 = this.drawPointsIndex * (c2.width / (this.sampleFreq * this.frameLength));
            ctx2.clearRect( x_value2 + clearWidth, 0, 1, c2.height);
            ctx2.moveTo( x_value1, this.data[this.drawPointsIndex-1]);
            ctx2.lineTo( x_value2.toFixed(2) , this.data[this.drawPointsIndex]);
        }
        ctx2.stroke(); 
        ctx2.closePath();
        
		this.drawPointsIndex++;

		// Turn around
		if(this.drawPointsIndex >= this.data.length){
			this.drawPointsIndex = 0;
			ctx2.moveTo(0, 0);
			ctx2.beginPath();
		}
    }

    drawPeakR() {
        const c2 = this.canvasRef2.current;
        const ctx2 = c2.getContext("2d");
        
        var originFillStyle = ctx2.fillStyle;
        var x_value = (this.drawPointsIndex + 1 - SECOND_DIFF_DELAY) * (c2.width / (this.sampleFreq * this.frameLength));
        ctx2.fillStyle = R_COLOR;
        ctx2.beginPath();
        ctx2.arc(x_value.toFixed(2) , this.data[this.drawPointsIndex-SECOND_DIFF_DELAY], 4, 0, Math.PI*2, true);
        ctx2.fill();
        ctx2.closePath();

        this.currentRPeak = this.drawPointsIndex;

        ctx2.fillStyle = originFillStyle;
    }

    drawPeakQ() {
        const c2 = this.canvasRef2.current;
        const ctx2 = c2.getContext("2d");
        var originFillStyle = ctx2.fillStyle;
        var QRInterval = (this.currentRPeak - this.props.data.Peak.PeakQ + (this.sampleFreq*2)) % (this.sampleFreq*2);
        
        var x_index;
        var x_value;

        x_index = ((this.currentRPeak + 1 - QRInterval + (this.sampleFreq * this.frameLength)) % (this.sampleFreq * this.frameLength));
        x_value = x_index * (c2.width / (this.sampleFreq * this.frameLength));

        ctx2.fillStyle = R_COLOR;
        ctx2.beginPath();
        ctx2.arc(x_value.toFixed(2) , this.data[x_index], 4, 0, Math.PI*2, true);
        ctx2.fill();
        ctx2.closePath();

        ctx2.fillStyle = originFillStyle;
    }

    drawPeakS() {
        const c2 = this.canvasRef2.current;
        const ctx2 = c2.getContext("2d");
        
        var originFillStyle = ctx2.fillStyle;
        var RSInterval = (this.props.data.Peak.PeakS - this.currentRPeak + (this.sampleFreq*2)) % (this.sampleFreq*2);
        
        var x_index;
        var x_value;

        x_index = ((this.currentRPeak + 1 + RSInterval + (this.sampleFreq * this.frameLength)) % (this.sampleFreq * this.frameLength));
        x_value = x_index * (c2.width / (this.sampleFreq * this.frameLength));

        ctx2.fillStyle = R_COLOR;
        ctx2.beginPath();
        ctx2.arc(x_value.toFixed(2) , this.data[x_index], 4, 0, Math.PI*2, true);
        ctx2.fill();
        ctx2.closePath();

        ctx2.fillStyle = originFillStyle;
    }

    drawPeakP() {
        const c2 = this.canvasRef2.current;
        const ctx2 = c2.getContext("2d");
        
        var originFillStyle = ctx2.fillStyle;
        var PRInterval = (this.currentRPeak - this.props.data.Peak.PeakP + (this.sampleFreq*2)) % (this.sampleFreq*2);
        
        var x_index;
        var x_value;

        x_index = ((this.currentRPeak + 1 - SECOND_DIFF_DELAY - PRInterval + (this.sampleFreq * this.frameLength)) % (this.sampleFreq * this.frameLength));
        x_value = x_index * (c2.width / (this.sampleFreq * this.frameLength));

        ctx2.fillStyle = P_COLOR;
        ctx2.beginPath();
        ctx2.arc(x_value.toFixed(2) , this.data[x_index], 4, 0, Math.PI*2, true);
        ctx2.fill();
        ctx2.closePath();

        ctx2.fillStyle = originFillStyle;
    }

    drawPeakT() {
        const c2 = this.canvasRef2.current;
        const ctx2 = c2.getContext("2d");
        
        var originFillStyle = ctx2.fillStyle;
        var TRInterval = (this.currentRPeak - this.props.data.Peak.PeakT + (this.sampleFreq*2)) % (this.sampleFreq*2);

        var x_index;
        var x_value;

        x_index = ((this.currentRPeak + 1 - SECOND_DIFF_DELAY - TRInterval + (this.sampleFreq * this.frameLength)) % (this.sampleFreq * this.frameLength));
        x_value = x_index * (c2.width / (this.sampleFreq * this.frameLength));

        ctx2.fillStyle = T_COLOR;
        ctx2.beginPath();
        ctx2.arc(x_value.toFixed(2) , this.data[x_index], 4, 0, Math.PI*2, true);
        ctx2.fill();
        ctx2.closePath();

        ctx2.fillStyle = originFillStyle;
    }

    drawOnEndR() {
        const c2 = this.canvasRef2.current;
        const ctx2 = c2.getContext("2d");
        
        var originLineWidth = ctx2.lineWidth;
        var originStrokeStyle = ctx2.strokeStyle;
        var RInterval0 = (this.currentRPeak - this.props.data.onEnd.onEndR[0] + (this.sampleFreq*2)) % (this.sampleFreq*2);
        var RInterval1 = (this.props.data.onEnd.onEndR[1] - this.currentRPeak + (this.sampleFreq*2)) % (this.sampleFreq*2);
        var x_index0, x_index1;
        var x_value0, x_value1;

        x_index0 = ((this.currentRPeak + 1 - RInterval0 + (this.sampleFreq * this.frameLength)) % (this.sampleFreq * this.frameLength));
        x_value0 = x_index0 * (c2.width / (this.sampleFreq * this.frameLength));
        x_index1 = ((this.currentRPeak + 1 + RInterval1 + (this.sampleFreq * this.frameLength)) % (this.sampleFreq * this.frameLength));
        x_value1 = x_index1 * (c2.width / (this.sampleFreq * this.frameLength));

        ctx2.strokeStyle = R_COLOR;
        ctx2.lineWidth = 2;
        ctx2.beginPath();
        ctx2.moveTo(x_value0.toFixed(2), this.data[x_index0]);
        ctx2.lineTo(x_value0.toFixed(2), this.data[x_index0] - 50);
        ctx2.moveTo(x_value1.toFixed(2), this.data[x_index1]);
        ctx2.lineTo(x_value1.toFixed(2), this.data[x_index1] - 50);
        ctx2.stroke();
        ctx2.closePath();

        ctx2.lineWidth = originLineWidth;
        ctx2.strokeStyle = originStrokeStyle;
    }

    drawOnEndT() {
        const c2 = this.canvasRef2.current;
        const ctx2 = c2.getContext("2d");
        
        var originStrokeStyle = ctx2.strokeStyle;
        var originLineWidth = ctx2.lineWidth;
        var TInterval0 = (this.currentRPeak - this.props.data.onEnd.onEndT[0] + (this.sampleFreq*2)) % (this.sampleFreq*2);
        var TInterval1 = (this.currentRPeak - this.props.data.onEnd.onEndT[1] + (this.sampleFreq*2)) % (this.sampleFreq*2);
        var x_index0, x_index1;
        var x_value0, x_value1;

        x_index0 = ((this.currentRPeak + 1 - SECOND_DIFF_DELAY - TInterval0 + (this.sampleFreq * this.frameLength)) % (this.sampleFreq * this.frameLength));
        x_value0 = x_index0 * (c2.width / (this.sampleFreq * this.frameLength));
        x_index1 = ((this.currentRPeak + 1 - SECOND_DIFF_DELAY - TInterval1 + (this.sampleFreq * this.frameLength)) % (this.sampleFreq * this.frameLength));
        x_value1 = x_index1 * (c2.width / (this.sampleFreq * this.frameLength));

        ctx2.strokeStyle = T_COLOR;
        ctx2.lineWidth = 2;
        ctx2.beginPath();
        ctx2.moveTo(x_value0.toFixed(2), this.data[x_index0]);
        ctx2.lineTo(x_value0.toFixed(2), this.data[x_index0] - 20);
        ctx2.moveTo(x_value1.toFixed(2), this.data[x_index1]);
        ctx2.lineTo(x_value1.toFixed(2), this.data[x_index1] - 20);
        ctx2.stroke();
        ctx2.closePath();

        ctx2.lineWidth = originLineWidth;
        ctx2.strokeStyle = originStrokeStyle;
    }

    drawOnEndP() {
        const c2 = this.canvasRef2.current;
        const ctx2 = c2.getContext("2d");
        
        var originLineWidth = ctx2.lineWidth;
        var originStrokeStyle = ctx2.strokeStyle;
        var PInterval0 = (this.currentRPeak - this.props.data.onEnd.onEndP[0] + (this.sampleFreq*2)) % (this.sampleFreq*2);
        var PInterval1 = (this.currentRPeak - this.props.data.onEnd.onEndP[1] + (this.sampleFreq*2)) % (this.sampleFreq*2);
        var x_index0, x_index1;
        var x_value0, x_value1;

        x_index0 = ((this.currentRPeak + 1 - SECOND_DIFF_DELAY - PInterval0 + (this.sampleFreq * this.frameLength)) % (this.sampleFreq * this.frameLength));
        x_value0 = x_index0 * (c2.width / (this.sampleFreq * this.frameLength));
        x_index1 = ((this.currentRPeak + 1 - SECOND_DIFF_DELAY - PInterval1 + (this.sampleFreq * this.frameLength)) % (this.sampleFreq * this.frameLength));
        x_value1 = x_index1 * (c2.width / (this.sampleFreq * this.frameLength));

        ctx2.strokeStyle = P_COLOR;
        ctx2.lineWidth = 2;
        ctx2.beginPath();
        ctx2.moveTo(x_value0.toFixed(2), this.data[x_index0]);
        ctx2.lineTo(x_value0.toFixed(2), this.data[x_index0] - 20);
        ctx2.moveTo(x_value1.toFixed(2), this.data[x_index1]);
        ctx2.lineTo(x_value1.toFixed(2), this.data[x_index1] - 20);
        ctx2.stroke();
        ctx2.closePath();

        ctx2.lineWidth = originLineWidth;
        ctx2.strokeStyle = originStrokeStyle;
    }

    componentDidUpdate(prevProps) {
        // if props updated
        if (this.props.data.ECG !== prevProps.data.ECG) {
            this.updateChart();
        }
        if (this.props.data.Peak.PeakR !== prevProps.data.Peak.PeakR) {
            this.drawPeakR();
        }
        if (this.props.data.Peak.PeakQ !== prevProps.data.Peak.PeakQ) {
            this.drawPeakQ();
        }
        if (this.props.data.Peak.PeakS !== prevProps.data.Peak.PeakS) {
            this.drawPeakS();
        }
        if (this.props.data.Peak.PeakP !== prevProps.data.Peak.PeakP) {
            this.drawPeakP();
        }
        if (this.props.data.Peak.PeakT !== prevProps.data.Peak.PeakT) {
            this.drawPeakT();
        }
        if ((this.props.data.onEnd.onEndR[0] !== prevProps.data.onEnd.onEndR[0]) ||
            (this.props.data.onEnd.onEndR[1] !== prevProps.data.onEnd.onEndR[1])) {
            this.drawOnEndR();
        }
        if ((this.props.data.onEnd.onEndP[0] !== prevProps.data.onEnd.onEndP[0]) || 
            (this.props.data.onEnd.onEndP[1] !== prevProps.data.onEnd.onEndP[1])) {
            this.drawOnEndP();
        }
        if ((this.props.data.onEnd.onEndT[0] !== prevProps.data.onEnd.onEndT[0]) || 
            (this.props.data.onEnd.onEndT[1] !== prevProps.data.onEnd.onEndT[1])) {
            this.drawOnEndT();
        }
    } 


    render() {
        return (
            <div>
                <div className="container-fluid">
                    <div style={{float: 'left',}}>
						<canvas ref={this.canvasRef1} id="myCanvas1" width="1400" height="256">
							Your browser does not support the HTML canvas tag.
						</canvas>
					</div>
			
					<div style={{float: 'top', position: 'absolute'}}>
						<canvas ref={this.canvasRef2} id="myCanvas2" width="1400" height="256">
							Your browser does not support the HTML canvas tag.
						</canvas>
					</div>
                </div>
            </div>
        );
    }

}

export default ECGDiagram;
