import React, {useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Player, PlayerRef} from '@remotion/player';
import {Body, Final, scenes, cueFrames} from './Root';
import {Cover, FollowOutro, OUTRO_FRAMES} from './VideoExtras';
import film from './film.json';
import project from './project.json';

function Preview(){
  const player=useRef<PlayerRef>(null);
  const mode=new URLSearchParams(window.location.search).get('mode')||'body';
  const isOutro=mode==='outro';
  const component=mode==='cover'?Cover:isOutro?FollowOutro:mode==='final'?Final:Body;
  const duration=mode==='cover'?1:isOutro?OUTRO_FRAMES:film.totalFrames+(mode==='final'?OUTRO_FRAMES:0);
  React.useEffect(()=>{
    (window as any).videoPreview={scenes,cueFrames,fps:film.fps,totalFrames:duration,seek:(frame:number)=>flushSync(()=>player.current?.seekTo(frame)),play:()=>player.current?.play(),pause:()=>player.current?.pause(),getFrame:()=>player.current?.getCurrentFrame()};
  },[duration]);
  if((isOutro||mode==='final')&&!project.avatar)return <main style={{padding:32}}>请先提供头像，再预览片尾。<a href="/?mode=body">返回正文</a></main>;
  return <div style={{display:'grid',gridTemplateColumns:'minmax(280px,440px) minmax(260px,1fr)',gap:32,maxWidth:1150,margin:'auto',padding:28,fontFamily:'sans-serif',color:'#142823'}}>
    <Player ref={player} component={component} durationInFrames={duration} fps={film.fps} compositionWidth={1080} compositionHeight={1920} controls={mode!=='cover'} style={{width:'100%'}}/>
    <main><h1>{project.brand}</h1><p>{film.previewMode?'无声排版示例：不能作为最终成片交付。':'连续旁白 · 同步字幕'} · {Math.round(duration/film.fps)} 秒</p><nav style={{display:'flex',gap:20}}>{['body','cover','outro','final'].map((value,i)=><a key={value} href={`/?mode=${value}`}>{['正文','封面','片尾','整片'][i]}</a>)}</nav><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:25}}>{scenes.map(scene=><button key={scene.id} onClick={()=>{player.current?.pause();player.current?.seekTo(scene.from+Math.min(110,scene.frames-1));}} style={{padding:12,textAlign:'left',background:'white',border:'1px solid #D4DCD1',borderRadius:8,cursor:'pointer'}}>{scene.index+1} · {scene.title.join('')}</button>)}</div><p>先审稿与样稿，再确认跨分镜试听。封面不自动插入视频开头。</p></main>
  </div>;
}

createRoot(document.getElementById('root')!).render(<Preview/>);
