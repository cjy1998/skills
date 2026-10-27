import React from 'react';
import {AbsoluteFill, Audio, Composition, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import story from './story.json';
import film from './film.json';
import project from './project.json';
import {fontFamily} from './fonts';
import {palette, Rise, Visual} from './Visuals';
import {Cover, FollowOutro, OUTRO_FRAMES} from './VideoExtras';

export const scenes=film.scenes.map((entry,index)=>{
  const source=story.find(scene=>scene.id===entry.id);
  if(!source)throw new Error(`Unknown scene: ${entry.id}`);
  return {...source,...entry,index};
});
export const cueFrames=scenes.flatMap(scene=>scene.captions.map(cue=>({frame:scene.from+Math.round((cue.start+cue.end)*film.fps/2),text:cue.text})));

const Caption:React.FC<{scene:(typeof scenes)[number]}>=({scene})=>{
  const frame=useCurrentFrame();
  const cue=scene.captions.find(c=>frame/film.fps>=c.start&&frame/film.fps<c.end);
  if(!cue)return null;
  const lines=project.captionLines as Record<string,string>;
  return <div data-caption style={{position:'absolute',left:80,right:96,top:1563,height:196,boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px 26px 8px',background:palette.paper,color:palette.ink,borderTop:`1px solid ${palette.line}`}}><span aria-hidden style={{position:'absolute',top:-2,left:0,width:56,height:4,background:scene.accent==='coral'?palette.coral:palette.mint}}/><div data-caption-text style={{fontSize:44,lineHeight:1.5,fontWeight:700,textAlign:'center',whiteSpace:'pre-line',letterSpacing:.1}}>{lines[cue.text]||cue.text}</div></div>;
};

const Scene:React.FC<{scene:(typeof scenes)[number]}>=({scene})=>{
  const frame=useCurrentFrame();
  const out=interpolate(frame,[scene.frames-10,scene.frames-1],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const accent=scene.accent==='coral'?palette.coral:palette.mint;
  return <AbsoluteFill style={{fontFamily,background:palette.paper,color:palette.ink,overflow:'hidden'}}>
    <div style={{position:'absolute',left:70,top:242,right:80,bottom:460,opacity:.32,backgroundImage:'radial-gradient(#ADBBA8 1px, transparent 1px)',backgroundSize:'28px 28px'}}/>
    <div style={{position:'absolute',left:80,top:83,right:95,display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:27,fontWeight:700,letterSpacing:1,display:'flex',alignItems:'center',gap:13}}><span style={{width:15,height:15,borderRadius:4,background:palette.ink}}/>{project.brand}</div><span style={{fontSize:21,fontFamily:'Menlo,monospace',color:palette.muted}}>{project.englishLabel}</span></div>
    <div style={{position:'absolute',top:160,left:80,right:95,display:'flex',gap:13}}>{project.chapters.slice(1).map((title,i)=><div key={title} style={{flex:title.length>4?1.4:1,padding:'14px 9px',borderTop:`3px solid ${scene.chapter===i+1?palette.ink:palette.line}`,color:scene.chapter===i+1?palette.ink:palette.muted,fontSize:24,fontWeight:scene.chapter===i+1?700:400,display:'flex',alignItems:'center',gap:9}}><span style={{fontFamily:'Menlo,monospace',fontSize:18}}>{String(i+1).padStart(2,'0')}</span>{title}</div>)}</div>
    <div style={{opacity:out}}>
      <Rise style={{position:'absolute',top:282,left:80,right:95}}><div style={{display:'inline-flex',padding:'9px 17px',borderRadius:7,fontSize:24,fontWeight:700,background:accent}}>{scene.label}</div></Rise>
      <Rise delay={5} style={{position:'absolute',left:77,top:358,right:93}}><div data-title style={{fontSize:81,fontWeight:900,lineHeight:1.31,letterSpacing:-2}}>{scene.title.map((line,i)=><React.Fragment key={i}>{i>0&&<br/>}{line}</React.Fragment>)}</div></Rise>
      <Rise delay={10} style={{position:'absolute',left:80,right:96,top:669}}><div data-visual style={{transform:`scale(${interpolate(frame,[0,scene.frames],[1,1.012])})`,transformOrigin:'center top'}}><Visual kind={scene.visual}/></div></Rise>
      <div style={{position:'absolute',left:82,right:96,top:1459,display:'flex',alignItems:'center',gap:14}}><span style={{width:30,height:3,background:palette.ink}}/><span style={{fontSize:23,color:palette.muted}}>{scene.chapter===0?project.introNote:`${project.chapters[scene.chapter]} / ${project.sceneNote}`}</span></div>
      <Caption scene={scene}/>
    </div>
    <div style={{position:'absolute',left:80,right:96,bottom:89,display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:20,color:palette.muted}}><span>{project.footer}</span><span style={{fontFamily:'Menlo,monospace'}}>{String(scene.index+1).padStart(2,'0')} / {String(scenes.length).padStart(2,'0')}</span></div>
  </AbsoluteFill>;
};

export const Body:React.FC=()=>{
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{background:palette.paper}}>
    {scenes.map(scene=><Sequence key={scene.id} from={scene.from} durationInFrames={scene.frames}><Scene scene={scene}/></Sequence>)}
    {film.audioFile&&<Sequence from={film.audioStart}><Audio src={staticFile(film.audioFile)}/></Sequence>}
    <div style={{position:'absolute',left:0,right:0,bottom:0,height:8,background:palette.line}}><div style={{height:'100%',width:`${100*frame/(film.totalFrames-1)}%`,background:palette.ink}}/></div>
  </AbsoluteFill>;
};

export const Final:React.FC=()=> <AbsoluteFill style={{background:palette.paper}}><Sequence durationInFrames={film.totalFrames}><Body/></Sequence><Sequence from={film.totalFrames} durationInFrames={OUTRO_FRAMES}><FollowOutro/></Sequence></AbsoluteFill>;

export const Root:React.FC=()=> <>
  <Composition id="ExplainerBody" component={Body} durationInFrames={film.totalFrames} fps={film.fps} width={1080} height={1920}/>
  <Composition id="ExplainerFinal" component={Final} durationInFrames={film.totalFrames+OUTRO_FRAMES} fps={film.fps} width={1080} height={1920}/>
  <Composition id="ExplainerCover" component={Cover} durationInFrames={1} fps={film.fps} width={1080} height={1920}/>
  <Composition id="FollowOutro" component={FollowOutro} durationInFrames={OUTRO_FRAMES} fps={film.fps} width={1080} height={1920}/>
</>;
