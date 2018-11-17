import React from 'react';

const loadingStatusStyle = {
	padding:'16px 16px',
	fontFamily: 'Playfair Display',
	fontWeight: '400',
	background:'rgb(17,17,17)',
	position:'absolute',
	top:'50%',
	left:'50%',
	transform:'translate(-50%,-50%)',
	color:'rgb(238,238,238)'
}

const LoadingStatus = () => 
	<div className='loading-status' style={loadingStatusStyle}>
		<p style={{margin:0}}>Loading UN migration data from 1990-2017. Please wait...</p>
	</div>

export default LoadingStatus;