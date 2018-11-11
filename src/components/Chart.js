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
		this.margin = {t:20,r:16,b:12,l:16}

		this.containerRef = null;
		this.axisRef = null;
		this.pathRef = {
			out:null,
			in:null
		}

	}

	componentDidMount(){

		const {max,data,country} = this.props;

		//Recompute visual attributes of all <svg> elements (without rerendering them)
		this.innerW = this.containerRef.clientWidth - this.margin.l - this.margin.r;
		this.innerH = this.containerRef.clientHeight - this.margin.t - this.margin.b;

		//Set scales and axes
		scaleX.domain([1990, 2017]).range([0, this.innerW]);
		scaleY.domain([0, max*1.2]).range([this.innerH, 0]);
		axisY.tickSize(-this.innerW);

		//Set visual attributes
		select(this.axisRef).call(axisY)
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
			if(+series.key === country){
				//origin = country i.e. outbound
				select(this.pathRef.out)
					//.transition()
					.attr('d', lineGenerator(series.values));
			}else{
				//origin = partner i.e. inbound
				select(this.pathRef.in)
					//.transition()
					.attr('d', lineGenerator(series.values));
			}
		});

	}

	render(){

		const {width,partner,country,max,data} = this.props;

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
							<path 
								className={`series ${+series.key === country?'out':'in'}`}
								key={series.key}
								style={pathStyle}
								ref={ref => {
									const inOut = `${+series.key === country?'out':'in'}`;
									this.pathRef[inOut] = ref;
								}}
							/>
						)}
					</g>
					<text 
						style={fontStyle}
						x={this.margin.l}
						y={this.margin.t}
						dy={4}
						fill='#eee'
					>
						{partner}
					</text>
				</svg>
			</div>
		)

	}

}

export default Chart;