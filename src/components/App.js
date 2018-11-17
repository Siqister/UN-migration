import React, {Component} from 'react';
import uniq from 'lodash/uniq';

//Data utilities
import { 
	ODData,countryCode,countryName
} from '../utils';

//Components
import GLWrapper from './GLWrapper';
import Header from './Header';
import ChartContainer from './ChartContainer';
import Credits from './Credits';
import LoadingStatus from './LoadingStatus';

class App extends Component{

	constructor(props){

		super(props);

		this.state = {
			width: 0,
			height: 0,
			data: null,
			countryCode: null,
			countryName: null,
			country: 840, //Default to US
			year: 2017, //Default to 2017,
			isCreditsOpen: false,
			isDataLoading: true
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
		Promise.all([ODData, countryCode, countryName])
			.then(([data, countryCode, countryName]) => {
				this.setState({data, countryCode, countryName})
			});

	}

	render(){

		const {
			data,
			countryCode,
			countryName,
			country,
			year,
			width,height,
			isCreditsOpen,
			isDataLoading
		} = this.state;

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
					toggleCredits={() => { this.setState({isCreditsOpen:!this.state.isCreditsOpen}) }}
					isCreditsOpen={isCreditsOpen}
				/>
				<GLWrapper
					width={width}
					height={height}
					data={glData}
					country={country}
					onLoadingComplete={()=>{ this.setState({isDataLoading:false}) }}
				/>
				<ChartContainer
					width={width}
					data={chartData}
					countryName={this.state.countryName}
					country={country}
					year={year}
				/>
				<Credits isOpen={isCreditsOpen}/>
				{isDataLoading && <LoadingStatus />}
			</div>
		)

	}

}

export default App;