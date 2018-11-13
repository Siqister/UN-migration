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
	height:'174px',
	width:'100%',
	bottom:'0',
}

const chartContainerBodyStyle = {
	position:'absolute',
	height:'150px',
	width:'100%',
	bottom:'0',
	//background:'#111'
}

const paginationIconStyle={
	width:'6px',
	height:'6px',
	position:'relative',
	top:'12px',
	transform:'translate(0,-50%)',
	borderRadius:'10px',
	margin:'0 2px',
	border:'1px solid #ccc',
	cursor:'pointer'
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

		const {width,data,countryName,country,year} = this.props;
		const {page, chartWidth} = this.state;

		if(!data || !countryName || !width){
			return null;
		}

		//compute derived data from props
		const dataByPartnerCountry = groupByCountry(data, country);
		const chartsPerPage = Math.floor(width/chartWidth);
		const maxPages = Math.ceil(dataByPartnerCountry.length/chartsPerPage);
		const chartsData = dataByPartnerCountry.slice(page * chartsPerPage, (page+1) * chartsPerPage);

		console.group('ChartContainer:render');
		console.log(countryName);
		console.log(country);
		console.log(countryName.get(country)); //TODO: not working yet

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
					<h2 style={Object.assign({}, fontStyle, {display:'inline'})} >
						Migration between {countryName.get(country)} and: 
					</h2>
					<div className='pagination' style={Object.assign({}, {float:'right'})}>
						{Array.from({length:maxPages}).map((d,i) =>
							<div 
								className='pagination-icon' 
								key={i} 
								style={Object.assign({}, paginationIconStyle, {background:i===page?'white':null})}
								onClick={e => this.setState({page:i})}
							>
							</div>
						)}
					</div>
				</div>
				<div 
					className='chart-container-body'
					style={chartContainerBodyStyle}
				>
					{chartsData.map((d,i) => 
						<Chart 
							width={chartWidth}
							key={i}
							partnerName={countryName.get(+d.key)}
							partner={d.key}
							country={country}
							max={chartsData[0].max}
							data={d.values}
							year={year}
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
