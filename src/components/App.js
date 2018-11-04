import React, {Component} from 'react';

//Data utilities
import { 
	migrationOriginDest,
	countryCode,
	transformToOD
} from '../utils';

//Components
import GLWrapper from './GLWrapper';


class App extends Component{

	constructor(props){

		super(props);

		this.state = {
			width: 0,
			height: 0,
			country: null,
			data: null,
			countryCode: null,
			country: 840, //Default to US
			year: 2017, //Default to 2017
		}

	}

	componentDidMount(){

		//Compute width and height from mounted DOM node
		this.setState({
			width: this.appNode.clientWidth,
			height: this.appNode.clientHeight
		});
		//Deal with resize
		window.addEventListener('resize', () => {
			this.setState({
				width: this.appNode.clientWidth,
				height: this.appNode.clientHeight
			});
		});

		//Request data
		Promise.all([
				migrationOriginDest,
				countryCode
			]).then(([data, countryCode]) => {
				this.setState({data, countryCode});
			});

	}

	render(){

		const {data,countryCode,country,year,width,height} = this.state;

		//Compute derived data
		const ODData = transformToOD(data, countryCode, country, year);

		return (
			<div className='app' ref={ node => {this.appNode = node;}}>
				<GLWrapper
					width={width}
					height={height}
					data={ODData}
					country={country}
				/>
			</div>
		)

	}

}

export default App;