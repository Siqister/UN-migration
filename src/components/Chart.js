import React, {Component} from 'react';
import {scaleLinear,line,axisLeft,select} from 'd3';

const fontStyle = {
	fontFamily: 'Playfair Display',
	fontWeight: '400',
	fontSize: '0.75rem',
	color:'#eee'
}

const chartStyle = {
	float:'left',
	width:'128px',
	height:'100%',
}

const pathStyle = {
	fill:'none',
	stroke:'yellow',
	strokeWidth:'1.5px'
}

//Share line axis generators, and scales
const scaleX = scaleLinear();
const scaleY = scaleLinear();

const lineGenerator = line()
	.x(d => scaleX(d.year))
	.y(d => scaleY(d.v));

const axisY = axisLeft()
	.scale(scaleY)
	.ticks(3)
	.tickFormat(d => d/1000+'k');

class Chart extends Component{

	constructor(props){
		super(props);

		this.innerW = 0;
		this.innerH = 0;
		this.margin = {t:24,r:24,b:24,l:16}

		this.containerRef = null;
		this.axisRef = null;
		this.pathRef = {
			out:null,
			in:null
		};
		this.readoutRef = {
			out:null,
			in:null
		};

	}

	componentDidMount(){

		const {max,data,country} = this.props;

		//Recompute visual attributes of all <svg> elements (without rerendering them)
		this.innerW = this.containerRef.clientWidth - this.margin.l - this.margin.r;
		this.innerH = this.containerRef.clientHeight - this.margin.t - this.margin.b;

		this._updateSVGAttr();

	}

	componentDidUpdate(){
		this._updateSVGAttr();
	}

	render(){

		const {width,partner,partnerName,country,max,data} = this.props;

		return (
			<div 
				className='chart' 
				style={Object.assign({}, chartStyle, {width:`${width}px`})}
				ref={ref => this.containerRef = ref}
			>
				<svg
					width={width}
				>
					<g className='plot' transform={`translate(${this.margin.l},${this.margin.t})`}>
						<g className='axis-y' 
							ref={ref => this.axisRef = ref}
						/>
						{data.map(series => 
							<g key={series.key}>
								<path 
									className={`series ${+series.key === country?'out':'in'}`}
									style={pathStyle}
									ref={ref => {
										const inOut = `${+series.key === country?'out':'in'}`;
										this.pathRef[inOut] = ref;
									}}
								/>
								<g
									className={`readout ${+series.key === country?'out':'in'}`}
									ref={ref => {
										const inOut = `${+series.key === country?'out':'in'}`;
										this.readoutRef[inOut] = ref;
									}}
								>
									<circle r={4} style={{fill:'yellow', stroke:'#111', strokeWidth:'2px'}} />
									<text></text>
								</g>
							</g>
						)}
					</g>
					<text 
						style={fontStyle}
						x={this.margin.l}
						y={this.margin.t}
						dy={4}
						fill='#eee'
					>
						{partnerName}
					</text>
				</svg>
			</div>
		)

	}

	_updateSVGAttr(){

		const {max,data,country,year} = this.props;

		//Set scales and axes
		scaleX.domain([1990, 2017]).range([0, this.innerW]);
		scaleY.domain([0, max*1.2]).range([this.innerH, 0]);
		axisY.tickSize(-this.innerW);

		//Set visual attributes
		select(this.axisRef).transition().call(axisY);
		select(this.axisRef)
			.select('.domain').style('display','none')
			.select(function(){ return this.parentNode })
			.selectAll('line')
				.style('stroke','#666')
				.style('stroke-dasharray','2px 2px')
			.select(function(){ return this.parentNode })
			.selectAll('text')
				.style('fill','#666')
				.style('font-size','8px')
				.attr('text-anchor','start')
				.attr('dy', -5);

		data.forEach(series => {
			let path;
			let readout;

			if(+series.key === country){
				//origin = country i.e. outbound
				path = this.pathRef.out;
				readout = this.readoutRef.out;
			}else{
				//origin = partner i.e. inbound
				path = this.pathRef.in;
				readout = this.readoutRef.in;
			}

			select(path)
				.transition()
				.attr('d', lineGenerator(series.values));

			//get readout value
			const readoutValue = series.values.filter(d => d.year === year)[0];
			if(!readoutValue) return;
			console.log(readoutValue);

			select(readout)
				//.transition()
				.attr('transform', `translate(${scaleX(readoutValue.year)}, ${scaleY(readoutValue.v)})`);
			select(readout)
				.select('text')
				.text(readoutValue.v)
				.style('fill','#ccc')
				.style('font-size','8px')
				.attr('text-anchor','middle')
				.attr('dy', -5);

		});

	}

}

export default Chart;