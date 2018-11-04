import React, {Component} from 'react';
import * as THREE from 'three';

import {countryISO, countryJSON} from '../utils';

class GLWrapper extends Component{

	constructor(props){

		super(props);

		this._initScene = this._initScene.bind(this); //TODO: remove
		this._animate = this._animate.bind(this);

		this.state = {
			cameraPosition: [0,0,30],
			cameraLookat: [0,0,0]
		};

		//GL: internal variables, meshes, and GL-specific state
		this.renderer = null;
		this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500); //default parameters
		this.scene = new THREE.Scene();

		this.globeMesh = null;

		this.RADIUS = 10;

		this._initScene(); //TODO: remove

	}

	componentDidMount(){

		//componentDidMount: initial component mount
		//Props (width, height, data, country) not complete yet
		//Initialize WebGL environment from mounted canvas
		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvasNode,
			antialias: true,
			alpha: true
		});
		this.renderer.setClearColor(0x000);

		//Start animation loop
		this._animate();

		//Make initial request for geo data
		Promise.all([
			countryISO,
			countryJSON
		]).then(([iso, json]) => {
			//zip the two
			
		})

	}

	componentDidUpdate(prevProps, prevState){

		//Not called for initial render
		//Props (width, height, data, country) may be incomplete
		//DOM is just updated
		const {width, height, data, country} = this.props;
		const {cameraPosition} = this.state;

		console.group('GLWrapper : componentDidUpdate');
		console.log(width);
		console.log(height);
		console.log(data);
		console.log(country);
		console.groupEnd();

		//When props.width and props.height passed in, set renderer size
		if(width && height){
			this.renderer.setSize(width, height);

			this.camera.aspect = width/height;
			this.camera.position.fromArray(cameraPosition); 
			this.camera.updateProjectionMatrix();

		};

		//When props.data and props.country are updated, regenerate mesh
		if(data !== prevProps.data || country !== prevProps.country){
			console.log('Regenerate mesh');
		}

	}

	render(){

		const {width, height} = this.props;

		return(
			<div className='gl-wrapper'>
				<canvas
					width={width}
					height={height}
					ref={node => {this.canvasNode = node}}
				/>
			</div>
		);

	}

	_initScene(){

		this.globeMesh = new THREE.Mesh(
			new THREE.SphereBufferGeometry(this.RADIUS, 32, 32),
			new THREE.MeshNormalMaterial()
		);

		this.scene.add(this.globeMesh);

	}

	_animate(){

		this.renderer.render(
			this.scene,
			this.camera
		);

		requestAnimationFrame(this._animate);

	}

}

export default GLWrapper;