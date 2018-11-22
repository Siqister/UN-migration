import React from 'react';

const tooltipStyle = {
	padding:'12px 12px',
	fontFamily: 'Playfair Display',
	fontWeight: '400',
	//background:'rgb(17,17,17)',
	color:'rgb(238,238,238)',
	background:'rgb(230,230,230)',
	color:'#444',
	position:'absolute',
	top:'50%',
	left:'50%',
}

const Tooltip = ({x, y, countryName}) => {
	if(!countryName) return null;

	return(
		<div className='tt' style={Object.assign({}, tooltipStyle, {
			left:`${x+15}px`,
			top:`${y+15}px`
		})}>
			<p style={{margin:0}}>{countryName}</p>
		</div>
	);
}

export default Tooltip;