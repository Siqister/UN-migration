import React, {Component} from 'react';

//Data utilities
import { 
	ODData
} from '../utils';

//Components
import GLWrapper from './GLWrapper';


class App extends Component{

	constructor(props){

		super(props);

		this.state = {
			width: 0,
			height: 0,
			data: null,
			country: 422, //Default to US
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
		ODData.then(data => {
				this.setState({data});
			});

	}

	render(){

		const {data,country,year,width,height} = this.state;

		//Compute derived data
		let glData = null;
		if(data){
			glData = data.filter(d => 
				d.year === year && (d.originCode === country || d.destCode === country)
			);
		}

		return (
			<div className='app' ref={ node => {this.appNode = node;}}>
				<GLWrapper
					width={width}
					height={height}
					data={glData}
					country={country}
				/>
			</div>
		)

	}

}

export default App;