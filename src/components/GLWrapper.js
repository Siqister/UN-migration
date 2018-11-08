import React, {Component} from 'react';
import * as THREE from 'three';
import {extent,scaleLog,scaleLinear} from 'd3';
const OrbitControls = require('three-orbitcontrols');
const TWEEN = require('tween.js');

const OffscreenCanvasWorker = require('worker-loader!../offscreenCanvasWorker');

import {countryISO, countryJSON, generateSpline, project, zipJSON, renderMap} from '../utils';
import {
	globeVS, globeFS,
	particleVS, particleFS, 
	quadVS, finalPassFS, particlesPassFS} from '../shaders';

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

		//GL animation state, used instead of react state to avoid unnecessary updating
		this.cameraPosition = [0,0,40];

		//GL: internal variables
		this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500); //default parameters
		this.orbitControls = null;
		//4x WebGL render targets and 1x WebGL renderer
		this.renderTargetGlobe = new THREE.WebGLRenderTarget(0,0);
		this.renderTargetParticle = new THREE.WebGLRenderTarget(0,0);
		this.tempFBO = [
			new THREE.WebGLRenderTarget(0,0),
			new THREE.WebGLRenderTarget(0,0)
		];
		this.currentCompositeTargetIdx = 0;
		//4x scenes (1 for path+globe, 1 for current particles, 1 for particle pass, 1 for final compositing)
		this.sceneGlobe = new THREE.Scene();
		this.sceneParticles = new THREE.Scene();
		this.sceneParticlesPass = new THREE.Scene();
		this.sceneFinalPass = new THREE.Scene();
		//GL: meshes
		this.globeMesh = null;
		this.pathMesh = null;
		this.particles = null;
		this.particlesPassQuad = null; 
		this.finalPassQuad = null;

		//Canvas for rendering globe textures
		this.canvasWorld = document.createElement('canvas');
		this.canvasWorld.width = 4096;
		this.canvasWorld.height = 2048;
		this.canvasWorldCtx = this.canvasWorld.getContext('2d');
		this.canvasWorldTexture = new THREE.CanvasTexture(this.canvasWorld);

		//Constants and utilities
		this.R0 = 10; //radius of earth
		this.R1 = 22; //max radius of bezier curve control points
		this.MAX_PARTICLE_PER_PATH = 32;
		this.MAX_PATH = 255;
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
			this.renderTargetGlobe.setSize(width, height);
			this.renderTargetParticle.setSize(width, height);
			this.tempFBO.forEach(target => {
				target.setSize(width, height);
			});

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
				.map(d => this.splineGenerator(...d)); 

			//Generate position attribute data for this.pathMesh from splines
			const pathPositions = splines
				.map(spline => spline.getPoints(32-1))
				.reduce((acc,val) => acc.concat(val), []); //flatten

			//Generate attributes for this.particles
			const vRange = extent(data, d => d.v);
			const particlesPerPath = scaleLinear()
				.domain(vRange)
				.range([3, this.MAX_PARTICLE_PER_PATH])
				.clamp(true);
			const particleData = data.map((od,i) => {
					const spline = splines[i];
					const {p0,p1,c0,c1} = spline; //THREE.Vector3
					const {v:value} = od; //migration figure
					const n = Math.round(particlesPerPath(value));
					
					return Array.from({length:n}).map((d,j) => {
						const t = 1/n * j;
						return {
							p0,p1,c0,c1,
							t,
							position: spline.getPoint(t)
						}
					});
				})
				.reduce((acc,val) => acc.concat(val), []);

			this._updateAttributes(pathPositions, particleData);

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

		//Redraw canvas-based textures
		if(geojson){
			//Render world map to this.canvasWorld
			//Also updates this.canvasWorldTexture
			//TODO: do this offscreen
			renderMap(this.canvasWorldCtx, geojson);
			this.canvasWorldTexture.needsUpdate = true;
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

		//Initialize scenes, camera, and meshes; runes only once on component constructor
		//Subsequent component updates will only modify the attributes of these meshes

		const {cameraLookat} = this.state;

		//Initialize camera
		this.camera.position.fromArray(this.cameraPosition);
		this.camera.lookAt(new THREE.Vector3(...cameraLookat));

		//Set up this.globeMesh
		this.globeMesh = new THREE.Mesh(
			new THREE.SphereBufferGeometry(this.R0, 32, 32),
			new THREE.ShaderMaterial({
				vertexShader:globeVS,
				fragmentShader:globeFS,
				uniforms:{
					uUseTexture:{value:0.0},
					tSampler:{value:this.canvasWorldTexture}
				}
			})
		);

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
		const particlesGeometry = new THREE.BufferGeometry();
		particlesGeometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(255*32*3),3));
		particlesGeometry.addAttribute('p0', new THREE.BufferAttribute(new Float32Array(255*32*3), 3));
		particlesGeometry.addAttribute('p1', new THREE.BufferAttribute(new Float32Array(255*32*3), 3));
		particlesGeometry.addAttribute('c0', new THREE.BufferAttribute(new Float32Array(255*32*3), 3));
		particlesGeometry.addAttribute('c1', new THREE.BufferAttribute(new Float32Array(255*32*3), 3));
		particlesGeometry.addAttribute('t', new THREE.BufferAttribute(new Float32Array(255*32*1), 1));
		particlesGeometry.addAttribute('s', new THREE.BufferAttribute(new Float32Array(255*32*1), 1));
		const particlesMaterial = new THREE.RawShaderMaterial({
			vertexShader: particleVS,
			fragmentShader: particleFS,
			uniforms:{
				tOffset: {value: 0.0}
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
		//particles
		this.sceneParticles.add(this.globeMesh.clone());
		this.sceneParticles.add(this.particles);
		//Pos processing passes
		this.sceneParticlesPass.add(this.particlesPassQuad);
		this.sceneFinalPass.add(this.finalPassQuad);
	}

	_updateAttributes(pathPositions, particleData){
			//Update this.pathMesh 
			const pathPositionAttribute = this.pathMesh.geometry.getAttribute('position');
			pathPositionAttribute.copyVector3sArray(pathPositions);
			pathPositionAttribute.needsUpdate = true;

			//Update this.particles
			const particlePositions = particleData.map(d => d.position);
			const particlePositionAttribute = this.particles.geometry.getAttribute('position');
			particlePositionAttribute.copyVector3sArray(particlePositions);
			particlePositionAttribute.needsUpdate = true;

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

			const particleT = particleData.map(d => d.t);
			const particleTAttribute = this.particles.geometry.getAttribute('t');
			particleTAttribute.copyArray(particleT);
			particleTAttribute.needsUpdate = true;

	}

	_animate(){

		//Perform individual render passes
		//First pass renders globe and lines
		this.globeMesh.material.uniforms.uUseTexture.value = 1.0;
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

}

export default GLWrapper;