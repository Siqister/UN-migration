import React, {Component} from 'react';
import {nest,mean,max} from 'd3';

import Chart from './Chart';

const fontStyle = {
	fontFamily: 'Playfair Display',
	fontWeight: '400',
	fontSize: '0.75rem',
	color:'#eee'
}

const chartContainerStyle = {
	position:'absolute',
	height:'144px',
	width:'100%',
	bottom:'0',
}

const chartContainerBodyStyle = {
	position:'absolute',
	height:'120px',
	width:'100%',
	bottom:'0',
	background:'#111'
}

class ChartContainer extends Component{

	constructor(props){

		super(props);

		this.state = {
			//pagination related
			page:0,
			chartWidth:144
		}
	
	}

	render(){

		const {width,data,countryCode,country,year} = this.props;
		const {page, chartWidth} = this.state;

		if(!data || !countryCode || !width){
			return null;
		}

		//compute derived data from props
		const dataByPartnerCountry = groupByCountry(data, country);
		const chartsPerPage = Math.floor(width/chartWidth);
		const maxPages = Math.ceil(dataByPartnerCountry.length/chartsPerPage);
		const chartsData = dataByPartnerCountry.slice(page * chartsPerPage, (page+1) * chartsPerPage);

		console.group('ChartContainer:render');
		console.log(countryCode);
		console.log(country);
		console.log(countryCode.get(country)); //TODO: not working yet

		console.log(`Render page ${page} of ${maxPages}, showing ${chartsPerPage} charts`);
		console.log(chartsData);
		console.groupEnd();

		return (
			<div 
				className='chart-container'
				style={chartContainerStyle}
			>
				<div 
					className='chart-container-top'
					style={{padding:'0 16px'}}
				>
					<h2 style={Object.assign({}, fontStyle, {fontSize:'1rem'})} >
						Migration to and from {countryCode.get(country)}:
					</h2>
				</div>
				<div 
					className='chart-container-body'
					style={chartContainerBodyStyle}
				>
					{chartsData.map(d => 
						<Chart 
							width={chartWidth}
							key={d.key}
							partner={d.key}
							country={country}
							max={chartsData[0].max}
							data={d.values}
						/>
					)}
				</div>
			</div>
		)

	}

}

//Utility function for generating derived data from OD pairs
const groupByCountry = (ODData, country) => {

	const ODDataTransformed = ODData.map(od => {
		let partnerCountry = od.destCode === country? od.origin : od.dest;
		let partnerCountryCode = od.destCode === country? od.originCode : od.destCode;
		return Object.assign({}, od, {partnerCountry, partnerCountryCode}); 	
	})

	return nest()
		.key(d => d.partnerCountryCode)
		.key(d => d.originCode)
		.entries(ODDataTransformed)
		.map(partner => {
			partner.mean = max(partner.values.map(series => mean(series.values, d => d.v)));
			partner.max = max(partner.values.map(series => max(series.values, d => d.v)));
			return partner;
		})
		.sort((a,b) => b.mean - a.mean);
}

export default ChartContainer;
