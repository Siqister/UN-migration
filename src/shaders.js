export const particleVS = `
	uniform mat4 projectionMatrix;
	uniform mat4 modelViewMatrix;

	attribute vec3 position;
	attribute vec3 p0;
	attribute vec3 p1;
	attribute vec3 c0;
	attribute vec3 c1;
	attribute float t;

	uniform float tOffset;

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

		vec3 interpolatedPosition = cubicBezier(p0,c0,c1,p1,pct);

		gl_Position = projectionMatrix * modelViewMatrix * vec4(interpolatedPosition, 1.0);
		gl_PointSize = 1.5;
	}
`;

export const particleFS = `
	precision mediump float;

	//uniform sampler2D texture;

	void main(){
		//vec4 color = texture2D(texture, gl_PointCoord);
		//gl_FragColor = texture2D(texture, gl_PointCoord);
		gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
	}
`;