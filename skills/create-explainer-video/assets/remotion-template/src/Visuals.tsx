import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

export const palette = {paper:'#F3F2EC', ink:'#142823', muted:'#66756D', mint:'#C6F39F', coral:'#F6A488', line:'#D4DCD1', white:'#FFFFFF', soft:'#E8ECE3'};
const mono = '"SFMono-Regular", Menlo, monospace';

export const Rise: React.FC<{children:React.ReactNode;delay?:number;style?:React.CSSProperties}> = ({children,delay=0,style}) => {
  const frame=useCurrentFrame();
  const p=spring({frame:frame-delay,fps:30,config:{damping:24,stiffness:115}});
  return <div style={{opacity:p,transform:`translateY(${(1-p)*34}px)`,...style}}>{children}</div>;
};

const Icon: React.FC<{type?:string;size?:number;color?:string}> = ({type='file',size=48,color=palette.ink}) => {
  const paths:Record<string,React.ReactNode>={
    file:<><path d="M10 4h18l10 10v30H10z"/><path d="M28 4v12h10M17 25h14M17 33h10"/></>,
    check:<path d="m9 25 10 10 22-24"/>,
    folder:<path d="M5 12h15l5 6h19v24H5z"/>,
    code:<><path d="m16 13-11 11 11 11m16-22 11 11-11 11M28 8l-8 32"/></>,
    globe:<><circle cx="24" cy="24" r="19"/><path d="M5 24h38M24 5c-14 10-14 28 0 38M24 5c14 10 14 28 0 38"/></>,
    lock:<><rect x="10" y="21" width="28" height="22" rx="5"/><path d="M16 21v-9a8 8 0 0 1 16 0v9M24 29v6"/></>,
    spark:<><path d="m24 4 6 14 14 6-14 6-6 14-6-14L4 24l14-6z"/></>,
    arrow:<path d="M7 24h33M28 12l12 12-12 12"/>,
    chat:<path d="M7 7h34v27H21L9 43V34H7zM15 17h18M15 25h12"/>,
    loop:<><path d="M39 18A17 17 0 0 0 9 12L5 18m0-12v12h12M9 30a17 17 0 0 0 30 6l4-6m0 12V30H31"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{paths[type]||paths.file}</svg>;
};

const Badge:React.FC<{children:React.ReactNode;dark?:boolean;color?:string}> = ({children,dark=false,color=palette.mint}) => <div style={{display:'inline-flex',alignItems:'center',gap:12,padding:'12px 22px',background:dark?'#FFFFFF12':color,borderRadius:50,fontSize:25,fontWeight:700,color:dark?palette.mint:palette.ink}}>{children}</div>;
const Panel:React.FC<{children:React.ReactNode;dark?:boolean;style?:React.CSSProperties}> = ({children,dark=false,style}) => <div style={{background:dark?palette.ink:palette.white,color:dark?palette.paper:palette.ink,borderRadius:32,padding:36,border:dark?'none':`1px solid ${palette.line}`,position:'relative',...style}}>{children}</div>;
const Note:React.FC<{children:React.ReactNode}> = ({children}) => <div style={{fontSize:27,color:palette.muted,textAlign:'center',marginTop:28,lineHeight:1.6}}>{children}</div>;
const Arrow:React.FC<{down?:boolean}> = ({down=false}) => <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:down?62:48,transform:down?'rotate(90deg)':undefined}}><Icon type="arrow" size={42}/></div>;
const Dot:React.FC<{color?:string}> = ({color=palette.mint}) => <span style={{width:10,height:10,borderRadius:10,display:'inline-block',background:color}}/>;
const RuleRow:React.FC<{n:string;title:string;sub:string;active?:boolean;icon?:string}> = ({n,title,sub,active=true,icon='check'}) => <Panel style={{padding:'27px 30px',display:'flex',alignItems:'center',gap:26,background:active?palette.white:palette.soft}}><span style={{fontFamily:mono,fontSize:25,color:palette.muted,minWidth:35}}>{n}</span><div style={{flex:1}}><div style={{fontSize:37,fontWeight:700,marginBottom:8}}>{title}</div><div style={{fontSize:25,color:palette.muted}}>{sub}</div></div><div style={{background:active?palette.mint:palette.line,padding:12,borderRadius:18}}><Icon type={icon} size={36}/></div></Panel>;

