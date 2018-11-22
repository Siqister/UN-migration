import React, {Component} from 'react';
import {scaleLinear,area,axisLeft,select} from 'd3';

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
	background:'rgba(0,0,0,0)',
	transition:'all .2s'
}

const pathStyle = {
	fillOpacity:.8
}

const readoutCircleStyle = {
	fill:'none', 
	stroke:'#111', 
	strokeWidth:'2px'
}

const colors = {
	out:'yellow',
	in:'#00E0FF'
}

//Shared line + axis generators, and scales
const scaleX = scaleLinear();
const scaleYTop = scaleLinear();
const scaleYBottom = scaleLinear();

const lineGenerator = area()
	.x(d => scaleX(d.year));

const axisYTop = axisLeft()
	.scale(scaleYTop)
	.ticks(2)
	.tickFormat(d => d/1000+'k');
const axisYBottom = axisLeft()
	.scale(scaleYBottom)
	.ticks(2)
	.tickFormat(d => d/1000+'k');


class Chart extends Component{

	constructor(props){
		super(props);

		this.margin = {t:40,r:24,b:24,l:16}
		this.containerRef = null;
		this.axisRef = {
			out:null, //top
			in:null //bottom
		};
		this.pathRef = {
			out:null,
			in:null
		};
		this.readoutRef = {
			out:null,
			in:null
		};

		this.state = {
			innerW: 0,
			innerH: 0,
			currentHeight: 0,
			expandedHeight: 400,
			expanded: false
		}

		this._onMouseenter = this._onMouseenter.bind(this);
		this._onMouseleave = this._onMouseleave.bind(this);

	}

	componentDidMount(){

		const {max,data,country,width,height} = this.props;

		//Recompute visual attributes of all <svg> elements
		this.setState({
			innerW: width - this.margin.l - this.margin.r,
			innerH: height - this.margin.t - this.margin.b,
			currentHeight: height
		});

		//Update SVG attributes
		this._updateSVGAttr();

	}

	componentDidUpdate(){
		this._updateSVGAttr();
	}

	render(){

		const {width,height,partner,partnerName,country,max,data} = this.props;
		const {innerW,innerH,expanded,currentHeight} = this.state;

		return (
			<div 
				className='chart' 
				style={Object.assign({}, chartStyle, {
					width:`${width}px`,
					transform:`translate(0,${height - currentHeight}px)`,
					height:`${currentHeight}px`, 
					background:expanded?'#111':null
				})}
				ref={ref => this.containerRef = ref}
				onMouseEnter={this._onMouseenter}
				onMouseLeave={this._onMouseleave}
			>
				<svg width={width} height={currentHeight}>
					<g className='plot' transform={`translate(${this.margin.l},${this.margin.t})`} >
						<g className='top out' transform={`translate(0, 0)`}>
							<path
								className='series out'
								style={Object.assign({}, pathStyle, {
									fill:colors.out,
									fillOpacity:expanded?1.0:0.8
								})}
								ref={ref => this.pathRef.out = ref}
							/>
							<g className='axis-y axis-y-top' ref={ref => this.axisRef.out = ref} />
						</g>
						<g className='bottom in' transform={`translate(0, ${innerH/2})`}>
							<path
								className='series in'
								style={Object.assign({}, pathStyle, {
									fill:colors.in,
									fillOpacity:expanded?1.0:0.8
								})}
								ref={ref => this.pathRef.in = ref}
							/>
							<g className='axis-y axis-y-bottom' ref={ref => this.axisRef.in = ref} />
						</g>
						<g className='readout-container top out' transform={`translate(0, 0)`}>
							<g
								className='readout out'
								ref={ref => this.readoutRef.out = ref}
							>
								<circle r={4} style={Object.assign({}, readoutCircleStyle, {fill:colors.out,})} /> 
								<text dy={-10}/>
							</g>
						</g>
						<g className='readout-container bottom in' transform={`translate(0, ${innerH/2})`}>
							<g
								className='readout in'
								ref={ref => this.readoutRef.in = ref}
							>
								<circle r={4} style={Object.assign({}, readoutCircleStyle, {fill:colors.in})} /> 
								<text dy={15}/>
							</g>
						</g>
					</g>
					<text 
						style={fontStyle}
						x={this.margin.l}
						y={this.margin.t - 16}
						dy={4}
						fill='#eee'
					>
						{partnerName}
					</text>
				</svg>
			</div>
		)

	}

	_onMouseenter(){
		const targetHeight = this.state.expandedHeight;
		this.setState({
			innerH: targetHeight - this.margin.t - this.margin.b,
			currentHeight: targetHeight,
			expanded: true
		});
	}

	_onMouseleave(){
		const targetHeight = this.props.height;
		this.setState({
			innerH: targetHeight - this.margin.t - this.margin.b,
			currentHeight: targetHeight,
			expanded: false
		});
	}

	_updateSVGAttr(){

		const {max,data,country,year} = this.props;
		const {innerW, innerH, expanded} = this.state;

		//Set scales and axes
		scaleX.domain([1990, 2017]).range([0, innerW]);
		scaleYTop.domain([0, max*1.2]).range([innerH/2, 0]);
		scaleYBottom.domain([0, max*1.2]).range([0, innerH/2]);
		axisYTop.tickSize(-innerW).ticks(expanded?4:2);
		axisYBottom.tickSize(-innerW).ticks(expanded?4:2);

		//Set visual attributes
		//Axes
		select(this.axisRef.out).transition().call(axisYTop);
		select(this.axisRef.out).call(this._setAxisStyle);
		select(this.axisRef.in).transition().call(axisYBottom);
		select(this.axisRef.in).call(this._setAxisStyle);

		//Series and readout
		data.forEach(series => {
			let path;
			let readout;
			let scaleY;

			if(+series.key === country){
				//origin = country i.e. out
				path = this.pathRef.out;
				readout = this.readoutRef.out;
				scaleY = scaleYTop;
				lineGenerator
					.y0(innerH/2)
					.y1(d => scaleY(d.v));
			}else{
				//origin = partner i.e. inbound
				path = this.pathRef.in;
				readout = this.readoutRef.in;
				scaleY = scaleYBottom;
				lineGenerator
					.y0(0)
					.y1(d => scaleY(d.v));
			}

			select(path)
				.transition()
				.attr('d', lineGenerator(series.values));

			//get readout value
			const readoutValue = series.values.filter(d => d.year === year)[0];
			if(!readoutValue) return;

			select(readout)
				.attr('transform', `translate(${scaleX(readoutValue.year)}, ${scaleY(readoutValue.v)})`)
				.select('text')
				.text(readoutValue.v)
				.style('fill','#ccc')
				.style('font-size','8px')
				.attr('text-anchor','middle');

		});

	}

	_setAxisStyle(selection){
		selection
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
	}

}

export default Chart;