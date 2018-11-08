import {renderMap} from './utils';

let ctx = null;
let w;
let h;

onmessage = function(e){
	
	const {canvas, geojson} = e.data;
	
	if(canvas){
		ctx = canvas.getContext('2d');
		w = canvas.width;
		h = canvas.height;
	}

	if(geojson && ctx){
		renderMap(ctx, geojson, w, h);
		postMessage('Map render complete');
	}

}