function Chat({repeat=false}:{repeat?:boolean}) {
  const frame=useCurrentFrame();
  const {durationInFrames}=useVideoConfig();
  const cycle=Math.floor(frame/80)%3;
  const lines=repeat?['先整理重点，标题别太长','配色统一，整套风格一致','导出之前，检查文字遮挡']:['先按我的格式来写……','对，还是上次那些要求……','这次，也请再检查一遍……'];
  return <><Panel dark style={{padding:34}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #FFFFFF25',paddingBottom:24}}><Badge dark><Dot/>和 AI 的日常</Badge><span style={{fontFamily:mono,color:'#A2B6A9',fontSize:24}}>CHAT</span></div><div style={{display:'flex',flexDirection:'column',gap:23,paddingTop:30}}>{lines.map((text,i)=><Rise delay={14+i*25} key={text}><div style={{padding:'24px 25px',borderRadius:'22px 22px 5px 22px',background:cycle===i?'#C6F39F':'#FFFFFF10',color:cycle===i?palette.ink:palette.paper,fontSize:31,fontWeight:500,marginLeft:i%2?35:0,transition:'none',display:'flex',alignItems:'center',gap:16}}><Icon type="chat" size={33} color={cycle===i?palette.ink:'#AAC1B2'}/>{text}</div></Rise>)}</div></Panel><Rise delay={80}><div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:22,marginTop:42}}><Icon type="loop" size={52}/><span style={{fontSize:35,fontWeight:700}}>{repeat?'能不能，整理好以后直接用？':'内容换了，规则又得重说。'}</span></div></Rise><div style={{height:5,margin:'28px 90px',background:palette.line,borderRadius:8,overflow:'hidden'}}><div style={{height:'100%',width:`${interpolate(frame,[0,durationInFrames],[0,100],{extrapolateRight:'clamp'})}%`,background:palette.ink}}/></div></>;
}

function Manual(){return <><Panel dark style={{padding:42,height:296,overflow:'hidden'}}><div style={{position:'absolute',width:240,height:240,border:'1px solid #C6F39F35',borderRadius:'50%',right:-40,top:-45}}/><Badge dark>可复用的任务操作手册</Badge><div style={{fontSize:123,lineHeight:1.35,fontWeight:900,letterSpacing:-5}}>SKILL<span style={{fontSize:30,color:palette.mint,marginLeft:27,letterSpacing:1}}>给 AI 的工作指南</span></div></Panel><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:18,marginTop:23}}>{[['何时用','适用场景','globe'],['怎么做','执行步骤','loop'],['怎样才算好','验收标准','check']].map(([a,b,c],i)=><Rise delay={24+i*18} key={a}><Panel style={{height:248,padding:26}}><Icon type={c} size={45}/><div style={{fontSize:a.length>4?31:36,fontWeight:700,marginTop:31}}>{a}</div><div style={{fontSize:26,color:palette.muted,marginTop:12}}>{b}</div></Panel></Rise>)}</div><Note>把零散的要求，组织成完整的做事方法。</Note></>}

function Prompt(){const frame=useCurrentFrame();return <><Panel style={{padding:42}}><Badge>最简单的形态</Badge><div style={{fontSize:39,fontWeight:700,margin:'28px 0 20px'}}>一份整理好的提示词</div><div style={{height:18,width:'91%',background:palette.soft,borderRadius:9,marginBottom:16}}/><div style={{height:18,width:'78%',background:palette.soft,borderRadius:9,marginBottom:16}}/><div style={{height:18,width:'62%',background:palette.soft,borderRadius:9}}/></Panel><Arrow down/><Rise delay={45}><Panel dark style={{padding:39,display:'flex',alignItems:'center',gap:35}}><div style={{transform:`rotate(${Math.sin(frame/50)*3}deg)`,background:palette.mint,padding:26,borderRadius:24}}><Icon type="folder" size={72}/></div><div><div style={{fontSize:51,fontWeight:700}}>Skill</div><div style={{fontSize:29,color:'#B9C8BF',marginTop:12}}>但它还可以不止于此。</div></div></Panel></Rise><Note>不只保存要求，也可以组织方法与材料。</Note></>}

