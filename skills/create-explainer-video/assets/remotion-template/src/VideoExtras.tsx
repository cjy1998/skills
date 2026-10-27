import React from 'react';
import {AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame} from 'remotion';
import project from './project.json';
import {fontFamily} from './fonts';
import {palette, Rise} from './Visuals';

export const OUTRO_FRAMES=120;
const mono='"SFMono-Regular", Menlo, monospace';
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
const Brand:React.FC=()=> <div style={{position:'absolute',left:80,right:80,top:83,display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{display:'flex',alignItems:'center',gap:13,fontSize:27,fontWeight:700}}><span style={{width:15,height:15,borderRadius:4,background:palette.ink}}/>{project.brand}</div><span style={{fontFamily:mono,fontSize:20,color:palette.muted,letterSpacing:1}}>{project.englishLabel}</span></div>;
const Backdrop:React.FC=()=> <div style={{position:'absolute',left:70,right:70,top:240,bottom:235,opacity:.32,backgroundImage:'radial-gradient(#ADBBA8 1px, transparent 1px)',backgroundSize:'28px 28px'}}/>;
const Avatar:React.FC<{size:number}>=({size})=> <Img src={staticFile(project.avatar)} alt="创作者头像" style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',display:'block'}}/>;

export const Cover:React.FC=()=> <AbsoluteFill style={{background:palette.paper,color:palette.ink,fontFamily,overflow:'hidden'}}>
  <Backdrop/><Brand/>
  <div style={{position:'absolute',left:80,top:230,display:'inline-flex',alignItems:'center',gap:16,fontSize:29,fontWeight:700}}><span style={{padding:'11px 20px',borderRadius:7,background:palette.mint}}>{project.cover.tag}</span><span style={{color:palette.muted}}>{project.cover.eyebrow}</span></div>
  <div style={{position:'absolute',left:72,right:80,top:341,fontSize:246,fontWeight:900,letterSpacing:-11,lineHeight:1}} data-safe-text>{project.cover.keyword}<span style={{color:palette.muted,fontWeight:400,fontSize:152,letterSpacing:-8,marginLeft:31}}>?</span></div>
  <div style={{position:'absolute',left:80,right:80,top:599,fontSize:102,fontWeight:900,lineHeight:1.2,letterSpacing:-3}} data-safe-text>{project.cover.title}</div>
  <div style={{position:'absolute',left:84,right:80,top:765,fontSize:35,fontWeight:500,color:palette.muted}} data-safe-text>{project.cover.subtitle}</div>
  <div style={{position:'absolute',left:105,top:925,width:864,height:470,borderRadius:30,background:palette.line,transform:'rotate(3deg)'}}/>
  <div style={{position:'absolute',left:80,right:80,top:888,height:492,borderRadius:30,padding:'44px',boxSizing:'border-box',background:palette.ink,color:palette.paper}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{fontSize:29,color:palette.mint,fontWeight:700}}>{project.cover.panelLabel}</div><svg width="49" height="57" viewBox="0 0 49 57" fill="none" stroke={palette.mint} strokeWidth="2.5"><path d="M8 3h23l11 12v39H8zM31 3v13h11M17 28h15M17 37h15"/></svg></div>
    <div style={{fontFamily:mono,fontSize:87,fontWeight:700,letterSpacing:-5,marginTop:38}} data-safe-text>{project.cover.panelTitle}</div>
    <div style={{height:1,background:'#FFFFFF28',marginTop:36,marginBottom:29}}/>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:32}}>{project.cover.panelItems.map(text=><span key={text} style={{display:'flex',alignItems:'center',gap:12}}><span style={{width:7,height:7,borderRadius:'50%',background:palette.mint}}/>{text}</span>)}</div>
  </div>
  <div style={{position:'absolute',top:1480,left:80,right:80,display:'flex',gap:16}}>{project.cover.topics.map((text,i)=><div key={text} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12,flex:text.length>4?1.45:1,padding:'24px 13px',border:`1px solid ${palette.line}`,background:palette.paper,borderRadius:14,fontSize:28,fontWeight:700}}><span style={{fontSize:20,fontFamily:mono,color:palette.muted}}>0{i+1}</span>{text}</div>)}</div>
  <div style={{position:'absolute',left:80,right:80,top:1670,borderTop:`1px solid ${palette.line}`,paddingTop:34,display:'flex',alignItems:'center',gap:24}}>{project.avatar&&<Avatar size={88}/>}<div><div style={{fontSize:30,fontWeight:700}}>{project.brand}</div><div style={{fontSize:24,color:palette.muted,marginTop:9}}>{project.cover.footer}</div></div><span style={{marginLeft:'auto',fontFamily:mono,fontSize:23,color:palette.muted}}>{project.cover.issue}</span></div>
