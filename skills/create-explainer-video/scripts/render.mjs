import {bundle} from '@remotion/bundler';
import {selectComposition,renderMedia,renderStill,openBrowser} from '@remotion/renderer';
import {existsSync,readFileSync,realpathSync,statSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {parseArgs} from 'node:util';

async function main(){
  const {values}=parseArgs({options:{help:{type:'boolean'},target:{type:'string'},output:{type:'string'},project:{type:'string'},browser:{type:'string'},port:{type:'string'},frame:{type:'string'}}});
  if(values.help){console.log('node scripts/render.mjs --target cover|outro|body|final|stills --output NEW_PATH --browser CHROME [--project DIR] [--port 8783] [--frame N (stills only)]');return;}
  const target=values.target;
  const ids={cover:'ExplainerCover',outro:'FollowOutro',body:'ExplainerBody',final:'ExplainerFinal',stills:'ExplainerBody'};
  if(!ids[target]||!values.output)throw new Error('需要 --target 和独立的 --output。');
  if(values.frame!==undefined&&target!=='stills')throw new Error('--frame 只能用于 stills。');
  const root=path.resolve(values.project||process.cwd());
  const output=path.resolve(values.output);
  if(existsSync(output))throw new Error('输出已存在，拒绝覆盖。');
  if(!statSync(path.dirname(output)).isDirectory())throw new Error('输出父目录不存在。');
  const browserExecutable=values.browser||process.env.REMOTION_BROWSER;
  if(!browserExecutable||!statSync(browserExecutable).isFile())throw new Error('通过 --browser 或 REMOTION_BROWSER 提供已有 Chrome；不会自动下载浏览器。');
  const port=Number(values.port||8783);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('端口必须为 1024–65535。');
  const film=JSON.parse(readFileSync(path.join(root,'src/film.json'),'utf8'));
  const project=JSON.parse(readFileSync(path.join(root,'src/project.json'),'utf8'));
  const story=JSON.parse(readFileSync(path.join(root,'src/story.json'),'utf8'));
  if(film.fps!==30)throw new Error('当前动画模板按 30 fps 设计；其他帧率须先适配动画。');
  let cursor=0;
  if(!film.scenes.length||film.scenes.length!==story.length)throw new Error('分镜数与原稿不一致，重新生成时间轴。');
  for(const [index,scene] of film.scenes.entries()){
    if(scene.id!==story[index].id||scene.from!==cursor||!Number.isInteger(scene.frames)||scene.frames<10)throw new Error('分镜时间轴无效。');
    let previous=0;
    for(const cue of scene.captions){
      if(!Number.isFinite(cue.start)||!Number.isFinite(cue.end)||cue.start<previous||cue.start>=cue.end||cue.end>scene.frames/film.fps+.0001)throw new Error('字幕顺序或边界无效。');
      previous=cue.end;
    }
    cursor+=scene.frames;
  }
  if(cursor!==film.totalFrames)throw new Error('总帧数不一致。');
  const asset=value=>{
    if(typeof value!=='string'||!value||value.includes('\\')||value.includes('\0')||value.split('/').some(part=>part==='..'||!part)||path.isAbsolute(value))throw new Error('素材必须是安全的 public 相对路径。');
    const base=realpathSync(path.join(root,'public'));
    const file=realpathSync(path.resolve(base,value));
    const relative=path.relative(base,file);
    if(relative.startsWith('..')||path.isAbsolute(relative)||!statSync(file).isFile())throw new Error('素材必须位于 public 内。');
    return file;
  };
  if(['body','final'].includes(target)){
    if(film.previewMode||!film.audioFile||!film.audioSha256)throw new Error('无声示例不能导出成片；先对齐已确认的连续旁白。');
    const digest=createHash('sha256').update(readFileSync(asset(film.audioFile))).digest('hex');
    if(digest!==film.audioSha256)throw new Error('音频已变更，重新生成字幕时间轴。');
    if(film.storySha256&&createHash('sha256').update(readFileSync(path.join(root,'src/story.json'))).digest('hex')!==film.storySha256)throw new Error('原稿已变更，重新核对旁白与字幕。');
  }
  if(['outro','final'].includes(target))asset(project.avatar);
  if(target==='cover'&&project.avatar)asset(project.avatar);
  const frame=values.frame===undefined?undefined:Number(values.frame);
  if(frame!==undefined&&(!Number.isInteger(frame)||frame<0||frame>=film.totalFrames))throw new Error('--frame 超出正文时间轴。');
  const work=mkdtempSync(path.join(path.dirname(output),'.explainer-render-'));
  let browser;
  try{
    const serveUrl=await bundle({entryPoint:path.join(root,'src/index.ts'),publicDir:path.join(root,'public'),outDir:path.join(work,'bundle')});
    browser=await openBrowser('chrome',{browserExecutable});
    const composition=await selectComposition({serveUrl,id:ids[target],browserExecutable,puppeteerInstance:browser,port});
    const options={composition,serveUrl,puppeteerInstance:browser,port};
    if(target==='cover')await renderStill({...options,frame:0,output,imageFormat:'png',overwrite:false});
    else if(target==='stills'){
      mkdirSync(output);
      const frames=frame===undefined?film.scenes.map(scene=>scene.from+Math.min(Math.round(scene.frames*.48),scene.frames-1)):[frame];
      for(const [i,at] of frames.entries())await renderStill({...options,frame:at,output:path.join(output,`${String(i+1).padStart(2,'0')}.png`),imageFormat:'png',overwrite:false});
    }else{
      let last=-1;
      await renderMedia({...options,codec:'h264',outputLocation:output,overwrite:false,concurrency:4,crf:19,audioCodec:'aac',audioBitrate:'192k',pixelFormat:'yuv420p',imageFormat:'jpeg',jpegQuality:92,x264Preset:'fast',onProgress:({progress})=>{const step=Math.floor(progress*10);if(step!==last){last=step;console.log(`Render ${step*10}%`);}}});
    }
    console.log(JSON.stringify({ok:true,target,output,frames:composition.durationInFrames,fps:composition.fps}));
  }finally{
    if(browser)await browser.close({silent:true});
    rmSync(work,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
