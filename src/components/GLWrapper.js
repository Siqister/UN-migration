import React, {Component} from 'react';
import * as THREE from 'three';
import {extent,scaleLog,scaleLinear} from 'd3';
const OrbitControls = require('three-orbitcontrols');
const TWEEN = require('tween.js');

import {countryISO, countryJSON, generateSpline, project, zipJSON} from '../utils';

class GLWrapper extends Component{

	constructor(props){

		super(props);

		this._initScene = this._initScene.bind(this); 
		this._updateAttributes = this._updateAttributes.bind(this);
		this._animate = this._animate.bind(this);

		this.state = {
			//data states
			geojson: null,
			centroids: null,

			//animation states
			cameraLookat: [0,0,0]
		};

		//GL: state, used instead of react state to avoid unnecessary updating
		this.cameraPosition = [0,0,40];

		//GL: internal variables
		this.renderer = null;
		this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500); //default parameters
		this.scene = new THREE.Scene();
		this.orbitControls = null;
		//GL: meshes
		this.globeMesh = null;
		this.pathMesh = null;
		this.particles = null;

		//Constants and utilities
		this.R0 = 10; //radius of earth
		this.R1 = 22; //max radius of bezier curve control points
		this.splineGenerator = generateSpline(this.R0, this.R1);

		//Initialize meshes and add these to scene
		this._initScene();

		//Initialize tweens
		this.tween = {};
		this.tween.camera = new TWEEN.Tween(this.camera.position)
			.easing(TWEEN.Easing.Cubic.InOut)
			.onUpdate(() => {
				this.camera.lookAt(new THREE.Vector3(...this.state.cameraLookat));
			});

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

		//Init orbitControls
		//Requires DOM element
		this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
		this.orbitControls.enableDamping = true;
		this.orbitControls.dampingFactor = 0.5;
		this.orbitControls.enableZoom = false;

		//Start animation loop
		this._animate();

		//Make one-time request for geodata
		Promise.all([
			countryISO,
			countryJSON
		])
			.then(zipJSON)
			.then(([geojson, centroids]) => {
				this.setState({
					geojson,
					centroids
				});
			});

	}

	componentDidUpdate(prevProps, prevState){

		//Not called for initial render
		//Props (width, height, data, country) may be incomplete
		//DOM is just updated
		const {width, height, data, country} = this.props;
		const {cameraLookat, geojson, centroids} = this.state;

		console.group('GLWrapper : componentDidUpdate');
		console.log(width);
		console.log(height);
		console.log(data);
		console.log(geojson);
		console.log(centroids);
		console.groupEnd();

		//When props.width and props.height passed in, set renderer size
		if(width && height){
			this.renderer.setSize(width, height);

			this.camera.aspect = width/height;
			this.camera.position.fromArray(this.cameraPosition); 
			this.camera.updateProjectionMatrix();

		};

		//Regenerate line mesh
		//Requires: props.data (migration data), state.geojson, state.centroids
		//TODO: regeneration should only occur when data has changed
		if(data && geojson && centroids){
			//Generate splines
			const splines = data
				.map(d => [centroids.get(d.originCode), centroids.get(d.destCode)]) //Zip data (migration OD) with centroids
				.map(d => this.splineGenerator(...d)); //splines

			//Generate position attribute data for path
			const pathPositions = splines
				.map(spline => spline.getPoints(32-1))
				.reduce((acc,val) => acc.concat(val), []); //flatten

			//Generate position attribute data for particles
			//TODO
			const MAX_PARTICLE_PER_PATH = 32;
			const vRange = extent(data, d => d.v);
			const particle_per_path = scaleLog().domain(vRange).range([1,MAX_PARTICLE_PER_PATH]).clamp(true);
			const particlePositions = data.map((d,i) => {
					const spline = splines[i];
					const {p0,p1,c0,c1} = spline; //THREE.Vector3
					const {v:value} = d; //migration figure

					const n = Math.round(particle_per_path(value));
					return spline.getPoints(n);
				})
				.reduce((acc,val) => acc.concat(val), []);

			//Update this.pathMesh 
			const pathPositionAttribute = this.pathMesh.geometry.getAttribute('position');
			pathPositionAttribute.copyVector3sArray(pathPositions);
			pathPositionAttribute.needsUpdate = true;

			//Update this.particles
			const particlePositionAttribute = this.particles.geometry.getAttribute('position');
			particlePositionAttribute.copyVector3sArray(particlePositions);
			particlePositionAttribute.needsUpdate = true;
		}

		//Update camera location based on props.country
		if(centroids && country){
			const o = [45,-15];
			const c = centroids.get(country);
			//new camera location
			const cameraPosition = project(
				[c[0]+o[0], c[1]+o[1]], 
				40); //THREE.Vector3
			this.tween.camera
				.to(cameraPosition, 1000)
				.start();
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

		const {cameraLookat} = this.state;

		//Initialize camera
		this.scene.add(this.camera);
		this.camera.position.fromArray(this.cameraPosition);
		this.camera.lookAt(new THREE.Vector3(...cameraLookat));

		//SET UP MESHES
		//Set up this.globeMesh
		this.globeMesh = new THREE.Mesh(
			new THREE.SphereBufferGeometry(this.R0, 32, 32),
			new THREE.MeshNormalMaterial()
		);

		//Set up this.pathMesh
		const pathGeometry = new THREE.BufferGeometry();
		pathGeometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(255*32*3),3));
		this.pathMesh = new THREE.Line(
			pathGeometry,
			new THREE.LineBasicMaterial({
				color: 0xffffff,
				transparent: true,
				opacity: 0.2
			})
		);

		//Set up this.particles
		const particlesGeometry = new THREE.BufferGeometry();
		particlesGeometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(255*32*3),3));
		const particlesMaterial = new THREE.PointsMaterial({color: 0xffffff});
		particlesMaterial.size = 0.2;
		this.particles = new THREE.Points(
			particlesGeometry,
			particlesMaterial
		);

		this.scene.add(this.globeMesh);
		this.scene.add(this.pathMesh);
		this.scene.add(this.particles);

	}

	_updateAttributes(){

	}

	_animate(){

		this.renderer.render(
			this.scene,
			this.camera
		);

		TWEEN.update();

		requestAnimationFrame(this._animate);

	}

}

export default GLWrapper;