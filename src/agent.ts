import {query,type Options} from "@anthropic-ai/claude-agent-sdk";
import {mkdir,writeFile,readFile} from "node:fs/promises";
import {resolve,relative} from "node:path";
import {fileURLToPath} from "node:url";
import {randomUUID,createHash} from "node:crypto";
import type {RunConfig,Mode,LabEvent} from "./protocol.js";
export type {RunConfig,LabEvent} from "./protocol.js";
export const ROOT=fileURLToPath(new URL("../",import.meta.url));
export const MODEL=process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
export const DEFAULT_CONFIG:RunConfig={mode:"all"};
export const MODES:Mode[]=["all","omitted","allow-one","none","no-source","slash","invalid"];
export const MARKERS=["CATALOG-SKILL-17","API-SKILL-17"];
export const PROMPTS={
 summary:"Summarize catalog.md using the classroom catalogue-summary workflow. If a matching skill is available to the Skill tool, invoke it before reading the data. Otherwise give a plain two-bullet summary. Never fetch SKILL.md using Read, run commands, edit files or claim tests ran.",
 plain:"Read catalog.md and summarize its facts in two short bullets. Do not invoke skills, read instruction files, edit anything, run commands or claim tests ran.",
 slash:"/api-review Review catalog.md briefly; do not edit files or run commands.",
};
export const CATALOG_SKILL=`---
name: catalog-summary
description: Use for the classroom catalogue-summary workflow to summarize catalog.md facts and category counts.
---
Read catalog.md. Give two brief bullets with the category counts.
Include the exact line CATALOG-SKILL-17 once.
Do not edit files, run commands or claim tests ran.
`;
export const API_SKILL=`---
name: api-review
description: Use for a classroom API access-policy review of catalog.md, not for a category-count summary.
---
Read catalog.md and give two brief API access-policy observations.
Include the exact line API-SKILL-17 once.
Do not edit files, run commands or claim tests ran.
`;
export function validateConfig(value:unknown):RunConfig {
 if(!value || typeof value!=="object" || Array.isArray(value))throw new Error("Send a skill experiment.");
 const v=value as RunConfig;if(!MODES.includes(v.mode))throw new Error("Choose a listed skill experiment.");
 return {mode:v.mode};
}
export function skillSelection(mode:Mode):Options["skills"] {
 if(mode==="omitted")return undefined;
 if(mode==="allow-one" || mode==="slash")return ["catalog-summary"];
 if(mode==="none")return [];
 if(mode==="invalid")return ["*"];
 return "all";
}
export function directories(c:RunConfig,id:string) {
 const root=resolve(ROOT,".runtime",c.mode,id);
 return {cwd:resolve(root,"project"),home:resolve(root,"home"),sdkHome:resolve(root,"sdk-home")};
}
export async function prepareWorkspace(c:RunConfig,id:string) {
 const d=directories(c,id);
 for(const dir of [d.home,d.sdkHome,resolve(d.cwd,".claude/skills/catalog-summary"),resolve(d.cwd,".claude/skills/api-review")])await mkdir(dir,{recursive:true});
 const files=[
  {name:"project/.claude/skills/catalog-summary/SKILL.md",path:resolve(d.cwd,".claude/skills/catalog-summary/SKILL.md"),contents:CATALOG_SKILL},
  {name:"project/.claude/skills/api-review/SKILL.md",path:resolve(d.cwd,".claude/skills/api-review/SKILL.md"),contents:API_SKILL},
 ];
 for(const file of files)await writeFile(file.path,file.contents);
 await writeFile(resolve(d.cwd,"catalog.md"),"# Classroom catalogue\nBooks: 3 items.\nStationery: 2 items.\nThe catalogue API is read-only and public in this classroom example.\nChanges belong to a separate authenticated admin service.\n");
 return files;
}
export function toolAllowed(cwd:string,name:string,input:Record<string,unknown>) {
 if(name==="Skill")return ["catalog-summary","api-review"].includes(String(input.skill));
 return name==="Read" && typeof input.file_path==="string"
  && resolve(cwd,input.file_path).toLowerCase()===resolve(cwd,"catalog.md").toLowerCase();
}
export function lessonOptions(c:RunConfig,id:string,readPaths:string[],skillCalls:string[],controller=new AbortController()):Options {
 const d=directories(c,id),selected=skillSelection(c.mode),env={...process.env};
 for(const key of ["CLAUDE_CODE_DISABLE_CLAUDE_MDS","CLAUDE_CODE_DISABLE_ATTACHMENTS","OTEL_LOG_RAW_API_BODIES"])delete env[key];
 return {
  model:MODEL,cwd:d.cwd,env:{...env,HOME:d.home,USERPROFILE:d.home,CLAUDE_CONFIG_DIR:d.sdkHome,
   CLAUDE_CODE_DISABLE_AUTO_MEMORY:"1",ENABLE_CLAUDEAI_MCP_SERVERS:"false"},
  settingSources:c.mode==="no-source" ? [] : ["project"],
  ...(selected===undefined ? {} : {skills:selected}),
  tools:["Read","Skill"],allowedTools:["Read","Skill"],
  disallowedTools:["Bash","Edit","Write","WebFetch","WebSearch"],
  systemPrompt:{type:"preset",preset:"claude_code",append:"This is a read-only skills classroom. Use the matching Skill tool workflow when available, then only Read catalog.md. Never fetch instruction files using Read. Keep answers brief and never claim tests ran."},
  strictMcpConfig:true,mcpServers:{},plugins:[],persistSession:false,
  effort:"low",thinking:{type:"disabled"},maxTurns:7,maxBudgetUsd:0.3,abortController:controller,
  hooks:{
   PreToolUse:[{hooks:[async input=>{
    if(input.hook_event_name==="PreToolUse" && !toolAllowed(d.cwd,input.tool_name,input.tool_input as Record<string,unknown>))
     return {hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:"Only the two classroom Skill names and catalog.md Read are supported."}};
    return {};
   }]}],
   PostToolUse:[{hooks:[async input=>{
    if(input.hook_event_name==="PostToolUse") {
     const v=input.tool_input as Record<string,unknown>;
     if(input.tool_name==="Read")readPaths.push(relative(d.cwd,resolve(d.cwd,String(v.file_path))).replaceAll("\\","/"));
     if(input.tool_name==="Skill")skillCalls.push(String(v.skill));
    }
    return {};
   }]}],
  },canUseTool:async()=>({behavior:"deny",message:"Only pre-approved guarded classroom calls are supported."}),
 };
}
export function redact(text:string) {
 const key=process.env.ANTHROPIC_API_KEY;
 return (key ? text.split(key).join("[REDACTED]") : text).replace(/sk-ant-[A-Za-z0-9_-]{16,}/g,"[REDACTED]").slice(0,16000);
}
export async function runAgent(c:RunConfig,emit:(e:LabEvent)=>void,controller=new AbortController()) {
 c=validateConfig(c);const id=randomUUID(),files=await prepareWorkspace(c,id);
 const digest=(s:string)=>createHash("sha256").update(s).digest("hex"),before=files.map(f=>digest(f.contents));
 const readPaths:string[]=[],skillCalls:string[]=[],options=lessonOptions(c,id,readPaths,skillCalls,controller);
 emit({type:"fixtures",files:files.map(({name,contents})=>({name,contents}))});
 emit({type:"options",config:c,options:{model:MODEL,settingSources:options.settingSources,
  skills:Object.hasOwn(options,"skills") ? options.skills : "omitted · discovered skills enabled",tools:options.tools,allowedTools:options.allowedTools,cwd:"owned project"}});
 let text="",initSkills:string[]=[],started=false,gotResult=false,rejected=false;
 const prompt=c.mode==="slash" ? PROMPTS.slash : ["none","no-source"].includes(c.mode) ? PROMPTS.plain : PROMPTS.summary;
 try {
  const run=query({prompt,options});
  try {
   for await(const message of run) {
    emit({type:"message",sdkType:message.type,summary:"subtype" in message ? String(message.subtype) : "Actual SDK message"});
    if(message.type==="system" && message.subtype==="init") {
     started=true;initSkills=message.skills;
     emit({type:"initialized",model:message.model,sessionId:message.session_id,skills:message.skills,tools:message.tools,slashCommands:message.slash_commands});
    }
    if(message.type==="assistant")for(const block of message.message.content) {
     if(block.type==="text")emit({type:"answer",text:redact(block.text)});
     if(block.type==="tool_use") {const input=block.input as Record<string,unknown>;emit({type:"tool",name:block.name,target:String(block.name==="Skill" ? input.skill : "catalog.md")});}
    }
    if(message.type==="result") {
     gotResult=true;text=redact(message.subtype==="success" ? message.result : message.errors.join("\n"));
     emit({type:"result",status:message.subtype==="success" && message.is_error ? "error" : message.subtype,text,sessionId:message.session_id,costUsd:message.total_cost_usd});
    }
   }
   if(!gotResult)throw new Error("No typed SDK result received.");
  }finally{run.close();}
 }catch(error) {
  if(c.mode!=="invalid" || started || !/skill|wildcard/i.test(String(error)))throw error;
  rejected=true;
  emit({type:"rejected",stage:"SDK option validation before init",text:redact(error instanceof Error ? error.message : String(error))});
 }
 const savedFilesUnchanged=(await Promise.all(files.map(async(f,i)=>digest(await readFile(f.path,"utf8"))===before[i]))).every(Boolean);
 emit({type:"evidence",mode:c.mode,initSkills,readPaths,skillCalls,returnedMarkers:MARKERS.filter(m=>text.includes(m)),sdkRejectedBeforeInit:rejected,savedFilesUnchanged,dispatchPrompt:c.mode==="slash"});
}
