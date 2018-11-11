import React, {Component} from 'react';
import uniq from 'lodash/uniq';

//Data utilities
import { 
	ODData, countryCode
} from '../utils';

//Components
import GLWrapper from './GLWrapper';
import Header from './Header';
import ChartContainer from './ChartContainer';


class App extends Component{

	constructor(props){

		super(props);

		this.state = {
			width: 0,
			height: 0,
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
		Promise.all([ODData, countryCode])
			.then(([data, countryCode]) => {
				this.setState({data, countryCode})
			});

	}

	render(){

		const {data,countryCode,country,year,width,height} = this.state;

		//Compute derived data
		let chartData = null;
		let glData = null;
		let years = null;
		let countries = null;

		if(data){
			chartData = data.filter(d => d.originCode === country || d.destCode === country );
			glData = chartData.filter(d => d.year === year );
			years = uniq(data.map(d => d.year));
		}

		if(countryCode){
			countries = Array.from(countryCode.entries());
		}

		return (
			<div className='app' ref={ node => {this.appNode = node;}}>
				<Header 
					countries={countries}
					country={country}
					onCountryChange={country => { this.setState({country: +country}) }}
					years={years}
					year={year}
					onYearChange={year => { this.setState({year: +year}) }}
				/>
				<GLWrapper
					width={width}
					height={height}
					data={glData}
					country={country}
				/>
				<ChartContainer
					width={width}
					data={chartData}
					countryCode={countryCode}
					country={country}
					year={year}
				/>
			</div>
		)

	}

}

export default App;