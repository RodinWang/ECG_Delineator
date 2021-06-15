import './App.css';
import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';
import '@fortawesome/fontawesome-free/css/all.min.css'
import { btConnect, btDisconnected, btGetDataArray } from './ble';
import ECGDiagram from './ECGDiagram'
import { EcgDelineator } from './EcgDelineator'

// convert CSV to number array
function CSVToNumberArray( strData, strDelimiter ) {
  strDelimiter = (strDelimiter || ",");
  var objPattern = new RegExp(
    (
      // Delimiters.
      "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +
      // Quoted fields.
      "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
      // Standard fields.
      "([^\"\\" + strDelimiter + "\\r\\n]*))"
    ),
    "gi"
    );

  var arrData = [[]];
  var arrMatches = null;

  while (arrMatches = objPattern.exec( strData )){
    // Get the delimiter that was found.
    var strMatchedDelimiter = arrMatches[ 1 ];

    if (strMatchedDelimiter.length && (strMatchedDelimiter !== strDelimiter) ){
      arrData.push( [] );
    }
    if (arrMatches[ 2 ]){
      var strMatchedValue = arrMatches[ 2 ].replace(
        new RegExp( "\"\"", "g" ),
        "\""
        );
    } else {
      var strMatchedValue = arrMatches[ 3 ];
    }
    arrData[ arrData.length - 1 ].push( parseInt(strMatchedValue) );
  }
  return( arrData );
}

var fileEcgdata = [];

class App extends React.Component {
  timeID = 0;
  dataIndex = 0;
  ecgDelineator = undefined;

  constructor(props) {
    super(props);
    this.state = {
      ecgSignal: [],
      peakR: [],
      peakQ: [],
      PeakS: [],
      peakP: [],
      peakT: [],
      onEndR: [],
      onEndP: [],
      onEndT: [],
      pPeakEnable: false,
      rPeakEnable: true,
      tPeakEnable: false,
      pOnEndEnable: false,
      rOnEndEnable: false,
      tOnEndEnable: false,
    };
  }

  componentDidMount() {
    document.getElementById('files').addEventListener('change', this.handleFileSelect.bind(this), false);
  }

  handleFileSelect(evt) {
		var files = evt.target.files; // FileList object

		// files is a FileList of File objects. List some properties.
		var output = [];
		for (var i = 0, f; f = files[i]; i++) {
			var reader = new FileReader();
			reader.onload = ((theFile) => {
				return (e) => {
					let filedata = e.target.result;
					fileEcgdata = CSVToNumberArray(filedata, ',').slice();
          this.ecgDelineator = new EcgDelineator();
          // set timer for 500Hz
          this.timerId = setInterval(this.handleEcgDraw.bind(this), 2);
				};
			})(f);
			// read file
			reader.readAsText(f);
		}
  }

  handleEcgDraw() {
    const { ecgSignal, PeakR, PeakQ, PeakS, PeakP, PeakT, onEndR, onEndP, onEndT, pPeakEnable, rPeakEnable, tPeakEnable, pOnEndEnable, rOnEndEnable, tOnEndEnable } = this.state;

		if (this.dataIndex >= 9999) {
			clearInterval(this.timerId);
      this.dataIndex = 0;
		}
		else {
      this.ecgDelineator.pushEcgData(fileEcgdata[0][this.dataIndex]);
      var ecg = this.ecgDelineator.getEcg40HzData();

      var posPeakR = PeakR;
      var posPeakQ = PeakQ;
      var posPeakS = PeakS;
      var posPeakP = PeakP;
      var posPeakT = PeakT;
      var posOnEndR = onEndR;
      var posOnEndP = onEndP;
      var posOnEndT = onEndT;
      if (this.ecgDelineator.isPeakRDetected()) {
        if (rPeakEnable)
          posPeakR = this.ecgDelineator.getPosPeakR();

        if (this.ecgDelineator.isPeakPDetected()) {
          if (pPeakEnable)
            posPeakP = this.ecgDelineator.getPosPeakP();
        }

        if (this.ecgDelineator.isPeakTDetected()) {
          if (tPeakEnable)
            posPeakT = this.ecgDelineator.getPosPeakT();
        }
      }

      if (this.ecgDelineator.isPeakQDetected()) {
        if (rPeakEnable)
          posPeakQ = this.ecgDelineator.getPosPeakQ();
      }

      if (this.ecgDelineator.isPeakQDetected()) {
        if (rPeakEnable)
          posPeakS = this.ecgDelineator.getPosPeakS();
      }

      if (this.ecgDelineator.isOnEndQRSDetected()) {
        if (rOnEndEnable)
          posOnEndR = this.ecgDelineator.getPosOnEndQRS();
      }

      if (this.ecgDelineator.isOnEndTDetected()) {
        if (tOnEndEnable)
          posOnEndT = this.ecgDelineator.getPosOnEndT();
      }

      if (this.ecgDelineator.isOnEndPDetected()) {
        if (pOnEndEnable)
          posOnEndP = this.ecgDelineator.getPosOnEndP();
      }     

      ecgSignal.push(ecg);
			this.dataIndex = this.dataIndex + 1;
      this.setState({
        ecgSignal: ecgSignal.slice(),
        PeakR: posPeakR,
        PeakQ: posPeakQ,
        PeakS: posPeakS,
        PeakP: posPeakP,
        PeakT: posPeakT,
        onEndR: posOnEndR,
        onEndP: posOnEndP,
        onEndT: posOnEndT,
      });
		}
	}


