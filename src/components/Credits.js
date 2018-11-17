import React from 'react';

import * as creditsContent from '../content/credits.md';

const drawerStyle = {
	position:'absolute',
	height:'100%',
	width:'320px',
	top:'0px',
	background:'rgb(230,230,230)',
	color:'#444',
	zIndex:998,
	overflow:'hidden',
	transition:'all .2s'
}

const creditsInnerStyle = {
	padding:'16px 16px',
	marginTop:'112px',
	fontFamily: 'Playfair Display',
	fontWeight: '300',
	borderTop:'1px solid #ccc'
}

const Credits = ({isOpen}) => 
	<div className='credits drawer'
		style={Object.assign({}, drawerStyle, {left:isOpen?'0px':'-320px'})}
	>
		<div 
			className='credits-inner' 
			style={creditsInnerStyle}
			dangerouslySetInnerHTML={{__html:creditsContent}}
		/>
	</div>

export default Credits;