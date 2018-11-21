import {
	csv,json,
	scaleLinear,
	geoInterpolate,geoCentroid,geoEquirectangular,geoPath
} from 'd3';
import * as THREE from 'three';

const MIGRATION_DATA_URL = './data/UN_MigrantStockByOriginAndDestination_2017/Table 1-Table 1.csv';
const COUNTRY_CODE_URL = './data/UN_MigrantStockByOriginAndDestination_2017/ANNEX-Table 1.csv';
const COUNTRY_ISO_URL = './data/country-codes.csv';
const COUNTRY_GEOJSON_URL = './data/countries.geojson';

//DATA UTILITIES
const fetchData = (url, parse, ...transforms) => 
	transforms.concat(d => d).reduce((p, transform) => p.then(transform), csv(url, parse));
export {fetchData}

//Zip origin destination data with countryCode
const zipDataToCode = ([data, code]) => {

	const ODData = [];

	data.forEach(d => {
		const od = d.origin
			.filter(d => d.v > 0)
			.map(o => ({
				origin: o.geographyName,
				originCode: code.get(o.geographyName),
				dest: d.dest,
				destCode: code.get(d.dest),

				v: o.v,
				year: d.year
			}))
			.filter(od => od.originCode && od.destCode);

		ODData.push(...od);
	});

	return ODData;
}

//Zip numerical ISO code with geojson; returns augmented GeoJSON and centroid lookup
const zipJSON = ([iso, json]) => {
	console.groupCollapsed('Zip json with iso');
	const features = json.features.map(f => {
		const {ISO_A3, ADMIN} = f.properties;
		const code = iso.get(ISO_A3);

		if(!code){
			console.log(`Code for ${ADMIN}/${ISO_A3} not found`);
		}else{
			f.properties.ISO_CODE = code;
		}

		return f;
	});
	console.groupEnd();

	//Produce a centroid lookup
	const centroids = new Map(features.map(f => [f.properties.ISO_CODE, geoCentroid(f)]));

	return [features, centroids];
}
export {zipJSON}

//DATA PROMISES
const migrationOriginDest = fetchData(
	MIGRATION_DATA_URL, 
	parseMigration, 
	data => data.filter(d => d.code < 900)
);
export {migrationOriginDest}

const _countryData = fetchData(
	COUNTRY_CODE_URL, 
	parseCountryCode, 
	data => data.filter(d => d[1] < 900), 
);
const countryCode = _countryData
	.then(data => new Map(data));
const countryName = _countryData
	.then(data => data.map(d => [d[1],d[0]]))
	.then(data => new Map(data));
export {countryCode}
export {countryName}

const ODData = Promise.all([migrationOriginDest, countryCode])
	.then(zipDataToCode);
export {ODData};

const countryISO = fetchData(
	COUNTRY_ISO_URL,
	parseCountryISO,
	data => new Map(data)
);
export {countryISO}

const countryJSON = json(COUNTRY_GEOJSON_URL);
export {countryJSON}

//Parse function for UN migration dataset
function parseMigration(d){

	const year = +d.Year;
	const code = +d.Code;
	const dest = d["Major area, region, country or area of destination"];

	delete d.Year;
	delete d["Sort order"];
	delete d["Major area, region, country or area of destination"];
	delete d.Notes;
	delete d.Code;
	delete d["Type of data (a)"];
	delete d.Total;

	return {
		year,
		code,
		dest,
		origin: Object.entries(d).map(x => ({geographyName: x[0], v: x[1] === '..'?0:+x[1].replace(/,/g, '')}))
	}

}

//Parse function for UN migration annex table (country code)
function parseCountryCode(d){

	return [
		d['Region, subregion, country or area'],
		+d.Code
	]

}

//Parse function for countries ISO code table
function parseCountryISO(d){

	return [
		d['ISO3166-1-Alpha-3'],
		+d['ISO3166-1-numeric']
	]

}

//3D geo utilities
//Project lngLat to 3D coordinates
export const project = (lngLat, r) => {
	const [lng, lat] = lngLat;
	//theta: incline from z-direction, [0, Math.PI]
	const theta = -(lat - 90)/180*Math.PI;
	//phi: azimuthal from positive x axis [0, Math.PI * 2]
	const phi = (lng + 180)/360 * Math.PI * 2;
	//console.log(theta/Math.PI, phi/Math.PI);
	return new THREE.Vector3(
		- r * Math.sin(theta) * Math.cos(phi),
		r * Math.cos(theta),
		r * Math.sin(theta) * Math.sin(phi)
	);
}

//convert origin destination pair to 3D spline
export const generateSpline = (r0, r1) => {

	const altitudeScale = scaleLinear()
		.domain([9, r0 * 2]) //euclidean distance between two vectors in 3D space
		.range([r0 * 1.1, r1])
		.clamp(true);

	//returns: THREE.Spline()
	return (lngLat0, lngLat1) => {

		if(!lngLat0 || !lngLat1) return;
		//https://medium.com/@xiaoyangzhao/drawing-curves-on-webgl-globe-using-three-js-and-d3-draft-7e782ffd7ab
		//Determine "lofting" altitude based on distance between p0 and p1
		const p0 = project(lngLat0, r0);
		const p1 = project(lngLat1, r0);
		const r = altitudeScale(p0.distanceTo(p1));

		//Generate two control points
		const interpolate = geoInterpolate(lngLat0, lngLat1);
		const c0 = project(interpolate(0.25), r);
		const c1 = project(interpolate(0.75), r);

		//Generate CubicBezier 3D spline
		const spline =  new THREE.CubicBezierCurve3(p0, c0, c1, p1);

		//TODO: avoid adding custom properties to spline object
		spline.p0 = p0;
		spline.p1 = p1;
		spline.c0 = c0;
		spline.c1 = c1;

		return spline;
	}

}

//Utilities for converting Number to color and vice versa
export const numToHex = num => 
	num.toString(16)

export const numToHexColor = num => 
	new THREE.Color().setHex(num)

export const colorToNum = (r,g,b) => ( r << 16 ) | ( g << 8 ) | ( b );

//2D geo utilities
//Utility function for rendering a map to canvas2DContext
const projection = geoEquirectangular();
export const renderMap = (ctx, json, colorById=false, width=4096, height=2048) => {
	projection
		.fitExtent([[0,0], [width,height]], {
			type:"FeatureCollection",
			features:json
		}) //fit the world
		.center([0,0])
		.translate([width/2,height/2]);

	//Set up geoPath object
	const path = geoPath(projection, ctx);

	//Render pixels
	//Black background
	ctx.fillStyle = 'rgb(0,0,0)';
	ctx.fillRect(0, 0, width, height);

	if(colorById){
		//TODO: test remove
		json.forEach(d => {
			if(!d.properties.ISO_CODE) return;
			ctx.beginPath();
			path(d);

			const color = numToHexColor(d.properties.ISO_CODE);
			ctx.fillStyle = '#' + color.getHexString();
			ctx.fill();
		});
	}else{
		//White border only
		ctx.strokeStyle = 'rgb(220,220,220)'
		ctx.beginPath();
		path({
			type:"FeatureCollection",
			features: json
		});
		ctx.stroke();
	}

}