  handleBTConnect() {
    if (this.ecgDelineator !== undefined) {
      delete this.ecgDelineator;
    }
    this.ecgDelineator = new EcgDelineator();
    btConnect();
  }

  handleBTDisconnect() {
    delete this.ecgDelineator;
    btDisconnected();
  }

  // Save ECG Data
  saveRawEcgData() {
		var fileName = "ecg_data.csv";//匯出的檔名
		var data = this.state.ecgSignal;
		var blob = new Blob([data], {
			type : "application/octet-stream"
		});
		var href = URL.createObjectURL(blob);
		var link = document.createElement("a");
		document.body.appendChild(link);
		link.href = href;
		link.download = fileName;
		link.click();
	}

  handlePOnPeakCheck() {
    let { pPeakEnable, rPeakEnable, pOnEndEnable } = this.state;
    pPeakEnable = !pPeakEnable;

    if (pPeakEnable) {
      rPeakEnable = true;
    }
    if (!pPeakEnable) {
      pOnEndEnable = false;
    }

    this.setState({
      pPeakEnable: pPeakEnable,
      rPeakEnable: rPeakEnable,
      pOnEndEnable: pOnEndEnable,
    });
  }

  handleROnPeakCheck() {
    let { pPeakEnable, rPeakEnable, tPeakEnable, pOnEndEnable, rOnEndEnable, tOnEndEnable } = this.state;
    rPeakEnable = !rPeakEnable;

    if (!rPeakEnable) {
      pPeakEnable = false;
      tPeakEnable = false;
      pOnEndEnable = false;
      rOnEndEnable = false;
      tOnEndEnable = false;
    }

    this.setState({
      pPeakEnable: pPeakEnable,
      rPeakEnable: rPeakEnable,
      tPeakEnable: tPeakEnable,
      pOnEndEnable: pOnEndEnable,
      rOnEndEnable: rOnEndEnable,
      tOnEndEnable: tOnEndEnable, 
    });
  }

  handleTOnPeakCheck() {
    let { tPeakEnable, rPeakEnable, tOnEndEnable } = this.state;
    tPeakEnable = !tPeakEnable;

    if (tPeakEnable) {
      rPeakEnable = true;
    }
    if (!tPeakEnable) {
      tOnEndEnable = false;
    }

    this.setState({
      tPeakEnable: tPeakEnable,
      rPeakEnable: rPeakEnable,
      tOnEndEnable: tOnEndEnable,
    });
  }

  handlePOnEndCheck(e) {
    let { pPeakEnable, rPeakEnable, pOnEndEnable } = this.state;
    pOnEndEnable = !pOnEndEnable;

    if (pOnEndEnable) {
      rPeakEnable = true;
      pPeakEnable = true;
    }

    this.setState({
      pPeakEnable: pPeakEnable,
      rPeakEnable: rPeakEnable,
      pOnEndEnable: pOnEndEnable,
    });
  }

  handleROnEndCheck(e) {
    let { rPeakEnable, rOnEndEnable } = this.state;
    rOnEndEnable = !rOnEndEnable;

    if (rOnEndEnable)
      rPeakEnable = true;

    this.setState({
      rOnEndEnable: rOnEndEnable,
      rPeakEnable: rPeakEnable,
    });
  }

  handleTOnEndCheck(e) {
    let { tPeakEnable, rPeakEnable, tOnEndEnable } = this.state;
    tOnEndEnable = !tOnEndEnable;

    if (tOnEndEnable) {
      rPeakEnable = true;
      tPeakEnable = true;
    }

    this.setState({
      tPeakEnable: tPeakEnable,
      rPeakEnable: rPeakEnable,
      tOnEndEnable: tOnEndEnable,
    });
  }

