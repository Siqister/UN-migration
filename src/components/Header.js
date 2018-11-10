import React, {Component} from 'react';

const selectStyle = {
	background: '#111',
	border: '1px solid #333',
	color: '#ccc'
}
const labelStyle = {
	fontFamily: 'Playfair Display',
	fontWeight: '400',
	fontSize: '0.75rem',
	color:'#eee'
}

const CountrySelect = props => (
  <div className="form-group">
    <label htmlFor="country-select" style={labelStyle}>Country</label>
    <select 
    	className="form-control form-control-sm" 
    	id="country-select" 
    	value={props.country}
    	style={selectStyle}
    	onChange={event => props.onCountryChange(event.target.value)}
    >
      {props.countries.sort((a,b) => (b[0] - a[0])).map(c =>
      	<option value={c[1]} key={c[1]}>{c[0]}</option>
			)}
    </select>
  </div>
);

const YearSelect = props => (
  <div className="form-group">
    <label htmlFor="year-select" style={labelStyle}>Year</label>
    <select 
    	className="form-control form-control-sm" 
    	id="year-select" 
    	value={props.year}
    	style={selectStyle}
    	onChange={event => props.onYearChange(event.target.value)}
    >
      {props.years.map(y =>
      	<option value={y} key={y}>{y}</option>
			)}
    </select>
  </div>
);

//Header component HOC
const headerWidgetStyle = {
	width:'256px',
	padding:'0 8px',
	boxSize:'border-box',
	float:'right'
}

const headerWidget = Component => {
	return props => 
		<div 
			className='header-widget'
			style={headerWidgetStyle}
		>
			<Component {...props} />
		</div>
}

//Create HOCs
const CountrySelectWidget = headerWidget(CountrySelect);
const YearSelectWidget = headerWidget(YearSelect);

//Header
const headerStyle = {
	position:'absolute',
	padding:'32px 16px',
	width:'100%'
};

const Header = ({years, year, onYearChange, countries, country, onCountryChange}) => (<header
		style={headerStyle}
	>
		<h1
			style={{
				fontFamily: 'Playfair Display',
				fontWeight: '400',
				fontSize: '1.5rem',
				color:'#eee',
				display:'inline'
			}}
		>
			UN Migration
		</h1>
		{countries && <CountrySelectWidget
			countries={countries}
			country={country}
			onCountryChange={onCountryChange}
		/>}
		{years && <YearSelectWidget
			years={years}
			year={year}
			onYearChange={onYearChange}
		/>}
	</header>);

export default Header;