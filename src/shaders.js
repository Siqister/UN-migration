export const globeVS = `
	varying vec2 v_uv;

	void main(){
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		v_uv = uv;
	}
`;

export const globeFS = `
	precision mediump float;

	varying vec2 v_uv;

	uniform float uUseTexture;
	uniform float uUsePickingTexture;
	uniform sampler2D tSampler;
	uniform sampler2D tPickingTexture;

	void main(){
		//Render black globe only
		vec3 color = vec3(0.0,0.0,0.0);

		//Render textured globe
		if(uUseTexture > 0.0){
			if(uUsePickingTexture > 0.0){
				color = texture2D(tPickingTexture, v_uv).rgb;
			}else{
				color = texture2D(tSampler, v_uv).rgb;
			}
		}
		gl_FragColor = vec4(color,1.0);
	}
`;

export const particleVS = `
  #define PI 3.1415926535

	uniform mat4 projectionMatrix;
	uniform mat4 modelViewMatrix;

	attribute vec3 position;
	attribute vec3 p0;
	attribute vec3 p1;
	attribute vec3 c0;
	attribute vec3 c1;
	attribute float t;

	uniform float tOffset;

	varying float v_t;

	vec3 cubicBezier(vec3 p0, vec3 c0, vec3 c1, vec3 p1, float t){
		float tn = 1.0 - t;
    return 
      tn * tn * tn * p0 + 
      3.0 * tn * tn * t * c0 + 
      3.0 * tn * t * t * c1 + 
      t * t * t * p1;
	}

	void main(){

		float pct = t + tOffset;
		if(pct > 1.0){
			pct = pct - 1.0;
		}
		v_t = sin(pct * PI);

		vec3 interpolatedPosition = cubicBezier(p0,c0,c1,p1,pct);

		gl_Position = projectionMatrix * modelViewMatrix * vec4(interpolatedPosition, 1.0);
		gl_PointSize = 2.0;
	}
`;

export const particleFS = `
	precision mediump float;

	//uniform sampler2D texture;
	varying float v_t;

	void main(){
		//vec4 color = texture2D(texture, gl_PointCoord);
		//gl_FragColor = texture2D(texture, gl_PointCoord);
		gl_FragColor = vec4(v_t, v_t, v_t, 0.7);
	}
`;

export const quadVS = `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 v_uv;
  void main(){
    gl_Position = vec4(position, 0.0, 1.0);
    v_uv = uv;
  }
`;

export const finalPassFS = `
	precision mediump float;

	uniform sampler2D tGlobe;
	uniform sampler2D tParticleComposite;
	varying vec2 v_uv;

	void main(){
		vec4 globe = texture2D(tGlobe, v_uv);
		vec4 particles = texture2D(tParticleComposite, v_uv);
		gl_FragColor = vec4(globe.rgb + particles.rgb, 1.0);
	}
`;

export const particlesPassFS = `
	precision mediump float;

	uniform sampler2D tCurrent;
	uniform sampler2D tPrev;
	varying vec2 v_uv;

	void main(){
		vec3 current = texture2D(tCurrent, v_uv).rgb;
		vec3 prev = texture2D(tPrev, v_uv).rgb;
		gl_FragColor = vec4(current + prev * 0.6, 1.0);
	}
`;