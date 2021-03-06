import React, {Component} from 'react';
import * as THREE from 'three';
import {extent,scaleLog,scaleLinear} from 'd3';
import uniq from 'lodash/uniq';
const OrbitControls = require('three-orbitcontrols');
const TWEEN = require('tween.js');

import {
	countryISO, 
	countryJSON, 
	generateSpline, 
	project, 
	zipJSON, 
	renderMap,
	colorToNum
} from '../utils';
import {
	globeVS, globeFS,
	particleVS, particleFS, 
	quadVS, finalPassFS, particlesPassFS} from '../shaders';

import particleTexture from '../spark1.png';

import Tooltip from './Tooltip';

class GLWrapper extends Component{

	constructor(props){

		super(props);

		this._initScene = this._initScene.bind(this); 
		this._generateParticleData = this._generateParticleData.bind(this);
		this._updatePaths = this._updatePaths.bind(this);
		this._updateParticles = this._updateParticles.bind(this);
		this._animate = this._animate.bind(this);
		this._onMousemove = this._onMousemove.bind(this);
		this._highlightTarget = this._highlightTarget.bind(this);

		this.state = {
			//data states
			geojson: null,
			centroids: null,

			//animation states
			cameraLookat: [0,0,0],

			//related to mouse interaction
			mouseX: null,
			mouseY: null,
			targetCountryCode: null
		};

		//Store a reference to particleData
		this.particleData = null;

		//GL animation state, used instead of react state to avoid unnecessary updating
		this.cameraPosition = [0,0,40];

		//GL: internal variables
		this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500); //default parameters
		this.orbitControls = null;
		//4x WebGL render targets and 1x WebGL renderer
		this.renderTargetGlobe = new THREE.WebGLRenderTarget(0,0);
		this.renderTargetPicking = new THREE.WebGLRenderTarget(0,0);
		this.renderTargetParticle = new THREE.WebGLRenderTarget(0,0);
		this.tempFBO = [
			new THREE.WebGLRenderTarget(0,0),
			new THREE.WebGLRenderTarget(0,0)
		];
		this.currentCompositeTargetIdx = 0;
		//4x scenes (1 for path+globe, 1 for current particles, 1 for particle pass, 1 for final compositing)
		this.sceneGlobe = new THREE.Scene();
		this.sceneGlobePicking = new THREE.Scene();
		this.sceneParticles = new THREE.Scene();
		this.sceneParticlesPass = new THREE.Scene();
		this.sceneFinalPass = new THREE.Scene();
		//GL: meshes
		this.globeMesh = null;
		this.pathMesh = null;
		this.particles = null;
		this.particlesPassQuad = null; 
		this.finalPassQuad = null;

		//Canvas and texture for rendering globe texture
		this.canvasWorld = document.createElement('canvas');
		this.canvasWorld.width = 4096;
		this.canvasWorld.height = 2048;
		this.canvasWorldCtx = this.canvasWorld.getContext('2d');
		this.canvasWorldTexture = new THREE.CanvasTexture(this.canvasWorld);

		//Canvas and texture for rendering picking texture
		this.canvasPicking = document.createElement('canvas');
		this.canvasPicking.width = 4096;
		this.canvasPicking.height = 2048;
		this.canvasPickingCtx = this.canvasPicking.getContext('2d');
		this.canvasPickingTexture = new THREE.CanvasTexture(this.canvasPicking);

		//Constants and utilities
		this.R0 = 10; //radius of earth
		this.R1 = 22; //max radius of bezier curve control points
		this.MAX_PARTICLE_PER_PATH = 16;
		this.MAX_PATH = 255;
		this.splineGenerator = generateSpline(this.R0, this.R1);

		//Initialize meshes and add these to scene
		this._initScene();

