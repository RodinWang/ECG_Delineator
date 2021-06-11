import './App.css';
import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';
import '@fortawesome/fontawesome-free/css/all.min.css'
import { btConnect, btDisconnected, btGetDataArray } from './ble';
import ECGDiagram from './ECGDiagram'
import { pushDataLowPassFilter14Hz, pushDatalowPassFilter40Hz } from './LowPassFilter';
import { OpeningFilter, ClosingFilter } from './MorphologicalFilter';

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
  ersion_test = null;

  constructor(props) {
    super(props);
    this.openingFilter = new OpeningFilter(60);
    this.closingFilter = new ClosingFilter(90);
    this.state = {
      ecgSignal: [],
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
					//console.log(fileEcgdata);
					//console.log(fileEcgdata[0][0]);
          // set timer for 500Hz
          this.timerId = setInterval(this.handleEcgDraw.bind(this), 2);
				};
			})(f);
			// read file
			reader.readAsText(f);
		}
  }

  handleEcgDraw(){
    const { ecgSignal } = this.state;

		if (this.dataIndex > 9999) {
			clearInterval(this.timerId);
      this.dataIndex = 0;
		}
		else {
      //console.log(fileEcgdata[0][this.dataIndex]);
		  //console.log(this.dataIndex);
			//drawEcgChart(fileEcgdata[0][this.dataIndex]);
      //ecgSignal.push(fileEcgdata[0][this.dataIndex]);
      //console.log(pushDatalowPassFilter40Hz(fileEcgdata[0][this.dataIndex]));
      var temp = pushDatalowPassFilter40Hz(fileEcgdata[0][this.dataIndex]);
      ecgSignal.push(this.closingFilter.pushData(this.openingFilter.pushData(temp)));
			this.dataIndex = this.dataIndex + 1;

      this.setState({ecgSignal: ecgSignal.slice()});
		}
	}

  // Save ECG Data
  saveRawEcgData()
	{
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

  render() {
    const { ecgSignal } = this.state;

    return (
      <div className="App">        
        <header className="App-header">
          <div className="container-fluid App-font">
          {/* <button type="button" className="btn btn-primary btn-sm" onClick={() => {
            let rand = Math.floor(Math.random()*10);
            console.log(rand)
            console.log(this.ersion_test.pushData(rand));
          }} /> */}
            {/* Button */}
            <div className="row">
              <div className="col-sm-1">
                <input type="file" className="btn btn-primary btn-sm" id="files" name="files[]" multiple ></input> 
              </div>
              <div className="col-sm-3" />
              <div className="col-sm-2">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => btConnect()}>
                  <span className="fas fa-bolt fa-lg" style={{color: 'white'}} > </span>
                  {"  Search BLE"}
                </button> 
              </div>
              <div className="col-sm-3">
                <button type="button" className="btn btn-danger btn-sm" onClick={() => btDisconnected()}>
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
                            <input className="form-check-input" type="checkbox" value="p" id="checkbox-peak-p" />
                            <label className="form-check-label h5" htmlFor="checkbox-peak-p">
                              P Peak
                            </label>
                          </div>
                        </div>
                        <div className="col-sm-4">
                          <div className="form-check">
                            <input className="form-check-input" type="checkbox" value="r" id="checkbox-peak-r" />
                            <label className="form-check-label h5" htmlFor="checkbox-peak-r">
                              QRS Complex
                            </label>
                          </div>
                        </div>
                        <div className="col-sm-4">
                          <div className="form-check">
                            <input className="form-check-input" type="checkbox" value="t" id="checkbox-peak-t" />
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
                          <input className="form-check-input" type="checkbox" value="p" id="checkbox-end-p" />
                          <label className="form-check-label h5" htmlFor="checkbox-end-p">
                            P On-End
                          </label>
                        </div>
                      </div>
                      <div className="col-sm-4">
                        <div className="form-check">
                          <input className="form-check-input" type="checkbox" value="r" id="checkbox-end-r" />
                          <label className="form-check-label h5" htmlFor="checkbox-end-r">
                            QRS 
                            <br />
                            On-End
                          </label>
                        </div>
                      </div>
                      <div className="col-sm-4">
                        <div className="form-check">
                          <input className="form-check-input" type="checkbox" value="t" id="checkbox-end-t" />
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
                <ECGDiagram data={ecgSignal}/>
              </div>
            </div>
          </div>
        </header>
      </div>
    );
  }
}

export default App;