function Package(){const items=[['核心说明','何时用、怎么做','file'],['参考资料','领域知识与范例','file'],['设计模板','可复用的版式','folder'],['执行脚本','按需处理文件','code']];return <><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:22}}>{items.map(([title,sub,icon],i)=><Rise key={title} delay={i*17}><Panel dark={i===0} style={{height:246,padding:30}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><Icon type={icon} size={44} color={i===0?palette.mint:palette.ink}/><span style={{fontSize:19,fontFamily:mono,color:i===0?'#ADC5B3':palette.muted}}>{i===0?'CORE':'OPTIONAL'}</span></div><div style={{fontSize:36,fontWeight:700,marginTop:25}}>{title}</div><div style={{fontSize:25,color:i===0?'#BFCFC5':palette.muted,marginTop:11}}>{sub}</div></Panel></Rise>)}</div><Rise delay={70}><div style={{marginTop:30,padding:'23px 28px',border:`1px solid ${palette.coral}`,borderRadius:18,fontSize:27,textAlign:'center'}}>不是重新训练模型，也不保证永远不出错。</div></Rise></>}

function Criteria(){return <><div style={{display:'flex',gap:16,flexDirection:'column'}}>{[['01','经常要做','不是只出现一次的临时问题'],['02','方法稳定','不同内容，处理步骤有共性'],['03','好坏可检查','知道什么样的结果才算合格']].map(([n,title,sub],i)=><Rise key={n} delay={i*22}><RuleRow n={n} title={title} sub={sub}/></Rise>)}</div><div style={{marginTop:30,textAlign:'center'}}><Badge color={palette.coral}>先找重复任务，再考虑做成技能。</Badge></div></>}

function Cases(){return <><div style={{display:'flex',gap:18,flexDirection:'column'}}>{[['周报','固定格式，换一周内容','file'],['代码检查','团队规范，换一份代码','code'],['图文制作','统一风格，换一个选题','folder']].map(([a,b,c],i)=><Rise key={a} delay={i*22}><Panel style={{display:'flex',alignItems:'center',gap:30,padding:29}}><div style={{background:palette.soft,borderRadius:21,padding:20}}><Icon type={c} size={43}/></div><div><div style={{fontSize:38,fontWeight:700}}>{a}</div><div style={{fontSize:27,color:palette.muted,marginTop:10}}>{b}</div></div></Panel></Rise>)}</div><Note>输入可以不同，方法可以相同。</Note></>}

function Dinner(){return <><Panel dark style={{height:370,padding:42}}><Badge dark>一个临时问题</Badge><div style={{fontSize:57,fontWeight:700,marginTop:58}}>今天晚饭吃什么？</div><div style={{fontSize:28,color:'#B9CEC0',marginTop:30}}>偶尔问一次，不需要完整工作流。</div></Panel><Rise delay={35}><div style={{marginTop:30,padding:'32px 40px',borderRadius:26,background:palette.coral,display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:41,fontWeight:700}}>直接问，就好。</span><Icon type="chat" size={52}/></div></Rise><Note>Skill 不是每个问题的必选项。</Note></>}

function Tools(){return <><Panel dark style={{padding:33}}><Badge dark>在手册里写了</Badge><div style={{fontSize:43,fontWeight:700,marginTop:28,marginBottom:8}}>“帮我操作浏览器”</div></Panel><div style={{textAlign:'center',fontSize:61,fontWeight:700,color:'#A24C37',lineHeight:1.6}}>≠</div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:22}}>{[['工具','真正执行操作','globe'],['权限','允许访问资源','lock']].map(([a,b,c],i)=><Rise delay={25+i*18} key={a}><Panel style={{padding:32,height:239}}><Icon type={c} size={49}/><div style={{fontSize:39,fontWeight:700,marginTop:23}}>{a}</div><div style={{fontSize:26,color:palette.muted,marginTop:10}}>{b}</div></Panel></Rise>)}</div><Note>方法写得再清楚，也不能凭空变出工具。</Note></>}

function Process(){return <><Panel dark style={{padding:43}}><Badge dark>别从一大堆规则开始</Badge><div style={{fontSize:51,fontWeight:700,marginTop:38}}>拿一个真实任务</div><div style={{display:'flex',gap:14,alignItems:'center',fontSize:28,color:'#C1CFC6',marginTop:24}}><Icon type="spark" size={33} color={palette.mint}/>和 AI 配合，先跑通一次</div></Panel><Arrow down/><div style={{display:'flex',gap:20}}>{[['01','做出结果'],['02','调整满意'],['03','提炼方法']].map(([n,t],i)=><Rise delay={20+i*20} key={n} style={{flex:1}}><Panel style={{padding:26,height:182}}><div style={{fontFamily:mono,fontSize:24,color:palette.muted}}>{n}</div><div style={{fontSize:32,fontWeight:700,marginTop:28}}>{t}</div></Panel></Rise>)}</div><Note>先验证，再把经验写进技能。</Note></>}

