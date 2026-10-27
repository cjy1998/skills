import http from 'node:http';
import {build} from 'esbuild';
import {createReadStream} from 'node:fs';
import {realpath,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PREVIEW_PORT||8782);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid PREVIEW_PORT');
const result=await build({entryPoints:[path.join(root,'src/Preview.tsx')],bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'}});
const javascript=result.outputFiles[0].contents;
const publicRoot=await realpath(path.join(root,'public'));
const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>科普视频预览</title><body style="margin:0;background:#F3F2EC"><div id="root"></div><script src="/preview.js"></script></body></html>';
const types={'.wav':'audio/wav','.mp3':'audio/mpeg','.mp4':'video/mp4','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg'};
const server=http.createServer(async(req,res)=>{
  if(req.headers.host!==`127.0.0.1:${port}`){res.writeHead(403).end();return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  try{
    const pathname=decodeURIComponent(new URL(req.url,`http://127.0.0.1:${port}`).pathname);
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(pathname==='/'||pathname==='/preview.js'){
      res.setHeader('Content-Type',pathname==='/'?'text/html; charset=utf-8':'application/javascript');
      res.end(req.method==='HEAD'?undefined:pathname==='/'?html:javascript);return;
    }
    if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
    if(pathname.includes('\0')){res.writeHead(404).end();return;}
    const assetPath=pathname.startsWith('/public/')?pathname.slice(8):pathname.slice(1);
    const file=await realpath(path.resolve(publicRoot,assetPath));
    const relative=path.relative(publicRoot,file);
    const type=types[path.extname(file).toLowerCase()];
    if(relative.startsWith('..')||path.isAbsolute(relative)||!type){res.writeHead(404).end();return;}
    const info=await stat(file);
    if(!info.isFile()){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',type);res.setHeader('Accept-Ranges','bytes');
    let start=0,end=info.size-1;
    if(req.headers.range){
      const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if(!match){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
      start=Number(match[1]);end=match[2]?Number(match[2]):end;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}
      end=Math.min(end,info.size-1);res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${info.size}`);
    }
    res.setHeader('Content-Length',end-start+1);
    if(req.method==='HEAD'){res.end();return;}
    const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
  }catch{if(!res.headersSent)res.writeHead(404).end();else res.destroy();}
});
server.on('error',error=>{console.error(`Preview failed: ${error.code||error.message}`);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${port}/ (restart after editing)`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close());