		//Initialize tweens
		this.tween = {};
		this.tween.camera = new TWEEN.Tween(this.camera.position)
			.easing(TWEEN.Easing.Cubic.InOut)
			.onUpdate(() => {
				this.cameraPosition = this.camera.position.toArray();
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

				this.props.onLoadingComplete();
			});

	}

	componentDidUpdate(prevProps, prevState){

		//Not called for initial render, but subsequent DOM updates

		//This is where to update GL state
		const {width, height, data, country} = this.props;
		const {cameraLookat, geojson, centroids} = this.state;

		console.groupCollapsed('GLWrapper : componentDidUpdate');
		console.log(width);
		console.log(height);
		console.log(data);
		console.log(geojson);
		console.log(centroids);
		console.groupEnd();

		//When props.width and props.height are changed, change render target size and update camera aspect
		if(width && height){
			this.renderer.setSize(width, height);
			this.renderTargetGlobe.setSize(width, height);
			this.renderTargetPicking.setSize(width, height);
			this.renderTargetParticle.setSize(width, height);
			this.tempFBO.forEach(target => {
				target.setSize(width, height);
			});

			this.camera.aspect = width/height;
			this.camera.updateProjectionMatrix();

		};

		//When props.data changes
		//When props.data becomes available, update webgl attributes
		if(data && centroids && (data !== prevProps.data)){
			//Generate unique array of destinations
			const destCodes = uniq(
				data.map(od => od.originCode === country?od.destCode:od.originCode)
			);
			const originCentroid = centroids.get(country);

			//Generate a map of splines for each destination from origin country
			const splines = new Map(
				destCodes.map(destCode => [destCode, this.splineGenerator(originCentroid, centroids.get(destCode))])
			);
			
			//Generate position attribute data for this.pathMesh from splines
			const pathPositions = Array.from(splines.values())
				.filter(d => !!d)
				.map(spline => spline.getPoints(32-1))
				.reduce((acc,val) => acc.concat(val), []);

			//Generate attributes for this.particles
			this.particleData = this._generateParticleData(data, splines);

			this._updatePaths(pathPositions);
			this._updateParticles(this.particleData);
		}

		//When props.country changes...
		//Update camera location based on props.country
		if(centroids && country && (country !== prevProps.country)){
			const o = [35,-12];
			const c = centroids.get(country);
			//new camera location
			const cameraPosition = project(
				[c[0]+o[0], c[1]+o[1]], 
				40); //THREE.Vector3
			this.tween.camera
				.to(cameraPosition, 1000)
				.start();
		}

		//When geojson is first loaded...
		//Redraw canvas-based textures
		if(geojson && (!prevState.geojson)){
			//TODO: do this offscreen
			renderMap(this.canvasWorldCtx, geojson);
			this.canvasWorldTexture.needsUpdate = true;

			renderMap(this.canvasPickingCtx, geojson, true);
			this.canvasPickingTexture.needsUpdate = true;
		}

	}

	render(){

		const {width, height, countryName} = this.props;
		const {mouseX, mouseY, targetCountryCode} = this.state;

		return(
			<div className='gl-wrapper'>
				<canvas
					width={width}
					height={height}
					ref={node => {this.canvasNode = node}}
					onMouseMove={this._onMousemove}
				/>
				{targetCountryCode&&<Tooltip 
					x={mouseX}
					y={mouseY}
					countryName={countryName.get(targetCountryCode)}
				/>}
			</div>
		);

	}

	_initScene(){

		//Initialize scenes, camera, and meshes; runes only once on component constructor
		//Subsequent component updates will only modify the attributes of these meshes

		const {cameraLookat} = this.state;

		//Initialize camera
		this.camera.position.fromArray(this.cameraPosition);
		this.camera.lookAt(new THREE.Vector3(...cameraLookat));

		//Set up this.globeMesh and this.globeMeshPicking
		this.globeMesh = new THREE.Mesh(
			new THREE.SphereBufferGeometry(this.R0, 32, 32),
			new THREE.ShaderMaterial({
				vertexShader:globeVS,
				fragmentShader:globeFS,
				uniforms:{
					uUseTexture:{value:0.0},
					uUsePickingTexture:{value:0.0},
					tSampler:{value:this.canvasWorldTexture},
					tPickingTexture:{value:this.canvasPickingTexture}
				}
			})
		);

		this.globeMeshPicking = this.globeMesh.clone();
		this.globeMeshPicking.material.uniforms.uUseTexture.value = 1.0;
		this.globeMeshPicking.material.uniforms.uUsePickingTexture.value = 1.0;

		//Set up this.pathMesh
		const pathGeometry = new THREE.BufferGeometry();
		pathGeometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(255*32*3),3));
		this.pathMesh = new THREE.Line(
			pathGeometry,
			new THREE.LineBasicMaterial({
				color: 0xffffff,
				transparent: true,
				opacity: 0.15
			})
		);

		//Set up this.particles
		const NUM_PARTICLES = this.MAX_PARTICLE_PER_PATH * this.MAX_PATH;
		const particlesGeometry = new THREE.BufferGeometry();
		particlesGeometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(NUM_PARTICLES*3),3));
		particlesGeometry.addAttribute('p0', new THREE.BufferAttribute(new Float32Array(NUM_PARTICLES*3), 3));
		particlesGeometry.addAttribute('p1', new THREE.BufferAttribute(new Float32Array(NUM_PARTICLES*3), 3));
		particlesGeometry.addAttribute('c0', new THREE.BufferAttribute(new Float32Array(NUM_PARTICLES*3), 3));
		particlesGeometry.addAttribute('c1', new THREE.BufferAttribute(new Float32Array(NUM_PARTICLES*3), 3));
		particlesGeometry.addAttribute('t', new THREE.BufferAttribute(new Float32Array(NUM_PARTICLES*1), 1));
		particlesGeometry.addAttribute('size', new THREE.BufferAttribute(new Float32Array(NUM_PARTICLES*1), 1));
		particlesGeometry.addAttribute('color', new THREE.BufferAttribute(new Float32Array(NUM_PARTICLES*3), 3));
		const particlesMaterial = new THREE.RawShaderMaterial({
			vertexShader: particleVS,
			fragmentShader: particleFS,
			blending: THREE.AdditiveBlending,
			uniforms:{
				tOffset: {value: 0.0},
				texture: {value: new THREE.TextureLoader().load(particleTexture)}
			}
		});
		this.particles = new THREE.Points(
			particlesGeometry,
			particlesMaterial
		);

		//Set up this.finalPassQuad
		const quadGeometry = new THREE.BufferGeometry();
  	quadGeometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array([-1,-1,-1,1,1,1,1,-1]), 2));
  	quadGeometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array([0,0,0,1,1,1,1,0]), 2));
  	quadGeometry.setIndex(new THREE.BufferAttribute(new Uint16Array([3,1,0,3,2,1]),1));
  	
  	const finalPassQuadMaterial = new THREE.RawShaderMaterial({
  		vertexShader: quadVS,
  		fragmentShader: finalPassFS,
  		uniforms:{
  			tGlobe: {value: this.renderTargetGlobe.texture },
  			tParticleComposite: {value: this.tempFBO[0].texture },
  		}
  	});
  	this.finalPassQuad = new THREE.Mesh(
  		quadGeometry,
  		finalPassQuadMaterial
  	);

  	//Set up this.particlesPassQuad
  	const particlesPassQuadMaterial = new THREE.RawShaderMaterial({
  		vertexShader: quadVS,
  		fragmentShader: particlesPassFS,
  		uniforms:{
  			tCurrent: {value: this.renderTargetParticle.texture },
  			tPrev: {value: this.tempFBO[1].texture }
  		}
  	});
  	this.particlesPassQuad = new THREE.Mesh(
  		quadGeometry,
  		particlesPassQuadMaterial
  	);

		//Initialize scenes with the correct meshes
		//globe and path
		this.sceneGlobe.add(this.globeMesh);
		this.sceneGlobe.add(this.pathMesh);
		this.sceneGlobePicking.add(this.globeMeshPicking);
		//particles
		this.sceneParticles.add(this.globeMesh.clone());
		this.sceneParticles.add(this.particles);
		//Pos processing passes
		this.sceneParticlesPass.add(this.particlesPassQuad);
		this.sceneFinalPass.add(this.finalPassQuad);
	}

	_updatePaths(pathPositions){
		//Update this.pathMesh 
		const pathPositionAttribute = this.pathMesh.geometry.getAttribute('position');
		pathPositionAttribute.copyVector3sArray(pathPositions);
		pathPositionAttribute.needsUpdate = true;

		//After updating attributes, update draw range
		this.pathMesh.geometry.setDrawRange(0, pathPositions.length);
	}

	_updateParticles(particleData, updatePosition=true, updateSpline=true, updateT=true, updateSize=true, updateColor=true){
		//Update this.particles
		if(updatePosition){
			const particlePositions = particleData.map(d => d.position);
			const particlePositionAttribute = this.particles.geometry.getAttribute('position');
			particlePositionAttribute.copyVector3sArray(particlePositions);
			particlePositionAttribute.needsUpdate = true;
		}

		if(updateSpline){
			const particleP0 = particleData.map(d => d.p0);
			const particleP0Attribute = this.particles.geometry.getAttribute('p0');
			particleP0Attribute.copyVector3sArray(particleP0);
			particleP0Attribute.needsUpdate = true;

			const particleP1 = particleData.map(d => d.p1);
			const particleP1Attribute = this.particles.geometry.getAttribute('p1');
			particleP1Attribute.copyVector3sArray(particleP1);
			particleP1Attribute.needsUpdate = true;

			const particleC0 = particleData.map(d => d.c0);
			const particleC0Attribute = this.particles.geometry.getAttribute('c0');
			particleC0Attribute.copyVector3sArray(particleC0);
			particleC0Attribute.needsUpdate = true;

			const particleC1 = particleData.map(d => d.c1);
			const particleC1Attribute = this.particles.geometry.getAttribute('c1');
			particleC1Attribute.copyVector3sArray(particleC1);
			particleC1Attribute.needsUpdate = true;
		}

		if(updateT){
			const particleT = particleData.map(d => d.t);
			const particleTAttribute = this.particles.geometry.getAttribute('t');
			particleTAttribute.copyArray(particleT);
			particleTAttribute.needsUpdate = true;
		}

		if(updateSize){
			const particleSize = particleData.map(d => d.size);
			const particleSizeAttribute = this.particles.geometry.getAttribute('size');
			particleSizeAttribute.copyArray(particleSize);
			particleSizeAttribute.needsUpdate = true;
		}

		if(updateColor){
			const particleColor = particleData.map(d => [d.color.r, d.color.g, d.color.b]).reduce((acc,val) => acc.concat(val), [])
			const particleColorAttribute = this.particles.geometry.getAttribute('color');
			particleColorAttribute.copyArray(particleColor);
			particleColorAttribute.needsUpdate = true;
		}
		
		//After updating attributes, update draw range
		this.particles.geometry.setDrawRange(0, particleData.length);
	}

	_animate(){

		//Perform individual render passes
		//First pass renders globe and lines
		this.globeMesh.material.uniforms.uUseTexture.value = 1.0;
		this.globeMesh.material.uniforms.uUsePickingTexture.value = 0.0;
		this.renderer.render(
			this.sceneGlobe,
			this.camera,
			this.renderTargetGlobe,
			true
		);

		//Second pass renders current particles
		this.globeMesh.material.uniforms.uUseTexture.value = 0.0;
		this.renderer.render(
			this.sceneParticles,
			this.camera,
			this.renderTargetParticle,
			true
		);

		//Compose current particles and past particles into composite particles
		const compositeTarget = this.tempFBO[this.currentCompositeTargetIdx];
		const prevTarget = this.tempFBO[(this.currentCompositeTargetIdx+1)%2];

		this.particlesPassQuad.material.uniforms.tPrev.value = prevTarget.texture;
		this.renderer.render(
			this.sceneParticlesPass,
			this.camera,
			compositeTarget,
			true
		);

		//Compose globe and particles
		this.finalPassQuad.material.uniforms.tParticleComposite.value = compositeTarget.texture;
		this.renderer.render(
			this.sceneFinalPass,
			this.camera
		);

		//Finally, flip the two tempFBO
		this.currentCompositeTargetIdx = (this.currentCompositeTargetIdx + 1)%2;

		//Update time-based uniform values
		this.particles.material.uniforms.tOffset.value = Date.now()/6000%1;

		//Update TWEEN
		TWEEN.update();

		requestAnimationFrame(this._animate);

	}

	_onMousemove(e){

		const pixelBuffer = new Uint8Array(4);
		const x = e.clientX;
		const y = e.clientY;

		//Render picking scene
		this.globeMesh.material.uniforms.uUseTexture.value = 1.0;
		this.globeMesh.material.uniforms.uUsePickingTexture.value = 1.0;
		this.renderer.render(
			this.sceneGlobePicking,
			this.camera,
			this.renderTargetPicking,
			true
		);

		//Read color buffer value
		this.renderer.readRenderTargetPixels(
			this.renderTargetPicking,
			x, this.renderTargetPicking.height-y,
			1,1,
			pixelBuffer);

		//Reverse engineer country code from color buffer value
		const targetCountryCode = colorToNum(pixelBuffer[0], pixelBuffer[1], pixelBuffer[2]);
		
		if(targetCountryCode > 0){
			this._highlightTarget(targetCountryCode);

			this.setState({
				mouseX: x,
				mouseY: y,
				targetCountryCode
			});
		}
		//this.setState({targetCountryCode});
		
	}

	_highlightTarget(code){

		if(!this.particleData) return;
		
		//Update the corresponding size attribute of the particles
		this.particleData.forEach(p => {
			p.size = p.triggeredBy===code?20.0:2.0
		});

		this._updateParticles(
				this.particleData,
				false,
				false,
				false,
				true, //only update size attribute
				false
			);
	}

	_generateParticleData(data, splines){

		const {country} = this.props;

		const particlesPerPath = scaleLinear()
			.domain(extent(data, d => d.v))
			.range([3, this.MAX_PARTICLE_PER_PATH])
			.clamp(true);

		return data.map(od => {

				const nParticles = particlesPerPath(od.v);
				
				//For each od pair...
				if(od.originCode === country){
					//particles leaving from origin country
					const spline = splines.get(od.destCode);
					if(!spline) return;

					return Array.from({length:nParticles}).map((d,i) => ({
						p0:spline.p0,
						p1:spline.p1,
						c0:spline.c0,
						c1:spline.c1,
						t: 1/nParticles * i,
						position: spline.getPoint(1/nParticles * i),
						size:2.0,
						color:new THREE.Color(0xffff00),
						triggeredBy:od.destCode
					}));

				}else{
					//particles entering origin country
					const spline = splines.get(od.originCode);
					if(!spline) return;
					
					//Note how we flip p0, p1, c0, and c1
					return Array.from({length:nParticles}).map((d,i) => ({
						p0:spline.p1,
						p1:spline.p0,
						c0:spline.c1,
						c1:spline.c0,
						t: 1/nParticles * i,
						position: spline.getPoint(1/nParticles * i),
						size:2.0,
						color:new THREE.Color(0x00e0ff),
						triggeredBy:od.originCode
					}));
				}

			})
			.filter(od => !!od)
			.reduce((acc,val) => acc.concat(val), []);

	}

}

export default GLWrapper;