</AbsoluteFill>;

export const FollowOutro:React.FC=()=>{
  const frame=useCurrentFrame();
  if(!project.avatar)throw new Error('Provide the creator avatar before producing an outro.');
  const entrance=spring({frame:frame-4,fps:30,config:{damping:19,stiffness:110}});
  const press=interpolate(frame,[50,54,60],[1,.955,1],clamp);
  const cursorMove=interpolate(frame,[32,49],[0,1],clamp);
  const cursorOpacity=interpolate(frame,[30,36,66,76],[0,1,1,0],clamp);
  const ripple=interpolate(frame,[53,83],[0,1],clamp);
  return <AbsoluteFill style={{background:palette.paper,color:palette.ink,fontFamily,overflow:'hidden'}}>
    <Backdrop/><Brand/>
    <Rise style={{position:'absolute',top:369,left:0,right:0,textAlign:'center',fontSize:26,color:palette.muted,letterSpacing:4}}>{project.outro.eyebrow}</Rise>
    <div style={{position:'absolute',top:488,left:370,width:340,height:340,display:'flex',alignItems:'center',justifyContent:'center',opacity:entrance,transform:`translateY(${(1-entrance)*26}px) scale(${.84+.16*entrance})`}}><div style={{position:'absolute',inset:0,border:`1px solid ${palette.line}`,borderRadius:'50%'}}/><div style={{position:'absolute',inset:13,border:`5px solid ${palette.mint}`,borderRadius:'50%'}}/><Avatar size={280}/><div style={{position:'absolute',right:23,bottom:27,width:48,height:48,border:`6px solid ${palette.paper}`,borderRadius:'50%',background:palette.mint,display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="27" height="27" viewBox="0 0 28 28" fill="none" stroke={palette.ink} strokeWidth="2.5"><path d="M14 4v20M4 14h20"/></svg></div></div>
    <Rise delay={10} style={{position:'absolute',left:80,right:80,top:899,textAlign:'center'}}><div style={{fontSize:78,fontWeight:900,lineHeight:1.36,letterSpacing:-2}} data-safe-text>{project.outro.title.map((line,i)=><React.Fragment key={i}>{i>0&&<br/>}{line}</React.Fragment>)}</div></Rise>
    <Rise delay={19} style={{position:'absolute',left:258,top:1200,width:564,height:126}}><div style={{position:'absolute',inset:0,border:`2px solid ${palette.mint}`,borderRadius:24,opacity:frame>=53?1-ripple:0,transform:`scale(${1+ripple*.23})`}}/><div style={{height:'100%',background:palette.mint,border:'1px solid #B6DF93',borderRadius:23,display:'flex',alignItems:'center',justifyContent:'center',gap:23,transform:`scale(${press})`,boxShadow:'0 8px 0 #1428230A'}}><svg width="35" height="35" viewBox="0 0 35 35" stroke={palette.ink} strokeWidth="3" strokeLinecap="round"><path d="M17.5 5v25M5 17.5h25"/></svg><span style={{fontSize:51,fontWeight:700,letterSpacing:5}} data-safe-text>{project.outro.button}</span></div></Rise>
    <svg width="75" height="86" viewBox="0 0 75 86" style={{position:'absolute',left:778-cursorMove*53,top:1354-cursorMove*66,opacity:cursorOpacity,transform:`rotate(-12deg) scale(${press})`,filter:'drop-shadow(0 5px 4px #14282322)'}}><path d="M10 6L62 46L39 50L52 73L39 80L27 55L10 72Z" fill={palette.paper} stroke={palette.ink} strokeWidth="3.5" strokeLinejoin="round"/></svg>
    <Rise delay={26} style={{position:'absolute',left:80,right:80,top:1431,display:'flex',justifyContent:'center',gap:15}}>{project.outro.tags.map(text=><span key={text} style={{fontSize:27,color:palette.muted,padding:'13px 22px',borderRadius:30,background:palette.soft}}>{text}</span>)}</Rise>
    <Rise delay={31} style={{position:'absolute',left:80,right:80,top:1668,borderTop:`1px solid ${palette.line}`,paddingTop:32,textAlign:'center',fontSize:28,color:palette.muted}}>{project.outro.footer}</Rise>
  </AbsoluteFill>;
};