function Refine(){return <><div style={{display:'flex',gap:22}}><Panel style={{flex:1,padding:28,height:343}}><Badge color={palette.soft}>调整前</Badge><div style={{fontSize:31,fontWeight:700,lineHeight:1.4,marginTop:27}}>标题太长<br/>一页太挤</div><div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:30}}>{Array.from({length:12},(_,i)=><div key={i} style={{height:12,width:i%3===0?'83%':'43%',background:palette.line,borderRadius:5}}/>)}</div></Panel><Panel dark style={{flex:1,padding:28,height:343}}><Badge dark>调整后</Badge><div style={{fontSize:31,fontWeight:700,lineHeight:1.4,marginTop:27}}>精简标题<br/>拆开层次</div><div style={{display:'flex',gap:15,marginTop:30}}>{[1,2].map(i=><div key={i} style={{width:93,height:86,borderRadius:12,background:palette.mint,padding:13}}><div style={{height:9,background:palette.ink,width:'80%',borderRadius:5}}/><div style={{height:5,background:'#14282355',width:'70%',marginTop:12}}/><div style={{height:5,background:'#14282355',width:'85%',marginTop:10}}/></div>)}</div></Panel></div><Rise delay={36}><Panel style={{marginTop:26,padding:30}}><div style={{fontSize:35,fontWeight:700,marginBottom:16}}>总结两件事</div><div style={{display:'flex',gap:15,fontSize:27}}><Badge>哪些做法有效？</Badge><Badge color={palette.coral}>哪些错误要避开？</Badge></div></Panel></Rise></>}

function Request(){return <><Panel dark style={{padding:41}}><div style={{fontFamily:mono,fontSize:22,color:'#AFCCB9',letterSpacing:2}}>PROMPT / 可以这样说</div><div style={{fontSize:42,fontWeight:500,lineHeight:1.75,marginTop:28}}>帮我把刚才确认的<br/><span style={{color:palette.mint}}>流程和要求</span>，整理成<br/>一个可复用的 Skill。</div><div style={{height:1,background:'#FFFFFF25',margin:'30px 0'}}/><div style={{fontSize:32,lineHeight:1.8,color:'#C7D9CB'}}>分清通用规则，<br/>和只属于这次的内容。</div></Panel><Note>提炼方法，不是把整段聊天原样塞进去。</Note></>}

function Files(){return <><Panel dark style={{padding:37}}><div style={{display:'flex',alignItems:'center',gap:18,borderBottom:'1px solid #FFFFFF25',paddingBottom:27}}><Icon type="folder" color={palette.mint}/><span style={{fontSize:34,fontFamily:mono}}>my-skill/</span></div><div style={{paddingTop:25,display:'flex',flexDirection:'column',gap:15}}>{[['SKILL.md','核心说明','file'],['assets/','模板与素材','folder'],['references/','参考资料','file'],['scripts/','执行脚本','code']].map(([name,label,icon],i)=><Rise delay={i*18} key={name}><div style={{display:'flex',alignItems:'center',gap:18,padding:'23px 19px',borderRadius:16,background:i===0?'#C6F39F':'#FFFFFF0A',color:i===0?palette.ink:'#DFE8E0'}}><Icon type={icon} size={32} color={i===0?palette.ink:'#AAC5B5'}/><span style={{fontSize:30,fontFamily:mono,flex:1}}>{name}</span><span style={{fontSize:24}}>{label}</span></div></Rise>)}</div></Panel><Note>示意结构：除核心说明外，其余按需添加。</Note></>}

function Test(){return <><div style={{display:'flex',gap:22}}>{[['资料 A','已经做满意'],['新资料 B','再跑一次试试']].map(([a,b],i)=><Rise delay={i*30} key={a} style={{flex:1}}><Panel dark={i===1} style={{height:312,padding:32}}><Icon type={i===1?'loop':'check'} size={53} color={i===1?palette.mint:palette.ink}/><div style={{fontSize:43,fontWeight:700,marginTop:35}}>{a}</div><div style={{fontSize:27,color:i===1?'#B9CDBC':palette.muted,marginTop:16}}>{b}</div></Panel></Rise>)}</div><Arrow down/><Panel style={{padding:30}}><div style={{fontSize:37,fontWeight:700,marginBottom:18}}>换个例子，还能做好吗？</div><div style={{fontSize:28,color:palette.muted,lineHeight:1.65}}>检查有没有把上一次的特殊条件，<br/>误当成每次都要遵守的规则。</div></Panel></>}