  render() {
    let { ecgSignal, PeakR, PeakQ, PeakS, PeakP, PeakT, onEndR, onEndP, onEndT, pPeakEnable, rPeakEnable, tPeakEnable, pOnEndEnable, rOnEndEnable, tOnEndEnable } = this.state;
    let data = {
      ECG: {
        ecgSignal
      },
      Peak: {
        PeakR,
        PeakQ,
        PeakS,
        PeakP,
        PeakT,
      },
      onEnd: {
        onEndR,
        onEndP,
        onEndT
      }
    }

    return (
      <div className="App">        
        <header className="App-header">
          <div className="container-fluid App-font">

            {/* Button */}
            <div className="row">
              <div className="col-sm-1">
                <input type="file" className="btn btn-primary btn-sm" id="files" name="files[]" multiple ></input> 
              </div>
              <div className="col-sm-3" />
              <div className="col-sm-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={this.handleBTConnect.bind(this)}>
                  <span className="fas fa-bolt fa-lg" style={{color: 'white'}} > </span>
                  {"  Search BLE"}
                </button> 
              </div>
              <div className="col-sm-3">
                <button type="button" className="btn btn-danger btn-sm" onClick={this.handleBTDisconnect.bind(this)}>
                  <span className="fas fa-unlink fa-md" style={{color: 'white'}} > </span>
                  {"  Disconnect BLE"}
                </button> 
              </div>
              <div className="col-sm-3">
                <button type="button" className="btn btn-success btn-sm" onClick={() => this.saveRawEcgData()}>
                  <span className="fas fa-cloud-download-alt fa-lg" style={{color: 'white'}} > </span>
                  {"  Save Raw ECG Data"}
                </button> 
              </div>
            </div>

            {/* Check Box and Status*/}
            <div className="row row-cols-1 row-cols-md-3">

              {/* On-Peak Feature */}
              <div className="col-sm-4 gy-3">
                <div className="card bg-secondary border-light">
                  <label className="card-header">
                    On-Peak Feature
                  </label>
                  <div className="card-body">
                      <div className="row">
                        <div className="col-sm-4">
                          <div className="form-check">
                            <input className="form-check-input" type="checkbox" value="p" id="checkbox-peak-p" checked={pPeakEnable} onChange={this.handlePOnPeakCheck.bind(this)}/>
                            <label className="form-check-label h5" htmlFor="checkbox-peak-p">
                              P Peak
                            </label>
                          </div>
                        </div>
                        <div className="col-sm-4">
                          <div className="form-check">
                            <input className="form-check-input" type="checkbox" value="r" id="checkbox-peak-r" checked={rPeakEnable} onChange={this.handleROnPeakCheck.bind(this)} />
                            <label className="form-check-label h5" htmlFor="checkbox-peak-r">
                              QRS Complex
                            </label>
                          </div>
                        </div>
                        <div className="col-sm-4">
                          <div className="form-check">
                            <input className="form-check-input" type="checkbox" value="t" id="checkbox-peak-t" checked={tPeakEnable} onChange={this.handleTOnPeakCheck.bind(this)} />
                            <label className="form-check-label h5" htmlFor="checkbox-peak-t">
                              T Peak
                            </label>
                          </div>
                        </div>
                      </div>
                  </div>
                </div>
              </div>

              {/* On-End Feature */}
              <div className="col-sm-4 gy-3">
                <div className="card bg-secondary border-light">
                  <label className="card-header">
                    On-End Feature
                  </label>
                  <div className="card-body">
                    <div className="row">
                      <div className="col-sm-4">
                        <div className="form-check">
                          <input className="form-check-input" type="checkbox" value="p" id="checkbox-end-p" checked={pOnEndEnable} onChange={this.handlePOnEndCheck.bind(this)} />
                          <label className="form-check-label h5" htmlFor="checkbox-end-p">
                            P On-End
                          </label>
                        </div>
                      </div>
                      <div className="col-sm-4">
                        <div className="form-check">
                          <input className="form-check-input" type="checkbox" value="r" id="checkbox-end-r" checked={rOnEndEnable} onChange={this.handleROnEndCheck.bind(this)} />
                          <label className="form-check-label h5" htmlFor="checkbox-end-r">
                            QRS 
                            <br />
                            On-End
                          </label>
                        </div>
                      </div>
                      <div className="col-sm-4">
                        <div className="form-check">
                          <input className="form-check-input" type="checkbox" value="t" id="checkbox-end-t" checked={tOnEndEnable} onChange={this.handleTOnEndCheck.bind(this)} />
                          <label className="form-check-label h5" htmlFor="checkbox-end-t">
                            T On-End
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Status */}
              <div className="col-sm-4 gy-3">
                <div className="card bg-secondary border-light">
                  <label className="card-header">
                    Current Status
                  </label>
                  <div className="card-body">
                    
                  </div>
                </div>
              </div>
            </div>



            {/* ECG Diagram */}
            <div className="row">
              <div className="col-md-12 gy-3">
                <ECGDiagram data={data}/>
              </div>
            </div>
          </div>
        </header>
      </div>
    );
  }
}

export default App;
