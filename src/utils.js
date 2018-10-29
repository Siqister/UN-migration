import {csv} from 'd3';

const MIGRATION_DATA_URL = './data/UN_MigrantStockByOriginAndDestination_2017/Table 1-Table 1.csv';
const COUNTRY_CODE_URL = './data/UN_MigrantStockByOriginAndDestination_2017/ANNEX-Table 1.csv';

export const fetchData = (url, parse, transform) => csv(url, parse).then(transform);
export const migrationOriginDest = fetchData(MIGRATION_DATA_URL, parseMigration, data => data.filter(d => d.code < 900));
export const countryCode = fetchData(COUNTRY_CODE_URL, parseCountryCode, data => data.filter(d => d.code < 900));

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

	return {
		name: d['Region, subregion, country or area'],
		code: +d.Code
	}

}