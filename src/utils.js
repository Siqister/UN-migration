import {csv,json} from 'd3';

const MIGRATION_DATA_URL = './data/UN_MigrantStockByOriginAndDestination_2017/Table 1-Table 1.csv';
const COUNTRY_CODE_URL = './data/UN_MigrantStockByOriginAndDestination_2017/ANNEX-Table 1.csv';
const COUNTRY_ISO_URL = './data/country-codes.csv';
const COUNTRY_GEOJSON_URL = './data/countries.geojson';

export const fetchData = (url, parse, ...transforms) => 
	transforms.concat(d => d).reduce((acc, transform) => acc.then(transform), csv(url, parse));

export const migrationOriginDest = fetchData(MIGRATION_DATA_URL, parseMigration, data => data.filter(d => d.code < 900));
export const countryCode = fetchData(
	COUNTRY_CODE_URL, 
	parseCountryCode, 
	data => data.filter(d => d[1] < 900), 
	data => new Map(data)
);
export const countryISO = fetchData(
	COUNTRY_ISO_URL,
	parseCountryISO
);
export const countryJSON = json(COUNTRY_GEOJSON_URL);

//Parse function for UN migration dataset
function parseMigration(d){

	const year = +d.Year;
	const code = +d.Code;
	const origin = d["Major area, region, country or area of destination"];

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
		origin,
		dest: Object.entries(d).map(x => ({geographyName: x[0], v: x[1] === '..'?0:+x[1].replace(/,/g, '')}))
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

	return {
		alpha3: d['ISO3166-1-Alpha-3'],
		name: d['official_name_en'],
		code: +d['ISO3166-1-numeric']
	}

}

//Parse function for geojson


//Data transform function for generating origin-destination pairs from data, countryCode Map, year, and source country
export function transformToOD(data, countryCode, originCode, year){

	if(!data || !countryCode) return null;

	const origin = data.filter(d => d.code === originCode && d.year === year)[0];
	if(!origin){
		console.error(`Country code ${originCode} not found for year ${year}`);
		return null;
	}

	//transform to array of OD pairs
	const ODData = origin.dest.map(destination => ({
		origin: origin.origin,
		originCode,
		dest: destination.geographyName, 
		destCode: countryCode.get(destination.geographyName),
		v: destination.v
	})).filter(od => od.destCode && od.v > 0);

	return ODData;

}