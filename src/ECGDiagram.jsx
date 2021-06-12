import React from "react";

const ECG_COLOR = "#23F427FF";
const SECOND_DIFF_DELAY = 3;

class ECGDiagram extends React.Component{

    sampleFreq = 500; // Hz
	frameLength = 4; // Sec
	drawPointsUnit = 40; //points
	data = Array(this.sampleFreq*this.frameLength);
	drawPointsIndex = 0;
    canvasRef1 = null;
    canvasRef2 = null;

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

    drawPeakR() {
        const c2 = this.canvasRef2.current;
        const ctx2 = c2.getContext("2d");
        
        var originFillStyle = ctx2.fillStyle;

        var x_value = (this.drawPointsIndex-1-SECOND_DIFF_DELAY) * (c2.width / (this.sampleFreq * this.frameLength));
        ctx2.fillStyle = "rgb(200,0,0)";
        ctx2.beginPath();
        ctx2.arc(x_value.toFixed(2) , this.data[this.drawPointsIndex-SECOND_DIFF_DELAY], 4, 0, Math.PI*2, true);
        ctx2.fill();
        ctx2.closePath();

        ctx2.fillStyle = originFillStyle;
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
            ctx2.clearRect(0, 0, clearWidth, c2.height);
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

    componentDidUpdate(prevProps) {
        // if props updated
        if (this.props.data !== prevProps.data) {
            this.updateChart();
        }
        if (this.props.data.PeakR.PeakR !== prevProps.data.PeakR.PeakR) {
            this.drawPeakR();
        }
    } 


    render() {
        return (
            <div>
                <div className="container-fluid">
                    <div style={{float: 'left',}}>
						<canvas ref={this.canvasRef1} id="myCanvas1" width="1000" height="256">
							Your browser does not support the HTML canvas tag.
						</canvas>
					</div>
			
					<div style={{float: 'top', position: 'absolute'}}>
						<canvas ref={this.canvasRef2} id="myCanvas2" width="1000" height="256">
							Your browser does not support the HTML canvas tag.
						</canvas>
					</div>
                </div>
            </div>
        );
    }

}

export default ECGDiagram;