function Install(){return <><div style={{display:'flex',flexDirection:'column',gap:20}}>{[['01','确认宿主支持','不是每个 AI 工具都支持这类 Skill','check'],['02','按要求安装或导入','入口和目录，以所用软件为准','folder'],['03','带着新资料调用','用真实任务验证效果','spark']].map(([n,title,sub,icon],i)=><Rise delay={i*25} key={n}><RuleRow n={n} title={title} sub={sub} icon={icon}/></Rise>)}</div><Note>这里展示通用流程，不冒充具体软件界面。</Note></>}

function Invoke(){return <><Panel dark style={{padding:40}}><Badge dark>明确点名调用</Badge><div style={{fontSize:45,lineHeight:1.6,fontWeight:700,marginTop:31}}>用这个技能，<br/>帮我处理这份资料。</div></Panel><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:22,marginTop:25}}><Rise delay={25}><Panel style={{padding:28,height:212}}><Icon type="spark" size={38}/><div style={{fontSize:32,fontWeight:700,marginTop:20}}>也可能自动选用</div><div style={{fontSize:25,color:palette.muted,marginTop:12}}>取决于宿主的实现</div></Panel></Rise><Rise delay={40}><Panel style={{padding:28,height:212}}><Icon type="globe" size={38}/><div style={{fontSize:32,fontWeight:700,marginTop:20}}>跨平台可能要适配</div><div style={{fontSize:25,color:palette.muted,marginTop:12}}>工具、脚本与环境</div></Panel></Rise></div><Note>能读取说明，不等于整套流程能直接运行。</Note></>}

function Summary(){return <><Panel dark style={{padding:43}}><Badge dark>SKILL 的价值</Badge><div style={{fontSize:67,fontWeight:900,lineHeight:1.5,marginTop:33}}>验证过的方法<br/><span style={{color:palette.mint}}>更方便地复用。</span></div><div style={{fontSize:28,color:'#BCD0C0',marginTop:25}}>不是凭空获得超能力。</div></Panel><div style={{display:'flex',gap:16,marginTop:27}}>{['明确场景','写清方法','准备材料','换例测试'].map((t,i)=><Rise delay={i*14} key={t} style={{flex:1}}><div style={{textAlign:'center',padding:'23px 8px',background:palette.white,border:`1px solid ${palette.line}`,borderRadius:18,fontSize:27,fontWeight:700}}>{t}</div></Rise>)}</div></>}

function Question(){const frame=useCurrentFrame();return <><Panel dark style={{padding:45,overflow:'hidden'}}><div style={{position:'absolute',right:28,top:6,fontFamily:mono,fontSize:250,lineHeight:1,color:'#C6F39F0D',transform:`rotate(${Math.sin(frame/70)*5}deg)`}}>?</div><Badge dark>从你自己的任务开始</Badge><div style={{fontSize:48,fontWeight:700,lineHeight:1.7,marginTop:44,position:'relative'}}>哪件事，<br/>你总在反复交代？</div><div style={{height:1,background:'#FFFFFF25',margin:'33px 0'}}/><div style={{fontSize:28,color:'#BBD0C0',lineHeight:1.7}}>它可能就是你第一个 Skill<br/>最好的起点。</div></Panel><div style={{marginTop:29,display:'flex',justifyContent:'center',gap:14}}>{['写周报','做图文','检查代码'].map(t=><Badge key={t} color={palette.soft}>{t}</Badge>)}</div></>}

export const Visual:React.FC<{kind:string}> = ({kind}) => {
  switch(kind){
    case 'chat':return <Chat/>;
    case 'repeat':return <Chat repeat/>;
    case 'manual':return <Manual/>;
    case 'prompt':return <Prompt/>;
    case 'package':return <Package/>;
    case 'criteria':return <Criteria/>;
    case 'cases':return <Cases/>;
    case 'dinner':return <Dinner/>;
    case 'tools':return <Tools/>;
    case 'process':return <Process/>;
    case 'refine':return <Refine/>;
    case 'request':return <Request/>;
    case 'files':return <Files/>;
    case 'test':return <Test/>;
    case 'install':return <Install/>;
    case 'invoke':return <Invoke/>;
    case 'summary':return <Summary/>;
    case 'question':return <Question/>;
    default:throw new Error(`Unknown visual: ${kind}`);
  }
};
